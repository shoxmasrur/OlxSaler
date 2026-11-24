import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  BOT_TOKEN: z.string().min(1),
  OWNER_TELEGRAM_ID: z.coerce.number().int().positive(),
  DATABASE_URL: z.string().url(),
  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().min(1),
  BRAVE_API_KEY: z.string().min(1),
  SENTRY_DSN: z.preprocess((v) => (v === '' ? undefined : v), z.string().url().optional()),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
  console.error(`.env xato yoki to'liq emas:\n${lines.join('\n')}`);
  process.exit(1);
}

export const env = parsed.data;
