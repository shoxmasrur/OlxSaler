import { logger } from '../lib/logger.js';
import { ADD_URL, firstPage, isLoginUrl, launchOlx } from './olx/browser.js';

/**
 * OLX'ga bir marta kirish: ochilgan Chrome oynasida login va parolni O'ZINGIZ kiriting.
 * Dastur parolni ko'rmaydi va saqlamaydi, faqat sessiya (cookie) browser-profile/ da qoladi.
 *
 * Kirilganini aniqlash: kirilmagan hisob uchun /adding/ sahifasi login sahifasiga yo'naltiradi.
 * Faqat login sahifasi ko'rilgandan KEYIN, undan chiqib olx.uz ga qaytilsa, kirish deb hisoblanadi.
 */
const TIMEOUT_MS = 10 * 60_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const context = await launchOlx();
const page = await firstPage(context);
await page.goto(ADD_URL, { waitUntil: 'domcontentloaded' });
await sleep(4_000);

let ok = false;
if (!isLoginUrl(page.url())) {
  // Login sahifasiga yo'naltirilmadi: sessiya allaqachon bor.
  ok = true;
  logger.info("OLX'ga allaqachon kirilgan.");
} else {
  logger.info(
    "Chrome oynasida OLX'ga kiring (login/parolni o'zingiz kiriting). 10 daqiqa kutaman...",
  );
  const startedAt = Date.now();
  const deadline = startedAt + TIMEOUT_MS;
  let lastReport = 0;
  while (Date.now() < deadline) {
    await sleep(2_000);
    // Barcha ochiq tablar kuzatiladi (login boshqa tabda ochilishi mumkin).
    const pages = context.pages().filter((p) => !p.isClosed());
    if (pages.length === 0) {
      logger.error(
        `Chrome oynasi ${Math.round((Date.now() - startedAt) / 1000)} soniyadan keyin YOPILDI (barcha tablar yopilgan).`,
      );
      break;
    }
    const urls = pages.map((p) => p.url());
    if (Date.now() - lastReport > 15_000) {
      lastReport = Date.now();
      logger.info(
        `Ochiq tablar: ${urls.map((u) => (u.startsWith('http') ? new URL(u).origin + new URL(u).pathname : u)).join(' | ')}`,
      );
    }
    if (
      urls.some(
        (u) => u.startsWith('http') && !isLoginUrl(u) && /(^|\.)olx\.uz$/.test(new URL(u).hostname),
      )
    ) {
      ok = true;
      break;
    }
  }
}

if (ok) {
  // Sessiya diskka yozilishi uchun biroz kutamiz.
  await sleep(4_000);
  logger.info('Kirish saqlandi. Endi worker shu sessiyadan foydalanadi.');
} else {
  logger.error(
    'Kirish aniqlanmadi (vaqt tugadi yoki oyna yopildi). Qayta urining: npm run olx:login',
  );
}
await context.close().catch(() => undefined);
process.exit(ok ? 0 : 1);
