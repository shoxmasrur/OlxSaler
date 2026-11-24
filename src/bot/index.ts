import { Bot } from 'grammy';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { whitelist } from './middleware/whitelist.js';
import { registerCommands, setupMenu } from './commands/index.js';
import { registerCallbacks } from './handlers/callbacks.js';
import { registerFileHandlers } from './handlers/files.js';

const bot = new Bot(env.BOT_TOKEN);

// Whitelist eng birinchi: boshqalarga hech narsa yetib bormaydi (FR-1).
bot.use(whitelist);
registerCommands(bot);
registerCallbacks(bot);
registerFileHandlers(bot);

bot.catch((err) => logger.error({ err: err.error }, 'Bot xatosi'));

await setupMenu(bot);

const stop = () => void bot.stop();
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

await bot.start({
  onStart: (me) => logger.info({ username: me.username }, 'Bot ishga tushdi'),
});
