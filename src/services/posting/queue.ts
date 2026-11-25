import { prisma } from '../../db/client.js';

export type QueueResult =
  | { ok: true; jobId: number }
  | { ok: false; reason: 'not_approved' | 'no_draft' | 'already_queued' };

const ACTIVE = ['PENDING', 'RUNNING'];

/**
 * Egasi yakuniy tasdiqlagan e'lonni joylash navbatiga qo'yadi. Job mavjudligi "egasi tasdiqladi"
 * degani. Bitta mahsulotga faqat bitta faol Job: ikki marta bosilsa ikki e'lon bo'lmaydi.
 */
export async function queueForPosting(productId: number): Promise<QueueResult> {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: productId },
      include: { listing: true, jobs: { where: { status: { in: ACTIVE } } } },
    });
    if (!product || product.status !== 'APPROVED') return { ok: false, reason: 'not_approved' };
    if (!product.listing) return { ok: false, reason: 'no_draft' };
    if (product.jobs.length > 0) return { ok: false, reason: 'already_queued' };

    const job = await tx.job.create({ data: { type: 'POST', productId, status: 'PENDING' } });
    await tx.eventLog.create({
      data: {
        type: 'JOB_QUEUED',
        entityType: 'Product',
        entityId: productId,
        payload: { jobId: job.id },
      },
    });
    return { ok: true, jobId: job.id };
  });
}
