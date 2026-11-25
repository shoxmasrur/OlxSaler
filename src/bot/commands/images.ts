import type { Bot } from 'grammy';
import { InputFile, InputMediaBuilder } from 'grammy';
import pLimit from 'p-limit';
import { prisma } from '../../db/client.js';
import { logger } from '../../lib/logger.js';
import { findImagesForProduct, type FindResult } from '../../services/images/find.js';

const DEFAULT_COUNT = 3;
const MAX_COUNT = 10;
const MAX_TRIES = 2;

type Outcome =
  { id: number; model: string; result: FindResult } | { id: number; model: string; error: string };

export function registerImageCommand(bot: Bot) {
  // /images [soni]: rasmi yo'q (IMPORTED) mahsulotlar uchun Brave orqali rasm topadi.
  bot.command('images', async (ctx) => {
    const requested = Number.parseInt(ctx.match, 10);
    const count = Math.min(
      Math.max(Number.isNaN(requested) ? DEFAULT_COUNT : requested, 1),
      MAX_COUNT,
    );

    // Rasm 2 marta topilmagan mahsulot navbatni to'smasin va Brave kreditini yemasin.
    const failed = await prisma.eventLog.groupBy({
      by: ['entityId'],
      where: { type: 'IMAGES_NOT_FOUND', entityType: 'Product' },
      _count: { _all: true },
    });
    const giveUp = failed
      .filter((f) => f.entityId !== null && f._count._all >= MAX_TRIES)
      .map((f) => f.entityId as number);

    const products = await prisma.product.findMany({
      where: { status: 'IMPORTED', id: { notIn: giveUp } },
      orderBy: { id: 'asc' },
      take: count,
    });
    const skipped = await prisma.product.count({
      where: { status: 'IMPORTED', id: { in: giveUp } },
    });
    if (skipped > 0) {
      await ctx.reply(
        `${skipped} ta mahsulot uchun rasm ${MAX_TRIES} marta topilmadi, ular o'tkazib yuboriladi (rasmni o'zingiz qo'shishingiz kerak).`,
      );
    }
    if (products.length === 0) {
      return void (await ctx.reply("Rasm qidiriladigan mahsulot yo'q (hammasi qayta ishlangan)."));
    }
    await ctx.reply(`${products.length} ta mahsulot uchun rasm qidiryapman...`);

    const limit = pLimit(3);
    const outcomes: Outcome[] = await Promise.all(
      products.map((p) =>
        limit(async (): Promise<Outcome> => {
          try {
            return { id: p.id, model: p.model, result: await findImagesForProduct(p.id) };
          } catch (err) {
            logger.error({ err, productId: p.id }, 'Rasm qidirishda xato');
            return {
              id: p.id,
              model: p.model,
              error: err instanceof Error ? err.message : String(err),
            };
          }
        }),
      ),
    );

    let ok = 0;
    for (const o of outcomes) {
      const title = `#${o.id} ${o.model}`.slice(0, 200);
      if ('error' in o) {
        await ctx.reply(`${title}\nXato: ${o.error}`);
        continue;
      }
      const { files, query, tried, rejected } = o.result;
      if (files.length === 0) {
        const why =
          Object.entries(rejected)
            .map(([k, n]) => `${k}: ${n}`)
            .join(', ') || "natija yo'q";
        await ctx.reply(`${title}\nRasm topilmadi (so'rov: "${query}"; ${why}).`);
        continue;
      }
      ok++;
      const caption = `${title}\nSo'rov: "${query}" (${files.length} ta rasm, ${tried} ta urinish)`;
      if (files.length === 1) {
        await ctx.replyWithPhoto(new InputFile(files[0]!), { caption });
      } else {
        await ctx.replyWithMediaGroup(
          files.map((f, i) =>
            InputMediaBuilder.photo(new InputFile(f), i === 0 ? { caption } : undefined),
          ),
        );
      }
    }
    await ctx.reply(`Tayyor: ${ok}/${products.length} ta mahsulotga rasm topildi.`);
  });
}
