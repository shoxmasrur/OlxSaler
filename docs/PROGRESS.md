# Loyiha holati (OlxSaler)

Oxirgi yangilanish: 2026-11-26. Eski reja: "OLX E'lon Agenti — Texnik vazifa va ishlar ketma-ketligi" (PDF, repoda yo'q).

**Oqim:** katalog Excel → bot bazaga yuklaydi → `/prepare` (Brave rasm, Claude ta'rif, navbat) → worker har e'lon oldidan Telegram'da egasidan tasdiq so'raydi → Playwright OLX.uz'ga odamdek sur'atda joylaydi (reklamasiz).

## Bosqichlar

| Bosqich | Holat | Izoh |
|---|---|---|
| 0 Tayyorgarlik | Tugadi | Kalitlar, OLX formasi `docs/olx-form.md`, profil (Бизнес, telefon, Toshkent) |
| 1 Skelet | Tugadi | TS strict, eslint, prettier, vitest, zod env, pino |
| 2 Baza | Tugadi | Prisma 7 (7 jadval), `logEvent`, seed |
| 3 Telegram bot | Tugadi | grammY, whitelist, buyruqlar |
| 4 Excel import | Tugadi | Katalog formati, validatsiya, dublikat himoyasi |
| 5 Rasm qidirish | Tugadi | `/images`, Brave, SSRF himoyasi, SHA-256 dublikat |
| 6 Tasdiq va qoralama | Tugadi | `/review`, `/draft`, Claude kirish matni (kafolat/yetkazib berish yozilmaydi, kirill aralash matn rad etiladi) |
| 7 OLX'ga joylash | Tugadi | `src/worker/olx/poster.ts`, "Не рекламировать" → "Да, создать", dublikat tekshiruvi, CAPTCHA/blokda to'xtaydi |
| 8 Navbat va limit | Tugadi | `/prepare`, `/status`, `/pause`, `/resume`; 10 daq interval, kuniga 30, 09:00–20:00 Toshkent |
| 9 Monitoring | Qisman | Xatoda skrinshot + Telegram xabari + avtomatik pauza. Sentry yo'q |
| 10 VPS | Kutmoqda | Hozir egasining kompyuterida ishlaydi |

## Joriy ma'lumotlar (2026-11-26 ertalab)
- 99 mahsulot. Joylangan: 31 ta (#6–#36, 2026-11-25). #37 egasi tomonidan tasdiqlangan, #38–#47 navbatda.
- OLX «Мега, 100 e'lon» paketi (Электроника, ~2026-12-25 gacha): ≈69 ta qoldi.
- 4 ta mahsulotga Brave rasm topa olmadi (2 urinishdan keyin `/prepare` o'tkazib yuboradi).

## Ishga tushirish
```bash
NODE_OPTIONS=--dns-result-order=ipv4first npm run dev:bot      # Telegram bot (tugmalar, buyruqlar)
NODE_OPTIONS=--dns-result-order=ipv4first npm run dev:worker   # joylash ishchisi (Chrome oynasi ochiladi)
npm test && npm run lint
```
- OLX sessiyasi `browser-profile/` da. Chiqib ketgan bo'lsa: `npm run olx:login`. Sinov (joylamasdan): `npm run olx:dryrun`.
- Sxema o'zgarsa: `npx prisma migrate dev` va `npx prisma generate`.

## Muhim texnik qarorlar
- **Prisma 7.10.1** (`latest` = rc, o'rnatmang). `npm audit fix --force` ishlatilmaydi.
- Worker Telegram'ga faqat xabar yuboradi, polling faqat botda (409 to'qnashuvi bo'lmasin).
- "Опубликовать" bir marta bosiladi, hech qachon qayta urinilmaydi. Worker joylash paytida to'xtasa, vazifa FAILED bo'ladi va navbat pauzaga tushadi.
- Dublikat bo'lmagan har qanday xato butun navbatni pauzaga qo'yadi (`/resume` bilan davom).
- Katalogdagi tan narx/foyda ustunlari bazaga o'qilmaydi.
- Wi-Fi ba'zan IPv4'ni yo'qotadi (faqat IPv6): OLX/Telegram ochilmasa Wi-Fi'ni qayta ulang.

## Ochiq masalalar
- Bot tokeni, Anthropic kaliti va OLX paroli oldin chatda ko'ringan: almashtirish tavsiya etiladi.
- Brave rasmlari boshqa sotuvchilarniki bo'lishi mumkin; OLX "настоящие фото" deb ogohlantiradi.
- Rasmsiz qolgan mahsulotlar uchun qo'lda rasm qo'shish yo'li yo'q.
- OLX PRO "Импорт объявлений" (rasmiy ommaviy yuklash) hali o'rganilmagan.
