import type { Bot } from 'grammy';
import { InlineKeyboard, InputFile } from 'grammy';
import { buildTemplate } from '../../services/priceList/template.js';

const soon = 'Tez orada...';

export function registerCommands(bot: Bot) {
  bot.command('start', (ctx) => ctx.reply('Salom! Narxlar jadvalini yuboring.'));
  bot.command('help', (ctx) => ctx.reply(soon));
  bot.command('template', async (ctx) =>
    ctx.replyWithDocument(new InputFile(await buildTemplate(), 'template.xlsx')),
  );
  bot.command('status', (ctx) => ctx.reply(soon));
  bot.command('list', (ctx) => ctx.reply(soon));
  bot.command('pause', (ctx) => ctx.reply(soon));
  bot.command('resume', (ctx) => ctx.reply(soon));

  // Qadam 3.4 sinovi uchun vaqtinchalik buyruq (6.5-qadamda preview bilan almashadi).
  bot.command('buttons', (ctx) =>
    ctx.reply("Tugmani sinab ko'ring:", {
      reply_markup: new InlineKeyboard().text('Ha', 'approve:42').text("Yo'q", 'skip:42'),
    }),
  );
}

export async function setupMenu(bot: Bot) {
  await bot.api.setMyCommands([
    { command: 'start', description: 'Botni boshlash' },
    { command: 'help', description: 'Yordam' },
    { command: 'template', description: 'Namuna Excel shablon' },
    { command: 'status', description: 'Holat' },
    { command: 'list', description: "Oxirgi e'lonlar" },
    { command: 'pause', description: "Workerni to'xtatish" },
    { command: 'resume', description: 'Workerni davom ettirish' },
  ]);
}
