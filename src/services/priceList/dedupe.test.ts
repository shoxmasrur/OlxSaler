import { describe, expect, it } from 'vitest';
import { productKey, splitNew } from './dedupe.js';
import type { ProductRow } from './parse.js';

const row = (over: Partial<ProductRow> & Pick<ProductRow, 'model'>): ProductRow => ({
  price: 1000,
  currency: "so'm",
  condition: 'yangi',
  quantity: 1,
  ...over,
});

describe('productKey', () => {
  it('kodi bo`lsa kod bo`yicha, bo`lmasa model + kategoriya bo`yicha', () => {
    expect(productKey({ code: 'HP1', model: 'A' })).toBe('code:HP1');
    expect(productKey({ code: null, model: 'A', category: 'Monitor' })).toBe('model:A|Monitor');
    expect(productKey({ model: 'A' })).toBe('model:A|');
  });
});

describe('splitNew', () => {
  it('bazada bor kodlarni o`tkazib yuboradi, yangilarini qoldiradi', () => {
    const rows = [row({ code: 'A', model: 'm1' }), row({ code: 'B', model: 'm2' })];
    const { fresh, skipped } = splitNew(rows, [{ code: 'A', model: 'boshqa nom', category: null }]);
    expect(fresh.map((r) => r.code)).toEqual(['B']);
    expect(skipped).toBe(1);
  });

  it('bir xil faylni qayta yuborish hammasini o`tkazib yuboradi', () => {
    const rows = [row({ code: 'A', model: 'm1' }), row({ model: 'Kodsiz', category: 'Monitor' })];
    const existing = rows.map((r) => ({
      code: r.code ?? null,
      model: r.model,
      category: r.category ?? null,
    }));
    expect(splitNew(rows, existing)).toEqual({ fresh: [], skipped: 2 });
  });

  it('kodsiz mahsulot boshqa kategoriyada bo`lsa dublikat emas', () => {
    const rows = [row({ model: 'Bir xil', category: 'Planshet' })];
    const { fresh } = splitNew(rows, [{ code: null, model: 'Bir xil', category: 'Monitor' }]);
    expect(fresh).toHaveLength(1);
  });

  it('bo`sh baza bilan hammasi yangi', () => {
    const rows = [row({ code: 'A', model: 'm1' }), row({ code: 'B', model: 'm2' })];
    expect(splitNew(rows, [])).toEqual({ fresh: rows, skipped: 0 });
  });
});
