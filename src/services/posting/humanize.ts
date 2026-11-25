/**
 * "Odamdek" sur'at: yozish tezligi va pauzalar. Tasodifiylik manbai parametr sifatida
 * beriladi (testlar uchun). Maqsad: shoshilmasdan, tabiiy sur'atda to'ldirish.
 */
export type Rand = () => number;

export interface TypingStyle {
  /** Har belgi orasidagi kutish (ms) oralig'i. */
  minDelay: number;
  maxDelay: number;
  /** Har necha belgidan keyin "o'ylash" pauzasi (o'rtacha). */
  thinkEvery: number;
  thinkMin: number;
  thinkMax: number;
}

export const TITLE_STYLE: TypingStyle = {
  minDelay: 55,
  maxDelay: 140,
  thinkEvery: 18,
  thinkMin: 250,
  thinkMax: 800,
};

/** Uzun matn (ta'rif) biroz tezroq yoziladi, lekin baribir odam sur'atida. */
export const TEXT_STYLE: TypingStyle = {
  minDelay: 18,
  maxDelay: 70,
  thinkEvery: 45,
  thinkMin: 300,
  thinkMax: 1200,
};

export const between = (min: number, max: number, rand: Rand = Math.random) =>
  Math.round(min + rand() * Math.max(max - min, 0));

/** Matnni bo'laklarga ajratadi: har bo'lak uchun kutish va bo'laklar orasida "o'ylash" pauzasi. */
export function typingPlan(
  text: string,
  style: TypingStyle,
  rand: Rand = Math.random,
): { chunk: string; delay: number; pauseAfter: number }[] {
  const plan: { chunk: string; delay: number; pauseAfter: number }[] = [];
  let i = 0;
  while (i < text.length) {
    const size = Math.max(
      1,
      Math.round(style.thinkEvery * (0.6 + rand() * 0.8)), // 60%-140%
    );
    const chunk = text.slice(i, i + size);
    i += size;
    plan.push({
      chunk,
      delay: between(style.minDelay, style.maxDelay, rand),
      pauseAfter: i < text.length ? between(style.thinkMin, style.thinkMax, rand) : 0,
    });
  }
  return plan;
}

/** Qadamlar orasidagi qisqa pauza (ms). */
export const stepPause = (rand: Rand = Math.random) => between(600, 2200, rand);
