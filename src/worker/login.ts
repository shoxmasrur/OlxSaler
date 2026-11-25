import { logger } from '../lib/logger.js';
import { firstPage, isLoginUrl, launchOlx, MY_ACCOUNT_URL } from './olx/browser.js';

/**
 * OLX'ga bir marta kirish: ochilgan Chrome oynasida login va parolni O'ZINGIZ kiriting.
 * Dastur parolni ko'rmaydi va saqlamaydi, faqat sessiya (cookie) browser-profile/ da qoladi.
 */
const TIMEOUT_MS = 10 * 60_000;

const context = await launchOlx();
const page = await firstPage(context);
await page.goto(MY_ACCOUNT_URL, { waitUntil: 'domcontentloaded' });
logger.info(
  "Chrome oynasida OLX'ga kiring (login/parolni o'zingiz kiriting). 10 daqiqa kutaman...",
);

const deadline = Date.now() + TIMEOUT_MS;
let ok = false;
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 2_000));
  if (page.isClosed()) break;
  if (!isLoginUrl(page.url()) && page.url().includes('olx.uz')) {
    ok = true;
    break;
  }
}

if (ok) {
  // Sessiya diskka yozilishi uchun biroz kutamiz.
  await new Promise((r) => setTimeout(r, 4_000));
  logger.info('Kirish saqlandi. Endi worker shu sessiyadan foydalanadi.');
} else {
  logger.error(
    'Kirish aniqlanmadi (vaqt tugadi yoki oyna yopildi). Qayta urining: npm run olx:login',
  );
}
await context.close().catch(() => undefined);
process.exit(ok ? 0 : 1);
