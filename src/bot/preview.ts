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
