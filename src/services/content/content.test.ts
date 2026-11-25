import { describe, expect, it } from 'vitest';
import { olxCategoryFor } from '../olx/categories.js';
import { CLAIM_PATTERN, cleanDescription, normalizeTitle } from './clean.js';
import { validateIntro } from './describe.js';

describe('cleanDescription: kafolat, yetkazib berish va qutida yozilmaydi', () => {
  const raw =
    'HP LAPTOP 15 - yangi, qutida, kafolat bilan. Tarkibi: 8 GB RAM, 512 GB SSD. Ish uchun tayyor. Rasmiy yetkazib beruvchidan, hujjatlari bilan. Yetkazib berish Toshkent bo\'ylab. Naqd va plastik karta qabul qilinadi.\n\nXususiyatlari:\nEkran: 15"\nKafolat: 12 oy\nRang: Kumush';

  it("da'volarni olib tashlaydi, mahsulot nomi va xususiyatlarni saqlaydi", () => {
    const out = cleanDescription(raw);
    expect(CLAIM_PATTERN.test(out)).toBe(false);
    expect(out).toContain('HP LAPTOP 15 - yangi.');
    expect(out).toContain('Tarkibi: 8 GB RAM, 512 GB SSD.');
    expect(out).toContain('Ekran: 15"');
    expect(out).toContain('Rang: Kumush');
    expect(out).not.toContain('Kafolat: 12 oy');
  });

  it("'Kafolat beriladi.' kabi butun gapni olib tashlaydi", () => {
    const out = cleanDescription('Yangi monitor. Kafolat beriladi. Yetkazib berish bepul.');
    expect(out).toBe('Yangi monitor.');
  });

  it("da'vosiz matnni o'zgartirmaydi", () => {
    const clean = 'Yangi monitor.\n\nXususiyatlari:\nEkran: 27"';
    expect(cleanDescription(clean)).toBe(clean);
  });
});

describe('normalizeTitle', () => {
  it("katta harfli sarlavhani oddiy yozuvga o'tkazadi, kodlar va qisqartmalar saqlanadi", () => {
    expect(normalizeTitle('HP LAPTOP 15-FC0075NIA AMD R7 5825U 8GB 512GB FHD IPS')).toBe(
      'HP Laptop 15-FC0075NIA AMD R7 5825U 8GB 512GB FHD IPS',
    );
    expect(normalizeTitle('ASUS VIVOBOOK X1504V INTEL CORE I7-1355U')).toBe(
      'Asus Vivobook X1504V Intel Core I7-1355U',
    );
  });

  it("aralash harfli sarlavhani o'zgartirmaydi", () => {
    const t = '27ZI3000-27" Flat monitor (VGA+HDMI+DC)';
    expect(normalizeTitle(t)).toBe(t);
  });

  it("Excel qo'ygan '...' va kesilgan oxirgi so'zni olib tashlaydi", () => {
    expect(
      normalizeTitle('HP LAPTOP 15-FC0075NIA AMD R7 5825U 8GB 512GB 15,6 FHD BACKLIT AI S...'),
    ).toBe('HP Laptop 15-FC0075NIA AMD R7 5825U 8GB 512GB 15,6 FHD Backlit AI');
  });

  it('70 belgidan oshmaydi va so`z o`rtasida kesilmaydi', () => {
    const long =
      'LENOVO IDEAPAD SLIM 3 15IRH10 I7-13620H 16GB DDR5 512GB 15.3 WUXGA IPS LUNA GREY EXTRA';
    const out = normalizeTitle(long);
    expect(out.length).toBeLessThanOrEqual(70);
    expect(long.toLowerCase().startsWith(out.toLowerCase())).toBe(true);
  });
});

describe('olxCategoryFor', () => {
  it('Excel varaq nomlarini OLX kategoriyasiga moslaydi', () => {
    expect(olxCategoryFor('Noutbuk i5 - Ryzen 5')?.steps.at(-1)).toBe('Ноутбуки');
    expect(olxCategoryFor('Noutbuk boshqa')?.laptopFields).toBe(true);
    expect(olxCategoryFor('Planshet')?.steps.at(-1)).toBe('Планшетные компьютеры');
    expect(olxCategoryFor('Monitor 27"')?.steps.at(-1)).toBe('Мониторы');
    expect(olxCategoryFor('Monitor 29-45" (katta)')?.laptopFields).toBe(false);
    expect(olxCategoryFor('Monoblok')?.steps).toEqual([
      'Электроника',
      'Компьютеры',
      'Настольные',
      'Моноблок',
    ]);
  });

  it("noma'lum varaq uchun null qaytaradi", () => {
    expect(olxCategoryFor('Telefonlar')).toBeNull();
    expect(olxCategoryFor(null)).toBeNull();
  });
});

describe('validateIntro (Claude matnini tekshirish)', () => {
  const source =
    'HP Laptop 15 - AMD Ryzen 7 5825U, 8 GB operativ xotira, 512 GB SSD, 15" Full HD ekran.';
  const good =
    "Bu noutbuk AMD Ryzen 7 5825U protsessori va 8 GB operativ xotira bilan jihozlangan. 512 GB SSD ma'lumotlarni tez saqlaydi.";

  it("to'g'ri matnni qabul qiladi", () => {
    expect(validateIntro(good, source)).toBe(good);
  });

  it("taqiqlangan da'volarni rad etadi (kafolat, yetkazib berish, qutida)", () => {
    expect(validateIntro(`${good} Kafolat beriladi.`, source)).toBeNull();
    expect(validateIntro(`${good} Yetkazib berish bor.`, source)).toBeNull();
    expect(validateIntro(`${good} Qutida, yangi.`, source)).toBeNull();
  });

  it('telefon, havola, @ va undov belgisini rad etadi', () => {
    expect(validateIntro(`${good} Aloqa: +998901234567`, source)).toBeNull();
    expect(validateIntro(`${good} Batafsil: https://t.me/x`, source)).toBeNull();
    expect(validateIntro(`${good} Ajoyib!`, source)).toBeNull();
  });

  it("manbada yo'q raqamni (to'qilgan xususiyat) rad etadi", () => {
    expect(validateIntro(good.replace('8 GB', '16 GB'), source)).toBeNull();
  });

  it('juda qisqa yoki juda uzun matnni rad etadi', () => {
    expect(validateIntro('Yaxshi noutbuk.', source)).toBeNull();
    expect(validateIntro('A'.repeat(701), source)).toBeNull();
  });
});

describe('validateIntro: kesilgan matn', () => {
  it("jumla o'rtasida tugagan (nuqtasiz) matnni rad etadi", () => {
    const source = 'AMD Ryzen 7 5825U, 8 GB, 512 GB SSD';
    const cut =
      "Bu noutbuk AMD Ryzen 7 5825U protsessori va 8 GB operativ xotira bilan ish, o'qish";
    expect(validateIntro(cut, source)).toBeNull();
    expect(validateIntro(`${cut} uchun mos.`, source)).not.toBeNull();
  });
});
