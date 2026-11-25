import type { Listing } from '@prisma/client';
import { prisma } from '../../db/client.js';
import { cleanDescription, disambiguateTitle, normalizeTitle } from '../content/clean.js';
import { writeIntro } from '../content/describe.js';
import { logEvent } from '../eventLog.js';
import { olxCategoryFor } from '../olx/categories.js';

const SPECS_MARKER = 'Xususiyatlari:';
const MIN_DESCRIPTION = 40;

export interface Draft {
  listing: Listing;
  price: number;
  /** Kirish matnini Claude yozdimi (false: tozalangan oddiy matn). */
  ai: boolean;
}

/**
 * Mahsulotdan e'lon qoralamasini yaratadi (yoki yangilaydi):
 * sarlavha oddiy yozuvga o'tkaziladi, ta'rifdan kafolat/yetkazib berish/qutida olib tashlanadi,
 * kirish matni Claude bilan o'ziga xos qilib yoziladi, xususiyatlar ro'yxati o'zgarishsiz qoladi.
 */
export async function createDraft(
  productId: number,
  options: { ai?: boolean } = {},
): Promise<Draft> {
  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });

  const category = olxCategoryFor(product.category);
  if (!category) throw new Error(`Kategoriya OLX bilan moslanmadi: "${product.category ?? ''}"`);

  const title = normalizeTitle(product.title ?? product.model);
  const cleaned = cleanDescription(product.description ?? '');
  const marker = cleaned.indexOf(SPECS_MARKER);
  const specs = marker >= 0 ? cleaned.slice(marker).trim() : '';
  const plainIntro = (marker >= 0 ? cleaned.slice(0, marker) : cleaned).trim();

  const aiIntro =
    options.ai === false
      ? null
      : await writeIntro({ model: product.model, category: category.path, source: cleaned });
  const description = [aiIntro ?? plainIntro, specs].filter(Boolean).join('\n\n');

  if (title.length < 16) throw new Error(`Sarlavha juda qisqa: "${title}"`);
  if (description.length < MIN_DESCRIPTION) throw new Error("Ta'rif juda qisqa (40 belgidan kam)");

  // Boshqa mahsulotning qoralamasida aynan shu sarlavha bo'lsa, rang qo'shiladi (dublikat bo'lmasin).
  const taken = (
    await prisma.listing.findMany({
      where: { productId: { not: productId } },
      select: { title: true },
    })
  ).map((l) => l.title);
  const uniqueTitle = disambiguateTitle(title, taken, description);

  const data = { title: uniqueTitle, description, olxCategory: category.path };
  const listing = await prisma.listing.upsert({
    where: { productId },
    create: { productId, ...data },
    update: data,
  });
  await logEvent('DRAFT_CREATED', 'Product', productId, { ai: aiIntro !== null });

  return { listing, price: product.price, ai: aiIntro !== null };
}
