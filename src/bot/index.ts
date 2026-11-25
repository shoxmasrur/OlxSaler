import dns from 'node:dns';
import net from 'node:net';
import { Bot, GrammyError } from 'grammy';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { whitelist } from './middleware/whitelist.js';
import { registerCommands, setupMenu } from './commands/index.js';
import { registerCallbacks } from './handlers/callbacks.js';
import { registerFileHandlers } from './handlers/files.js';

// Ba'zi tarmoqlarda IPv6 manzil ishlamaydi (ETIMEDOUT/ENETUNREACH): Telegram, Brave va
// Anthropic ulanishlari uchun IPv4 afzal ko'riladi.
dns.setDefaultResultOrder('ipv4first');
// IPv4/IPv6 "happy eyeballs" bu tarmoqda Telegram'ga ulanishni uzib qo'yadi (ETIMEDOUT): o'chiriladi.
net.setDefaultAutoSelectFamily(false);

const bot = new Bot(env.BOT_TOKEN);

// Whitelist eng birinchi: boshqalarga hech narsa yetib bormaydi (FR-1).
bot.use(whitelist);
registerCommands(bot);
registerCallbacks(bot);
registerFileHandlers(bot);

bot.catch((err) => logger.error({ err: err.error }, 'Bot xatosi'));

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
// Tarmoq xatolarining matnida so'rov manzili (va u bilan bot tokeni) bo'ladi: logga tokensiz yoziladi.
const safe = (err: unknown) =>
  (err instanceof Error ? err.message : String(err)).replaceAll(env.BOT_TOKEN, '<TOKEN>');
const isFatal = (err: unknown) =>
  err instanceof GrammyError && [401, 403, 409].includes(err.error_code);

// Telegram'ga ulanish beqaror bo'lishi mumkin (ETIMEDOUT): bir urinish bilan o'chib qolmaymiz.
async function withRetry(name: string, fn: () => Promise<void>, attempts: number) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (isFatal(err) || i >= attempts) throw err;
      logger.warn(
        { attempt: i, attempts, reason: safe(err) },
        `${name}: tarmoq xatosi, qayta uriniladi`,
      );
      await sleep(Math.min(3000 * i, 15_000));
    }
  }
}

let stopping = false;
const stop = () => {
  stopping = true;
  void bot.stop();
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

// Menyu muhim emas: 5 urinishdan keyin ham bo'lmasa, bot menyusiz ishlaydi.
await withRetry('Menyu', () => setupMenu(bot), 5).catch((err) =>
  logger.error({ reason: safe(err) }, "Menyu o'rnatilmadi, bot menyusiz ishlaydi"),
);

// Polling ham tarmoq uzilsa qayta ishga tushadi.
while (!stopping) {
  try {
    await bot.start({
      onStart: (me) => logger.info({ username: me.username }, 'Bot ishga tushdi'),
    });
    break;
  } catch (err) {
    if (stopping) break;
    if (isFatal(err)) throw err;
    logger.warn({ reason: safe(err) }, "Polling to'xtadi, 5 soniyadan keyin qayta uriniladi");
    await sleep(5000);
  }
}
