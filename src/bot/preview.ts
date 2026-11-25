import type { PostPlan } from '../services/posting/plan.js';

const TELEGRAM_LIMIT = 4096;

/** 8200000 -> "8 200 000" */
export const formatPrice = (price: number) => String(price).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export interface PreviewInput {
  productId: number;
  title: string;
  description: string;
  olxCategory: string;
  price: number;
  /** Kirish matnini Claude yozdimi. */
  ai?: boolean;
}

/** E'londa aynan nima chiqishini ko'rsatadi: egasi yakuniy tasdiqdan oldin o'qiydi. */
export function formatPreview(p: PreviewInput): string {
  const head = [
    `📝 #${p.productId}: e'lon qoralamasi${p.ai ? '' : ' (oddiy matn, AI ishlatilmadi)'}`,
    `Kategoriya: ${p.olxCategory}`,
    `Narx: ${formatPrice(p.price)} so'm`,
    `Sarlavha (${p.title.length}/70): ${p.title}`,
    '',
  ].join('\n');
  const room = TELEGRAM_LIMIT - head.length - 50;
  const body = p.description.length > room ? `${p.description.slice(0, room)}...` : p.description;
  return head + body;
}

export interface ConfirmContext {
  postedToday: number;
  dailyLimit: number;
}

/**
 * Joylashdan oldingi yakuniy so'rov: OLX formasiga aynan nima kiritilishi.
 * Telefon va joylashuv OLX profilidan avtomatik to'ladi (dastur ularga tegmaydi).
 */
export function formatPostConfirmation(plan: PostPlan, ctx: ConfirmContext): string {
  const head = [
    `🧾 #${plan.productId}: OLX'ga joylashga tayyor. Tasdiqlaysizmi?`,
    `Bugun joylangan: ${ctx.postedToday}/${ctx.dailyLimit}`,
    '',
    `Kategoriya: ${plan.category.path}`,
    `Sarlavha (${plan.title.length}/70): ${plan.title}`,
    `Narx: ${formatPrice(plan.price)} ${plan.currency}`,
    `Turi: ${plan.sellerType} | Holat: ${plan.condition}`,
    ...(plan.diagonal
      ? [`Diagonal: ${plan.diagonal} | Marka: ${plan.brand}`]
      : [`Marka: ${plan.brand}`]),
    `Rasmlar: ${plan.images.length} ta (yuqoridagi albom)`,
    'Joylashuv va aloqa: OLX profilingizdan (Toshkent, Yunusobod; Shohruh)',
    '',
    "Ta'rif:",
  ].join('\n');
  const room = TELEGRAM_LIMIT - head.length - 50;
  const body =
    plan.description.length > room ? `${plan.description.slice(0, room)}...` : plan.description;
  return `${head}\n${body}`;
}
