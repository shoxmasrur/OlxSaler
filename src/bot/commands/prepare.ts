import type { Bot } from 'grammy';
import { nextToPrepare, prepareProduct } from '../../services/posting/prepare.js';

const DEFAULT_COUNT = 10;
const MAX_COUNT = 30;

// Bir vaqtda ikkita /prepare ishlamasin (Brave va Claude so'rovlari ikkilanmasin).
let running = false;

export function registerPrepareCommand(bot: Bot) {
  // /prepare [soni]: keyingi mahsulotlar uchun rasm qidiradi, tasdiqlaydi, qoralama yaratadi va
  // navbatga qo'yadi. Joylash oldidan har e'lon uchun yakuniy tasdiq baribir so'raladi.
  bot.command('prepare', async (ctx) => {
    if (running) return void (await ctx.reply('Tayyorlash allaqachon ketyapti, kuting.'));

    const requested = Number.parseInt(ctx.match, 10);
    const count = Math.min(
      Math.max(Number.isNaN(requested) ? DEFAULT_COUNT : requested, 1),
      MAX_COUNT,
    );
    const products = await nextToPrepare(count);
    if (products.length === 0) {
      return void (await ctx.reply('Tayyorlanadigan mahsulot qolmadi.'));
    }

    running = true;
    try {
      await ctx.reply(
        `${products.length} ta mahsulotni navbatga tayyorlayapman (rasm, qoralama). Bu bir necha daqiqa oladi...`,
      );
      let ok = 0;
      const failed: string[] = [];
      // Ketma-ket: Brave va Claude'ga ortiqcha yuk tushmasin.
      for (const p of products) {
        const res = await prepareProduct(p.id);
        if (res.ok) ok++;
        else failed.push(`#${p.id} (${res.step ?? 'xato'}: ${res.message ?? ''})`.slice(0, 160));
      }
      await ctx.reply(
        [
          `✅ Navbatga qo'yildi: ${ok}/${products.length}.`,
          ...(failed.length ? [`⚠️ Qolmadi:\n${failed.join('\n')}`] : []),
          "Endi joylash dasturi interval bilan har e'lonni sizdan tasdiqlatib joylaydi. Holat: /status",
        ].join('\n'),
      );
    } finally {
      running = false;
    }
  });
}
