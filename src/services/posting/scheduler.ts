import type { GuardResult } from './guard.js';

export type WorkerAction = 'post' | 'ask' | 'idle';

export interface SchedulerInput {
  /** Joylash uchun qoidalar. */
  guard: GuardResult;
  /** Tasdiq so'rash uchun qoidalar (tanaffus biroz qisqaroq: ASK_LEAD_MS). Berilmasa `guard`. */
  askGuard?: GuardResult;
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
  if (i.hasConfirmed) return i.guard.allowed ? 'post' : 'idle';
  if (i.hasAsked) return 'idle';
  const askAllowed = (i.askGuard ?? i.guard).allowed;
  if (askAllowed && i.hasPending && (i.askNotBefore === null || i.now >= i.askNotBefore))
    return 'ask';
  return 'idle';
}
