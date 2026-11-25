import path from 'node:path';
import { chromium, type BrowserContext, type Page } from 'playwright-core';

/** OLX sessiyasi shu papkada saqlanadi (git'da e'tiborsiz). Parol dasturda saqlanmaydi. */
export const PROFILE_DIR = path.resolve('browser-profile');

export const ADD_URL = 'https://www.olx.uz/adding/';
export const MY_ACCOUNT_URL = 'https://www.olx.uz/myaccount/';

/**
 * VS Code (snap) terminalidan ishga tushirilganda XDG_DATA_DIRS snap'ning o'z GNOME sxemalarini
 * ko'rsatadi va Chrome oynasi "settings schema ... does not contain a key" xatosi bilan yiqiladi.
 * Chrome uchun snap yo'llari olib tashlanadi.
 */
function cleanEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
  const dirs = (env.XDG_DATA_DIRS ?? '/usr/local/share:/usr/share')
    .split(':')
    .filter((p) => p && !p.includes('/snap/'));
  env.XDG_DATA_DIRS = (dirs.length > 0 ? dirs : ['/usr/local/share', '/usr/share']).join(':');
  delete env.GSETTINGS_SCHEMA_DIR;
  return env;
}

/**
 * Egasining o'z Google Chrome'i bilan, ko'rinadigan oynada (headed) ochiladi: brauzer yuklab
 * olish shart emas va egasi jarayonni ko'ra oladi. Til/vaqt zonasi O'zbekistonga mos.
 */
export async function launchOlx(): Promise<BrowserContext> {
  return chromium.launchPersistentContext(PROFILE_DIR, {
    channel: 'chrome',
    headless: false,
    env: cleanEnv(),
    viewport: { width: 1366, height: 900 },
    locale: 'ru-RU',
    timezoneId: 'Asia/Tashkent',
  });
}

export async function firstPage(context: BrowserContext): Promise<Page> {
  return context.pages()[0] ?? (await context.newPage());
}

/** Kirish sahifasiga yo'naltirilgan bo'lsa, hisobga kirilmagan. */
export function isLoginUrl(url: string): boolean {
  return /login\.olx\.|\/account\/(login|register)/i.test(url);
}
