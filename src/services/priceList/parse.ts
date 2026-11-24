import ExcelJS from 'exceljs';
import { parse as parseCsv } from 'csv-parse/sync';
import { z } from 'zod';

export type RawRow = Record<string, string>;

export interface ProductRow {
  model: string;
  price: number;
  currency: "so'm" | 'y.e.';
  condition: 'yangi' | 'b.u.';
  quantity: number;
  category?: string;
  note?: string;
}

export interface RowError {
  /** Jadvaldagi qator raqami (sarlavha 1-qator, birinchi ma'lumot 2-qator). */
  row: number;
  message: string;
}

export interface ParseResult {
  rows: ProductRow[];
  errors: RowError[];
}

const HEADER_ALIASES: Record<string, string> = {
  model: 'model',
  narx: 'price',
  price: 'price',
  valyuta: 'currency',
  currency: 'currency',
  holati: 'condition',
  holat: 'condition',
  condition: 'condition',
  soni: 'quantity',
  son: 'quantity',
  quantity: 'quantity',
  kategoriya: 'category',
  category: 'category',
  izoh: 'note',
  note: 'note',
};

const normalizeHeader = (h: string) => h.toLowerCase().replace(/[^\p{L}]/gu, '');
const normalizeWord = (s: string) => s.toLowerCase().replace(/[ʻʼ’‘`´]/g, "'").trim();

/** "1 250 000", "1,250,000", "1250000 so'm" -> 1250000. Raqam topilmasa NaN. */
export function cleanPrice(value: string): number {
  const negative = /^\s*[-−–]/.test(value);
  const digits = value.replace(/[\s\u00a0,]/g, '').replace(/[^\d.]/g, '');
  if (!/^\d+(\.\d+)?$/.test(digits)) return NaN;
  return negative ? -Number(digits) : Number(digits);
}

const CURRENCIES: Record<string, ProductRow['currency']> = {
  "so'm": "so'm",
  som: "so'm",
  uzs: "so'm",
  'y.e.': 'y.e.',
  ye: 'y.e.',
  usd: 'y.e.',
  $: 'y.e.',
};

const CONDITIONS: Record<string, ProductRow['condition']> = {
  yangi: 'yangi',
  new: 'yangi',
  'b.u.': 'b.u.',
  bu: 'b.u.',
  used: 'b.u.',
};

const rowSchema = z.object({
  model: z.string().trim().min(1, "model bo'sh"),
  price: z
    .string()
    .transform(cleanPrice)
    .pipe(z.number({ error: 'narx raqam emas' }).positive("narx 0 dan katta bo'lishi kerak")),
  currency: z
    .string()
    .transform((v) => (v.trim() === '' ? "so'm" : CURRENCIES[normalizeWord(v)]))
    .pipe(z.enum(["so'm", 'y.e.'], { error: "valyuta noto'g'ri (so'm yoki y.e.)" })),
  condition: z
    .string()
    .transform((v) => (v.trim() === '' ? 'yangi' : CONDITIONS[normalizeWord(v)]))
    .pipe(z.enum(['yangi', 'b.u.'], { error: "holati noto'g'ri (yangi yoki b.u.)" })),
  quantity: z
    .string()
    .transform((v) => (v.trim() === '' ? 1 : Number(v.replace(/\s/g, ''))))
    .pipe(
      z
        .number({ error: "soni raqam bo'lishi kerak" })
        .int("soni butun son bo'lishi kerak")
        .positive("soni 0 dan katta bo'lishi kerak"),
    ),
  category: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

/** Bo'sh qatorlar tashlab yuboriladi. Xatolar qator raqami bilan yig'iladi (FR-5). */
export function validateRows(raw: { row: number; data: RawRow }[]): ParseResult {
  const rows: ProductRow[] = [];
  const errors: RowError[] = [];

  for (const { row, data } of raw) {
    if (Object.values(data).every((v) => v.trim() === '')) continue;
    const parsed = rowSchema.safeParse({
      model: data.model ?? '',
      price: data.price ?? '',
      currency: data.currency ?? '',
      condition: data.condition ?? '',
      quantity: data.quantity ?? '',
      category: data.category || undefined,
      note: data.note || undefined,
    });
    if (parsed.success) {
      const { category, note, ...rest } = parsed.data;
      rows.push({ ...rest, ...(category ? { category } : {}), ...(note ? { note } : {}) });
    } else {
      errors.push({ row, message: parsed.error.issues.map((i) => i.message).join(', ') });
    }
  }
  return { rows, errors };
}

function toRawRows(table: string[][]): { row: number; data: RawRow }[] {
  const [header, ...body] = table;
  if (!header) return [];
  const keys = header.map((h) => HEADER_ALIASES[normalizeHeader(h)] ?? '');
  return body.map((cells, i) => {
    const data: RawRow = {};
    keys.forEach((key, col) => {
      if (key) data[key] = cells[col] ?? '';
    });
    return { row: i + 2, data };
  });
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if ('result' in value && value.result !== undefined) {
      return cellToString(value.result as ExcelJS.CellValue);
    }
    if ('richText' in value) return value.richText.map((t) => t.text).join('');
    if ('text' in value) return String(value.text);
    return '';
  }
  return String(value);
}

export async function parseXlsx(buf: Buffer): Promise<ParseResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const sheet = wb.worksheets[0];
  if (!sheet) return { rows: [], errors: [{ row: 1, message: "jadval bo'sh" }] };

  // Qator raqamlari saqlanishi uchun 1-qatordan oxirgigacha hammasi o'qiladi.
  const table: string[][] = [];
  for (let r = 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const cells: string[] = [];
    for (let c = 1; c <= sheet.columnCount; c++) cells.push(cellToString(row.getCell(c).value));
    table.push(cells);
  }
  return validateRows(toRawRows(table));
}

export function parseCsvBuffer(buf: Buffer): ParseResult {
  const text = buf.toString('utf8').replace(/^\uFEFF/, '');
  const delimiter = text.split('\n', 1)[0]?.includes(';') ? ';' : ',';
  const table = parseCsv(text, {
    delimiter,
    relax_column_count: true,
    skip_empty_lines: false,
  }) as string[][];
  return validateRows(toRawRows(table));
}
