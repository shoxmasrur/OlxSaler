import { z } from 'zod';
import { env } from '../../config/env.js';

export interface ImageCandidate {
  /** Asl rasm manzili. */
  url: string;
  width?: number;
  height?: number;
  /** Rasm turgan sayt domeni (masalan hp.com). */
  source: string;
  title: string;
}

const responseSchema = z.object({
  results: z
    .array(
      z.object({
        title: z.string().optional(),
        source: z.string().optional(),
        properties: z.object({
          url: z.string(),
          width: z.number().optional(),
          height: z.number().optional(),
        }),
      }),
    )
    .default([]),
});

const ATTEMPTS = 3;

/** Tarmoq uzilishi va 5xx xatolarida 3 martagacha urinadi (kutish 1s, 2s). 429 va 4xx qayta urinilmaydi. */
async function fetchWithRetry(url: URL, init: RequestInit): Promise<Response> {
  let lastError = 'noma`lum xato';
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
      if (res.status < 500) return res;
      lastError = `HTTP ${res.status}`;
    } catch (err) {
      const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : '';
      lastError = cause || (err instanceof Error ? err.message : String(err));
    }
    if (attempt < ATTEMPTS) await new Promise((r) => setTimeout(r, attempt * 1000));
  }
  throw new Error(`Brave'ga ulanib bo'lmadi (${ATTEMPTS} urinish): ${lastError}`);
}

/** Brave Image Search: 1 ta so'rov = 1 ta qidiruv (oyiga ~$5 kredit ichida). */
export async function searchImages(query: string, count = 20): Promise<ImageCandidate[]> {
  const apiKey = env.BRAVE_API_KEY;
  if (typeof apiKey !== 'string' || apiKey === '') throw new Error(".env da BRAVE_API_KEY yo'q");

  const url = new URL('https://api.search.brave.com/res/v1/images/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(count));
  url.searchParams.set('safesearch', 'strict');

  const res = await fetchWithRetry(url, {
    headers: { 'X-Subscription-Token': apiKey, Accept: 'application/json' },
  });
  if (res.status === 429) throw new Error('Brave limiti tugadi yoki juda tez (429)');
  if (!res.ok) throw new Error(`Brave xatosi: HTTP ${res.status}`);

  const data = responseSchema.parse(await res.json());
  return data.results.map((r) => ({
    url: r.properties.url,
    width: r.properties.width,
    height: r.properties.height,
    source: r.source ?? '',
    title: r.title ?? '',
  }));
}
