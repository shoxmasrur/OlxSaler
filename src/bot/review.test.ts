import type { ProductStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { canReview, isReviewAction, TARGET_STATUS } from '../services/products/transitions.js';
import { parseCallback, reviewKeyboard } from './keyboards.js';

const ALL: ProductStatus[] = [
  'IMPORTED',
  'IMAGES_FOUND',
  'DRAFT_READY',
  'APPROVED',
  'POSTING',
  'POSTED',
  'FAILED',
  'SKIPPED',
];

describe('holat o`tishlari', () => {
  it('tasdiqlash faqat rasmi topilgan (yoki qoralamasi tayyor) mahsulotga ta`sir qiladi', () => {
    expect(ALL.filter((s) => canReview(s, 'approve'))).toEqual(['IMAGES_FOUND', 'DRAFT_READY']);
    expect(TARGET_STATUS.approve).toBe('APPROVED');
  });

  it("joylanayotgan yoki joylangan mahsulotni o'tkazib yuborib bo'lmaydi", () => {
    for (const s of ['POSTING', 'POSTED', 'FAILED', 'SKIPPED'] as const) {
      expect(canReview(s, 'skip')).toBe(false);
    }
    expect(canReview('APPROVED', 'skip')).toBe(true);
    expect(TARGET_STATUS.skip).toBe('SKIPPED');
  });

  it("tasdiqlangan mahsulot uchun rasmni qayta qidirib bo'lmaydi", () => {
    expect(canReview('APPROVED', 'retry')).toBe(false);
    expect(canReview('IMAGES_FOUND', 'retry')).toBe(true);
    expect(canReview('IMPORTED', 'retry')).toBe(true);
    expect(TARGET_STATUS.retry).toBeUndefined();
  });

  it('isReviewAction faqat 3 ta harakatni taniydi', () => {
    expect(['approve', 'skip', 'retry'].every(isReviewAction)).toBe(true);
    expect(isReviewAction('delete')).toBe(false);
    expect(isReviewAction('')).toBe(false);
  });
});

describe('tugmalar va callback formati', () => {
  it("parseCallback harakat va mahsulot raqamini o'qiydi", () => {
    expect(parseCallback('approve:42')).toEqual({ action: 'approve', productId: 42 });
    expect(parseCallback('retry:7')).toEqual({ action: 'retry', productId: 7 });
  });

  it("noto'g'ri formatni rad etadi", () => {
    for (const bad of ['approve', 'approve:', 'approve:x', ':5', 'Approve:5', 'approve:5:6', '']) {
      expect(parseCallback(bad)).toBeNull();
    }
  });

  it("klaviaturadagi har tugma parseCallback bilan o'qiladi va 64 baytdan oshmaydi", () => {
    const buttons = reviewKeyboard(123456).inline_keyboard.flat();
    expect(buttons).toHaveLength(3);
    const actions = buttons.map((b) => {
      const data = (b as { callback_data: string }).callback_data;
      expect(Buffer.byteLength(data)).toBeLessThanOrEqual(64);
      const parsed = parseCallback(data);
      expect(parsed?.productId).toBe(123456);
      return parsed?.action;
    });
    expect(actions).toEqual(['approve', 'retry', 'skip']);
  });
});
