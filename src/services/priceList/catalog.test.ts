import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { parseXlsx } from './parse.js';

const HEADER = [
  '№',
  'Kod',
  "E'lon sarlavhasi",
  "Model (to'liq nomi)",
  'Xarakteristika',
  "E'lon matni (opisaniya)",
  'Tan narx $',
  "Tan narx so'm",
  "E'londagi narx",
  "Foyda so'm",
  'Foyda %',
  'Holat',
];

type Item = [code: string, title: string, price: number];

async function buildCatalog(sheets: Record<string, Item[]>): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const summary = wb.addWorksheet('Xulosa');
  summary.addRow(['Kategoriya', 'Nechta model']);
  for (const [name, items] of Object.entries(sheets)) {
    summary.addRow([name, items.length]);
    const ws = wb.addWorksheet(name);
    ws.addRow(HEADER);
    items.forEach(([code, title, price], i) =>
      ws.addRow([
        i + 1,
        code,
        title,
        `${title} (to'liq)`,
        'Ekran: 15"\nRAM: 8 GB',
        `${title} - yangi, qutida.`,
        600,
        7000000,
        price,
        1111111,
        0.12,
        'Bozor tekshirilgan',
      ]),
    );
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe("katalog Excel (ko'p varaqli)", () => {
  it("varaq nomini kategoriya qiladi va 'Xulosa' varag'ini o'tkazib yuboradi", async () => {
    const buf = await buildCatalog({
      'Noutbuk i5': [['A1', 'Laptop A', 5000000]],
      'Monitor 27"': [['B1', 'Monitor B', 1200000]],
    });
    const { rows, errors } = await parseXlsx(buf);
    expect(errors).toEqual([]);
    expect(rows.map((r) => r.category)).toEqual(['Noutbuk i5', 'Monitor 27"']);
  });

  it("faqat e'londagi narxni oladi, tan narx va foydani olmaydi", async () => {
    const buf = await buildCatalog({ Planshet: [['P1', 'Tablet', 1790000]] });
    const { rows } = await parseXlsx(buf);
    const row = rows[0]!;
    expect(row.price).toBe(1790000);
    expect(row.currency).toBe("so'm");
    expect(row.condition).toBe('yangi');
    const dump = JSON.stringify(row);
    expect(dump).not.toContain('7000000');
    expect(dump).not.toContain('1111111');
  });

  it("kod, sarlavha va ta'rif (matn + xususiyatlar) saqlanadi", async () => {
    const buf = await buildCatalog({ Planshet: [['P1', 'Tablet', 1790000]] });
    const { rows } = await parseXlsx(buf);
    expect(rows[0]).toMatchObject({ code: 'P1', title: 'Tablet', model: "Tablet (to'liq)" });
    expect(rows[0]!.description).toContain('Tablet - yangi, qutida.');
    expect(rows[0]!.description).toContain('Xususiyatlari:\nEkran: 15"');
  });

  it('takroriy kodni xato sifatida qaytaradi, qolganlarini qabul qiladi', async () => {
    const buf = await buildCatalog({
      Noutbuk: [
        ['X1', 'Birinchi', 100000],
        ['X1', 'Ikkinchi', 100000],
        ['X2', 'Uchinchi', 100000],
      ],
    });
    const { rows, errors } = await parseXlsx(buf);
    expect(rows.map((r) => r.code)).toEqual(['X1', 'X2']);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toContain('[Noutbuk] takroriy kod X1');
  });

  it("noto'g'ri narxli qatorni varaq nomi bilan xato qiladi", async () => {
    const buf = await buildCatalog({ Noutbuk: [['X1', 'Narxsiz', 0]] });
    const { rows, errors } = await parseXlsx(buf);
    expect(rows).toEqual([]);
    expect(errors[0]).toMatchObject({ row: 2 });
    expect(errors[0]!.message).toContain('[Noutbuk]');
  });

  it("kodi yo'q qatorlar dublikat deb hisoblanmaydi", async () => {
    const buf = await buildCatalog({
      Monitor: [
        ['', 'Kodsiz 1', 800000],
        ['', 'Kodsiz 2', 800000],
      ],
    });
    const { rows, errors } = await parseXlsx(buf);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).not.toHaveProperty('code');
  });
});
