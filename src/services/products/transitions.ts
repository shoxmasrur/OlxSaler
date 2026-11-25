import type { ProductStatus } from '@prisma/client';

export type ReviewAction = 'approve' | 'skip' | 'retry';

/** Qaysi holatdagi mahsulotga qaysi tugma ta'sir qilishi mumkin. */
const ALLOWED_FROM: Record<ReviewAction, ProductStatus[]> = {
  approve: ['IMAGES_FOUND', 'DRAFT_READY'],
  skip: ['IMPORTED', 'IMAGES_FOUND', 'DRAFT_READY', 'APPROVED'],
  retry: ['IMPORTED', 'IMAGES_FOUND'],
};

/** Tugma bosilgandan keyingi holat (retry holatni o'zgartirmaydi). */
export const TARGET_STATUS: Partial<Record<ReviewAction, ProductStatus>> = {
  approve: 'APPROVED',
  skip: 'SKIPPED',
};

export function allowedFrom(action: ReviewAction): ProductStatus[] {
  return ALLOWED_FROM[action];
}

export function canReview(status: ProductStatus, action: ReviewAction): boolean {
  return ALLOWED_FROM[action].includes(status);
}

export function isReviewAction(value: string): value is ReviewAction {
  return value === 'approve' || value === 'skip' || value === 'retry';
}
