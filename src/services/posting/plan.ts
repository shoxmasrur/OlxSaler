import { olxCategoryFor, type OlxCategory } from '../olx/categories.js';

export type Diagonal = 'До 13"' | '13"-14"' | '15"-15,6"' | '16"-17"' | 'От 18"';

/** Formaga kiritiladigan hamma narsa. Tasdiq xabari va brauzer shu bir obyektdan foydalanadi. */
export interface PostPlan {
  productId: number;
  title: string;
  description: string;
  price: number;
  currency: 'сум';
  category: OlxCategory;
  sellerType: 'Бизнес';
  condition: 'Новый';
  /** Faqat noutbuklar uchun majburiy. */
  diagonal: Diagonal | null;
  /** Brend (modelning birinchi so'zi); OLX ro'yxatidagi variantga keyin moslanadi. */
  brand: string;
  images: string[];
}

export interface PlanInput {
  productId: number;
  model: string;
  price: number;
  categorySheet: string | null;
  title: string;
  description: string;
  images: string[];
}

/** 15,6 / 15.6 / 15" -> son. Faqat ekran uchun mantiqiy oraliqdagi (9-50) qiymatlar. */
function parseInches(raw: string): number | null {
  const n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) && n >= 9 && n <= 50 ? n : null;
}

export function diagonalBucket(inches: number): Diagonal {
  if (inches < 13) return 'До 13"';
  if (inches < 15) return '13"-14"';
  if (inches < 16) return '15"-15,6"';
  if (inches < 18) return '16"-17"';
  return 'От 18"';
}

/** Avval sarlavhadagi "15,6 FHD" kabi yozuvdan, keyin xususiyatlardagi "Ekran: 15"" qatoridan. */
export function findDiagonal(title: string, description: string): Diagonal | null {
  const fromSpecs = /Ekran(?: o'lchami)?:\s*(\d{2}(?:[.,]\d)?)\s*"/i.exec(description)?.[1];
  const fromTitle =
    /(?:^|\s)(\d{2}(?:[.,]\d)?)\s*(?:"|''|FHD|WUXGA|WQXGA|QHD|HD|OLED|IPS|2K|3K)/i.exec(title)?.[1];
  // Sarlavhadagi son aniqroq (15,6), xususiyatlardagi qisqartirilgan bo'lishi mumkin (15").
  // Oxirgi chora: ta'rif matnidagi "15.3 dyuymli" (sarlavha qisqartirilgan, xususiyatda faqat "WUXGA").
  const fromText = /(\d{2}(?:[.,]\d)?)\s*dyuym/i.exec(description)?.[1];
  const inches = parseInches(fromTitle ?? fromSpecs ?? fromText ?? '');
  return inches === null ? null : diagonalBucket(inches);
}

export type PlanResult = { ok: true; plan: PostPlan } | { ok: false; error: string };

export function buildPostPlan(input: PlanInput): PlanResult {
  const category = olxCategoryFor(input.categorySheet);
  if (!category) {
    return { ok: false, error: `Kategoriya moslanmadi: "${input.categorySheet ?? ''}"` };
  }
  if (input.images.length === 0) return { ok: false, error: 'Rasm yo`q' };
  if (input.title.length < 16 || input.title.length > 70) {
    return { ok: false, error: `Sarlavha uzunligi ${input.title.length} (16-70 bo'lishi kerak)` };
  }
  if (input.description.length < 40) return { ok: false, error: "Ta'rif 40 belgidan qisqa" };
  if (input.price <= 0) return { ok: false, error: "Narx noto'g'ri" };

  const diagonal = category.laptopFields ? findDiagonal(input.title, input.description) : null;
  if (category.laptopFields && !diagonal) {
    return { ok: false, error: 'Ekran diagonali aniqlanmadi (noutbuk uchun majburiy)' };
  }

  return {
    ok: true,
    plan: {
      productId: input.productId,
      title: input.title,
      description: input.description,
      price: input.price,
      currency: 'сум',
      category,
      sellerType: 'Бизнес',
      condition: 'Новый',
      diagonal,
      brand: input.model.trim().split(/\s+/)[0] ?? '',
      images: input.images,
    },
  };
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/**
 * OLX ro'yxatidan mos variantni tanlaydi: aniq (registrsiz) moslik, keyin "Другая марка"/"Другое".
 * Hech biri bo'lmasa null (ishchi to'xtab, egasiga xabar beradi; taxmin qilib tanlamaydi).
 */
export function pickOption(options: string[], wanted: string): string | null {
  const w = norm(wanted);
  const exact = w ? options.find((o) => norm(o) === w) : undefined;
  if (exact) return exact;
  return options.find((o) => /друг|проч|other/i.test(o)) ?? null;
}

/** Modeldagi kod (harf+raqam aralash, kamida 5 belgi), masalan "15-FC0075NIA" -> "15fc0075nia". */
export function modelCode(model: string): string | null {
  const token = model
    .split(/\s+/)
    .map(norm)
    .find((t) => t.length >= 5 && /\d/.test(t) && /\p{L}/u.test(t));
  return token ?? null;
}

/** Hisobdagi mavjud e'lon sarlavhalaridan birida shu mahsulotning kodi bormi (takrorlanish). */
export function findDuplicate(model: string, existingTitles: string[]): string | null {
  const code = modelCode(model);
  if (!code) return null;
  return existingTitles.find((t) => norm(t).includes(code)) ?? null;
}
