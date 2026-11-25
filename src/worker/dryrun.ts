import { prisma } from '../db/client.js';
import { logger } from '../lib/logger.js';
import { loadPlan } from '../services/posting/jobs.js';
import { postListing, PostError } from './olx/poster.js';

/**
 * Sinov: formani to'ldiradi, lekin "Опубликовать" ni BOSMAYDI. Natija skrinshot.
 * Ishlatish: npm run olx:dryrun -- <mahsulotId>
 */
const productId = Number(process.argv[2]);
if (!Number.isInteger(productId) || productId <= 0) {
  console.error('Ishlatish: npm run olx:dryrun -- <mahsulotId>');
  process.exit(2);
}

const planResult = await loadPlan(productId);
if (!planResult.ok) {
  console.error(`Reja tuzib bo'lmadi: ${planResult.error}`);
  process.exit(1);
}
const { plan } = planResult;
console.log(
  JSON.stringify(
    { ...plan, description: `${plan.description.slice(0, 80)}...`, category: plan.category.path },
    null,
    2,
  ),
);

try {
  const result = await postListing(plan, { dryRun: true });
  logger.info({ screenshot: result.screenshot }, "Forma to'ldirildi, JOYLANMADI (dry-run)");
  process.exitCode = 0;
} catch (err) {
  if (err instanceof PostError) {
    logger.error({ kind: err.kind, screenshot: err.screenshot }, err.message);
  } else {
    logger.error({ err }, 'Kutilmagan xato');
  }
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
