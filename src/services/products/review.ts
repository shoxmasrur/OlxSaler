import type { ProductStatus } from '@prisma/client';
import { prisma } from '../../db/client.js';
import { logEvent } from '../eventLog.js';
import { allowedFrom, TARGET_STATUS } from './transitions.js';

export interface ReviewResult {
  ok: boolean;
  /** Tugma bosilgandan keyingi (yoki ok=false bo'lsa, hozirgi) holat. */
  status: ProductStatus | null;
}

/**
 * Tasdiqlash yoki o'tkazib yuborish. Holat sharti bazaning o'zida tekshiriladi
 * (updateMany), shuning uchun tugma ikki marta bosilsa ham ikki marta ishlamaydi.
 */
export async function applyReview(
  productId: number,
  action: 'approve' | 'skip',
): Promise<ReviewResult> {
  const target = TARGET_STATUS[action]!;
  const { count } = await prisma.product.updateMany({
    where: { id: productId, status: { in: allowedFrom(action) } },
    data: { status: target },
  });

  if (count === 1) {
    await logEvent(
      action === 'approve' ? 'PRODUCT_APPROVED' : 'PRODUCT_SKIPPED',
      'Product',
      productId,
    );
    return { ok: true, status: target };
  }
  const current = await prisma.product.findUnique({
    where: { id: productId },
    select: { status: true },
  });
  return { ok: false, status: current?.status ?? null };
}
