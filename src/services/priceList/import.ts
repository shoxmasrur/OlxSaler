import { prisma } from '../../db/client.js';
import { logEvent } from '../eventLog.js';
import { splitNew } from './dedupe.js';
import type { ParseResult } from './parse.js';

export interface ImportSummary {
  /** Hammasi oldin yuklangan bo'lsa, yangi ro'yxat yaratilmaydi. */
  priceListId: number | null;
  imported: number;
  /** Bazada allaqachon bor mahsulotlar (qayta yuborilgan fayl). */
  skipped: number;
  errors: ParseResult['errors'];
}

/** Hammasi yoki hech narsa: PriceList va barcha Product'lar bitta tranzaksiyada (FR-4). */
export async function importPriceList(
  fileName: string,
  telegramFileId: string | undefined,
  result: ParseResult,
): Promise<ImportSummary> {
  const { rows, errors } = result;

  const outcome = await prisma.$transaction(async (tx) => {
    // Kod bo'yicha (kodsizlar uchun model bo'yicha) bazada bor mahsulotlar qayta qo'shilmaydi.
    const codes = rows.flatMap((r) => (r.code ? [r.code] : []));
    const models = rows.flatMap((r) => (r.code ? [] : [r.model]));
    const existing = await tx.product.findMany({
      where: { OR: [{ code: { in: codes } }, { code: null, model: { in: models } }] },
      select: { code: true, model: true, category: true },
    });
    const { fresh, skipped } = splitNew(rows, existing);

    if (rows.length > 0 && fresh.length === 0) return { list: null, fresh, skipped };

    const list = await tx.priceList.create({
      data: {
        fileName,
        telegramFileId,
        rowCount: fresh.length,
        errorCount: errors.length,
      },
    });
    if (fresh.length > 0) {
      await tx.product.createMany({
        data: fresh.map((r) => ({
          priceListId: list.id,
          code: r.code,
          title: r.title,
          description: r.description,
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
    return { list, fresh, skipped };
  });

  await logEvent('PRICELIST_IMPORTED', 'PriceList', outcome.list?.id, {
    fileName,
    imported: outcome.fresh.length,
    skipped: outcome.skipped,
    errors: errors.length,
  });

  return {
    priceListId: outcome.list?.id ?? null,
    imported: outcome.fresh.length,
    skipped: outcome.skipped,
    errors,
  };
}

export function formatSummary(s: ImportSummary): string {
  const lines = [`${s.imported} ta mahsulot qabul qilindi.`];
  if (s.skipped > 0) {
    lines.push(`${s.skipped} ta mahsulot oldin yuklangan, o'tkazib yuborildi.`);
  }
  if (s.errors.length > 0) {
    const shown = s.errors.slice(0, 20).map((e) => `${e.row}-qator — ${e.message}`);
    const more = s.errors.length > 20 ? `\n...va yana ${s.errors.length - 20} ta` : '';
    lines.push(`${s.errors.length} ta xato:\n${shown.join('\n')}${more}`);
  }
  return lines.join('\n');
}
