import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../../db/client.js';
import { logEvent } from '../eventLog.js';
import { queueForPosting } from '../posting/queue.js';

const IMAGES_DIR = path.resolve('storage/images');

/**
 * Rasm izohidan mahsulot raqamini oladi: "#62", "#62 oq rang" yoki faqat "62".
 * Raqam topilmasa null.
 */
export function parseProductTag(caption: string | undefined | null): number | null {
  if (!caption) return null;
  const m = caption.match(/#\s*(\d{1,6})\b/) ?? caption.trim().match(/^(\d{1,6})\b/);
  return m ? Number(m[1]) : null;
}

/**
 * Albomda izoh faqat birinchi rasmda keladi: qolgan rasmlar media_group_id orqali
 * shu mahsulotga bog'lanadi. Yozuvlar 10 daqiqadan keyin unutiladi.
 */
export class MediaGroupMemory {
  private readonly map = new Map<string, { productId: number; at: number }>();
  constructor(private readonly ttlMs = 10 * 60_000) {}

  remember(groupId: string, productId: number, now = Date.now()) {
    this.map.set(groupId, { productId, at: now });
  }

  recall(groupId: string, now = Date.now()): number | null {
    for (const [k, v] of this.map) if (now - v.at > this.ttlMs) this.map.delete(k);
    return this.map.get(groupId)?.productId ?? null;
  }
}

export type AttachResult =
  | { ok: true; productId: number; ownerImages: number; queued: boolean; status: string }
  | { ok: false; error: string };

/**
 * Egasi yuborgan haqiqiy rasmni mahsulotga biriktiradi.
 * Birinchi haqiqiy rasm kelganda qidiruvdan topilgan (SEARCH) rasmlar tanlovdan chiqariladi:
 * e'londa faqat egasining rasmlari bo'ladi. SKIPPED mahsulot qoralamasi bo'lsa APPROVED ga
 * qaytadi va joylash navbatiga qo'yiladi (tasdiq baribir har e'londan oldin Telegram'da so'raladi).
 */
export async function attachOwnerPhoto(productId: number, data: Buffer): Promise<AttachResult> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { listing: true },
  });
  if (!product) return { ok: false, error: `#${productId} mahsulot topilmadi` };
  if (product.status === 'POSTED' || product.status === 'POSTING') {
    return { ok: false, error: `#${productId} allaqachon joylangan` };
  }

  const dir = path.join(IMAGES_DIR, String(productId));
  await mkdir(dir, { recursive: true });
  const localPath = path.join(dir, `owner-${Date.now()}.jpg`);
  await writeFile(localPath, data);

  const before = await prisma.productImage.count({ where: { productId, source: 'USER' } });
  await prisma.$transaction(async (tx) => {
    if (before === 0) {
      await tx.productImage.updateMany({
        where: { productId, source: 'SEARCH' },
        data: { selected: false },
      });
    }
    await tx.productImage.create({
      data: { productId, localPath, source: 'USER', selected: true },
    });
    if (product.status === 'SKIPPED' || product.status === 'IMPORTED') {
      await tx.product.update({
        where: { id: productId },
        data: { status: product.listing ? 'APPROVED' : 'IMAGES_FOUND' },
      });
    }
  });
  await logEvent('OWNER_PHOTO_ADDED', 'Product', productId);

  const queued = (await queueForPosting(productId)).ok;
  const fresh = await prisma.product.findUnique({ where: { id: productId } });
  return {
    ok: true,
    productId,
    ownerImages: before + 1,
    queued,
    status: fresh?.status ?? product.status,
  };
}
