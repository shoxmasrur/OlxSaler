import type { RawRow } from './parse.js';

/**
 * "Perfetto" katalog formati: har kategoriya alohida varaqda, ustunlari:
 * Kod, E'lon sarlavhasi, Model, Xarakteristika, E'lon matni, E'londagi narx, Holat...
 *
 * MUHIM: faylda tan narx, foyda va bozor narxlari ham bor. Ular bu yerda
 * ATAYIN o'qilmaydi: bazaga tushmaydi va OLX'ga chiqmaydi.
 */

export interface SheetTable {
  name: string;
  table: string[][];
}

export interface CatalogSheet {
  name: string;
  rows: { row: number; data: RawRow }[];
}

export interface CatalogRead {
  sheets: CatalogSheet[];
  /** Takroriy kodlar kabi parsingdan oldingi xatolar. */
  errors: { sheet: string; row: number; message: string }[];
}

const normalize = (h: string) => h.toLowerCase().replace(/[^\p{L}]/gu, '');

// Faqat kerakli ustunlar. Boshqa ustunlar (tan narx, foyda...) bu ro'yxatda yo'q.
const COLUMNS: Record<string, string> = {
  kod: 'code',
  elonsarlavhasi: 'title',
  modeltoliqnomi: 'model',
  xarakteristika: 'specs',
  elonmatniopisaniya: 'text',
  elondaginarx: 'price',
  holat: 'note',
};

function columnKeys(header: string[]): string[] {
  return header.map((h) => COLUMNS[normalize(h)] ?? '');
}

export function isCatalogHeader(header: string[]): boolean {
  const keys = new Set(columnKeys(header));
  return keys.has('title') && keys.has('price');
}

/** Hech bir varaq katalog formatida bo'lmasa null qaytaradi. */
export function readCatalog(sheets: SheetTable[]): CatalogRead | null {
  const result: CatalogRead = { sheets: [], errors: [] };
  const seenCodes = new Map<string, string>();

  for (const { name, table } of sheets) {
    const [header, ...body] = table;
    if (!header || !isCatalogHeader(header)) continue;
    const keys = columnKeys(header);
    const rows: CatalogSheet['rows'] = [];

    body.forEach((cells, i) => {
      const d: Record<string, string> = {};
      keys.forEach((key, col) => {
        if (key) d[key] = (cells[col] ?? '').trim();
      });
      if (Object.values(d).every((v) => v === '')) return;

      const row = i + 2;
      const code = d.code ?? '';
      if (code) {
        const first = seenCodes.get(code);
        if (first) {
          result.errors.push({ sheet: name, row, message: `takroriy kod ${code} (${first})` });
          return;
        }
        seenCodes.set(code, `${name}, ${row}-qator`);
      }

      const description = [d.text, d.specs ? `Xususiyatlari:\n${d.specs}` : '']
        .filter(Boolean)
        .join('\n\n');

      rows.push({
        row,
        data: {
          code,
          title: d.title ?? '',
          model: d.model || d.title || '',
          price: d.price ?? '',
          currency: "so'm",
          condition: 'yangi',
          quantity: '1',
          category: name,
          note: d.note ?? '',
          description,
        },
      });
    });
    result.sheets.push({ name, rows });
  }

  return result.sheets.length > 0 ? result : null;
}
