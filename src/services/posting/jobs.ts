import { prisma } from '../../db/client.js';
import { logEvent } from '../eventLog.js';
import { DEFAULT_GUARD, localDateKey } from './guard.js';
import { buildPostPlan, type PlanResult } from './plan.js';

/**
 * Joylash vazifasi hayoti:
 * PENDING (navbatda) -> ASKED (egasidan tasdiq so'ralgan) -> CONFIRMED -> RUNNING -> DONE
 * Istalgan bosqichdan FAILED yoki CANCELLED ga o'tishi mumkin.
 */
export const ACTIVE_JOB_STATUSES = ['PENDING', 'ASKED', 'CONFIRMED', 'RUNNING'];

// ---- Sozlamalar (Setting jadvali) ----

export async function getSetting(key: string): Promise<string | null> {
  return (await prisma.setting.findUnique({ where: { key } }))?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

export async function isPaused(): Promise<boolean> {
  return (await getSetting('paused')) === '1';
}

// ---- Hisob: bugun nechta e'lon joylangan ----

export async function postedStats(
  now: Date = new Date(),
  timeZone = DEFAULT_GUARD.timeZone,
): Promise<{ postedToday: number; lastPostedAt: Date | null }> {
  const recent = await prisma.listing.findMany({
    where: { postedAt: { gte: new Date(now.getTime() - 36 * 3_600_000) } },
    select: { postedAt: true },
  });
  const today = localDateKey(now, timeZone);
  const postedToday = recent.filter(
    (l) => l.postedAt && localDateKey(l.postedAt, timeZone) === today,
  ).length;
  const last = await prisma.listing.aggregate({ _max: { postedAt: true } });
  return { postedToday, lastPostedAt: last._max.postedAt ?? null };
}

// ---- Holat o'tishlari (hammasi bazaning o'zida shart bilan: ikki marta bosish xavfsiz) ----

async function move(productId: number, from: string[], to: string): Promise<boolean> {
  const { count } = await prisma.job.updateMany({
    where: { productId, status: { in: from } },
    data: { status: to },
  });
  return count > 0;
}

export const markAsked = (productId: number) => move(productId, ['PENDING'], 'ASKED');

export async function confirmJob(productId: number): Promise<boolean> {
  const ok = await move(productId, ['ASKED'], 'CONFIRMED');
  if (ok) await logEvent('JOB_CONFIRMED', 'Product', productId);
  return ok;
}

/** "Keyinroq": navbatga qaytadi, lekin shu zahoti qayta so'ralmaydi. */
export async function deferJob(productId: number, minutes = 60): Promise<boolean> {
  const ok = await move(productId, ['ASKED'], 'PENDING');
  if (ok) await setSetting('ask_not_before', String(Date.now() + minutes * 60_000));
  return ok;
}

export async function cancelJob(productId: number): Promise<boolean> {
  const ok = await move(productId, ['PENDING', 'ASKED', 'CONFIRMED'], 'CANCELLED');
  if (ok) await logEvent('JOB_CANCELLED', 'Product', productId);
  return ok;
}

// ---- Ishchi uchun ----

/** Eng eski PENDING vazifa (mahsuloti hali APPROVED bo'lgan). */
export async function nextPendingJob() {
  return prisma.job.findFirst({
    where: { type: 'POST', status: 'PENDING', product: { status: 'APPROVED' } },
    orderBy: { id: 'asc' },
  });
}

export async function hasJobIn(statuses: string[]): Promise<boolean> {
  return (await prisma.job.count({ where: { type: 'POST', status: { in: statuses } } })) > 0;
}

/** CONFIRMED -> RUNNING (atomik): bir vazifani faqat bitta ishchi oladi. */
export async function claimConfirmedJob() {
  const job = await prisma.job.findFirst({
    where: { type: 'POST', status: 'CONFIRMED' },
    orderBy: { id: 'asc' },
  });
  if (!job) return null;
  const { count } = await prisma.job.updateMany({
    where: { id: job.id, status: 'CONFIRMED' },
    data: { status: 'RUNNING', attempts: { increment: 1 } },
  });
  return count === 1 ? job : null;
}

/** Mahsulot, qoralama va tanlangan rasmlardan joylash rejasini tuzadi. */
export async function loadPlan(productId: number): Promise<PlanResult> {
  const p = await prisma.product.findUnique({
    where: { id: productId },
    include: { listing: true, images: { where: { selected: true }, orderBy: { id: 'asc' } } },
  });
  if (!p) return { ok: false, error: 'Mahsulot topilmadi' };
  if (!p.listing) return { ok: false, error: "Qoralama yo'q (/draft)" };
  return buildPostPlan({
    productId,
    model: p.model,
    price: p.price,
    categorySheet: p.category,
    title: p.listing.title,
    description: p.listing.description,
    images: p.images.flatMap((i) => (i.localPath ? [i.localPath] : [])),
  });
}

export async function markPosted(
  jobId: number,
  productId: number,
  data: { url: string | null; adId: string | null; price: number },
): Promise<void> {
  await prisma.$transaction([
    prisma.listing.update({
      where: { productId },
      data: { olxUrl: data.url, olxAdId: data.adId, postedPrice: data.price, postedAt: new Date() },
    }),
    prisma.product.update({ where: { id: productId }, data: { status: 'POSTED' } }),
    prisma.job.update({ where: { id: jobId }, data: { status: 'DONE', lastError: null } }),
  ]);
  await logEvent('POSTED', 'Product', productId, { url: data.url, adId: data.adId });
}

export async function failJob(
  jobId: number,
  productId: number,
  error: string,
  screenshotPath?: string,
): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: { status: 'FAILED', lastError: error.slice(0, 500), screenshotPath },
  });
  await logEvent('POST_FAILED', 'Product', productId, { error: error.slice(0, 500) });
}

/**
 * Ishchi qayta ishga tushganda RUNNING qolgan vazifa: e'lon joylanganmi yo'qmi noma'lum.
 * Avtomatik qayta joylamaymiz (dublikat bo'lmasligi uchun): FAILED + navbat pauzasi.
 */
export async function recoverStaleRunning(): Promise<number[]> {
  const stale = await prisma.job.findMany({ where: { status: 'RUNNING' } });
  for (const j of stale) {
    await failJob(
      j.id,
      j.productId,
      "Ishchi to'xtadi: e'lon joylanganmi yo'qmi noma'lum, OLX'da tekshiring",
    );
  }
  if (stale.length > 0) await setSetting('paused', '1');
  return stale.map((j) => j.productId);
}
