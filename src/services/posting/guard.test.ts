import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GUARD,
  evaluateGuard,
  localDateKey,
  localHour,
  randomGapMs,
  type GuardState,
} from './guard.js';

// Toshkent UTC+5: 07:00Z = 12:00 mahalliy.
const noon = new Date('2026-11-25T07:00:00Z');
const base: GuardState = { now: noon, postedToday: 0, lastPostedAt: null, paused: false };

describe('localHour / localDateKey (Asia/Tashkent)', () => {
  it('UTC vaqtini Toshkent soatiga o`tkazadi', () => {
    expect(localHour(noon, 'Asia/Tashkent')).toBe(12);
    expect(localHour(new Date('2026-11-25T19:30:00Z'), 'Asia/Tashkent')).toBe(0);
  });

  it('"bugun" mahalliy sana bo`yicha (yarim tundan keyin yangi kun)', () => {
    expect(localDateKey(new Date('2026-11-25T18:59:00Z'), 'Asia/Tashkent')).toBe('2026-11-25');
    expect(localDateKey(new Date('2026-11-25T19:01:00Z'), 'Asia/Tashkent')).toBe('2026-11-26');
  });
});

describe('evaluateGuard', () => {
  it('hammasi joyida bo`lsa ruxsat beradi', () => {
    expect(evaluateGuard(base)).toEqual({ allowed: true });
  });

  it('pauza yoqilgan bo`lsa to`xtatadi (hamma narsadan oldin)', () => {
    expect(evaluateGuard({ ...base, paused: true })).toEqual({ allowed: false, reason: 'paused' });
  });

  it('kunlik limitga yetgach to`xtatadi', () => {
    expect(evaluateGuard({ ...base, postedToday: DEFAULT_GUARD.dailyLimit - 1 }).allowed).toBe(
      true,
    );
    expect(evaluateGuard({ ...base, postedToday: DEFAULT_GUARD.dailyLimit })).toEqual({
      allowed: false,
      reason: 'daily_limit',
    });
  });

  it('tunda va erta tongda joylamaydi, kunduzi joylaydi', () => {
    const at = (iso: string) => evaluateGuard({ ...base, now: new Date(iso) });
    expect(at('2026-11-25T03:00:00Z')).toMatchObject({ allowed: false, reason: 'outside_hours' }); // 08:00
    expect(at('2026-11-25T04:00:00Z').allowed).toBe(true); // 09:00
    expect(at('2026-11-25T14:59:00Z').allowed).toBe(true); // 19:59
    expect(at('2026-11-25T15:00:00Z')).toMatchObject({ allowed: false, reason: 'outside_hours' }); // 20:00
  });

  it('oxirgi e`londan keyin tanaffus tugamaguncha kutadi va qachon bo`lishini aytadi', () => {
    const last = new Date(noon.getTime() - 10 * 60_000);
    const res = evaluateGuard({ ...base, lastPostedAt: last });
    expect(res).toMatchObject({ allowed: false, reason: 'too_soon' });
    if (!res.allowed) expect(res.retryAfter?.getTime()).toBe(last.getTime() + 20 * 60_000);
  });

  it('tanlangan tasodifiy tanaffus ishlatiladi', () => {
    const last = new Date(noon.getTime() - 30 * 60_000);
    expect(evaluateGuard({ ...base, lastPostedAt: last }).allowed).toBe(true);
    expect(evaluateGuard({ ...base, lastPostedAt: last, requiredGapMs: 45 * 60_000 }).allowed).toBe(
      false,
    );
  });
});

describe('randomGapMs', () => {
  it('doim [minGapMin, maxGapMin] oralig`ida', () => {
    expect(randomGapMs(DEFAULT_GUARD, () => 0)).toBe(20 * 60_000);
    expect(randomGapMs(DEFAULT_GUARD, () => 1)).toBe(60 * 60_000);
    for (let i = 0; i < 50; i++) {
      const ms = randomGapMs(DEFAULT_GUARD);
      expect(ms).toBeGreaterThanOrEqual(20 * 60_000);
      expect(ms).toBeLessThanOrEqual(60 * 60_000);
    }
  });
});
