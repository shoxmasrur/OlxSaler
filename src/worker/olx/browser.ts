import path from 'node:path';
import { chromium, type BrowserContext, type Page } from 'playwright-core';

/** OLX sessiyasi shu papkada saqlanadi (git'da e'tiborsiz). Parol dasturda saqlanmaydi. */
export const PROFILE_DIR = path.resolve('browser-profile');

export const ADD_URL = 'https://www.olx.uz/adding/';
export const MY_ACCOUNT_URL = 'https://www.olx.uz/myaccount/';

/**
 * Egasining o'z Google Chrome'i bilan, ko'rinadigan oynada (headed) ochiladi: brauzer yuklab
 * olish shart emas va egasi jarayonni ko'ra oladi. Til/vaqt zonasi O'zbekistonga mos.
 */
export async function launchOlx(): Promise<BrowserContext> {
  return chromium.launchPersistentContext(PROFILE_DIR, {
    channel: 'chrome',
    headless: false,
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
