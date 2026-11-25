import { prisma } from '../../db/client.js';
import { findImagesForProduct } from '../images/find.js';
import { createDraft } from '../listings/draft.js';
import { applyReview } from '../products/review.js';
import { ACTIVE_JOB_STATUSES } from './jobs.js';
import { queueForPosting } from './queue.js';

export const MAX_IMAGE_TRIES = 2;

export interface PrepareOutcome {
  productId: number;
  model: string;
  ok: boolean;
  /** Qaysi bosqichda to'xtadi (xato bo'lsa). */
  step?: 'images' | 'approve' | 'draft' | 'queue';
  message?: string;
}

/** Rasmi 2 marta topilmagan mahsulotlar: navbatni to'smasin va Brave kreditini yemasin. */
export async function productsGivenUp(): Promise<number[]> {
  const failed = await prisma.eventLog.groupBy({
    by: ['entityId'],
    where: { type: 'IMAGES_NOT_FOUND', entityType: 'Product' },
    _count: { _all: true },
  });
  return failed
    .filter((f) => f.entityId !== null && f._count._all >= MAX_IMAGE_TRIES)
    .map((f) => f.entityId as number);
}

/** Joylashga tayyorlanishi mumkin bo'lgan keyingi mahsulotlar. */
export async function nextToPrepare(count: number) {
  const giveUp = await productsGivenUp();
  const noActiveJob = { jobs: { none: { status: { in: ACTIVE_JOB_STATUSES } } } };
  return prisma.product.findMany({
    where: {
      OR: [
        { status: 'IMAGES_FOUND', ...noActiveJob },
        { status: 'APPROVED', ...noActiveJob },
        { status: 'IMPORTED', id: { notIn: giveUp } },
      ],
    },
    orderBy: { id: 'asc' },
    take: count,
    select: { id: true, model: true },
  });
}

/**
 * Bitta mahsulotni navbatga tayyorlaydi: rasm (kerak bo'lsa) -> rasmni tasdiqlash -> qoralama -> navbat.
 * Joylashdan oldingi YAKUNIY tasdiq baribir egasidan so'raladi (albom va to'liq ma'lumot bilan).
 */
export async function prepareProduct(productId: number): Promise<PrepareOutcome> {
  const product = await prisma.product.findUniqueOrThrow({
    where: { id: productId },
    select: { model: true, status: true },
  });
  const base = { productId, model: product.model };
  const fail = (step: PrepareOutcome['step'], message: string): PrepareOutcome => ({
    ...base,
    ok: false,
    step,
    message,
  });

  try {
    if (product.status === 'IMPORTED') {
      const found = await findImagesForProduct(productId);
      if (found.files.length === 0) return fail('images', 'rasm topilmadi');
    }

    const current = await prisma.product.findUniqueOrThrow({
      where: { id: productId },
      select: { status: true },
    });
    if (current.status === 'IMAGES_FOUND') {
      const approved = await applyReview(productId, 'approve');
      if (!approved.ok) return fail('approve', `holat: ${approved.status ?? "noma'lum"}`);
    }

    await createDraft(productId);

    const queued = await queueForPosting(productId);
    if (!queued.ok && queued.reason !== 'already_queued') return fail('queue', queued.reason);
    return { ...base, ok: true };
  } catch (err) {
    return fail(undefined, err instanceof Error ? err.message : String(err));
  }
}
