# Loyiha holati (OlxSaler)

Oxirgi yangilanish: 2026-11-24. Reja: "OLX E'lon Agenti — Texnik vazifa va ishlar ketma-ketligi" (PDF, repoda yo'q).

## Bajarilgan bosqichlar

| Bosqich | Holat | Izoh |
|---|---|---|
| 0 Tayyorgarlik | Qisman | Bot token, Telegram ID, Postgres bor. Anthropic, Brave, Sentry kalitlari va `docs/olx-form.md` (OLX formasini qo'lda o'rganish) hali yo'q |
| 1 Skelet | Tugadi | TS strict, eslint, prettier, vitest, zod env, pino |
| 2 Baza | Tugadi | Prisma 7 (7 jadval), `logEvent`, seed |
| 3 Telegram bot | Tugadi | grammY, whitelist, buyruqlar karkasi, tugmalar, fayl qabul qilish |
| 4 Excel import | Tugadi | `/template`, parser, validatsiya, tranzaksiyali saqlash |
| 5 Rasm qidirish | Keyingi | Brave API kaliti kerak |
| 6-10 | Kutmoqda | Claude yordamchi, Playwright joylash, navbat, xavfsizlik, ishga tushirish |

## Muhim texnik qarorlar
- **Prisma 7.10.1** (barqaror). `latest` tegi rc versiyaga ishora qiladi, `8.0.0-rc` ni o'rnatmang. Sxemada `url` yo'q, u `prisma.config.ts` da. Klient `@prisma/adapter-pg` bilan.
- `src/db/client.ts` faqat `DATABASE_URL` ni tekshiradi (seed/migratsiya boshqa kalitlarsiz ishlashi uchun).
- `src/config/env.ts` da `ANTHROPIC_*`, `BRAVE_API_KEY`, `SENTRY_DSN` vaqtincha ixtiyoriy. 5-6-bosqichda majburiy qilinadi.
- Bazaning nomi `OlxSales` (bo'sh `olxsales` bazasi ham bor, ishlatilmaydi).
- Product statuslari: IMPORTED → IMAGES_FOUND → DRAFT_READY → APPROVED → POSTING → POSTED / FAILED / SKIPPED.
- `/buttons` vaqtinchalik sinov buyrug'i, 6.5-qadamda preview bilan almashadi.
- Polling faqat bot jarayonida. Worker faqat `sendMessage` yuboradi (409 xatosidan qochish).

## Ishga tushirish
```bash
# Lokal Postgres ishlayotgan bo'lsin
cp .env.example .env     # va to'ldiring
npx prisma migrate deploy && npx prisma db seed
npm run dev:bot
npm test && npm run lint
```

## Ertaga davom ettirish
1. `.env` ga `BRAVE_API_KEY` (Brave "Search" rejasi, rasm qidiruvi shunda bor) qo'shing.
2. **Bosqich 5:** `searchImages` (Brave) → yuklab olish va filtr (600px, 5MB, SHA-256 dublikat, sharp → JPG) → `attachUserImage` → `p-limit(3)` parallel.
3. Imkon bo'lsa 0.3-qadamni (OLX formasini qo'lda o'rganish, `docs/olx-form.md`) boshlang. 6- va 7-bosqichlar unga bog'liq. 7-bosqich eng xavfli joy, uni erta sinash tavsiya etiladi.
4. Kunlik limit 10-bosqichgacha 5 dan oshmasin.

## Ochiq masalalar
- `.env.example` lokal nusxasida parol bor (commit qilinmagan). Bo'sh shablonga qaytarish kerak.
- Bot token chat orqali ko'ringan fayllarda bo'lgan. Ehtiyot uchun @BotFather da `/revoke` tavsiya etiladi.
- `.env` dagi `SENTRY_DSN` bo'sh bo'lishi kerak (avval noto'g'ri matn bor edi).
