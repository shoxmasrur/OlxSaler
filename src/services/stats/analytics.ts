import {
  latestPerAd,
  topAds,
  totals,
  viewsByDay,
  viewsByHour,
  type StatRow,
  type Totals,
} from './report.js';

/**
 * Analitik hisobot uchun tayyor ma'lumot (toza funksiyalar, DB'siz).
 * "Murojaat" = xaridor aniq qiziqish bildirgan holat: telefonni ochgan yoki chatda yozgan.
 */
export interface CategoryStat {
  category: string;
  ads: number;
  views: number;
  avgViews: number;
  leads: number;
  zeroViews: number;
}

export interface TopAd {
  label: string;
  views: number;
  leads: number;
}

export interface Analytics {
  takenAt: Date;
  totals: Totals;
  /** Oldingi yig'ishdagi jamlanma (o'sishni ko'rsatish uchun); birinchi yig'ishda null. */
  previous: { takenAt: Date; totals: Totals } | null;
  leads: number;
  zeroViews: { count: number; labels: string[] };
  categories: CategoryStat[];
  top: TopAd[];
  /** Top-10 ning jami ko'rishlardagi ulushi (0..1). */
  topShare: number;
  days: [string, number][];
  hours: number[];
  /** Bot joylagan e'lonlarning o'rtacha yoshi (kun); noma'lum bo'lsa null. */
  avgAgeDays: number | null;
}

/** Bot joylamagan (katalogda yo'q) e'lonlar guruhi: taqqoslashda doim oxirida. */
export const OTHER_CATEGORY = "Eski e'lonlar";

const leadsOf = (r: Pick<StatRow, 'phones' | 'messages'>) => r.phones + r.messages;

export function adLabel(r: Pick<StatRow, 'title' | 'productId' | 'adId'>, max = 40): string {
  const t = r.title.length > max ? `${r.title.slice(0, max - 1).trimEnd()}…` : r.title;
  return `${t || r.adId}${r.productId ? ` #${r.productId}` : ''}`;
}

export function buildAnalytics(
  rows: StatRow[],
  categoryOf: (productId: number | null) => string,
  timeZone: string,
  postedAtOf: (productId: number) => Date | undefined = () => undefined,
): Analytics | null {
  const latest = latestPerAd(rows);
  if (latest.length === 0) return null;
  const takenAt = new Date(Math.max(...latest.map((r) => r.takenAt.getTime())));
  const t = totals(latest);

  const stamps = [...new Set(rows.map((r) => r.takenAt.getTime()))].sort((a, b) => a - b);
  const prevAt = stamps.length >= 2 ? stamps.at(-2)! : null;
  // Taqqoslash faqat oldingi yig'ishda ham bo'lgan e'lonlar bo'yicha: yangi qo'shilgan e'lonning
  // hamma ko'rishlari "o'sish" bo'lib ketmasin (yangi e'lon uchun oldingi qiymat = hozirgisi).
  let previous: Analytics['previous'] = null;
  if (prevAt !== null) {
    const before = new Map(
      latestPerAd(rows.filter((r) => r.takenAt.getTime() <= prevAt)).map((r) => [r.adId, r]),
    );
    previous = {
      takenAt: new Date(prevAt),
      totals: totals(latest.map((r) => before.get(r.adId) ?? r)),
    };
  }

  const groups = new Map<string, StatRow[]>();
  for (const r of latest) {
    const c = categoryOf(r.productId);
    groups.set(c, [...(groups.get(c) ?? []), r]);
  }
  const categories = [...groups.entries()]
    .map(([category, list]) => {
      const views = list.reduce((s, r) => s + r.views, 0);
      return {
        category,
        ads: list.length,
        views,
        avgViews: views / list.length,
        leads: list.reduce((s, r) => s + leadsOf(r), 0),
        zeroViews: list.filter((r) => r.views === 0).length,
      };
    })
    .sort(
      (a, b) =>
        Number(a.category === OTHER_CATEGORY) - Number(b.category === OTHER_CATEGORY) ||
        b.avgViews - a.avgViews,
    );

  const top10 = topAds(latest, 10);
  const zero = latest.filter((r) => r.views === 0);

  const ages = latest.flatMap((r) => {
    const at = r.productId ? postedAtOf(r.productId) : undefined;
    return at ? [(takenAt.getTime() - at.getTime()) / 86_400_000] : [];
  });

  return {
    takenAt,
    totals: t,
    previous,
    leads: t.phones + t.messages,
    zeroViews: { count: zero.length, labels: zero.map((r) => adLabel(r, 32)) },
    categories,
    top: top10.map((r) => ({ label: adLabel(r), views: r.views, leads: leadsOf(r) })),
    topShare: t.views ? top10.reduce((s, r) => s + r.views, 0) / t.views : 0,
    days: viewsByDay(rows, timeZone),
    hours: viewsByHour(rows, timeZone),
    avgAgeDays: ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : null,
  };
}

/** 2.456 -> "2,5"; 2 -> "2" (o'zbekcha o'nlik vergul). */
export const num = (n: number, digits = 1) =>
  n.toFixed(digits).replace('.', ',').replace(/,0+$/, '');
/** Ulush foizda: pct(4, 254) -> "1,6%". */
export const pct = (part: number, whole: number) =>
  whole > 0 ? `${num((part / whole) * 100)}%` : '0%';

const isOther = (c: CategoryStat) => c.category === OTHER_CATEGORY;

/** Oddiy tilda xulosalar: raqamlar nimani anglatadi. */
export function insights(a: Analytics): string[] {
  const out: string[] = [];
  const t = a.totals;
  const ours = a.categories.filter((c) => !isOther(c));

  if (a.avgAgeDays !== null && a.avgAgeDays < 3) {
    out.push(
      `E'lonlar hali yangi (o'rtacha ${num(a.avgAgeDays)} kunlik): raqamlar dastlabki, ishonchli xulosa uchun 5-7 kun kerak.`,
    );
  }
  if (ours.length >= 2) {
    const best = ours[0]!;
    const worst = ours.at(-1)!;
    if (worst.avgViews > 0 && best.avgViews / worst.avgViews >= 1.3) {
      out.push(
        `${best.category} e'lonlari eng ko'p ko'rilmoqda: bir e'longa ${num(best.avgViews)} ko'rish, ${worst.category.toLowerCase()}da esa ${num(worst.avgViews)} (${num(best.avgViews / worst.avgViews)} barobar farq).`,
      );
    }
  }
  const leadCats = a.categories.filter((c) => c.leads > 0).sort((x, y) => y.leads - x.leads);
  if (a.leads === 0) {
    out.push("Hali hech kim telefonni ochmagan va yozmagan: xaridorlar faqat ko'rib ketmoqda.");
  } else {
    out.push(
      `Xaridor murojaatlari (telefon + chat) jami ${a.leads} ta: ${leadCats.map((c) => `${c.category.toLowerCase()} ${c.leads}`).join(', ')}.`,
    );
  }
  out.push(
    `Ko'rganlarning ${pct(a.leads, t.views)} qismi bog'lanmoqda. Bunday e'lonlar uchun 2-5% yaxshi natija hisoblanadi.`,
  );
  if (a.topShare > 0) {
    out.push(
      `Eng ko'p ko'rilgan 10 ta e'lon barcha ko'rishlarning ${pct(a.topShare, 1)} qismini oladi.`,
    );
  }
  const peak = Math.max(...a.hours);
  if (peak > 0) {
    const h = a.hours.indexOf(peak);
    out.push(
      `Eng faol vaqt: ${String(h).padStart(2, '0')}:00 atrofi (Toshkent). Yangi e'lonni shu vaqtdan oldin qo'ygan ma'qul.`,
    );
  }
  if (a.previous) {
    const d = t.views - a.previous.totals.views;
    out.push(`Oldingi yig'ishdan beri ko'rishlar: ${d >= 0 ? '+' : ''}${d}.`);
  }
  return out;
}

/** Amaliy tavsiyalar (raqamlarga qarab). */
export function recommendations(a: Analytics): string[] {
  const out: string[] = [];
  if (a.zeroViews.count > 0) {
    out.push(
      `${a.zeroViews.count} ta e'lonni hali hech kim ko'rmagan. Sarlavha va birinchi rasmni tekshiring: ${a.zeroViews.labels
        .slice(0, 3)
        .join('; ')}${a.zeroViews.count > 3 ? ' va boshqalar' : ''}.`,
    );
  }
  const weak = a.categories.find((c) => !isOther(c) && c.ads >= 3 && c.avgViews < 1);
  if (weak) {
    out.push(
      `${weak.category}: bir e'longa 1 tadan kam ko'rish. Narxni bozor bilan solishtiring yoki sarlavhaga mashhur model nomini qo'shing.`,
    );
  }
  const viewedNoLead = a.top.filter((x) => x.views >= 5 && x.leads === 0).slice(0, 3);
  if (viewedNoLead.length > 0) {
    out.push(
      `Ko'p ko'rilgan, lekin hech kim bog'lanmagan: ${viewedNoLead.map((x) => x.label).join('; ')}. Narx yoki ta'rif xaridorni to'xtatayotgan bo'lishi mumkin.`,
    );
  }
  return out;
}
