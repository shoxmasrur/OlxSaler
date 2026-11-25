import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { downloadImage, processImage, RejectError } from './download.js';
import { buildAltQuery, buildQuery, rankCandidates } from './find.js';

const solid = (w: number, h: number, format: 'png' | 'jpeg' = 'png') => {
  const img = sharp({ create: { width: w, height: h, channels: 4, background: '#3366cc' } });
  return (format === 'png' ? img.png() : img.jpeg()).toBuffer();
};

describe('buildQuery', () => {
  it("modelning birinchi 6 ta so'zini oladi va qo'shtirnoqlarni olib tashlaydi", () => {
    expect(buildQuery('HP LAPTOP 15-FC0075NIA AMD R7 5825U 8GB 512GB 15,6 FHD')).toBe(
      'HP LAPTOP 15-FC0075NIA AMD R7 5825U',
    );
    expect(buildQuery('IMMER IV27F144 27" FLAT FHD IPS')).toBe('IMMER IV27F144 27 FLAT FHD IPS');
  });
});

describe('rankCandidates', () => {
  const c = (source: string, url: string) => ({ source, url, title: '' });

  it('ishlab chiqaruvchi saytlarini oldinga chiqaradi, tartibni saqlaydi', () => {
    const ranked = rankCandidates([
      c('shop.uz', 'https://a/1.jpg'),
      c('support.hp.com', 'https://b/2.jpg'),
      c('other.com', 'https://c/3.jpg'),
      c('asus.com', 'https://d/4.jpg'),
    ]);
    expect(ranked.map((r) => r.source)).toEqual([
      'support.hp.com',
      'asus.com',
      'shop.uz',
      'other.com',
    ]);
  });

  it('bir xil manzilni bir marta qoldiradi', () => {
    const ranked = rankCandidates([c('a.com', 'https://x/1.jpg'), c('b.com', 'https://x/1.jpg')]);
    expect(ranked).toHaveLength(1);
  });

  it("'nothp.com' ni ishlab chiqaruvchi deb hisoblamaydi", () => {
    const ranked = rankCandidates([
      c('nothp.com', 'https://a/1.jpg'),
      c('hp.com', 'https://b/2.jpg'),
    ]);
    expect(ranked[0]!.source).toBe('hp.com');
  });
});

describe('processImage', () => {
  it("katta PNG'ni JPG'ga o'tkazadi va SHA-256 beradi", async () => {
    const out = await processImage(await solid(800, 700));
    expect((await sharp(out.data).metadata()).format).toBe('jpeg');
    expect(out).toMatchObject({ width: 800, height: 700 });
    expect(out.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('bir xil rasm bir xil SHA-256 beradi (dublikatni aniqlash uchun)', async () => {
    const buf = await solid(700, 700);
    expect((await processImage(buf)).sha256).toBe((await processImage(buf)).sha256);
  });

  it('600px dan kichikni rad etadi', async () => {
    await expect(processImage(await solid(599, 900))).rejects.toThrow(/kichik/);
  });

  it("rasm bo'lmagan baytlarni rad etadi", async () => {
    await expect(processImage(Buffer.from('<html>salom</html>'))).rejects.toBeInstanceOf(
      RejectError,
    );
  });

  it('2000px dan kattani kichraytiradi', async () => {
    const out = await processImage(await solid(3000, 2400, 'jpeg'));
    expect(Math.max(out.width, out.height)).toBe(2000);
  });
});

describe('downloadImage (SSRF himoyasi)', () => {
  it('http manzilni rad etadi', async () => {
    await expect(downloadImage('http://example.com/a.jpg')).rejects.toThrow('faqat https');
  });

  it.each([
    'https://127.0.0.1/a.jpg',
    'https://10.0.0.5/a.jpg',
    'https://192.168.1.1/a.jpg',
    'https://[::1]/a.jpg',
    'https://169.254.169.254/latest',
  ])('ichki manzilni rad etadi: %s', async (url) => {
    await expect(downloadImage(url)).rejects.toThrow('ichki tarmoq manzili');
  });

  it("noto'g'ri manzilni rad etadi", async () => {
    await expect(downloadImage('bu url emas')).rejects.toThrow("manzil noto'g'ri");
  });
});

describe('buildAltQuery', () => {
  const model = 'HP LAPTOP 15-FC0075NIA AMD R7 5825U 8GB 512GB';

  it("har urinishda boshqa uzunlikdagi (3, 4, 5 so'z) so'rov beradi", () => {
    expect(buildAltQuery(model, 0)).toBe('HP LAPTOP 15-FC0075NIA');
    expect(buildAltQuery(model, 1)).toBe('HP LAPTOP 15-FC0075NIA AMD');
    expect(buildAltQuery(model, 2)).toBe('HP LAPTOP 15-FC0075NIA AMD R7');
    expect(buildAltQuery(model, 3)).toBe(buildAltQuery(model, 0));
  });

  it('qisqa modelda xato bermaydi', () => {
    expect(buildAltQuery('Monitor 24', 2)).toBe('Monitor 24');
  });
});
