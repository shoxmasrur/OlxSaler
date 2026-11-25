import type { Api } from 'grammy';
import { InputFile, InputMediaBuilder } from 'grammy';
import { reviewKeyboard } from '../keyboards.js';

/**
 * Rasmlarni albom qilib yuboradi va ostiga tasdiqlash tugmalarini qo'yadi.
 * Telegram albomga tugma biriktirishga ruxsat bermaydi, shuning uchun tugmalar alohida xabarda.
 * Rasm bo'lmasa false qaytaradi (hech narsa yuborilmaydi).
 */
export async function sendAlbum(
  api: Api,
  chatId: number,
  product: { id: number; model: string },
  files: string[],
  info: string,
): Promise<boolean> {
  if (files.length === 0) return false;

  const caption = `#${product.id} ${product.model}`.slice(0, 200) + `\n${info}`;

  if (files.length === 1) {
    await api.sendPhoto(chatId, new InputFile(files[0]!), { caption });
  } else {
    await api.sendMediaGroup(
      chatId,
      files.map((f, i) => InputMediaBuilder.photo(new InputFile(f), i === 0 ? { caption } : {})),
    );
  }
  await api.sendMessage(chatId, `#${product.id}: shu rasmlar mosmi?`, {
    reply_markup: reviewKeyboard(product.id),
  });
  return true;
}

/** Qidiruv natijasi uchun standart izoh. */
export const searchInfo = (query: string, count: number, tried: number) =>
  `So'rov: "${query}" (${count} ta rasm, ${tried} ta urinish)`;
