import { describe, expect, it, vi } from 'vitest';

vi.mock('../../db/client.js', () => ({ prisma: {} }));
const { MediaGroupMemory, parseProductTag } = await import('./ownerPhotos.js');

describe('parseProductTag', () => {
  it('izohdagi #raqamni oladi', () => {
    expect(parseProductTag('#62')).toBe(62);
    expect(parseProductTag('#62 oq rang, oldidan')).toBe(62);
    expect(parseProductTag('Mana rasm # 104')).toBe(104);
  });

  it('faqat raqamdan iborat izohni ham tushunadi', () => {
    expect(parseProductTag(' 75 ')).toBe(75);
  });

  it("raqamsiz yoki bo'sh izohda null", () => {
    expect(parseProductTag(undefined)).toBeNull();
    expect(parseProductTag('')).toBeNull();
    expect(parseProductTag('oq monitor 27"')).toBeNull();
  });
});

describe('MediaGroupMemory', () => {
  it('albomning keyingi rasmlarini birinchisidagi mahsulotga bog`laydi', () => {
    const m = new MediaGroupMemory(1000);
    m.remember('g1', 62, 0);
    expect(m.recall('g1', 500)).toBe(62);
    expect(m.recall('g2', 500)).toBeNull();
  });

  it('muddati o`tgan yozuvni unutadi', () => {
    const m = new MediaGroupMemory(1000);
    m.remember('g1', 62, 0);
    expect(m.recall('g1', 1500)).toBeNull();
  });
});
