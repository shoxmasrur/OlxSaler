import dns from 'node:dns';
import net from 'node:net';
import { readFile } from 'node:fs/promises';
import { env } from '../config/env.js';
import { prisma } from '../db/client.js';
import { logger } from '../lib/logger.js';
import { formatChatChanges, ingestSnapshot } from '../services/stats/ingest.js';
import { createApi, notify } from '../worker/telegram.js';

dns.setDefaultResultOrder('ipv4first');
net.setDefaultAutoSelectFamily(false);

/** Foydalanish: `npm run stats:ingest -- <snapshot.json>` (scripts/olx-stats-collect.js natijasi). */
const file = process.argv[2];
if (!file) {
  console.error('Fayl ko`rsatilmadi: npm run stats:ingest -- <snapshot.json>');
  process.exit(1);
}

try {
  const res = await ingestSnapshot(JSON.parse(await readFile(file, 'utf8')));
  logger.info(
    { ads: res.ads, matched: res.matched, chatChanges: res.chatChanges.length },
    'Statistika saqlandi',
  );
  const text = formatChatChanges(res.chatChanges);
  if (text) await notify(createApi(env.BOT_TOKEN), env.OWNER_TELEGRAM_ID, text);
} finally {
  await prisma.$disconnect();
}
