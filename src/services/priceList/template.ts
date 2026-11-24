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
