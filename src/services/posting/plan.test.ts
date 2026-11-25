import { describe, expect, it } from 'vitest';
import { between, stepPause, typingPlan, TEXT_STYLE, TITLE_STYLE } from './humanize.js';
import { decideAction } from './scheduler.js';
import {
  buildPostPlan,
  diagonalBucket,
  findDiagonal,
  findDuplicate,
  modelCode,
  pickOption,
  type PlanInput,
} from './plan.js';

describe('diagonalBucket / findDiagonal', () => {
  it("OLX oraliqlariga to'g'ri tushiradi", () => {
    expect(diagonalBucket(11.6)).toBe('До 13"');
    expect(diagonalBucket(13.3)).toBe('13"-14"');
    expect(diagonalBucket(14)).toBe('13"-14"');
    expect(diagonalBucket(15)).toBe('15"-15,6"');
    expect(diagonalBucket(15.6)).toBe('15"-15,6"');
    expect(diagonalBucket(16)).toBe('16"-17"');
    expect(diagonalBucket(17.3)).toBe('16"-17"');
    expect(diagonalBucket(18)).toBe('От 18"');
  });

  it('sarlavhadan o`qiydi (vergul va nuqta, FHD/WUXGA bilan)', () => {
    expect(findDiagonal('HP Laptop 15-FC0075NIA 8GB 512GB 15,6 FHD Backlit', '')).toBe('15"-15,6"');
    expect(findDiagonal('Lenovo Ideapad 16GB 512GB 15.3 WUXGA IPS', '')).toBe('15"-15,6"');
    expect(findDiagonal('Asus Zenbook 14 UM3406 16GB 14.0 OLED', '')).toBe('13"-14"');
  });

  it("sarlavhada bo'lmasa, xususiyatlardagi Ekran qatoridan oladi", () => {
    expect(findDiagonal('Keetab PKSU6 I5-1235U 8GB', 'Xususiyatlari:\nEkran: 15" Full HD')).toBe(
      '15"-15,6"',
    );
  });

  it('RAM/disk hajmini ekran deb adashmaydi (16GB, 512GB)', () => {
    expect(findDiagonal('Laptop X1 16GB 512GB', '')).toBeNull();
  });
});

const input: PlanInput = {
  productId: 6,
  model: 'HP LAPTOP 15-FC0075NIA AMD R7 5825U 8GB 512GB 15,6 FHD BACKLIT AI SILVER',
  price: 8_200_000,
  categorySheet: 'Noutbuk i7 - Ryzen 7',
  title: 'HP Laptop 15-FC0075NIA AMD R7 5825U 8GB 512GB 15,6 FHD Backlit AI',
  description:
    'HP noutbuki AMD Ryzen 7 5825U protsessori va 8 GB operativ xotira bilan jihozlangan.',
  images: ['/x/1.jpg', '/x/2.jpg', '/x/3.jpg'],
};

describe('buildPostPlan', () => {
  it("to'liq reja tuzadi: Бизнес, Новый, сум, diagonal va marka", () => {
    const res = buildPostPlan(input);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.plan).toMatchObject({
      currency: 'сум',
      sellerType: 'Бизнес',
      condition: 'Новый',
      diagonal: '15"-15,6"',
      brand: 'HP',
      price: 8_200_000,
    });
    expect(res.plan.category.steps.at(-1)).toBe('Ноутбуки');
  });

  it('monitor uchun diagonal talab qilinmaydi', () => {
    const res = buildPostPlan({
      ...input,
      categorySheet: 'Monitor 27"',
      title: 'Immer IV27F144 27" Flat FHD IPS 144Hz',
      model: 'IMMER IV27F144 27" FLAT',
    });
    expect(res.ok && res.plan.diagonal).toBeNull();
  });

  it('yetishmayotgan ma`lumotda xato beradi (rasm, sarlavha, diagonal, kategoriya)', () => {
    expect(buildPostPlan({ ...input, images: [] })).toMatchObject({ ok: false });
    expect(buildPostPlan({ ...input, title: 'Qisqa' })).toMatchObject({ ok: false });
    expect(buildPostPlan({ ...input, title: 'x'.repeat(71) })).toMatchObject({ ok: false });
    expect(buildPostPlan({ ...input, categorySheet: 'Telefonlar' })).toMatchObject({ ok: false });
    expect(
      buildPostPlan({ ...input, title: 'Laptop 16GB 512GB SSD nomi', description: 'a'.repeat(60) }),
    ).toMatchObject({ ok: false, error: expect.stringContaining('diagonal') });
  });
});

describe('pickOption', () => {
  const brands = ['Acer', 'Asus', 'GigaByte', 'HP', 'Lenovo', 'Другая марка'];

  it('registrdan qat`i nazar aniq moslikni tanlaydi', () => {
    expect(pickOption(brands, 'HP')).toBe('HP');
    expect(pickOption(brands, 'ASUS')).toBe('Asus');
    expect(pickOption(brands, 'GIGABYTE')).toBe('GigaByte');
  });

  it("noma'lum brend uchun 'Другая марка' ni tanlaydi", () => {
    expect(pickOption(brands, 'KEETAB')).toBe('Другая марка');
  });

  it("o'xshash variant ham, 'другая' ham yo'q bo'lsa null (taxmin qilmaydi)", () => {
    expect(pickOption(['Acer', 'Asus'], 'IMMER')).toBeNull();
  });
});

describe('takrorlanishni aniqlash', () => {
  it('model kodini ajratadi', () => {
    expect(modelCode('HP LAPTOP 15-FC0075NIA AMD R7')).toBe('15fc0075nia');
    expect(modelCode('GIGABYTE GS27FCA 27" Gaming')).toBe('gs27fca');
    expect(modelCode('Monitor 24')).toBeNull();
  });

  it('hisobdagi e`lon sarlavhasida shu kod bo`lsa dublikat deydi', () => {
    const existing = ['Gigabyte GS27FCA 27" Gaming monitor 27" FHD Curved', 'Boshqa narsa'];
    expect(findDuplicate('GIGABYTE GS27FCA 27" GAMING MONITOR', existing)).toBe(existing[0]);
    expect(findDuplicate('GIGABYTE GS24F14 24" GAMING', existing)).toBeNull();
  });
});

describe('humanize', () => {
  it('between oraliqdan chiqmaydi', () => {
    expect(between(10, 20, () => 0)).toBe(10);
    expect(between(10, 20, () => 1)).toBe(20);
  });

  it("typingPlan matnni to'liq va tartibda qaytaradi, pauzalar oraliqda", () => {
    const text = 'Bu noutbuk 8 GB operativ xotira bilan jihozlangan. 512 GB SSD ham bor.';
    const plan = typingPlan(text, TITLE_STYLE);
    expect(plan.map((p) => p.chunk).join('')).toBe(text);
    for (const p of plan) {
      expect(p.delay).toBeGreaterThanOrEqual(TITLE_STYLE.minDelay);
      expect(p.delay).toBeLessThanOrEqual(TITLE_STYLE.maxDelay);
    }
    expect(plan.at(-1)!.pauseAfter).toBe(0);
    expect(plan.length).toBeGreaterThan(1);
  });

  it('uzun matn uchun ham to`liq saqlanadi, yangi satrlar bilan', () => {
    const text = 'Birinchi.\n\nXususiyatlari:\nEkran: 15"\n'.repeat(20);
    expect(
      typingPlan(text, TEXT_STYLE)
        .map((p) => p.chunk)
        .join(''),
    ).toBe(text);
  });

  it('stepPause 0.6-2.2 soniya', () => {
    for (let i = 0; i < 30; i++) {
      const ms = stepPause();
      expect(ms).toBeGreaterThanOrEqual(600);
      expect(ms).toBeLessThanOrEqual(2200);
    }
  });
});

describe('decideAction (ishchi qarori)', () => {
  const ok = { allowed: true } as const;
  const base = {
    guard: ok,
    hasRunning: false,
    hasConfirmed: false,
    hasAsked: false,
    hasPending: true,
    now: 1_000,
    askNotBefore: null,
  };

  it("navbatdagi e'lon bo'lsa va ruxsat bo'lsa tasdiq so'raydi", () => {
    expect(decideAction(base)).toBe('ask');
  });

  it("egasi tasdiqlagan e'lonni joylaydi (so'rashdan ustun)", () => {
    expect(decideAction({ ...base, hasConfirmed: true })).toBe('post');
  });

  it('interval qoidasi bajarilmasa hech narsa qilmaydi (post ham, ask ham)', () => {
    const blocked = { allowed: false, reason: 'too_soon' } as const;
    expect(decideAction({ ...base, guard: blocked })).toBe('idle');
    expect(decideAction({ ...base, guard: blocked, hasConfirmed: true })).toBe('idle');
  });

  it("tasdiq kutilayotgan bo'lsa yangisini so'ramaydi", () => {
    expect(decideAction({ ...base, hasAsked: true })).toBe('idle');
  });

  it("bitta e'lon bajarilayotgan bo'lsa kutadi", () => {
    expect(decideAction({ ...base, hasRunning: true, hasConfirmed: true })).toBe('idle');
  });

  it("'Keyinroq' dan keyin belgilangan vaqtgacha qayta so'ramaydi", () => {
    expect(decideAction({ ...base, askNotBefore: 5_000 })).toBe('idle');
    expect(decideAction({ ...base, askNotBefore: 5_000, now: 5_000 })).toBe('ask');
  });

  it("navbat bo'sh bo'lsa idle", () => {
    expect(decideAction({ ...base, hasPending: false })).toBe('idle');
  });
});

describe('decideAction: tasdiq so`rovi oldinroq, joylash keyin', () => {
  const ok = { allowed: true } as const;
  const tooSoon = { allowed: false, reason: 'too_soon' } as const;
  const base = {
    guard: tooSoon,
    askGuard: ok,
    hasRunning: false,
    hasConfirmed: false,
    hasAsked: false,
    hasPending: true,
    now: 1_000,
    askNotBefore: null,
  };

  it("joylash hali mumkin emas, lekin tasdiq so'rash mumkin bo'lsa so'raydi", () => {
    expect(decideAction(base)).toBe('ask');
  });

  it("tasdiqlangan e'lon tanaffus tugamaguncha joylanmaydi", () => {
    expect(decideAction({ ...base, hasConfirmed: true })).toBe('idle');
    expect(decideAction({ ...base, hasConfirmed: true, guard: ok })).toBe('post');
  });

  it("so'rash ham mumkin bo'lmasa kutadi", () => {
    expect(decideAction({ ...base, askGuard: tooSoon })).toBe('idle');
  });
});
