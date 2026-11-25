import { access } from 'node:fs/promises';
import type { Bot } from 'grammy';
import { prisma } from '../../db/client.js';
import { logger } from '../../lib/logger.js';
import { sendAlbum } from '../handlers/album.js';

const DEFAULT_COUNT = 3;
const MAX_COUNT = 10;

const exists = (file: string) =>
  access(file).then(
    () => true,
    () => false,
  );

export function registerReviewCommand(bot: Bot) {
  // /review [soni]: rasmi topilgan, lekin hali tasdiqlanmagan mahsulotlarni tugmalar bilan qayta ko'rsatadi.
  bot.command('review', async (ctx) => {
    const requested = Number.parseInt(ctx.match, 10);
    const count = Math.min(
      Math.max(Number.isNaN(requested) ? DEFAULT_COUNT : requested, 1),
      MAX_COUNT,
    );

    const products = await prisma.product.findMany({
      where: { status: 'IMAGES_FOUND' },
      orderBy: { id: 'asc' },
      take: count,
      include: { images: { where: { selected: true }, orderBy: { id: 'asc' } } },
    });
    if (products.length === 0) {
      return void (await ctx.reply("Tasdiqlanadigan mahsulot yo'q."));
    }

    let shown = 0;
    for (const p of products) {
      try {
        const candidates = p.images.flatMap((i) => (i.localPath ? [i.localPath] : []));
        const files = (
          await Promise.all(candidates.map(async (f) => ((await exists(f)) ? f : null)))
        ).filter((f): f is string => f !== null);
        if (
          await sendAlbum(ctx.api, ctx.chat.id, p, files, `Saqlangan rasmlar: ${files.length} ta`)
        ) {
          shown++;
        } else {
          await ctx.reply(
            `#${p.id} ${p.model}\nRasm fayllari topilmadi. /images bilan qayta qidiring.`,
          );
        }
      } catch (err) {
        logger.error({ err, productId: p.id }, "Ko'rsatishda xato");
        await ctx.reply(`#${p.id}: ko'rsatib bo'lmadi.`);
      }
    }

    const left = await prisma.product.count({ where: { status: 'IMAGES_FOUND' } });
    await ctx.reply(`Ko'rsatildi: ${shown}. Tasdiqlanishi kutilayotgan jami: ${left}.`);
  });
}
