import 'dotenv/config';
import { z } from 'zod';

const optional = (s: z.ZodType) => z.preprocess((v) => (v === '' ? undefined : v), s.optional());

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  BOT_TOKEN: z.string().min(1),
  OWNER_TELEGRAM_ID: z.coerce.number().int().positive(),
  DATABASE_URL: z.string().url(),
  ANTHROPIC_API_KEY: optional(z.string().min(1)), // 5-6-bosqichda majburiy bo'ladi
  ANTHROPIC_MODEL: optional(z.string().min(1)), // 5-6-bosqichda majburiy bo'ladi
  BRAVE_API_KEY: optional(z.string().min(1)), // 5-6-bosqichda majburiy bo'ladi
  SENTRY_DSN: optional(z.string().url()),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
  console.error(`.env xato yoki to'liq emas:\n${lines.join('\n')}`);
  process.exit(1);
}

export const env = parsed.data;
