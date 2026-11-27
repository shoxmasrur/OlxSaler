import { z } from 'zod';
import { prisma } from '../../db/client.js';
import { logEvent } from '../eventLog.js';

/**
 * Brauzerdan (egasining Chrome sessiyasi, sahifada KO'RINIB turgan raqamlar) yig'ilgan
 * statistika fayli. Kirish kaliti/cookie bu faylga hech qachon yozilmaydi.
 */
const count = z.coerce.number().int().min(0);
export const snapshotSchema = z.object({
  takenAt: z.coerce.date(),
  ads: z.array(
    z.object({
      adId: z.string().regex(/^\d+$/),
      /** Bo'sh bo'lsa bazadagi qoralama sarlavhasi olinadi (bot joylagan e'lonlar). */
      title: z.string().default(''),
      views: count,
      observed: count,
      phones: count,
      messages: count,
    }),
  ),
  chats: z
    .array(
      z.object({
        id: z.string().min(1),
        userName: z.string(),
        adTitle: z.string(),
        /** Ro'yxatdagi vaqt yozuvi ("10:15", "26 нояб."). Yangi xabar kelsa o'zgaradi. */
        lastLabel: z.string(),
        unread: z.boolean().default(false),
      }),
    )
    .default([]),
});
export type Snapshot = z.infer<typeof snapshotSchema>;

export interface ChatChange {
  id: string;
  userName: string;
  adTitle: string;
  lastLabel: string;
  isNew: boolean;
}

export interface IngestResult {
  ads: number;
  matched: number;
  chatChanges: ChatChange[];
}

export async function ingestSnapshot(raw: unknown): Promise<IngestResult> {
  const snap = snapshotSchema.parse(raw);
  const adIds = snap.ads.map((a) => a.adId);
  const listings = await prisma.listing.findMany({
    where: { olxAdId: { in: adIds } },
    select: { olxAdId: true, productId: true, title: true },
  });
  const byAd = new Map(listings.map((l) => [l.olxAdId!, l]));

  await prisma.adStat.createMany({
    data: snap.ads.map((a) => ({
      ...a,
      title: a.title || byAd.get(a.adId)?.title || '',
      productId: byAd.get(a.adId)?.productId ?? null,
      takenAt: snap.takenAt,
    })),
  });

  // Suhbatlar: yangi yoki vaqt yozuvi o'zgargan (yangi xabar) bo'lsa bildirishnoma uchun qaytariladi.
  const known = new Map(
    (await prisma.chatThread.findMany({ where: { id: { in: snap.chats.map((c) => c.id) } } })).map(
      (c) => [c.id, c],
    ),
  );
  const chatChanges: ChatChange[] = [];
  for (const c of snap.chats) {
    const prev = known.get(c.id);
    if (!prev || prev.lastLabel !== c.lastLabel) {
      chatChanges.push({ ...c, isNew: !prev });
    }
    await prisma.chatThread.upsert({
      where: { id: c.id },
      create: c,
      update: {
        userName: c.userName,
        adTitle: c.adTitle,
        lastLabel: c.lastLabel,
        unread: c.unread,
      },
    });
  }

  await logEvent('STATS_COLLECTED', undefined, undefined, {
    ads: snap.ads.length,
    chats: snap.chats.length,
    changes: chatChanges.length,
  });
  return { ads: snap.ads.length, matched: listings.length, chatChanges };
}

/** Telegram bildirishnomasi matni: kim, qaysi e'lon, qachon (xabar matni yo'q). */
export function formatChatChanges(changes: ChatChange[]): string | null {
  if (changes.length === 0) return null;
  const lines = changes
    .slice(0, 15)
    .map(
      (c) =>
        `${c.isNew ? '🆕' : '💬'} ${c.userName} — «${c.adTitle.slice(0, 60)}» (${c.lastLabel})`,
    );
  if (changes.length > 15) lines.push(`... va yana ${changes.length - 15} ta`);
  return ['📨 OLX chat: yangi xabarlar', ...lines, '', 'Javob berish: olx.uz → Чат'].join('\n');
}
