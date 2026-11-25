import type { Bot, Context } from 'grammy';
import { prisma } from '../../db/client.js';
import { logger } from '../../lib/logger.js';
import { buildAltQuery, findImagesForProduct } from '../../services/images/find.js';
import { applyReview } from '../../services/products/review.js';
import { canReview, isReviewAction } from '../../services/products/transitions.js';
import { createDraft } from '../../services/listings/draft.js';
import { queueForPosting } from '../../services/posting/queue.js';
import { draftKeyboard, parseCallback } from '../keyboards.js';
import { formatPreview } from '../preview.js';
import { searchInfo, sendAlbum } from './album.js';

// Tugma ikki marta bosilsa, bir vaqtda ikkita qidiruv ketmasin.
const retrying = new Set<number>();

async function handleRetry(ctx: Context, productId: number) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, model: true, status: true },
  });
  if (!product || !canReview(product.status, 'retry')) {
    return void (await ctx.answerCallbackQuery({ text: 'Bu mahsulot uchun endi mumkin emas' }));
  }
  if (retrying.has(productId)) {
    return void (await ctx.answerCallbackQuery({ text: 'Qidiryapman, kuting...' }));
  }
  retrying.add(productId);
  await ctx.answerCallbackQuery({ text: 'Boshqa rasm qidiryapman...' });

  try {
    const previous = await prisma.productImage.findMany({
      where: { productId, source: 'SEARCH' },
      select: { sourceUrl: true },
    });
    const attempt = await prisma.eventLog.count({
      where: { type: 'IMAGES_FOUND', entityType: 'Product', entityId: productId },
    });
    const result = await findImagesForProduct(productId, {
      query: buildAltQuery(product.model, attempt),
      exclude: new Set(previous.flatMap((p) => (p.sourceUrl ? [p.sourceUrl] : []))),
      keepExisting: true,
    });

    if (result.files.length === 0) {
      return void (await ctx.reply(
        `#${productId}: boshqa rasm topilmadi, oldingilari qoldi (so'rov: "${result.query}").`,
      ));
    }
    await ctx.editMessageText(`🔄 #${productId}: yangi rasmlar yuborildi.`);
    await sendAlbum(
      ctx.api,
      ctx.from!.id,
      product,
      result.files,
      searchInfo(result.query, result.files.length, result.tried),
    );
  } catch (err) {
    logger.error({ err, productId }, 'Qayta qidirishda xato');
    await ctx.reply(
      `#${productId}: qidirishda xato: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    retrying.delete(productId);
  }
}

const QUEUE_REASONS = {
  not_approved: 'rasmlari tasdiqlanmagan yoki mahsulot holati mos emas',
  no_draft: "qoralama yo'q (/draft bilan yarating)",
  already_queued: 'allaqachon navbatda',
} as const;

const rewriting = new Set<number>();

async function handleDraftAction(ctx: Context, action: 'queue' | 'rewrite', productId: number) {
  if (action === 'queue') {
    await ctx.answerCallbackQuery();
    const res = await queueForPosting(productId);
    return void (await ctx.editMessageText(
      res.ok
        ? `🚀 #${productId} navbatga qo'shildi. Eslatma: joylash dasturi hali ulanmagan, hozircha e'lon joylanmaydi.`
        : `#${productId}: navbatga qo'yib bo'lmadi, ${QUEUE_REASONS[res.reason]}.`,
    ));
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { status: true },
  });
  if (product?.status !== 'APPROVED') {
    return void (await ctx.answerCallbackQuery({ text: 'Bu mahsulot uchun endi mumkin emas' }));
  }
  if (rewriting.has(productId)) {
    return void (await ctx.answerCallbackQuery({ text: 'Yozyapman, kuting...' }));
  }
  rewriting.add(productId);
  await ctx.answerCallbackQuery({ text: 'Qayta yozyapman...' });
  try {
    const { listing, price, ai } = await createDraft(productId);
    await ctx.editMessageText(
      formatPreview({
        productId,
        title: listing.title,
        description: listing.description,
        olxCategory: listing.olxCategory,
        price,
        ai,
      }),
      { reply_markup: draftKeyboard(productId) },
    );
  } catch (err) {
    logger.error({ err, productId }, 'Qayta yozishda xato');
    await ctx.reply(
      `#${productId}: qayta yozib bo'lmadi: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    rewriting.delete(productId);
  }
}

export function registerCallbacks(bot: Bot) {
  bot.on('callback_query:data', async (ctx) => {
    const parsed = parseCallback(ctx.callbackQuery.data);
    if (parsed && (parsed.action === 'queue' || parsed.action === 'rewrite')) {
      logger.info(parsed, 'Callback');
      return handleDraftAction(ctx, parsed.action, parsed.productId);
    }
    if (!parsed || !isReviewAction(parsed.action)) return void (await ctx.answerCallbackQuery());
    const { action, productId } = parsed;
    logger.info(parsed, 'Callback');

    if (action === 'retry') return handleRetry(ctx, productId);

    await ctx.answerCallbackQuery();
    const res = await applyReview(productId, action);
    const text = res.ok
      ? action === 'approve'
        ? `✅ #${productId} tasdiqlandi.`
        : `⏭ #${productId} o'tkazib yuborildi.`
      : `#${productId}: hozirgi holati ${res.status ?? 'topilmadi'}, o'zgarmadi.`;
    // Matn almashganda tugmalar ham yo'qoladi: ikkinchi marta bosib bo'lmaydi.
    await ctx.editMessageText(text);
  });
}
