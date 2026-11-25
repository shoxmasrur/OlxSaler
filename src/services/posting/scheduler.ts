import type { GuardResult } from './guard.js';

export type WorkerAction = 'post' | 'ask' | 'idle';

export interface SchedulerInput {
  guard: GuardResult;
  hasRunning: boolean;
  hasConfirmed: boolean;
  /** Egasidan tasdiq so'ralgan, javob kutilmoqda. */
  hasAsked: boolean;
  hasPending: boolean;
  now: number;
  /** "Keyinroq" bosilgandan keyin shu vaqtgacha qayta so'ralmaydi (ms). */
  askNotBefore: number | null;
}

/**
 * Ishchi har aylanishda nima qilishini hal qiladi. Tartib muhim:
 * 1) Bir vaqtda faqat bitta e'lon. 2) Interval qoidalari (limit, soat, tanaffus, pauza)
 * bajarilmasa hech narsa qilinmaydi. 3) Egasi tasdiqlagan e'lon joylanadi.
 * 4) Tasdiq kutilayotgan bo'lsa, yangisi so'ralmaydi.
 */
export function decideAction(i: SchedulerInput): WorkerAction {
  if (i.hasRunning) return 'idle';
  if (!i.guard.allowed) return 'idle';
  if (i.hasConfirmed) return 'post';
  if (i.hasAsked) return 'idle';
  if (i.hasPending && (i.askNotBefore === null || i.now >= i.askNotBefore)) return 'ask';
  return 'idle';
}
