/**
 * Joylash himoyasi: OLX'da spam deb belgilanmaslik uchun sur'at va hajm cheklovi.
 * Toza funksiya (DB'siz): joylash ishchisi holatni bazadan olib shu yerga beradi.
 */
export interface GuardConfig {
  /** Kuniga ko'pi bilan nechta e'lon. */
  dailyLimit: number;
  /** Ruxsat etilgan soatlar [startHour, endHour) mahalliy vaqt bo'yicha. */
  startHour: number;
  endHour: number;
  /** Ikki e'lon orasidagi tanaffus oralig'i (daqiqa). */
  minGapMin: number;
  maxGapMin: number;
  timeZone: string;
}

// Egasining qarori: kuniga 30 tagacha; ikki e'lon joylanishi orasida to'ldirish va kutish vaqti
// birgalikda kamida 6 daqiqa (qat'iy; 2026-11-26 da 10 → 8 → 6 daqiqaga qisqartirildi, egasi qarori).
export const DEFAULT_GUARD: GuardConfig = {
  dailyLimit: 30,
  startHour: 9,
  endHour: 20,
  minGapMin: 6,
  maxGapMin: 6,
  timeZone: 'Asia/Tashkent',
};

/**
 * Egasidan tasdiq so'rovi joylash vaqtidan shuncha erta yuboriladi: formani to'ldirish (~3-4 daqiqa)
 * kutishning bir qismi bo'ladi, shunda joylashlar orasidagi jami masofa baribir minGapMin dan kam bo'lmaydi.
 */
export const ASK_LEAD_MS = 4 * 60_000;

export interface GuardState {
  now: Date;
  /** Bugun (mahalliy sana bo'yicha) joylangan yoki joylanayotgan e'lonlar soni. */
  postedToday: number;
  lastPostedAt: Date | null;
  paused: boolean;
  /** Oxirgi e'londan keyin tanlangan tasodifiy tanaffus (ms). Bo'lmasa minGapMin. */
  requiredGapMs?: number;
}

export type GuardReason = 'paused' | 'daily_limit' | 'outside_hours' | 'too_soon';
export type GuardResult =
  { allowed: true } | { allowed: false; reason: GuardReason; retryAfter?: Date };

const MIN = 60_000;

/** Berilgan vaqtning mahalliy soati (0-23). */
export function localHour(date: Date, timeZone: string): number {
  const h = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone }).format(
    date,
  );
  return Number(h) % 24;
}

/** Mahalliy sana kaliti (YYYY-MM-DD): "bugun" shu bo'yicha sanaladi. */
export function localDateKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(date);
}

/** Ikki e'lon orasidagi tasodifiy tanaffus: [minGapMin, maxGapMin]. */
export function randomGapMs(cfg: GuardConfig, rand: () => number = Math.random): number {
  const span = Math.max(cfg.maxGapMin - cfg.minGapMin, 0);
  return Math.round((cfg.minGapMin + rand() * span) * MIN);
}

export function evaluateGuard(state: GuardState, cfg: GuardConfig = DEFAULT_GUARD): GuardResult {
  if (state.paused) return { allowed: false, reason: 'paused' };
  if (state.postedToday >= cfg.dailyLimit) return { allowed: false, reason: 'daily_limit' };

  const hour = localHour(state.now, cfg.timeZone);
  if (hour < cfg.startHour || hour >= cfg.endHour) {
    return { allowed: false, reason: 'outside_hours' };
  }

  if (state.lastPostedAt) {
    const gap = state.requiredGapMs ?? cfg.minGapMin * MIN;
    const next = new Date(state.lastPostedAt.getTime() + gap);
    if (state.now < next) return { allowed: false, reason: 'too_soon', retryAfter: next };
  }
  return { allowed: true };
}
