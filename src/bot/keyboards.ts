import { InlineKeyboard } from 'grammy';

/** Callback data formati: harakat:mahsulotId (masalan approve:42). */
export function parseCallback(data: string): { action: string; productId: number } | null {
  const m = /^([a-z_]+):(\d+)$/.exec(data);
  return m ? { action: m[1]!, productId: Number(m[2]) } : null;
}

export function reviewKeyboard(productId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Tasdiqlash', `approve:${productId}`)
    .text('🔄 Boshqasini top', `retry:${productId}`)
    .row()
    .text("⏭ O'tkazib yubor", `skip:${productId}`);
}
