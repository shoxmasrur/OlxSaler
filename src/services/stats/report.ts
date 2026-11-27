import { localDateKey, localHour } from '../posting/guard.js';

/**
 * E'lon statistikasi hisoboti (toza funksiyalar, DB'siz).
 * OLX faqat jamlanma raqam beradi (ko'rishlar, sevimlilar, telefon, xabarlar) va uni soatiga bir
 * yangilaydi. "Qaysi soatda ko'rilyapti" ketma-ket qaydlar orasidagi o'sishdan hisoblanadi.
 */
export interface StatRow {
  adId: string;
  productId: number | null;
  title: string;
  views: number;
  observed: number;
  phones: number;
  messages: number;
  takenAt: Date;
}

export interface Totals {
  ads: number;
  views: number;
  observed: number;
  phones: number;
  messages: number;
}

/** Har e'lonning eng oxirgi qaydi. */
export function latestPerAd(rows: StatRow[]): StatRow[] {
  const map = new Map<string, StatRow>();
  for (const r of rows) {
    const prev = map.get(r.adId);
    if (!prev || r.takenAt > prev.takenAt) map.set(r.adId, r);
  }
  return [...map.values()];
}

export function totals(latest: StatRow[]): Totals {
  return latest.reduce<Totals>(
    (t, r) => ({
      ads: t.ads + 1,
      views: t.views + r.views,
      observed: t.observed + r.observed,
      phones: t.phones + r.phones,
      messages: t.messages + r.messages,
    }),
    { ads: 0, views: 0, observed: 0, phones: 0, messages: 0 },
  );
}

/** Eng ko'p ko'rilganlar (teng bo'lsa: ko'proq telefon/sevimli, keyin xabar). */
export function topAds(latest: StatRow[], n = 10): StatRow[] {
  return [...latest]
    .sort(
      (a, b) =>
        b.views - a.views ||
        b.phones - a.phones ||
        b.observed - a.observed ||
        b.messages - a.messages,
    )
    .slice(0, n);
}

/** Kategoriya bo'yicha jamlanma. `categoryOf` productId -> kategoriya nomi. */
export function byCategory(
  latest: StatRow[],
  categoryOf: (productId: number | null) => string,
): { category: string; totals: Totals }[] {
  const groups = new Map<string, StatRow[]>();
  for (const r of latest) {
    const c = categoryOf(r.productId);
    groups.set(c, [...(groups.get(c) ?? []), r]);
  }
  return [...groups.entries()]
    .map(([category, rows]) => ({ category, totals: totals(rows) }))
    .sort((a, b) => b.totals.views - a.totals.views);
}

/**
 * Har e'lon uchun ketma-ket qaydlar orasidagi o'sish (manfiy farq e'tiborga olinmaydi: OLX ba'zan
 * bot ko'rishlarini olib tashlaydi). O'sish keyingi qayd vaqtiga yoziladi.
 */
export function viewDeltas(rows: StatRow[]): { at: Date; views: number }[] {
  const byAd = new Map<string, StatRow[]>();
  for (const r of rows) byAd.set(r.adId, [...(byAd.get(r.adId) ?? []), r]);
  const out: { at: Date; views: number }[] = [];
  for (const list of byAd.values()) {
    list.sort((a, b) => a.takenAt.getTime() - b.takenAt.getTime());
    for (let i = 1; i < list.length; i++) {
      const d = list[i]!.views - list[i - 1]!.views;
      if (d > 0) out.push({ at: list[i]!.takenAt, views: d });
    }
  }
  return out;
}

/** Mahalliy soat (0-23) bo'yicha ko'rishlar o'sishi. */
export function viewsByHour(rows: StatRow[], timeZone: string): number[] {
  const hours = Array.from({ length: 24 }, () => 0);
  for (const d of viewDeltas(rows)) hours[localHour(d.at, timeZone)]! += d.views;
  return hours;
}

/** Mahalliy sana (YYYY-MM-DD) bo'yicha ko'rishlar o'sishi, sana tartibida. */
export function viewsByDay(rows: StatRow[], timeZone: string): [string, number][] {
  const days = new Map<string, number>();
  for (const d of viewDeltas(rows)) {
    const k = localDateKey(d.at, timeZone);
    days.set(k, (days.get(k) ?? 0) + d.views);
  }
  return [...days.entries()].sort(([a], [b]) => a.localeCompare(b));
}

/** Matnli gistogramma: "09:00 ▇▇▇▇ 12". Bo'sh soatlar ko'rsatilmaydi. */
export function hourBars(hours: number[], width = 12): string[] {
  const max = Math.max(...hours, 0);
  if (max === 0) return [];
  return hours.flatMap((v, h) =>
    v > 0
      ? [
          `${String(h).padStart(2, '0')}:00 ${'▇'.repeat(Math.max(1, Math.round((v / max) * width)))} ${v}`,
        ]
      : [],
  );
}
