import { prisma } from '../../db/client.js';
import { logEvent } from '../eventLog.js';
import type { ParseResult } from './parse.js';

export interface ImportSummary {
  priceListId: number;
  imported: number;
  errors: ParseResult['errors'];
}

/** Hammasi yoki hech narsa: PriceList va barcha Product'lar bitta tranzaksiyada (FR-4). */
export async function importPriceList(
  fileName: string,
  telegramFileId: string | undefined,
  result: ParseResult,
): Promise<ImportSummary> {
  const { rows, errors } = result;

  const priceList = await prisma.$transaction(async (tx) => {
    const list = await tx.priceList.create({
      data: {
        fileName,
        telegramFileId,
        rowCount: rows.length,
        errorCount: errors.length,
      },
    });
    if (rows.length > 0) {
      await tx.product.createMany({
        data: rows.map((r) => ({
          priceListId: list.id,
          model: r.model,
          price: Math.round(r.price),
          currency: r.currency,
          condition: r.condition,
          quantity: r.quantity,
          category: r.category,
          note: r.note,
          status: 'IMPORTED' as const,
        })),
      });
    }
    return list;
  });

  await logEvent('PRICELIST_IMPORTED', 'PriceList', priceList.id, {
    fileName,
    imported: rows.length,
    errors: errors.length,
  });

  return { priceListId: priceList.id, imported: rows.length, errors };
}

export function formatSummary(s: ImportSummary): string {
  const lines = [`${s.imported} ta mahsulot qabul qilindi.`];
  if (s.errors.length > 0) {
    const shown = s.errors.slice(0, 20).map((e) => `${e.row}-qator — ${e.message}`);
    const more = s.errors.length > 20 ? `\n...va yana ${s.errors.length - 20} ta` : '';
    lines.push(`${s.errors.length} ta xato:\n${shown.join('\n')}${more}`);
  }
  return lines.join('\n');
}
