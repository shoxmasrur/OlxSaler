import { describe, expect, it } from 'vitest';
import { cleanPrice, parseCsvBuffer, parseXlsx } from './parse.js';
import { buildTemplate } from './template.js';

describe('cleanPrice', () => {
  it('turli formatlarni tozalaydi', () => {
    expect(cleanPrice('1 250 000')).toBe(1250000);
    expect(cleanPrice('1,250,000')).toBe(1250000);
    expect(cleanPrice("1250000 so'm")).toBe(1250000);
    expect(cleanPrice('1 250 000')).toBe(1250000);
  });

  it('matnli narx NaN beradi', () => {
    expect(cleanPrice('kelishiladi')).toBeNaN();
    expect(cleanPrice('')).toBeNaN();
  });
});

describe('parseCsvBuffer', () => {
  const csv = (body: string) => Buffer.from(`Model,Narx,Valyuta,Holati,Soni\n${body}`);

  it("to'g'ri qatorni o'qiydi va standart qiymatlarni qo'yadi", () => {
    const { rows, errors } = parseCsvBuffer(csv('Galaxy A55,"4 200 000",,,'));
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { model: 'Galaxy A55', price: 4200000, currency: "so'm", condition: 'yangi', quantity: 1 },
    ]);
  });

  it("bo'sh modelni qator raqami bilan rad etadi", () => {
    const { rows, errors } = parseCsvBuffer(csv(',100000,,,'));
    expect(rows).toHaveLength(0);
    expect(errors).toEqual([{ row: 2, message: "model bo'sh" }]);
  });

  it('matnli narxni rad etadi', () => {
    const { errors } = parseCsvBuffer(csv('iPhone 15,kelishiladi,,,'));
    expect(errors).toHaveLength(1);
    expect(errors[0]!.row).toBe(2);
  });

  it('manfiy va nol narxni rad etadi', () => {
    const { rows, errors } = parseCsvBuffer(csv('A,-5,,,\nB,0,,,'));
    expect(rows).toHaveLength(0);
    expect(errors.map((e) => e.row)).toEqual([2, 3]);
  });

  it("bo'sh qatorlarni tashlab yuboradi, qator raqamlarini saqlaydi", () => {
    const { rows, errors } = parseCsvBuffer(csv('A,100,,,\n,,,,\n,50,,,'));
    expect(rows).toHaveLength(1);
    expect(errors).toEqual([{ row: 4, message: "model bo'sh" }]);
  });

  it("valyuta va holat sinonimlarini taniydi, noto'g'risini rad etadi", () => {
    const { rows, errors } = parseCsvBuffer(csv('A,10,USD,b.u.,2\nB,10,euro,yangi,1'));
    expect(rows[0]).toMatchObject({ currency: 'y.e.', condition: 'b.u.', quantity: 2 });
    expect(errors).toEqual([{ row: 3, message: "valyuta noto'g'ri (so'm yoki y.e.)" }]);
  });

  it("nuqtali vergul ajratuvchini taniydi (Excel'dan eksport)", () => {
    const { rows } = parseCsvBuffer(Buffer.from('Model;Narx\nA;1000'));
    expect(rows).toHaveLength(1);
  });
});

describe('template', () => {
  it("/template fayli o'zi parse qilinadi: 1 ta namuna qator, xatosiz", async () => {
    const { rows, errors } = await parseXlsx(await buildTemplate());
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ model: 'Samsung Galaxy A55', price: 4200000, quantity: 3 });
  });
});
