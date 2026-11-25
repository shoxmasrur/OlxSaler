import type { Bot } from 'grammy';
import { prisma } from '../../db/client.js';
import { DEFAULT_GUARD, evaluateGuard, localDateKey } from '../../services/posting/guard.js';
import { getSetting, isPaused, postedStats, setSetting } from '../../services/posting/jobs.js';

const REASONS = {
  paused: 'pauza yoqilgan',
  daily_limit: 'kunlik limit tugadi',
  outside_hours: 'ruxsat etilgan soatdan tashqari (09:00-20:00 Toshkent)',
  too_soon: "oxirgi e'londan keyingi tanaffus tugamagan",
} as const;

const fmt = (d: Date) =>
  new Intl.DateTimeFormat('ru-RU', {
    timeZone: DEFAULT_GUARD.timeZone,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);

export function registerControlCommands(bot: Bot) {
  bot.command('pause', async (ctx) => {
    await setSetting('paused', '1');
    await ctx.reply("⏸ Joylash to'xtatildi. Davom ettirish: /resume");
  });

  bot.command('resume', async (ctx) => {
    await setSetting('paused', '0');
    await ctx.reply('▶️ Joylash davom etadi (interval qoidalariga amal qilinadi).');
  });

  bot.command('status', async (ctx) => {
    const [products, jobs, stats, paused, gap] = await Promise.all([
      prisma.product.groupBy({ by: ['status'], _count: true }),
      prisma.job.groupBy({ by: ['status'], _count: true, where: { type: 'POST' } }),
      postedStats(),
      isPaused(),
      getSetting('gap_ms'),
    ]);
    const now = new Date();
    const guard = evaluateGuard({
      now,
      postedToday: stats.postedToday,
      lastPostedAt: stats.lastPostedAt,
      paused,
      requiredGapMs: gap ? Number(gap) : undefined,
    });
    const line = (rows: { status: string; _count: number }[]) =>
      rows.length ? rows.map((r) => `${r.status}: ${r._count}`).join(', ') : "yo'q";
    const verdict = guard.allowed
      ? '✅ Hozir joylashga ruxsat bor'
      : `⛔ Hozir joylanmaydi: ${REASONS[guard.reason]}${
          guard.reason === 'too_soon' && guard.retryAfter
            ? ` (${fmt(guard.retryAfter)} dan keyin)`
            : ''
        }`;

    await ctx.reply(
      [
        `📊 Holat (${localDateKey(now, DEFAULT_GUARD.timeZone)})`,
        `Mahsulotlar: ${line(products)}`,
        `Joylash vazifalari: ${line(jobs)}`,
        `Bugun joylangan: ${stats.postedToday}/${DEFAULT_GUARD.dailyLimit}`,
        `Oxirgi e'lon: ${stats.lastPostedAt ? fmt(stats.lastPostedAt) : "hali yo'q"}`,
        paused ? '⏸ Pauza: YOQILGAN' : "▶️ Pauza: o'chiq",
        verdict,
      ].join('\n'),
    );
  });
}
