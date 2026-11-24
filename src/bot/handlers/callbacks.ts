import type { Bot } from 'grammy';
import { logger } from '../../lib/logger.js';

// Callback data formati: action:productId (masalan approve:42)
export function parseCallback(data: string): { action: string; productId: number } | null {
  const m = /^([a-z_]+):(\d+)$/.exec(data);
  return m ? { action: m[1]!, productId: Number(m[2]) } : null;
}

export function registerCallbacks(bot: Bot) {
  bot.on('callback_query:data', async (ctx) => {
    const parsed = parseCallback(ctx.callbackQuery.data);
    await ctx.answerCallbackQuery();
    if (!parsed) return;
    logger.info(parsed, 'Callback');
    await ctx.editMessageText(`Tanlandi: ${parsed.action} (mahsulot ${parsed.productId})`);
  });
}
