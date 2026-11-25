import type { ProductStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { canReview, isReviewAction, TARGET_STATUS } from '../services/products/transitions.js';
import { draftKeyboard, parseCallback, reviewKeyboard } from './keyboards.js';
import { formatPreview } from './preview.js';

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

describe('qoralama ko`rinishi va tugmalari', () => {
  it('narx probel bilan, sarlavha uzunligi va kategoriya ko`rsatiladi', () => {
    const text = formatPreview({
      productId: 6,
      title: 'HP Laptop 15-FC0075NIA',
      description: 'Matn.',
      olxCategory: 'Электроника / Компьютеры / Ноутбуки',
      price: 8200000,
      ai: true,
    });
    expect(text).toContain("Narx: 8 200 000 so'm");
    expect(text).toContain('Sarlavha (22/70): HP Laptop 15-FC0075NIA');
    expect(text).toContain('Электроника / Компьютеры / Ноутбуки');
    expect(text).not.toContain('AI ishlatilmadi');
  });

  it('AI ishlatilmasa, shu haqida ogohlantiradi', () => {
    const text = formatPreview({
      productId: 1,
      title: 'x'.repeat(20),
      description: 'Matn.',
      olxCategory: 'k',
      price: 1,
      ai: false,
    });
    expect(text).toContain('AI ishlatilmadi');
  });

  it('juda uzun matn Telegram limitidan (4096) oshmaydi', () => {
    const text = formatPreview({
      productId: 1,
      title: 'x'.repeat(20),
      description: 'a'.repeat(9000),
      olxCategory: 'k',
      price: 1,
      ai: true,
    });
    expect(text.length).toBeLessThanOrEqual(4096);
  });

  it('draftKeyboard: queue / rewrite / skip callback formati to`g`ri', () => {
    const data = draftKeyboard(9)
      .inline_keyboard.flat()
      .map((b) => parseCallback((b as { callback_data: string }).callback_data));
    expect(data).toEqual([
      { action: 'queue', productId: 9 },
      { action: 'rewrite', productId: 9 },
      { action: 'skip', productId: 9 },
    ]);
  });
});
