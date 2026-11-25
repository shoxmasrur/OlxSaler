import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { Locator, Page } from 'playwright-core';
import { logger } from '../../lib/logger.js';
import {
  between,
  stepPause,
  TEXT_STYLE,
  TITLE_STYLE,
  typingPlan,
  type TypingStyle,
} from '../../services/posting/humanize.js';
import { findDuplicate, pickOption, type PostPlan } from '../../services/posting/plan.js';
import { ADD_URL, firstPage, isLoginUrl, launchOlx, MY_ACCOUNT_URL } from './browser.js';

const SHOTS_DIR = path.resolve('storage/screenshots');

export type FailKind = 'needs_login' | 'blocked' | 'form_error' | 'duplicate';

/** Dastur o'zi hal qilmaydigan holat: ishchi to'xtaydi, egasiga xabar beriladi. Aylanib o'tilmaydi. */
export class PostError extends Error {
  constructor(
    readonly kind: FailKind,
    message: string,
    readonly screenshot?: string,
  ) {
    super(message);
  }
}

export interface PostResult {
  url: string | null;
  adId: string | null;
  screenshot: string;
  dryRun: boolean;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const human = () => sleep(stepPause());

// CAPTCHA, telefon/SMS tasdig'i, blok: bularni ko'rsak, to'xtaymiz (aylanib o'tishga urinmaymiz).
const BLOCK_PATTERN =
  /captcha|recaptcha|я не робот|подтвердите (?:свой )?(?:номер|телефон)|введите код|код из (?:sms|смс)|аккаунт (?:заблокирован|ограничен)|заблокирован/i;

async function screenshot(page: Page, name: string): Promise<string> {
  await mkdir(SHOTS_DIR, { recursive: true });
  const file = path.join(SHOTS_DIR, `${Date.now()}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function ensureNoBlock(page: Page, where: string): Promise<void> {
  const text = await page.locator('body').innerText();
  const hit = BLOCK_PATTERN.exec(text)?.[0];
  if (hit) {
    throw new PostError(
      'blocked',
      `${where}: OLX "${hit}" so'ramoqda`,
      await screenshot(page, 'blocked'),
    );
  }
}

async function humanClick(target: Locator): Promise<void> {
  await target.scrollIntoViewIfNeeded();
  await target.hover();
  await sleep(between(180, 520));
  await target.click();
}

async function humanType(page: Page, target: Locator, text: string, style: TypingStyle) {
  await target.scrollIntoViewIfNeeded();
  await target.hover();
  await sleep(between(200, 600));
  await target.click();
  await sleep(between(200, 500));
  for (const { chunk, delay, pauseAfter } of typingPlan(text, style)) {
    await page.keyboard.type(chunk, { delay });
    if (pauseAfter) await sleep(pauseAfter);
  }
}

/** Nomzod locator'lardan birinchi ko'rinadiganini qaytaradi (OLX markup'iga chidamlilik uchun). */
async function firstVisible(candidates: Locator[], what: string): Promise<Locator> {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    for (const c of candidates) {
      const first = c.first();
      if (await first.isVisible().catch(() => false)) return first;
    }
    await sleep(300);
  }
  throw new PostError('form_error', `Maydon topilmadi: ${what}`);
}

async function dismissOverlays(page: Page): Promise<void> {
  // OLX tugallanmagan qoralamani saqlab qo'yadi: har safar noldan boshlaymiz.
  const startOver = page.getByText('Нет, начать заново');
  if (
    await startOver.waitFor({ state: 'visible', timeout: 4_000 }).then(
      () => true,
      () => false,
    )
  ) {
    await humanClick(startOver);
    await human();
  }
  // Cookie paneli: faqat yopamiz (rozilik bermaymiz).
  const cookie = page.getByRole('button', { name: 'Закрыть' });
  if (
    await cookie
      .first()
      .isVisible()
      .catch(() => false)
  )
    await cookie.first().click();
}

async function chooseCategory(page: Page, plan: PostPlan): Promise<void> {
  const steps = plan.category.steps;
  const last = steps.at(-1)!;

  // Sarlavhadan keyin OLX o'zi kategoriya taklif qiladi ("Наше предложение" + "Изменить").
  const change = page.getByText('Изменить', { exact: true }).first();
  if (
    await change.waitFor({ state: 'visible', timeout: 8_000 }).then(
      () => true,
      () => false,
    )
  ) {
    await humanClick(change);
  } else {
    await humanClick(page.getByRole('button', { name: /Категория/ }).first());
  }
  await page.getByText('Выберите категорию').first().waitFor({ timeout: 10_000 });
  await human();

  // Tavsiya qilinganlar orasida kerakli kategoriya bormi, yo'qsa yo'l bo'ylab boramiz.
  const direct = page.getByText(last, { exact: true }).last();
  if (await direct.isVisible().catch(() => false)) {
    await humanClick(direct);
  } else {
    for (const step of steps) {
      await humanClick(page.getByText(step, { exact: true }).last());
      await human();
    }
  }
  await page
    .getByText('Выберите категорию')
    .first()
    .waitFor({ state: 'hidden', timeout: 10_000 })
    .catch(() => {
      throw new PostError('form_error', `Kategoriya tanlanmadi: ${plan.category.path}`);
    });
  await page.getByText('Состояние').first().waitFor({ timeout: 10_000 });
}

async function uploadPhotos(page: Page, plan: PostPlan): Promise<void> {
  await page.locator('input[type="file"]').first().setInputFiles(plan.images);
  await page
    .getByText(/ГЛАВНОЕ|Главное/)
    .first()
    .waitFor({ timeout: 45_000 })
    .catch(() => {
      throw new PostError('form_error', 'Rasmlar yuklanmadi');
    });
  await sleep(between(2_500, 5_000) + plan.images.length * 1_000);
}

async function chooseFromList(page: Page, option: string): Promise<void> {
  const byRole = page.getByRole('option', { name: option, exact: true });
  const target = (await byRole
    .first()
    .isVisible()
    .catch(() => false))
    ? byRole.first()
    : page.getByText(option, { exact: true }).last();
  await humanClick(target);
}

/** Ochiladigan ro'yxat: variantlarni o'qiydi, mosini tanlaydi; mos kelmasa taxmin qilmaydi. */
async function selectCombo(
  page: Page,
  label: RegExp,
  pick: (options: string[]) => string | null,
  what: string,
): Promise<string> {
  const field = await firstVisible(
    [
      page.getByLabel(label),
      page.locator('label', { hasText: label }).locator('xpath=following::*[@role="combobox"][1]'),
      page.locator('label', { hasText: label }).locator('xpath=following::input[1]'),
    ],
    what,
  );
  await humanClick(field);
  const options = page.getByRole('option').filter({ visible: true });
  await options.first().waitFor({ timeout: 8_000 });
  const texts = (await options.allInnerTexts()).map((t) => t.trim()).filter(Boolean);
  const chosen = pick(texts);
  if (!chosen) {
    throw new PostError(
      'form_error',
      `"${what}" uchun mos variant yo'q. Variantlar: ${texts.join(', ')}`,
    );
  }
  await humanClick(page.getByRole('option', { name: chosen, exact: true }).first());
  await human();
  return chosen;
}

async function fillForm(page: Page, plan: PostPlan): Promise<void> {
  const log = (step: string) => logger.info({ productId: plan.productId }, `OLX: ${step}`);

  log('sarlavha');
  await humanType(page, page.getByPlaceholder(/iPhone 11/), plan.title, TITLE_STYLE);
  await human();

  log('kategoriya');
  await chooseCategory(page, plan);
  await human();

  log('rasmlar');
  await uploadPhotos(page, plan);
  await human();

  log("ta'rif");
  await humanType(
    page,
    page.getByPlaceholder(/Подумайте, какие подробности/),
    plan.description,
    TEXT_STYLE,
  );
  await human();

  log('narx');
  const price = await firstVisible(
    [
      page.getByLabel(/^\s*Цена/),
      page.locator('label', { hasText: /^\s*Цена/ }).locator('xpath=following::input[1]'),
    ],
    'Цена',
  );
  await humanType(page, price, String(plan.price), TITLE_STYLE);
  await human();
  await humanClick(page.getByRole('textbox', { name: 'Выбрать' }).first());
  await chooseFromList(page, plan.currency);
  await human();

  log('tur va holat');
  await humanClick(page.getByRole('button', { name: plan.sellerType, exact: true }));
  await human();
  await humanClick(page.getByRole('button', { name: plan.condition, exact: true }));
  await human();

  if (plan.diagonal) {
    log('diagonal');
    await selectCombo(
      page,
      /Диагональ/,
      (o) => (o.includes(plan.diagonal!) ? plan.diagonal! : null),
      'Диагональ экрана',
    );
  }
  log('marka');
  await selectCombo(page, /Марка/, (o) => pickOption(o, plan.brand), 'Марка');
}

/**
 * "Рекламировать объявление" sahifasi: "Не рекламировать" va tasdiq oynasida "Да, создать" (reklamasiz).
 * Pullik "Добавить рекламу" tugmasiga HECH QACHON tegilmaydi. Cookie paneli tugmalarni yopib turadi.
 */
async function declinePromotion(page: Page): Promise<void> {
  const cookie = page.getByRole('button', { name: 'Закрыть' });
  if (
    await cookie
      .first()
      .isVisible()
      .catch(() => false)
  )
    await cookie.first().click();
  await human();
  await humanClick(page.getByRole('button', { name: 'Не рекламировать' }));
  await human();
  await humanClick(page.getByRole('button', { name: 'Да, создать' }));
  const done = await page
    .waitForURL((u) => u.pathname.startsWith('/purchase/confirmation'), { timeout: 30_000 })
    .then(
      () => true,
      () => false,
    );
  if (!done) {
    throw new PostError(
      'form_error',
      'Reklama taklifidan reklamasiz chiqib bo`lmadi',
      await screenshot(page, 'promo'),
    );
  }
  await sleep(between(1_500, 3_000));
}

/** Sahifadagi e'lon havolasi va ID si (agar topilsa). */
async function findAd(
  page: Page,
  title: string,
): Promise<{ url: string | null; adId: string | null }> {
  const needle = title.slice(0, 20).toLowerCase();
  const links = await page
    .locator('a[href*="/d/obyavlenie/"]')
    .evaluateAll((as) =>
      as.map((a) => ({ href: (a as HTMLAnchorElement).href, text: a.textContent ?? '' })),
    );
  const hit = links.find((l) => l.text.toLowerCase().includes(needle)) ?? links[0];
  if (!hit) return { url: null, adId: null };
  return { url: hit.href, adId: /-ID([A-Za-z0-9]+)\.html/.exec(hit.href)?.[1] ?? null };
}

/**
 * E'lonni formaga odamdek sur'atda to'ldiradi. dryRun=true: "Опубликовать" bosilmaydi.
 * "Опубликовать" faqat BIR marta bosiladi va hech qachon qayta urinilmaydi (dublikat bo'lmasligi uchun).
 */
export async function postListing(plan: PostPlan, opts: { dryRun: boolean }): Promise<PostResult> {
  const context = await launchOlx();
  try {
    const page = await firstPage(context);

    // 1) Hisobda shunga o'xshash e'lon bormi (dublikat).
    await page.goto(MY_ACCOUNT_URL, { waitUntil: 'domcontentloaded' });
    await sleep(between(2_000, 4_000));
    if (isLoginUrl(page.url())) {
      throw new PostError(
        'needs_login',
        "OLX'ga kirilmagan (npm run olx:login)",
        await screenshot(page, 'login'),
      );
    }
    await ensureNoBlock(page, 'Hisob sahifasi');
    const dup = findDuplicate(plan.title, (await page.locator('body').innerText()).split('\n'));
    if (dup) throw new PostError('duplicate', `Hisobda shunga o'xshash e'lon bor: ${dup}`);

    // 2) Forma.
    await human();
    await page.goto(ADD_URL, { waitUntil: 'domcontentloaded' });
    await sleep(between(2_000, 4_000));
    if (isLoginUrl(page.url())) {
      throw new PostError(
        'needs_login',
        "OLX'ga kirilmagan (npm run olx:login)",
        await screenshot(page, 'login'),
      );
    }
    await dismissOverlays(page);
    await ensureNoBlock(page, 'Forma ochilganda');
    await fillForm(page, plan);

    const ready = await screenshot(page, `${plan.productId}-ready`);
    if (opts.dryRun) return { url: null, adId: null, screenshot: ready, dryRun: true };

    // 3) Joylash: ko'rib chiqish uchun pauza, keyin BIR marta bosish.
    await sleep(between(3_000, 6_000));
    await ensureNoBlock(page, 'Joylashdan oldin');
    await humanClick(page.getByRole('button', { name: 'Опубликовать' }));

    const left = await page
      .waitForURL((u) => !u.pathname.startsWith('/adding'), { timeout: 60_000 })
      .then(
        () => true,
        () => false,
      );
    if (!left) {
      const errors = await page
        .locator('[class*="error" i], [data-testid*="error" i]')
        .allInnerTexts()
        .catch(() => [] as string[]);
      throw new PostError(
        'form_error',
        `Joylash tasdiqlanmadi (forma ochiq qoldi). ${errors.filter(Boolean).join(' | ').slice(0, 300)}`,
        await screenshot(page, `${plan.productId}-stuck`),
      );
    }
    await sleep(between(2_000, 4_000));
    // OLX e'lon yaratilgach pullik reklama taklif qiladi: e'lon allaqachon yaratilgan (URL'da ad-id),
    // biz faqat reklamasiz davom etamiz va hech qachon to'lamaymiz.
    const adIdFromUrl = /[?&]ad-id=(\d+)/.exec(page.url())?.[1] ?? null;
    if (page.url().includes('/purchase/activate/promote/')) await declinePromotion(page);
    await ensureNoBlock(page, 'Joylashdan keyin');
    const after = await page.locator('body').innerText();
    if (/оплатить|купить пакет|лимит бесплатн/i.test(after)) {
      throw new PostError(
        'blocked',
        "OLX to'lov yoki limit so'rayapti (paket qo'llanmadi)",
        await screenshot(page, `${plan.productId}-payment`),
      );
    }
    const found = adIdFromUrl ? null : await findAd(page, plan.title);
    const adId = adIdFromUrl ?? found?.adId ?? null;
    const url = adIdFromUrl ? `https://www.olx.uz/d/${adIdFromUrl}/` : (found?.url ?? null);
    return {
      url: url ?? page.url(),
      adId,
      screenshot: await screenshot(page, `${plan.productId}-done`),
      dryRun: false,
    };
  } finally {
    await context.close();
  }
}
