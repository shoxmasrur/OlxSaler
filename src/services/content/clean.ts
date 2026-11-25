/**
 * E'lon matnini tozalash. Egasining qarori: kafolat, yetkazib berish va "qutida" haqida
 * hozircha HECH NARSA yozilmaydi (tasdiqlanmagan da'volar). Bu qoidalar shu yerda bitta joyda.
 */

const BANNED_SENTENCE = /yetkazib|dostavka/i;
const BANNED_PHRASE = /,?\s*(?:kafolat|qutida)[^,.\n]*/gi;

/** Matnda taqiqlangan da'vo qolganmi (tekshiruv uchun). */
export const CLAIM_PATTERN = /kafolat|yetkazib|dostavka|qutida|garantiya/i;

function cleanSentence(sentence: string): string {
  if (BANNED_SENTENCE.test(sentence)) return '';
  const cleaned = sentence.replace(BANNED_PHRASE, '').trim();
  // "Kafolat beriladi." kabi gap butunlay yo'qoladi; qoldiq tinish belgilari tashlanadi.
  return /[\p{L}\p{N}]{3,}/u.test(cleaned) ? cleaned : '';
}

/** Har satr va har gap alohida tekshiriladi: sarlavha va xususiyatlar saqlanadi, da'volar olib tashlanadi. */
export function cleanDescription(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      // "Kafolat: 12 oy" kabi xususiyat satri butunlay olib tashlanadi.
      if (CLAIM_PATTERN.test(line) && line.includes(':') && line.length < 80) return '';
      return line
        .split(/(?<=[.!?])\s+/)
        .map(cleanSentence)
        .filter(Boolean)
        .join(' ');
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Boshqa e'londa aynan shu sarlavha bo'lsa (masalan, faqat rangi farq qiluvchi ikki model),
 * OLX dublikat deb belgilamasligi uchun oxiriga rang qo'shiladi ("Rang: Ko'k" -> "... Ko'k").
 * Sarlavha 70 belgidan oshmaydi: kerak bo'lsa, o'rtasidagi so'zlar emas, oxiri qisqartiriladi.
 */
export function disambiguateTitle(
  title: string,
  takenTitles: string[],
  description: string,
  maxLength = 70,
): string {
  const key = (s: string) => s.trim().toLowerCase();
  if (!takenTitles.some((t) => key(t) === key(title))) return title;
  const color = /Rang:\s*([^\n]+)/i.exec(description)?.[1]?.trim();
  if (!color) return title;
  const base = title.slice(0, Math.max(maxLength - color.length - 1, 16)).trim();
  return `${base} ${color}`.slice(0, maxLength);
}

// Qisqartma va texnik belgilar katta harfda qoladi.
const ACRONYMS = new Set([
  'AMD',
  'SSD',
  'HDD',
  'FHD',
  'QHD',
  'WQHD',
  'UWQHD',
  'WUXGA',
  'OLED',
  'IPS',
  'LED',
  'LCD',
  'HDMI',
  'VGA',
  'USB',
  'RAM',
  'NVME',
  'AIO',
  'RGB',
  'HDR',
  'DDR',
  'GPU',
  'CPU',
]);

const upperRatio = (s: string) => {
  const letters = s.replace(/[^A-Za-z]/g, '');
  return letters.length === 0 ? 0 : letters.replace(/[^A-Z]/g, '').length / letters.length;
};

/**
 * "HP LAPTOP 15-FC0075NIA AMD R7" -> "HP Laptop 15-FC0075NIA AMD R7".
 * Faqat deyarli butunlay katta harfli sarlavhalar o'zgaradi. Raqamli tokenlar (model kodlari),
 * qisqartmalar va 2 harfgacha so'zlar o'zgarmaydi.
 */
export function normalizeTitle(title: string, maxLength = 70): string {
  // Excel manbasi 70 belgida "..." bilan kesgan: kesilgan oxirgi so'z olib tashlanadi.
  const t = title
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s*\S*\.\.\.$/, '');
  const out =
    upperRatio(t) <= 0.6
      ? t
      : t
          .split(' ')
          .map((token) =>
            /\d/.test(token)
              ? token
              : token.replace(/[A-Za-z]+/g, (run) =>
                  run.length <= 2 || ACRONYMS.has(run)
                    ? run
                    : run[0]!.toUpperCase() + run.slice(1).toLowerCase(),
                ),
          )
          .join(' ');
  if (out.length <= maxLength) return out;
  const cut = out.slice(0, maxLength);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), 16)).trim();
}
