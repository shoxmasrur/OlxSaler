import { prisma } from '../src/db/client.js';

const defaults: Record<string, string> = {
  DAILY_POST_LIMIT: '10',
  PAUSE_MIN: '120',
  PAUSE_MAX: '300',
  WORKER_PAUSED: 'false',
};

for (const [key, value] of Object.entries(defaults)) {
  await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value } });
}

console.log("Setting to'ldirildi:", Object.keys(defaults).join(', '));
await prisma.$disconnect();
