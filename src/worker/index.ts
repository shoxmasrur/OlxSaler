import dns from 'node:dns';
import net from 'node:net';
import { InputFile } from 'grammy';
import { env } from '../config/env.js';
import { prisma } from '../db/client.js';
import { logger } from '../lib/logger.js';
import { scrubSecrets } from '../lib/scrub.js';
import { DEFAULT_GUARD, evaluateGuard, randomGapMs } from '../services/posting/guard.js';
import {
  claimConfirmedJob,
  failJob,
  getSetting,
  hasJobIn,
  isPaused,
  loadPlan,
  markAsked,
  markPosted,
  nextPendingJob,
  postedStats,
  recoverStaleRunning,
  setSetting,
} from '../services/posting/jobs.js';
import { decideAction } from '../services/posting/scheduler.js';
import { PostError, postListing } from './olx/poster.js';
import { createApi, notify, sendConfirmation } from './telegram.js';

// Ba'zi tarmoqlarda IPv6 ishlamaydi: Telegram va OLX uchun IPv4 afzal.
dns.setDefaultResultOrder('ipv4first');
// IPv4/IPv6 "happy eyeballs" bu tarmoqda Telegram'ga ulanishni uzib qo'yadi (ETIMEDOUT): o'chiriladi.
net.setDefaultAutoSelectFamily(false);

const api = createApi(env.BOT_TOKEN);
const owner = env.OWNER_TELEGRAM_ID;
const TICK_MS = 30_000;

let stopping = false;
const stop = () => {
  stopping = true;
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function askOwner(job: { id: number; productId: number }, postedToday: number) {
  const res = await loadPlan(job.productId);
  if (!res.ok) {
    await failJob(job.id, job.productId, res.error);
    return void (await notify(api, owner, `⚠️ #${job.productId} joylab bo'lmaydi: ${res.error}`));
  }
  // Avval xabar yuboriladi, keyin holat o'zgaradi (xabar bormasa, vazifa "so'ralgan" bo'lib qolmasin).
  await sendConfirmation(api, owner, res.plan, {
    postedToday,
    dailyLimit: DEFAULT_GUARD.dailyLimit,
  });
  await markAsked(job.productId);
  logger.info({ productId: job.productId }, "Egasidan tasdiq so'raldi");
}

async function postConfirmed() {
  const job = await claimConfirmedJob();
  if (!job) return;
  const id = job.productId;

  const res = await loadPlan(id);
  if (!res.ok) {
    await failJob(job.id, id, res.error);
    return void (await notify(api, owner, `⚠️ #${id} joylab bo'lmaydi: ${res.error}`));
  }

  await notify(
    api,
    owner,
    `🚀 #${id}: OLX formasini to'ldiryapman (Chrome oynasi ochiladi, odamdek sur'atda, taxminan 2-4 daqiqa)...`,
  );

  try {
    const result = await postListing(res.plan, { dryRun: false });
    await markPosted(job.id, id, { url: result.url, adId: result.adId, price: res.plan.price });
    const gapMs = randomGapMs(DEFAULT_GUARD);
    await setSetting('gap_ms', String(gapMs));
    const stats = await postedStats();
    await notify(
      api,
      owner,
      [
        `✅ #${id} joylandi (moderatsiyadan keyin faol bo'ladi).`,
        result.url ?? '',
        `Bugun: ${stats.postedToday}/${DEFAULT_GUARD.dailyLimit}. Keyingi e'lon kamida ${Math.round(gapMs / 60_000)} daqiqadan keyin so'raladi.`,
      ]
        .filter(Boolean)
        .join('\n'),
    );
  } catch (err) {
    const kind = err instanceof PostError ? err.kind : 'unknown';
    const message = scrubSecrets(err instanceof Error ? err.message : String(err));
    const screenshot = err instanceof PostError ? err.screenshot : undefined;
    await failJob(job.id, id, message, screenshot);
    logger.error({ productId: id, kind, screenshot }, message);

    // Dublikat xavfli emas: faqat shu e'lon o'tkaziladi. Boshqa har qanday xato: butun navbat to'xtaydi.
    if (kind !== 'duplicate') await setSetting('paused', '1');
    await notify(
      api,
      owner,
      kind === 'duplicate'
        ? `♻️ #${id} o'tkazildi: ${message}`
        : `⛔ #${id}: ${message}\nXavfsizlik uchun joylash PAUZAga qo'yildi. Tekshirib, /resume bilan davom ettiring.`,
    );
    if (screenshot) await api.sendPhoto(owner, new InputFile(screenshot)).catch(() => undefined);
  }
}

async function tick() {
  const [paused, stats, gap, notBefore, pending, hasRunning, hasConfirmed, hasAsked] =
    await Promise.all([
      isPaused(),
      postedStats(),
      getSetting('gap_ms'),
      getSetting('ask_not_before'),
      nextPendingJob(),
      hasJobIn(['RUNNING']),
      hasJobIn(['CONFIRMED']),
      hasJobIn(['ASKED']),
    ]);
  const now = new Date();
  const guard = evaluateGuard({
    now,
    postedToday: stats.postedToday,
    lastPostedAt: stats.lastPostedAt,
    paused,
    requiredGapMs: gap ? Number(gap) : undefined,
  });
  const action = decideAction({
    guard,
    hasRunning,
    hasConfirmed,
    hasAsked,
    hasPending: pending !== null,
    now: now.getTime(),
    askNotBefore: notBefore ? Number(notBefore) : null,
  });

  if (action === 'ask' && pending) await askOwner(pending, stats.postedToday);
  else if (action === 'post') await postConfirmed();
}

async function main() {
  // Oldingi ishchi e'lon joylash paytida to'xtagan bo'lsa: avtomatik qayta joylamaymiz.
  const stale = await recoverStaleRunning();
  if (stale.length > 0) {
    await notify(
      api,
      owner,
      `⚠️ Ishchi oldingi safar to'xtagan: ${stale.map((p) => `#${p}`).join(', ')}. E'lon joylanganmi yo'qmi noma'lum, OLX'da tekshiring. Joylash pauzada, tayyor bo'lsa /resume.`,
    );
  }
  logger.info(`Worker ishga tushdi (har ${TICK_MS / 1000} soniyada tekshiradi)`);

  while (!stopping) {
    try {
      await tick();
    } catch (err) {
      logger.error({ err }, 'Worker aylanishida xato');
    }
    await sleep(TICK_MS);
  }
  await prisma.$disconnect();
  logger.info("Worker to'xtadi");
}

await main();
