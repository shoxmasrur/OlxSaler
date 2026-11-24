import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import { z } from 'zod';

// Faqat DATABASE_URL kerak: seed va migratsiya skriptlari boshqa kalitlarsiz ishlashi uchun.
const { DATABASE_URL } = z.object({ DATABASE_URL: z.string().url() }).parse(process.env);

const adapter = new PrismaPg({ connectionString: DATABASE_URL });

export const prisma = new PrismaClient({ adapter });
