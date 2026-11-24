import type { Context, NextFunction } from 'grammy';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';

// FR-1: faqat egasiga javob beradi.
export async function whitelist(ctx: Context, next: NextFunction) {
  if (ctx.from?.id === env.OWNER_TELEGRAM_ID) {
    return next();
  }
  logger.warn({ fromId: ctx.from?.id }, 'Ruxsatsiz urinish');
  if (ctx.chat) {
    await ctx.reply("Ruxsat yo'q");
  }
}
