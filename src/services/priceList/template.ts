import ExcelJS from 'exceljs';

export const TEMPLATE_HEADERS = [
  'Model',
  'Narx',
  'Valyuta',
  'Holati',
  'Soni',
  'Kategoriya',
  'Izoh',
] as const;

export const CATALOG_HEADERS = [
  'Kod',
  "E'lon sarlavhasi",
  "Model (to'liq nomi)",
  'Xarakteristika',
  "E'lon matni (opisaniya)",
  "E'londagi narx",
  'Holat',
] as const;

const GUIDE = [
  ['KATALOG FAYLI: BOTGA QANDAY YUBORILADI'],
  [],
  [
    '1. Har kategoriya ALOHIDA VARAQDA. Varaq nomi = kategoriya (masalan: Noutbuk i5, Monitor 27").',
  ],
  [
    '2. Har varaqning 1-qatori sarlavha (nomlarini o`zgartirmang). 2-qatordan boshlab har qatorda BITTA mahsulot.',
  ],
  [
    '3. MAJBURIY ustunlar: "E\'lon sarlavhasi" (OLX\'da 70 belgigacha) va "E\'londagi narx" (so\'mda, faqat raqam: 8200000).',
  ],
  [
    '4. Kod: ixtiyoriy, lekin tavsiya etiladi. Bir xil kodli mahsulot ikkinchi marta qo`shilmaydi (faylni qayta yuborsangiz ham).',
  ],
  [
    "5. Model: to'liq nomi (rasm qidirish shu bo'yicha ishlaydi). Bo'sh qolsa, sarlavha ishlatiladi.",
  ],
  [
    '6. Xarakteristika: har satrda bittadan, "Ekran: 15.6 FHD" ko\'rinishida (Alt+Enter bilan yangi satr).',
  ],
  ["7. E'lon matni: xaridor ko'radigan ta'rif. Holat: ichki izoh (OLX'ga chiqmaydi)."],
  ['8. Boshqa ustunlar (tan narx, foyda va h.k.) o`qilmaydi, ular faylda tursa ham zarar yo`q.'],
  ["9. Rasmlar fayl ichida kerak emas: bot ularni /images buyrug'i bilan o'zi topadi."],
  [],
  ['DIQQAT: "NAMUNA" qatorlarini o\'chirib, o\'zingizning mahsulotlaringizni yozing.'],
];

/** Katalog formatidagi namuna fayl: yo'riqnoma varag'i + 2 ta namunaviy kategoriya varag'i. */
export async function buildCatalogTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  const guide = wb.addWorksheet("Yo'riqnoma");
  GUIDE.forEach((line) => guide.addRow(line));
  guide.getColumn(1).width = 120;
  guide.getRow(1).font = { bold: true, size: 14 };

  const widths = [14, 42, 42, 34, 50, 16, 22];
  const sample = (name: string, rows: (string | number)[][]) => {
    const ws = wb.addWorksheet(name);
    ws.columns = CATALOG_HEADERS.map((header, i) => ({ header, key: header, width: widths[i] }));
    ws.getRow(1).font = { bold: true };
    rows.forEach((r) => ws.addRow(r));
    ws.eachRow((row) =>
      row.eachCell((cell) => {
        cell.alignment = { wrapText: true, vertical: 'top' };
      }),
    );
  };

  sample('Noutbuk i5', [
    [
      'NAMUNA-1',
      'NAMUNA LENOVO V15 I5-13420H 8GB 512GB 15.6 FHD',
      'LENOVO V15 G5 IRL I5-13420H 8GB DDR5 512GB 15.6 FHD GREY',
      'Ekran: 15.6" Full HD\nProtsessor: Intel Core i5-13420H\nOperativ xotira: 8 GB\nXotira: 512 GB SSD',
      "Yangi, qutida, kafolat bilan. Ish va o'qish uchun. Yetkazib berish Toshkent bo'ylab.",
      7060000,
      'Bozor tekshirilgan',
    ],
    [
      'NAMUNA-2',
      'NAMUNA HP 255 G10 R5-7530U 16GB 512GB 15.6 FHD',
      'HP LAPTOP 255 G10 AMD R5-7530U 16GB DDR4 512GB 15.6 FHD',
      'Ekran: 15.6" Full HD\nProtsessor: AMD Ryzen 5 7530U\nOperativ xotira: 16 GB\nXotira: 512 GB SSD',
      'Yangi, kafolat bilan. Naqd va plastik karta qabul qilinadi.',
      6900000,
      '',
    ],
  ]);
  sample('Monitor 27"', [
    [
      'NAMUNA-3',
      'NAMUNA IMMER 27" FLAT FHD IPS 100Hz',
      'IMMER IV27F144 27" FLAT FHD IPS (VGA+2xHDMI)',
      'Ekran o\'lchami: 27"\nAniqlik: Full HD 1920x1080\nPanel: IPS',
      'Yangi monitor, qutida, kafolat bilan.',
      1120000,
      '',
    ],
  ]);

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Namuna jadval: "Valyuta" va "Holati" ustunlari ochiluvchi ro'yxat bilan (FR-3). */
export async function buildTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Narxlar');

  ws.columns = TEMPLATE_HEADERS.map((header) => ({ header, key: header, width: 18 }));
  ws.getRow(1).font = { bold: true };
  ws.addRow(['Samsung Galaxy A55', 4200000, "so'm", 'yangi', 3, 'Telefonlar', '256GB, qora']);

  const MAX_ROW = 500;
  for (let r = 2; r <= MAX_ROW; r++) {
    ws.getCell(`C${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"so\'m,y.e."'],
    };
    ws.getCell(`D${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"yangi,b.u."'],
    };
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
