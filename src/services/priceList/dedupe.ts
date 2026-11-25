import type { ProductRow } from './parse.js';

export interface KnownProduct {
  code: string | null;
  model: string;
  category: string | null;
}

/**
 * Mahsulot kaliti: kodi bo'lsa kod, bo'lmasa model + kategoriya.
 * Bir xil fayl qayta yuborilganda mahsulotlar ikkilanmasligi uchun.
 */
export function productKey(p: { code?: string | null; model: string; category?: string | null }) {
  return p.code ? `code:${p.code}` : `model:${p.model}|${p.category ?? ''}`;
}

export function splitNew(
  rows: ProductRow[],
  existing: KnownProduct[],
): { fresh: ProductRow[]; skipped: number } {
  const known = new Set(existing.map(productKey));
  const fresh = rows.filter((r) => !known.has(productKey(r)));
  return { fresh, skipped: rows.length - fresh.length };
}
