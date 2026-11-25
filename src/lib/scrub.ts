// Telegram so'rov manzili tokenni o'z ichiga oladi: https://api.telegram.org/bot<id>:<token>/method
const TELEGRAM_TOKEN = /bot\d{6,}:[A-Za-z0-9_-]{30,}/g;

/** Logga yozishdan oldin sirlarni (bot tokeni) yashiradi. */
export function scrubSecrets(text: string, exactToken = process.env.BOT_TOKEN): string {
  let out = text.replace(TELEGRAM_TOKEN, 'bot<TOKEN>');
  if (exactToken) out = out.split(exactToken).join('<TOKEN>');
  return out;
}
