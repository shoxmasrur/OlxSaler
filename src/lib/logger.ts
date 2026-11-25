import pino from 'pino';
import { scrubSecrets } from './scrub.js';

const isProd = process.env.NODE_ENV === 'production';

// Tarmoq xatolarining matnida so'rov manzili (va u bilan bot tokeni) bo'ladi: logga tokensiz yoziladi.
function errSerializer(err: unknown) {
  const plain = pino.stdSerializers.err(err as Error);
  try {
    return JSON.parse(scrubSecrets(JSON.stringify(plain))) as unknown;
  } catch {
    return { type: plain.type, message: scrubSecrets(String(plain.message)), stack: '' };
  }
}

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  serializers: { err: errSerializer },
  transport: isProd
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss' },
      },
});
