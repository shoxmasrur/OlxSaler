import { z } from 'zod';
import { env } from '../../config/env.js';
import { CLAIM_PATTERN } from './clean.js';

const API_URL = 'https://api.anthropic.com/v1/messages';
const ATTEMPTS = 3;

const responseSchema = z.object({
  content: z.array(z.object({ type: z.string(), text: z.string().optional() })),
  stop_reason: z.string().nullish(),
});

// Model matnni yozishdan oldin "o'ylash"ga ham token sarflaydi: chegara keng bo'lishi kerak.
const MAX_TOKENS = 2000;

const SYSTEM = `Sen OLX.uz uchun e'lon matni yozuvchisan. Faqat o'zbek tilida (lotin yozuvida) yoz.
Qoidalar:
- Faqat berilgan ma'lumotdagi faktlardan foydalan. Yangi raqam, xususiyat yoki va'da qo'shma.
- 2-3 ta qisqa, tabiiy gap. Har mahsulot uchun matn o'ziga xos bo'lsin (andoza ibora takrorlama).
- Kafolat, yetkazib berish, qutida, narx, to'lov, telefon, havola, emoji va undov belgisi haqida yozma.
- Faqat matnning o'zini qaytar: sarlavha, ro'yxat yoki izoh qo'shma.`;

/**
 * Model yozgan kirish matnini tekshiradi. Yaroqsiz bo'lsa null: chaqiruvchi oddiy (tozalangan)
 * matnga qaytadi. Qo'shimcha himoya: matndagi har bir raqam manba matnda bo'lishi shart
 * (model xususiyat to'qib qo'shmasligi uchun).
 */
export function validateIntro(intro: string, source: string): string | null {
  const text = intro.replace(/\s+/g, ' ').trim();
  if (text.length < 40 || text.length > 700) return null;
  if (!/[.)]$/.test(text)) return null; // jumla o'rtasida tugagan matn
  if (CLAIM_PATTERN.test(text)) return null;
  // Model ba'zan lotin matnga kirill so'z yoki harf aralashtiradi ("ноутбуки", "jihозlangan").
  if (/\p{Script=Cyrillic}/u.test(text)) return null;
  if (/(\+?998|https?:|www\.|@|t\.me|\d{9,}|!)/i.test(text)) return null;
  const numbers = text.match(/\d+(?:[.,]\d+)?/g) ?? [];
  if (numbers.some((n) => !source.includes(n))) return null;
  return text;
}

export interface IntroInput {
  model: string;
  category: string;
  /** Tozalangan manba matn (xususiyatlar bilan). */
  source: string;
}

/** Claude bilan o'ziga xos kirish matni. Kalit yo'q yoki xato bo'lsa null (oddiy matn ishlatiladi). */
export async function writeIntro(input: IntroInput): Promise<string | null> {
  const apiKey = env.ANTHROPIC_API_KEY;
  const model = env.ANTHROPIC_MODEL;
  if (typeof apiKey !== 'string' || typeof model !== 'string') return null;

  const prompt = `Mahsulot: ${input.model}\nKategoriya: ${input.category}\nMa'lumot:\n${input.source}`;

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: MAX_TOKENS,
          system: SYSTEM,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (res.status >= 400 && res.status < 500 && res.status !== 429) return null;
      if (res.ok) {
        const data = responseSchema.parse(await res.json());
        // Kesilgan javob (max_tokens) e'longa tushmasligi kerak.
        if (data.stop_reason !== 'end_turn') return null;
        const text = data.content.find((c) => c.type === 'text')?.text ?? '';
        // Yaroqsiz matn (kirill aralash, to'qilgan raqam...): yangi javob so'raladi.
        const valid = validateIntro(text, input.source);
        if (valid) return valid;
      }
    } catch {
      // tarmoq uzilishi: qayta uriniladi
    }
    if (attempt < ATTEMPTS) await new Promise((r) => setTimeout(r, attempt * 1500));
  }
  return null;
}
