import type { Bot } from 'grammy';
import { InputFile } from 'grammy';
import { buildCatalogTemplate } from '../../services/priceList/template.js';
import { registerControlCommands } from './control.js';
import { registerDraftCommand } from './draft.js';
import { registerImageCommand } from './images.js';
import { registerReviewCommand } from './review.js';

const soon = 'Tez orada...';

export function registerCommands(bot: Bot) {
  bot.command('start', (ctx) => ctx.reply('Salom! Narxlar jadvalini yuboring.'));
  bot.command('help', (ctx) => ctx.reply(soon));
  bot.command('template', async (ctx) =>
    ctx.replyWithDocument(new InputFile(await buildCatalogTemplate(), 'katalog_namuna.xlsx')),
  );
  bot.command('list', (ctx) => ctx.reply(soon));
  registerControlCommands(bot);
  registerImageCommand(bot);
  registerReviewCommand(bot);
  registerDraftCommand(bot);
}

export async function setupMenu(bot: Bot) {
  await bot.api.setMyCommands([
    { command: 'start', description: 'Botni boshlash' },
    { command: 'help', description: 'Yordam' },
    { command: 'template', description: 'Namuna Excel shablon' },
    { command: 'images', description: 'Mahsulotlarga rasm topish' },
    { command: 'review', description: 'Rasmlarni tasdiqlash' },
    { command: 'draft', description: "E'lon qoralamasi va yakuniy tasdiq" },
    { command: 'status', description: 'Holat' },
    { command: 'list', description: "Oxirgi e'lonlar" },
    { command: 'pause', description: "Joylashni to'xtatish" },
    { command: 'resume', description: 'Joylashni davom ettirish' },
  ]);
}
