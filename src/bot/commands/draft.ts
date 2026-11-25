import type { Bot } from 'grammy';
import { prisma } from '../../db/client.js';
import { logger } from '../../lib/logger.js';
import { createDraft } from '../../services/listings/draft.js';
import { ACTIVE_JOB_STATUSES } from '../../services/posting/jobs.js';
import { draftKeyboard } from '../keyboards.js';
import { formatPreview } from '../preview.js';

const DEFAULT_COUNT = 2;
const MAX_COUNT = 5;

export function registerDraftCommand(bot: Bot) {
  // /draft [soni]: rasmi tasdiqlangan (APPROVED), hali navbatga qo'yilmagan mahsulotlarga
  // e'lon qoralamasi tayyorlaydi va yakuniy tasdiq uchun ko'rsatadi.
  bot.command('draft', async (ctx) => {
    const requested = Number.parseInt(ctx.match, 10);
    const count = Math.min(
      Math.max(Number.isNaN(requested) ? DEFAULT_COUNT : requested, 1),
      MAX_COUNT,
    );

    const products = await prisma.product.findMany({
      where: { status: 'APPROVED', jobs: { none: { status: { in: ACTIVE_JOB_STATUSES } } } },
      orderBy: { id: 'asc' },
      take: count,
      select: { id: true },
    });
    if (products.length === 0) {
      return void (await ctx.reply(
        "Qoralama uchun tasdiqlangan mahsulot yo'q. Avval /review bilan rasmlarni tasdiqlang.",
      ));
    }
    await ctx.reply(`${products.length} ta qoralama tayyorlayapman...`);

    // Ketma-ket: Claude API'ga bir vaqtda ko'p so'rov yubormaymiz.
    for (const { id } of products) {
      try {
        const { listing, price, ai } = await createDraft(id);
        await ctx.reply(
          formatPreview({
            productId: id,
            title: listing.title,
            description: listing.description,
            olxCategory: listing.olxCategory,
            price,
            ai,
          }),
          { reply_markup: draftKeyboard(id) },
        );
      } catch (err) {
        logger.error({ err, productId: id }, 'Qoralama yaratishda xato');
        await ctx.reply(
          `#${id}: qoralama yaratib bo'lmadi: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  });
}
