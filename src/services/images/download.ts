import { createHash } from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';

export const MIN_SIDE = 600;
export const MAX_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface ProcessedImage {
  data: Buffer;
  width: number;
  height: number;
  sha256: string;
}

/** Rad etish sababi foydalanuvchiga/logga ko'rsatiladi. */
export class RejectError extends Error {}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number) as [number, number];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7)) || !v.slice(7).includes('.');
  return (
    v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')
  );
}

/** SSRF himoyasi: faqat https va faqat ommaviy IP manzillar. */
async function assertPublic(url: URL): Promise<void> {
  if (url.protocol !== 'https:') throw new RejectError('faqat https');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (addrs.length === 0 || addrs.some((a) => isPrivateIp(a.address))) {
    throw new RejectError('ichki tarmoq manzili');
  }
}

async function readLimited(res: Response): Promise<Buffer> {
  const declared = Number(res.headers.get('content-length'));
  if (declared > MAX_BYTES) throw new RejectError('fayl 5 MB dan katta');
  if (!res.body) throw new RejectError("javob bo'sh");

  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of res.body) {
    total += chunk.byteLength;
    if (total > MAX_BYTES) throw new RejectError('fayl 5 MB dan katta');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function fetchBytes(rawUrl: string): Promise<Buffer> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new RejectError("manzil noto'g'ri");
  }
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublic(url);
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OlxSalesBot/1.0)', Accept: 'image/*' },
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) throw new RejectError("yo'naltirish manzili yo'q");
      url = new URL(location, url);
      continue;
    }
    if (!res.ok) throw new RejectError(`HTTP ${res.status}`);
    return readLimited(res);
  }
  throw new RejectError("juda ko'p yo'naltirish");
}

/** Baytlarni tekshiradi (tur, o'lcham) va oq fonli JPG'ga o'tkazadi. */
export async function processImage(raw: Buffer): Promise<ProcessedImage> {
  const type = await fileTypeFromBuffer(raw);
  if (!type || !ALLOWED_MIME.has(type.mime)) throw new RejectError('rasm emas yoki turi mos emas');

  const meta = await sharp(raw).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (Math.min(width, height) < MIN_SIDE) {
    throw new RejectError(`kichik (${width}x${height}, kamida ${MIN_SIDE}px)`);
  }

  const data = await sharp(raw)
    .rotate()
    .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 88 })
    .toBuffer();
  const out = await sharp(data).metadata();
  return {
    data,
    width: out.width ?? width,
    height: out.height ?? height,
    sha256: createHash('sha256').update(data).digest('hex'),
  };
}

export async function downloadImage(url: string): Promise<ProcessedImage> {
  return processImage(await fetchBytes(url));
}
