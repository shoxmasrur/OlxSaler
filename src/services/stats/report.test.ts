import { describe, expect, it } from 'vitest';
import { categoryGroup, parseStatsArg } from '../../bot/commands/stats.js';
import {
  OTHER_CATEGORY,
  buildAnalytics,
  insights,
  num,
  pct,
  recommendations,
} from './analytics.js';
import { renderDashboardSvg } from './dashboard.js';
import { formatChatChanges, snapshotSchema } from './ingest.js';
import {
  byCategory,
  hourBars,
  latestPerAd,
  topAds,
  totals,
  viewsByDay,
  viewsByHour,
  type StatRow,
} from './report.js';

const TZ = 'Asia/Tashkent';
// Toshkent UTC+5: 05:00Z = 10:00 mahalliy.
const row = (adId: string, at: string, views: number, extra: Partial<StatRow> = {}): StatRow => ({
  adId,
  productId: null,
  title: `E'lon ${adId}`,
  views,
  observed: 0,
  phones: 0,
  messages: 0,
  takenAt: new Date(at),
  ...extra,
});

const rows = [
  row('1', '2026-11-27T04:00:00Z', 2),
  row('1', '2026-11-27T05:00:00Z', 5),
  row('1', '2026-11-27T06:00:00Z', 4), // OLX bot ko'rishlarini olib tashlagan: manfiy farq hisoblanmaydi
  row('1', '2026-11-27T07:00:00Z', 6),
  row('2', '2026-11-27T04:00:00Z', 0),
  row('2', '2026-11-27T05:00:00Z', 1, { phones: 1 }),
];

describe('statistika hisoboti', () => {
  it('har e`lonning oxirgi qaydi va jamlanma', () => {
    const latest = latestPerAd(rows);
    expect(latest.map((r) => [r.adId, r.views])).toEqual([
      ['1', 6],
      ['2', 1],
    ]);
    expect(totals(latest)).toEqual({ ads: 2, views: 7, observed: 0, phones: 1, messages: 0 });
  });

  it('top: ko`rish, teng bo`lsa telefon bo`yicha', () => {
    const latest = [
      row('a', '2026-11-27T05:00:00Z', 3),
      row('b', '2026-11-27T05:00:00Z', 3, { phones: 2 }),
    ];
    expect(topAds(latest, 1)[0]!.adId).toBe('b');
  });

  it('soatlar: o`sish keyingi qayd soatiga yoziladi, manfiy farq e`tiborsiz', () => {
    const hours = viewsByHour(rows, TZ);
    expect(hours[10]).toBe(3 + 1); // 04Z->05Z: +3 (1-e'lon), +1 (2-e'lon)
    expect(hours[11]).toBe(0); // 5 -> 4
    expect(hours[12]).toBe(2); // 4 -> 6
    expect(hours.reduce((a, b) => a + b, 0)).toBe(6);
    expect(viewsByDay(rows, TZ)).toEqual([['2026-11-27', 6]]);
  });

  it('kategoriya bo`yicha guruhlash', () => {
    const latest = latestPerAd(rows);
    expect(byCategory(latest, () => 'Monitor')).toEqual([
      { category: 'Monitor', totals: totals(latest) },
    ]);
  });

  it('gistogramma faqat bo`sh bo`lmagan soatlar', () => {
    const h = Array.from({ length: 24 }, () => 0);
    h[9] = 4;
    h[14] = 2;
    expect(hourBars(h, 4)).toEqual(['09:00 ▇▇▇▇ 4', '14:00 ▇▇ 2']);
    expect(hourBars(Array.from({ length: 24 }, () => 0))).toEqual([]);
  });
});

describe('/stats argumenti va kategoriya', () => {
  it('OLX ID va mahsulot raqami', () => {
    expect(parseStatsArg('66915010')).toEqual({ adId: '66915010' });
    expect(parseStatsArg('#75')).toEqual({ productId: 75 });
    expect(parseStatsArg('75')).toEqual({ productId: 75 });
    expect(parseStatsArg('')).toBeNull();
    expect(parseStatsArg('abc')).toBeNull();
  });

  it('katalog varaq nomidan guruh', () => {
    expect(categoryGroup('Noutbuk i7')).toBe('Noutbuk');
    expect(categoryGroup('Monitor 22-24"')).toBe('Monitor');
    expect(categoryGroup(null)).toBe("Eski e'lonlar");
  });
});

describe('statistika fayli', () => {
  it('to`g`ri faylni qabul qiladi, chats ixtiyoriy', () => {
    const s = snapshotSchema.parse({
      takenAt: '2026-11-27T05:00:00Z',
      ads: [{ adId: '66900000', title: 'X', views: '3', observed: 0, phones: 0, messages: 0 }],
    });
    expect(s.ads[0]!.views).toBe(3);
    expect(s.chats).toEqual([]);
  });

  it('noto`g`ri OLX ID ni rad etadi', () => {
    expect(() =>
      snapshotSchema.parse({
        takenAt: '2026-11-27T05:00:00Z',
        ads: [{ adId: 'abc', title: 'X', views: 1, observed: 0, phones: 0, messages: 0 }],
      }),
    ).toThrow();
  });

  it('chat bildirishnomasi: xabar matnisiz, bo`sh bo`lsa null', () => {
    expect(formatChatChanges([])).toBeNull();
    const text = formatChatChanges([
      { id: 'u1', userName: 'Ali', adTitle: 'HP 250 G10', lastLabel: '10:15', isNew: true },
    ])!;
    expect(text).toContain('🆕 Ali — «HP 250 G10» (10:15)');
  });
});

describe('analitika', () => {
  const cat = (id: number | null) =>
    id === null ? OTHER_CATEGORY : id < 10 ? 'Noutbuk' : 'Monitor';
  const data = [
    row('1', '2026-11-27T04:00:00Z', 4, { productId: 1 }),
    row('1', '2026-11-27T05:00:00Z', 9, { productId: 1, phones: 1 }),
    row('2', '2026-11-27T05:00:00Z', 6, { productId: 2 }),
    row('3', '2026-11-27T05:00:00Z', 0, { productId: 11 }),
    row('4', '2026-11-27T05:00:00Z', 2, { productId: 12 }),
    row('5', '2026-11-27T05:00:00Z', 30), // eski e'lon: ko'p ko'rilgan, lekin oxirida turadi
  ];
  const a = buildAnalytics(data, cat, TZ, () => new Date('2026-11-26T05:00:00Z'))!;

  it('oldingi yig`ish, kategoriya tartibi, eski e`lonlar oxirida', () => {
    expect(a.totals.views - a.previous!.totals.views).toBe(5); // faqat 1-e'lon o'sgan: 4 -> 9
    expect(a.categories.map((c) => c.category)).toEqual(['Noutbuk', 'Monitor', OTHER_CATEGORY]);
    expect(a.categories[0]).toMatchObject({ ads: 2, views: 15, avgViews: 7.5, leads: 1 });
    expect(a.zeroViews.count).toBe(1);
    expect(a.avgAgeDays).toBe(1);
  });

  it('xulosalar va tavsiyalar oddiy tilda', () => {
    const text = insights(a).join(' ');
    expect(text).toContain('Noutbuk e`lonlari eng ko`p ko`rilmoqda'.replaceAll('`', "'"));
    expect(text).toContain("Oldingi yig'ishdan beri ko'rishlar: +5.");
    expect(recommendations(a).join(' ')).toContain("1 ta e'lonni hali hech kim ko'rmagan");
  });

  it('raqam formati va panel SVG', () => {
    expect(num(2.456)).toBe('2,5');
    expect(num(2)).toBe('2');
    expect(pct(4, 254)).toBe('1,6%');
    const svg = renderDashboardSvg(a);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('Xaridor voronkasi');
    expect(svg).not.toContain('NaN');
  });
});
