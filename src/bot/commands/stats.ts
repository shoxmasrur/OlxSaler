import type { Bot } from 'grammy';
import { InputFile } from 'grammy';
import { prisma } from '../../db/client.js';
import { logger } from '../../lib/logger.js';
import { DEFAULT_GUARD } from '../../services/posting/guard.js';
import {
  OTHER_CATEGORY as OTHER,
  buildAnalytics,
  insights,
  num,
  pct,
  recommendations,
  type Analytics,
} from '../../services/stats/analytics.js';
import { renderDashboardPng } from '../../services/stats/dashboard.js';
import { latestPerAd, viewsByDay, type StatRow } from '../../services/stats/report.js';

const TZ = DEFAULT_GUARD.timeZone;
const HISTORY_DAYS = 30;

const fmtTime = (d: Date) =>
  new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, dateStyle: 'short', timeStyle: 'short' }).format(
    d,
  );

/** Katalog varaq nomidan ("Noutbuk i7", "Monitor 27\"") umumiy guruh. */
export function categoryGroup(sheet: string | null | undefined): string {
  const n = (sheet ?? '').toLowerCase();
  if (n.startsWith('noutbuk')) return 'Noutbuk';
  if (n.startsWith('monitor')) return 'Monitor';
  if (n.startsWith('planshet')) return 'Planshet';
  if (n.startsWith('monoblok')) return 'Monoblok';
  return OTHER;
}

/** `/stats 66915010` (OLX ID) yoki `/stats #75` / `/stats 75` (mahsulot raqami). */
export function parseStatsArg(arg: string): { adId: string } | { productId: number } | null {
  const a = arg.trim();
  const tag = /^#?\s*(\d{1,6})$/.exec(a);
  if (tag) return { productId: Number(tag[1]) };
  if (/^\d{7,}$/.test(a)) return { adId: a };
  return null;
}

async function loadRows(adId?: string): Promise<StatRow[]> {
  return prisma.adStat.findMany({
    where: {
      ...(adId ? { adId } : {}),
      takenAt: { gte: new Date(Date.now() - HISTORY_DAYS * 86_400_000) },
    },
    orderBy: { takenAt: 'asc' },
  });
}

/** Bazadan analitika: kategoriya va joylangan vaqt mahsulotlar jadvalidan olinadi. */
export async function loadAnalytics(): Promise<Analytics | null> {
  const rows = await loadRows();
  const ids = [...new Set(rows.flatMap((r) => (r.productId ? [r.productId] : [])))];
  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, category: true, listing: { select: { postedAt: true } } },
  });
  const cat = new Map(products.map((p) => [p.id, categoryGroup(p.category)]));
  const posted = new Map(products.map((p) => [p.id, p.listing?.postedAt ?? undefined]));
  return buildAnalytics(
    rows,
    (id) => (id ? (cat.get(id) ?? OTHER) : OTHER),
    TZ,
    (id) => posted.get(id),
  );
}

/** Rasm ostidagi matn: asosiy raqamlar, xulosalar, tavsiyalar, chat. */
export async function overviewText(a: Analytics): Promise<string> {
  const t = a.totals;
  const [chatTotal, recentChats] = await Promise.all([
    prisma.chatThread.count(),
    prisma.chatThread.findMany({ orderBy: { updatedAt: 'desc' }, take: 5 }),
  ]);
  const recs = recommendations(a);
  return [
    `OLX ANALITIKA — ${fmtTime(a.takenAt)}`,
    '',
    'ASOSIY RAQAMLAR',
    `• Faol e'lonlar: ${t.ads}`,
    `• Ko'rishlar: ${t.views} (bir e'longa o'rtacha ${num(t.views / Math.max(t.ads, 1))})`,
    `• Sevimlilarga qo'shdi: ${t.observed} (${pct(t.observed, t.views)})`,
    `• Telefonni ochdi: ${t.phones} (${pct(t.phones, t.views)})`,
    `• Chatda yozdi: ${t.messages} (${pct(t.messages, t.views)})`,
    '',
    'XULOSALAR',
    ...insights(a).map((s, i) => `${i + 1}. ${s}`),
    ...(recs.length ? ['', 'NIMA QILISH KERAK', ...recs.map((s, i) => `${i + 1}. ${s}`)] : []),
    '',
    `CHAT: ${chatTotal} ta suhbat`,
    ...recentChats.map((c) => `• ${c.userName} — «${c.adTitle.slice(0, 40)}» (${c.lastLabel})`),
    '',
    "Bitta e'lon tahlili: /stats #37 (mahsulot raqami) yoki /stats 66908568 (OLX ID)",
  ].join('\n');
}

async function single(arg: { adId: string } | { productId: number }): Promise<string> {
  let adId: string | null = 'adId' in arg ? arg.adId : null;
  if ('productId' in arg) {
    const l = await prisma.listing.findUnique({ where: { productId: arg.productId } });
    adId = l?.olxAdId ?? null;
    if (!adId) return `#${arg.productId}: OLX'da joylangan e'lon topilmadi.`;
  }
  const rows = await loadRows(adId!);
  const last = rows.at(-1);
  if (!last) return `${adId}: bu e'lon uchun statistika hali yo'q.`;

  // Shu kategoriyadagi boshqa e'lonlar bilan taqqoslash.
  const a = await loadAnalytics();
  const product = last.productId
    ? await prisma.product.findUnique({
        where: { id: last.productId },
        select: { category: true, price: true, currency: true },
      })
    : null;
  const group = categoryGroup(product?.category);
  const cat = a?.categories.find((c) => c.category === group);
  const all = a ? latestPerAd(await loadRows()) : [];
  const rank = [...all].sort((x, y) => y.views - x.views).findIndex((r) => r.adId === adId) + 1;
  const vsAvg =
    cat && cat.avgViews > 0
      ? last.views >= cat.avgViews
        ? `kategoriya o'rtachasidan ${num(last.views / cat.avgViews)} barobar YUQORI`
        : `kategoriya o'rtachasidan PAST (${num(last.views)} va ${num(cat.avgViews)})`
      : null;
  const days = viewsByDay(rows, TZ).slice(-14);

  return [
    `E'LON TAHLILI${last.productId ? ` #${last.productId}` : ''}`,
    last.title,
    `https://www.olx.uz/d/${adId}/`,
    product ? `Narx: ${product.price.toLocaleString('ru-RU')} ${product.currency}` : '',
    '',
    `• Ko'rishlar: ${last.views}${rank ? ` (${all.length} ta e'lon ichida ${rank}-o'rin)` : ''}`,
    `• Sevimlilarga qo'shdi: ${last.observed}`,
    `• Telefonni ochdi: ${last.phones}`,
    `• Chatda yozdi: ${last.messages}`,
    ...(vsAvg ? [`• ${group}: ${vsAvg}`] : []),
    '',
    ...(days.length
      ? ["Kunlar bo'yicha yangi ko'rishlar:", ...days.map(([d, v]) => `  ${d}: ${v}`), '']
      : []),
    `Holat: ${fmtTime(last.takenAt)}`,
  ]
    .filter((l, i, arr) => !(l === '' && arr[i - 1] === ''))
    .join('\n');
}

export function registerStatsCommand(bot: Bot) {
  bot.command('stats', async (ctx) => {
    const arg = parseStatsArg(ctx.match ?? '');
    if (arg)
      return void (await ctx.reply(await single(arg), {
        link_preview_options: { is_disabled: true },
      }));

    const a = await loadAnalytics();
    if (!a) {
      return void (await ctx.reply(
        "Statistika hali yig'ilmagan. Birinchi yig'ishdan keyin shu yerda chiqadi.",
      ));
    }
    try {
      await ctx.replyWithPhoto(new InputFile(await renderDashboardPng(a), 'analitika.png'), {
        caption: `OLX analitika — ${fmtTime(a.takenAt)}`,
      });
    } catch (err) {
      logger.error({ err }, 'Analitika rasmi chizilmadi');
    }
    await ctx.reply((await overviewText(a)).slice(0, 4000), {
      link_preview_options: { is_disabled: true },
    });
  });
}
