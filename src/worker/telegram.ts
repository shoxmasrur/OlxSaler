import { Api, InputFile, InputMediaBuilder } from 'grammy';
import { confirmKeyboard } from '../bot/keyboards.js';
import { formatPostConfirmation, type ConfirmContext } from '../bot/preview.js';
import type { PostPlan } from '../services/posting/plan.js';

/**
 * Ishchi Telegram'dan faqat xabar YUBORADI (polling yo'q: bot jarayoni bilan 409 to'qnashuvi
 * bo'lmasligi uchun). Tugma bosilishini bot jarayoni qabul qilib, bazaga yozadi.
 */
export function createApi(token: string): Api {
  return new Api(token);
}

export async function notify(api: Api, chatId: number, text: string): Promise<void> {
  await api.sendMessage(chatId, text.slice(0, 4000));
}

/** To'liq e'lon ma'lumoti + rasmlar albomi + "Joylash / Keyinroq / Bekor" tugmalari. */
export async function sendConfirmation(
  api: Api,
  chatId: number,
  plan: PostPlan,
  ctx: ConfirmContext,
): Promise<void> {
  const caption = `#${plan.productId} ${plan.title}`.slice(0, 200);
  if (plan.images.length === 1) {
    await api.sendPhoto(chatId, new InputFile(plan.images[0]!), { caption });
  } else {
    await api.sendMediaGroup(
      chatId,
      plan.images
        .slice(0, 10)
        .map((f, i) => InputMediaBuilder.photo(new InputFile(f), i === 0 ? { caption } : {})),
    );
  }
  await api.sendMessage(chatId, formatPostConfirmation(plan, ctx), {
    reply_markup: confirmKeyboard(plan.productId),
  });
}
