import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Bot, Context } from 'grammy';
import { fileTypeFromBuffer } from 'file-type';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { parseCsvBuffer, parseXlsx } from '../../services/priceList/parse.js';
import { formatSummary, importPriceList } from '../../services/priceList/import.js';
import {
  MediaGroupMemory,
  attachOwnerPhoto,
  parseProductTag,
} from '../../services/images/ownerPhotos.js';

const UPLOADS = path.resolve('storage/uploads');
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function download(ctx: Context, fileId: string) {
  const file = await ctx.api.getFile(fileId);
  const res = await fetch(`https://api.telegram.org/file/bot${env.BOT_TOKEN}/${file.file_path}`);
  if (!res.ok) throw new Error(`Yuklab bo'lmadi: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function save(dir: string, name: string, data: Buffer) {
  await mkdir(dir, { recursive: true });
  const target = path.join(dir, `${Date.now()}-${name}`);
  await writeFile(target, data);
  return target;
}

const PHOTO_HINT =
  "Rasm qabul qilindi, lekin mahsulotga bog'lanmadi. Bog'lash uchun izohga mahsulot raqamini " +
  'yozing, masalan: #62 (albomda izoh birinchi rasmda bo\'lsa yetarli).';

const groups = new MediaGroupMemory();

/**
 * Izohda "#62" bo'lsa (yoki albomning birinchi rasmida bo'lgan bo'lsa) rasmni o'sha mahsulotga
 * biriktiradi va javob beradi. Mahsulot raqami topilmasa false (rasm oddiy yuklama sifatida saqlanadi).
 */
async function attachToProduct(ctx: Context, buf: Buffer): Promise<boolean> {
  const msg = ctx.message!;
  const groupId = msg.media_group_id;
  let productId = parseProductTag(msg.caption);
  if (productId !== null && groupId) groups.remember(groupId, productId);
  if (productId === null && groupId) productId = groups.recall(groupId);
  if (productId === null) return false;

  const res = await attachOwnerPhoto(productId, buf);
  if (!res.ok) {
    await ctx.reply(`Rasm biriktirilmadi: ${res.error}.`);
    return true;
  }
  const queue = res.queued
    ? ' Joylash navbatiga qo\'yildi (oldin tasdiq so\'raladi).'
    : res.status === 'APPROVED'
      ? ' Navbatda bor.'
      : ` Holat: ${res.status} (qoralama kerak).`;
  await ctx.reply(`#${res.productId}: rasm qo'shildi (haqiqiy rasmlar: ${res.ownerImages} ta).${queue}`);
  return true;
}

// Fayl turi kengaytma bo'yicha emas, ichidagi baytlar bo'yicha tekshiriladi.
export type DetectedKind = 'xlsx' | 'csv' | 'image' | null;

export async function detectKind(buf: Buffer): Promise<DetectedKind> {
  const type = await fileTypeFromBuffer(buf);
  if (type?.mime === XLSX_MIME) return 'xlsx';
  if (type?.mime.startsWith('image/')) return 'image';
  // CSV'da magic bayt yo'q: matn bo'lishi (NUL baytsiz) va fayl turi aniqlanmagan bo'lishi kerak.
  if (!type && !buf.subarray(0, 4096).includes(0)) return 'csv';
  return null;
}

export function registerFileHandlers(bot: Bot) {
  bot.on('message:document', async (ctx) => {
    const doc = ctx.message.document;
    try {
      const buf = await download(ctx, doc.file_id);
      const kind = await detectKind(buf);
      const name = (doc.file_name ?? 'file').replace(/[^\w.-]/g, '_');
      const ext = path.extname(name).toLowerCase();
      const extOk = (kind === 'xlsx' && ext === '.xlsx') || (kind === 'csv' && ext === '.csv');
      if (kind === 'image') {
        if (await attachToProduct(ctx, buf)) return;
        await save(path.join(UPLOADS, 'images'), name, buf);
        return void (await ctx.reply(PHOTO_HINT));
      }
      if (!extOk) {
        return void (await ctx.reply(
          'Fayl rad etildi: faqat haqiqiy .xlsx yoki .csv qabul qilinadi.',
        ));
      }
      const target = await save(UPLOADS, name, buf);
      logger.info({ target }, 'Jadval saqlandi');

      const result = kind === 'xlsx' ? await parseXlsx(buf) : parseCsvBuffer(buf);
      const summary = await importPriceList(doc.file_name ?? name, doc.file_id, result);
      await ctx.reply(formatSummary(summary));
    } catch (err) {
      logger.error({ err }, 'Fayl qabul qilishda xato');
      await ctx.reply('Faylni qabul qilishda xato.');
    }
  });

  bot.on('message:photo', async (ctx) => {
    try {
      const largest = ctx.message.photo.at(-1)!;
      const buf = await download(ctx, largest.file_id);
      if ((await detectKind(buf)) !== 'image') {
        return void (await ctx.reply('Rasm rad etildi.'));
      }
      if (await attachToProduct(ctx, buf)) return;
      await save(path.join(UPLOADS, 'images'), `${largest.file_unique_id}.jpg`, buf);
      await ctx.reply(PHOTO_HINT);
    } catch (err) {
      logger.error({ err }, 'Rasm qabul qilishda xato');
      await ctx.reply('Rasmni qabul qilishda xato.');
    }
  });
}
