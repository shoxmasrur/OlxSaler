import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../../db/client.js';
import { logEvent } from '../eventLog.js';
import { searchImages, type ImageCandidate } from './brave.js';
import { downloadImage, MIN_SIDE, RejectError } from './download.js';

const IMAGES_DIR = path.resolve('storage/images');
const WANT = 3;
const MAX_ATTEMPTS = 12;

// Ishlab chiqaruvchi saytlari oldinga chiqariladi: rasmlari toza va aniq modelniki.
const MANUFACTURERS = [
  'hp.com',
  'asus.com',
  'lenovo.com',
  'acer.com',
  'dell.com',
  'gigabyte.com',
  'msi.com',
  'samsung.com',
  'lg.com',
  'philips.com',
  'aoc.com',
  'benq.com',
  'xiaomi.com',
  'huawei.com',
  'apple.com',
];

export interface FindResult {
  productId: number;
  query: string;
  /** Saqlangan JPG fayllar yo'llari. */
  files: string[];
  tried: number;
  /** Rad etish sabablari va soni. */
  rejected: Record<string, number>;
}

/** Modelning boshidan 6 ta so'z: brend + seriya + model kodi yetarli. */
export function buildQuery(model: string): string {
  return model.replace(/["“”]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 6).join(' ');
}

const isManufacturer = (source: string) =>
  MANUFACTURERS.some((d) => source === d || source.endsWith(`.${d}`));

export function rankCandidates(list: ImageCandidate[]): ImageCandidate[] {
  const unique = [...new Map(list.map((c) => [c.url, c])).values()];
  // Array.sort barqaror: bir xil darajadagilar Brave tartibida qoladi.
  return unique.sort(
    (a, b) => Number(!isManufacturer(a.source)) - Number(!isManufacturer(b.source)),
  );
}

export async function findImagesForProduct(productId: number): Promise<FindResult> {
  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
  const query = buildQuery(product.model);
  const candidates = rankCandidates(await searchImages(query, 30));

  const accepted: { url: string; data: Buffer; width: number; height: number }[] = [];
  const seen = new Set<string>();
  const rejected: Record<string, number> = {};
  const reject = (reason: string) => {
    const key = reason.split(' (')[0]!;
    rejected[key] = (rejected[key] ?? 0) + 1;
  };

  let tried = 0;
  for (const c of candidates) {
    if (accepted.length >= WANT || tried >= MAX_ATTEMPTS) break;
    // Brave o'lchamni bersa, kichik rasmni yuklab olmaymiz.
    if (c.width && c.height && Math.min(c.width, c.height) < MIN_SIDE) {
      reject('kichik');
      continue;
    }
    tried++;
    try {
      const img = await downloadImage(c.url);
      if (seen.has(img.sha256)) {
        reject('dublikat');
        continue;
      }
      seen.add(img.sha256);
      accepted.push({ url: c.url, data: img.data, width: img.width, height: img.height });
    } catch (err) {
      reject(err instanceof RejectError ? err.message : "yuklab bo'lmadi");
    }
  }

  const dir = path.join(IMAGES_DIR, String(productId));
  await rm(dir, { recursive: true, force: true });
  const files: string[] = [];
  if (accepted.length > 0) {
    await mkdir(dir, { recursive: true });
    for (const [i, img] of accepted.entries()) {
      const file = path.join(dir, `${i + 1}.jpg`);
      await writeFile(file, img.data);
      files.push(file);
    }
  }

  await prisma.$transaction(async (tx) => {
    // Qayta qidirilsa, eski qidiruv rasmlari almashtiriladi.
    await tx.productImage.deleteMany({ where: { productId, source: 'SEARCH' } });
    if (accepted.length > 0) {
      await tx.productImage.createMany({
        data: accepted.map((img, i) => ({
          productId,
          sourceUrl: img.url,
          localPath: files[i]!,
          width: img.width,
          height: img.height,
          source: 'SEARCH' as const,
          selected: true,
        })),
      });
      if (product.status === 'IMPORTED') {
        await tx.product.update({ where: { id: productId }, data: { status: 'IMAGES_FOUND' } });
      }
    }
  });

  await logEvent(accepted.length > 0 ? 'IMAGES_FOUND' : 'IMAGES_NOT_FOUND', 'Product', productId, {
    query,
    found: accepted.length,
    tried,
    rejected,
  });

  return { productId, query, files, tried, rejected };
}
