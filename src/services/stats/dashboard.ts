import sharp from 'sharp';
import { num, pct, type Analytics } from './analytics.js';

/**
 * Analitik panel rasmi (SVG -> PNG, Telegram'ga yuboriladi).
 * Ranglar: bitta qator ma'lumot = bitta ko'k rang; voronka = ko'kning och->to'q bosqichlari
 * (dataviz validatoridan o'tgan: #84b9f3, #519ced, #2370cd, #0f4a96). Matn hech qachon seriya
 * rangida emas, faqat matn ranglarida.
 */
const C = {
  surface: '#ffffff',
  tile: '#f4f6f9',
  text: '#191919',
  muted: '#666666',
  grid: '#e6e6e6',
  bar: '#257de0',
  funnel: ['#84b9f3', '#519ced', '#2370cd', '#0f4a96'],
};
const FONT = 'Noto Sans, DejaVu Sans, sans-serif';
const W = 1080;
const PAD = 40;
const INNER = W - PAD * 2;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function text(
  x: number,
  y: number,
  s: string,
  o: { size?: number; weight?: number; color?: string; anchor?: 'start' | 'middle' | 'end' } = {},
) {
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${o.size ?? 15}" font-weight="${o.weight ?? 400}" fill="${o.color ?? C.text}" text-anchor="${o.anchor ?? 'start'}">${esc(s)}</text>`;
}

/** Gorizontal ustun: chap tomoni asosga yopishgan, o'ng (ma'lumot) uchi 4px yumaloq. */
function hbar(x: number, y: number, w: number, h: number, color: string) {
  if (w <= 0) return '';
  const r = Math.min(4, w / 2, h / 2);
  return `<path d="M${x} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x}Z" fill="${color}"/>`;
}

/** Vertikal ustun: pastki tomoni asosda, yuqori uchi yumaloq. */
function vbar(x: number, base: number, w: number, h: number, color: string) {
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h / 2);
  const top = base - h;
  return `<path d="M${x} ${base}V${top + r}Q${x} ${top} ${x + r} ${top}H${x + w - r}Q${x + w} ${top} ${x + w} ${top + r}V${base}Z" fill="${color}"/>`;
}

const fmtTime = (d: Date) =>
  new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Tashkent',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);

function section(y: number, title: string, note?: string): string {
  return (
    text(PAD, y, title, { size: 20, weight: 700 }) +
    (note ? text(PAD, y + 22, note, { size: 13, color: C.muted }) : '')
  );
}

function kpiTiles(a: Analytics, y: number): string {
  const t = a.totals;
  const prev = a.previous?.totals;
  const delta = (now: number, before: number | undefined) =>
    before === undefined ? '' : ` · ${now - before >= 0 ? '+' : ''}${now - before} oldingidan`;
  const tiles = [
    {
      label: "Ko'rishlar",
      value: t.views,
      sub: `bir e'longa ${num(t.views / Math.max(t.ads, 1))}${delta(t.views, prev?.views)}`,
    },
    {
      label: "Sevimlilarga qo'shdi",
      value: t.observed,
      sub: `ko'rganlarning ${pct(t.observed, t.views)}`,
    },
    { label: 'Telefonni ochdi', value: t.phones, sub: `ko'rganlarning ${pct(t.phones, t.views)}` },
    { label: 'Chatda yozdi', value: t.messages, sub: `ko'rganlarning ${pct(t.messages, t.views)}` },
  ];
  const gap = 16;
  const w = (INNER - gap * 3) / 4;
  return tiles
    .map((k, i) => {
      const x = PAD + i * (w + gap);
      return (
        `<rect x="${x}" y="${y}" width="${w}" height="124" rx="12" fill="${C.tile}"/>` +
        text(x + 20, y + 32, k.label, { size: 15, color: C.muted }) +
        text(x + 20, y + 80, String(k.value), { size: 40, weight: 700 }) +
        text(x + 20, y + 106, k.sub, { size: 13, color: C.muted })
      );
    })
    .join('');
}

function funnel(a: Analytics, y: number): string {
  const t = a.totals;
  const steps = [
    { label: "E'lonni ko'rdi", v: t.views },
    { label: "Sevimlilarga qo'shdi", v: t.observed },
    { label: 'Telefonni ochdi', v: t.phones },
    { label: 'Chatda yozdi', v: t.messages },
  ];
  const x0 = PAD + 230;
  const maxW = INNER - 230 - 220;
  return steps
    .map((s, i) => {
      const ry = y + i * 42;
      const w = t.views ? Math.max((s.v / t.views) * maxW, s.v > 0 ? 4 : 0) : 0;
      const share = i === 0 ? '100%' : pct(s.v, t.views);
      return (
        text(PAD, ry + 21, s.label, { size: 15 }) +
        hbar(x0, ry + 4, w, 26, C.funnel[i]!) +
        text(x0 + w + 10, ry + 22, `${s.v}`, { size: 16, weight: 700 }) +
        text(x0 + w + 10 + String(s.v).length * 10 + 8, ry + 22, `(${share})`, {
          size: 14,
          color: C.muted,
        })
      );
    })
    .join('');
}

function categories(a: Analytics, y: number): string {
  const x0 = PAD + 230;
  const maxW = INNER - 230 - 330;
  const max = Math.max(...a.categories.map((c) => c.avgViews), 0.0001);
  return a.categories
    .map((c, i) => {
      const ry = y + i * 40;
      const w = Math.max((c.avgViews / max) * maxW, c.avgViews > 0 ? 4 : 0);
      return (
        text(PAD, ry + 20, `${c.category} (${c.ads})`, { size: 15 }) +
        hbar(x0, ry + 4, w, 24, C.bar) +
        text(x0 + w + 10, ry + 21, num(c.avgViews), { size: 16, weight: 700 }) +
        text(
          x0 + w + 54,
          ry + 21,
          `${c.views} ko'rish · ${c.leads} murojaat${c.zeroViews ? ` · ${c.zeroViews} tasi 0` : ''}`,
          { size: 13, color: C.muted },
        )
      );
    })
    .join('');
}

function topList(a: Analytics, y: number): string {
  const x0 = PAD + 470;
  const maxW = INNER - 470 - 130;
  const max = Math.max(...a.top.map((r) => r.views), 1);
  return a.top
    .map((r, i) => {
      const ry = y + i * 32;
      const w = Math.max((r.views / max) * maxW, r.views > 0 ? 4 : 0);
      return (
        text(PAD, ry + 18, `${i + 1}. ${r.label}`, { size: 14 }) +
        hbar(x0, ry + 4, w, 20, C.bar) +
        text(x0 + w + 10, ry + 19, String(r.views), { size: 15, weight: 700 }) +
        (r.leads
          ? text(x0 + w + 16 + String(r.views).length * 9, ry + 19, `· ${r.leads} murojaat`, {
              size: 13,
              color: C.muted,
            })
          : '')
      );
    })
    .join('');
}

/** Vertikal ustunli kichik grafik (kun yoki soat). Ma'lumot bo'lmasa izoh. */
function columns(
  x: number,
  y: number,
  w: number,
  h: number,
  items: { label: string; v: number }[],
  empty: string,
): string {
  const max = Math.max(...items.map((i) => i.v), 0);
  const base = y + h;
  if (max === 0) {
    return (
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${C.tile}"/>` +
      text(x + w / 2, y + h / 2 + 5, empty, { size: 14, color: C.muted, anchor: 'middle' })
    );
  }
  const slot = w / items.length;
  const bw = Math.max(Math.min(slot - 4, 40), 3);
  const labelEvery = items.length > 12 ? 3 : 1;
  return (
    `<line x1="${x}" y1="${base}" x2="${x + w}" y2="${base}" stroke="${C.grid}"/>` +
    items
      .map((it, i) => {
        const bx = x + i * slot + (slot - bw) / 2;
        const bh = (it.v / max) * (h - 24);
        return (
          vbar(bx, base, bw, bh, C.bar) +
          (it.v === max
            ? text(bx + bw / 2, base - bh - 6, String(it.v), { size: 12, anchor: 'middle' })
            : '') +
          (i % labelEvery === 0
            ? text(bx + bw / 2, base + 18, it.label, { size: 12, color: C.muted, anchor: 'middle' })
            : '')
        );
      })
      .join('')
  );
}

export function renderDashboardSvg(a: Analytics): string {
  const parts: string[] = [];

  parts.push(text(PAD, 58, "OLX e'lonlar analitikasi", { size: 30, weight: 700 }));
  parts.push(
    text(PAD, 88, `${fmtTime(a.takenAt)} holati · ${a.totals.ads} ta faol e'lon`, {
      size: 16,
      color: C.muted,
    }),
  );
  let y = 112;
  parts.push(kpiTiles(a, y));
  y += 124 + 56;

  parts.push(section(y, 'Xaridor voronkasi', "Ko'rganlarning qanchasi keyingi qadamga o'tgan"));
  y += 42;
  parts.push(funnel(a, y));
  y += 4 * 42 + 40;

  parts.push(
    section(
      y,
      "Kategoriyalar: bir e'longa o'rtacha ko'rish",
      "Qavs ichida e'lonlar soni. Murojaat = telefon ochildi + chatda yozdi",
    ),
  );
  y += 42;
  parts.push(categories(a, y));
  y += a.categories.length * 40 + 40;

  parts.push(section(y, "Eng ko'p ko'rilgan 10 ta e'lon", '#raqam = bazadagi mahsulot raqami'));
  y += 42;
  parts.push(topList(a, y));
  y += a.top.length * 32 + 44;

  const colW = (INNER - 40) / 2;
  parts.push(text(PAD, y, "Kunlar bo'yicha yangi ko'rishlar", { size: 18, weight: 700 }));
  parts.push(
    text(PAD + colW + 40, y, "Soatlar bo'yicha (Toshkent vaqti)", { size: 18, weight: 700 }),
  );
  y += 20;
  parts.push(
    columns(
      PAD,
      y,
      colW,
      170,
      a.days.slice(-10).map(([d, v]) => ({ label: d.slice(8, 10) + '.' + d.slice(5, 7), v })),
      "Kamida 2 ta yig'ishdan keyin chiqadi",
    ),
  );
  parts.push(
    columns(
      PAD + colW + 40,
      y,
      colW,
      170,
      a.hours.map((v, h) => ({ label: String(h).padStart(2, '0'), v })),
      "Kamida 2 ta yig'ishdan keyin chiqadi",
    ),
  );
  y += 170 + 50;

  parts.push(
    text(
      PAD,
      y,
      'Manba: OLX «Мои объявления» va chat (OLX raqamlarni soatiga bir yangilaydi; bir xaridor kuniga 1 marta sanaladi).',
      { size: 12, color: C.muted },
    ),
  );
  y += 28;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${y}" viewBox="0 0 ${W} ${y}"><rect width="100%" height="100%" fill="${C.surface}"/>${parts.join('')}</svg>`;
}

/** Telegram uchun aniq (2x) PNG. */
export async function renderDashboardPng(a: Analytics): Promise<Buffer> {
  return sharp(Buffer.from(renderDashboardSvg(a)), { density: 144 })
    .png()
    .toBuffer();
}
