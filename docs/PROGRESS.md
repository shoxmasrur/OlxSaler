# Loyiha holati (OlxSaler)

Oxirgi yangilanish: 2026-11-25. Eski reja: "OLX E'lon Agenti — Texnik vazifa va ishlar ketma-ketligi" (PDF, repoda yo'q).

**Yo'nalish:** mahsulotlar katalog Excel (`katalog_namuna.xlsx` formati) orqali botga yuklanadi, rasmlar Brave orqali topiladi, egasi tasdiqlaydi, bot Playwright bilan OLX.uz'ga joylaydi.

## Bajarilgan bosqichlar

| Bosqich | Holat | Izoh |
|---|---|---|
| 0 Tayyorgarlik | Qisman | Bot token, Telegram ID, Postgres, Anthropic va Brave kalitlari bor. `docs/olx-form.md` (OLX formasini o'rganish) hali yo'q |
| 1 Skelet | Tugadi | TS strict, eslint, prettier, vitest, zod env, pino |
| 2 Baza | Tugadi | Prisma 7 (7 jadval), `logEvent`, seed |
| 3 Telegram bot | Tugadi | grammY, whitelist, buyruqlar, fayl qabul qilish, Telegram uzilsa qayta urinish |
| 4 Excel import | Tugadi | Katalog formati (ko'p varaqli) + eski oddiy shablon, validatsiya, tranzaksiya, qayta yuborishdan himoya (kod bo'yicha) |
| 5 Rasm qidirish | Tugadi | `/images [soni]`: Brave, SSRF himoyasi, 600px/5MB filtri, SHA-256 dublikat, JPG. Topilgan rasmlar albom qilib yuboriladi |
| 6 Tasdiqlash va qoralama | Keyingi | Tugmalar (Tasdiqlash / Boshqasini top / O'tkazib yubor), `APPROVED`, Claude bilan matnni sayqallash |
| 7 OLX'ga joylash | Kutmoqda | Playwright. `docs/olx-form.md` ga bog'liq |
| 8-10 | Kutmoqda | Navbat, kunlik limit 5, `/status`, `/pause`, VPS'ga ko'chirish |

## Joriy ma'lumotlar (2026-11-25)
- Bazada 99 mahsulot (`1_OLX_ga_yuklash.xlsx`, `Lenovo00428` takroriy kod bitta rad etilgan). 11 tasiga rasm topilgan.
- Qolganlari `IMPORTED`. Rasm 2 marta topilmasa, `/images` uni o'tkazib yuboradi.

## Muhim texnik qarorlar
- **Prisma 7.10.1** (barqaror). `latest` tegi rc versiyaga ishora qiladi, `8.0.0-rc` ni o'rnatmang. `npm audit fix --force` ni ishlatmang: Prisma/ExcelJS'ni eskisiga tushiradi (qolgan zaifliklar faqat dev vosita va ishlatilmaydigan yo'l).
- **Sxemani o'zgartirgach:** `npx prisma migrate dev`, keyin **`npx prisma generate`** va botni qayta ishga tushiring (aks holda "Unknown argument" xatosi).
- Katalog Excel'dagi **tan narx, foyda va bozor narxlari atayin o'qilmaydi** (bazaga tushmaydi). `*.xlsx`, `*.csv`, `*.pdf` `.gitignore` da.
- `src/db/client.ts` faqat `DATABASE_URL` ni tekshiradi (seed/migratsiya boshqa kalitlarsiz ishlashi uchun).
- `ANTHROPIC_*`, `BRAVE_API_KEY`, `SENTRY_DSN` `env.ts` da hali ixtiyoriy. 6-7-bosqichda majburiy qilinadi.
- Bazaning nomi `OlxSales` (bo'sh `olxsales` bazasi ham bor, ishlatilmaydi).
- Product statuslari: IMPORTED → IMAGES_FOUND → DRAFT_READY → APPROVED → POSTING → POSTED / FAILED / SKIPPED.
- Loglarda bot tokeni `<TOKEN>` bilan almashtiriladi (`src/lib/scrub.ts`).
- Polling faqat bot jarayonida. Worker faqat `sendMessage` yuboradi (409 xatosidan qochish).
- `/buttons` vaqtinchalik sinov buyrug'i, 6-bosqichda preview bilan almashadi.

## Ishga tushirish
```bash
# Lokal Postgres ishlayotgan bo'lsin
cp .env.example .env     # va to'ldiring (BOT_TOKEN, OWNER_TELEGRAM_ID, DATABASE_URL, BRAVE_API_KEY, ANTHROPIC_*)
npx prisma migrate deploy && npx prisma generate && npx prisma db seed
NODE_OPTIONS=--dns-result-order=ipv4first npm run dev:bot   # IPv6 muammosi bo'lsa
npm test && npm run lint
```

## Keyingi qadamlar
1. OLX e'lon berish formasini o'rganish (`docs/olx-form.md`): majburiy maydonlar, kategoriyalar, rasm limiti, login (login/parolni egasi o'zi kiritadi).
2. Qolgan mahsulotlarga rasm (`/images 10` ni takrorlash), Brave kredit sarfini kuzatish.
3. 6-bosqich: tasdiqlash tugmalari va qoralama.
4. 7-bosqich: Playwright joylash. Avval 1 ta test e'lon.

## Ochiq masalalar
- Bot tokeni oldin chat/log orqali ko'ringan: @BotFather da `/revoke` tavsiya etiladi. Anthropic kaliti va OLX paroli ham chatda yozilgan: almashtirish tavsiya etiladi.
- Mualliflik huquqi: Brave topgan rasmlar boshqa sotuvchilarniki bo'lishi mumkin. Ishlab chiqaruvchi saytlar ustuvor.
- Rasmsiz qolgan mahsulotlar (2 marta topilmagan) uchun qo'lda rasm qo'shish yo'li hali yo'q.
