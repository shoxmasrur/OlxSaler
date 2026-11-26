# OLX.uz e'lon berish formasi (kuzatuv natijasi)

Sana: 2026-11-25. Manba: `https://www.olx.uz/adding/` (brauzerda qo'lda ko'rib chiqildi, hech narsa joylanmagan). Interfeys rus tilida (`Рус`), `O'Z` ga almashtirish mumkin. Maydon nomlari quyida **rus tilida** (Playwright shu matnlar bo'yicha topadi).

Kirish: login sahifasi `login.olx.uz`. Parolni dastur emas, egasi qo'lda kiritadi; Playwright uchun saqlangan sessiya (`browser-profile/`) ishlatiladi.

## Umumiy maydonlar (barcha kategoriyalar)
| Maydon (RU) | Majburiy | Cheklov / izoh | Bizning manba |
|---|---|---|---|
| Укажите название | Ha | **16-70 belgi** | `Product.title` (Excel "E'lon sarlavhasi") |
| Категория | Ha | Modal oyna, 3-4 daraja (pastga qarang) | Excel varaq nomi |
| Фото | Yo'q (*) | **8 tagacha** (8 ta fayl maydoni), 1-chisi muqova | `ProductImage` (3 tagacha) |
| Описание | Ha | **40-9000 belgi** | `Product.description` |
| Продать / Обмен / Бесплатно | Ha | Standart: **Продать** | Продать |
| Цена | Ha | Raqam + валюта (**сум** / **у.е.**), "Договорная" tumbleri | `Product.price`, сум |
| Частный или бизнес | Ha | `Частное лицо` / `Бизнес` | **Savol ochiq** |
| Состояние | Ha | `Б/у` / `Новый` | Новый |
| Автопродление | Yo'q | Standart o'chiq | Tegmaymiz |
| Местоположение | Ha | "Название города или индекс" combobox | **Savol ochiq** |
| Контактное лицо | - | Profilidan to'lgan | - |
| Email-адрес | - | Profilidan to'lgan (o'zgartirib bo'lmaydi) | - |
| Номер телефона | - | **Hozir bo'sh (`+998`)** | **Savol ochiq** |
| Предпросмотр / Опубликовать | - | Pastda ikki tugma | Faqat Опубликовать (tasdiqdan keyin) |

(*) Fotoning majburiyligi tekshirilmagan (yulduzcha yo'q). Hamma e'londa foto bo'lishi kerak, deb hisoblaymiz.

## Kategoriya yo'li va qo'shimcha maydonlar
Yo'l: **Электроника → Компьютеры → ...**

| Bizning varaq | OLX yo'li | Qo'shimcha maydonlar |
|---|---|---|
| Noutbuk i7 / i5 / boshqa | Электроника / Компьютеры / **Ноутбуки** | **Диагональ экрана***, **Марка ноутбука*** |
| Planshet | Электроника / Компьютеры / **Планшетные компьютеры** | Марка планшетного компьютера |
| Monitor 22-24" / 27" / 29-45" | Электроника / Компьютеры / **Мониторы** | Марка монитора (diagonal yo'q) |
| Monoblok | Электроника / Компьютеры / Настольные / **Моноблок** | Faqat umumiy maydonlar |

"Настольные" ichida: Системный блок / Моноблок / Другое.

### Диагональ экрана (ro'yxat, Ноутбуки)
`До 13"`, `13"-14"`, `15"-15,6"`, `16"-17"`, `От 18"`.
Moslash: sarlavhadagi diagonal (`15,6`, `15.6`, `15.3`, `14`, `16`...) shu oraliqlarga tushiriladi. Oraliqqa tushmaydigan qiymat (masalan 14.5, 15.3) uchun qoida qo'lda tekshirilishi kerak.

### Марка ноутбука (to'liq ro'yxat)
Acer, Apple, Asus, BenQ, Bliss, Chuwi, Compaq, Dell, DESTEN, Digma, eMachines, Fujitsu-Siemens, GigaByte, Hasee, Honor, HP, HTC, Huawei, IBM/ThinkPad, iRU, Jumper, Lenovo, LG, Machenike, Medion, Microsoft Surface, MSI, NEC, Packard Bell, Panasonic, Razer, RoverBook, Samsung, Schenker, Sony, Teclast, Thunderobot, Toshiba, VAIO, Wortmann, Xiaomi, XMG, **Другая марка**, AIWA.
Moslash: modelning birinchi so'zi (HP, ASUS, LENOVO, ACER, DELL...) shu ro'yxatga; topilmasa (KEETAB va h.k.) → `Другая марка`.

### Планшетные компьютеры (2026-11-26, #57–#61 joylandi)
- OLX sarlavhadan ko'pincha **«Ноутбуки» ni noto'g'ri taklif qiladi**: «Изменить» → Электроника → Компьютеры → Планшетные компьютеры qo'lda tanlanadi.
- Qo'shimcha maydonlar: Частный/Бизнес, **Марка планшетного компьютера***, Состояние. Diagonal yo'q.
- Marka ro'yxati: Acer, Alldocube, Amazon, Apple, Archos, Asus, BDF, Black Shark, BQ, Chuwi, Cube, Datawind, Dell, Digma, Dragon Touch, Getac, Google Pixel Tablet, Honor, HP, HTC, Huawei, iBall, iLife, Intex, Irbis, Jumper, Karbonn, Kobo, Lava, Lenovo, Medion, Micromax, Microsoft Surface, Nubia, Nvidia, Onda, OnePlus, Onyx Boox, Oppo, Oukitel, Panasonic, Pipo, Prestigio, Ramos, Realme, Remarkable, Samsung, Sony, TCL, Teclast, Toshiba, Vankyo, Vivo, Wiko, Xiaomi, Zebra, ZTE, Zync, **Другая**.

### Моноблок (2026-11-26, #63 joylandi)
- Kategoriya modalida «Моноблок (Электроника / Компьютеры / Настольные)» tavsiya sifatida chiqadi.
- Qo'shimcha maydonlar faqat Частный/Бизнес va Состояние (marka yo'q).

### Мониторы (2026-11-26, #71–#72 joylandi)
- OLX sarlavhadan «Мониторы» ni to'g'ri taklif qiladi. Maydonlar: Частный/Бизнес, Состояние, Марка монитора (majburiy emas).
- Marka ro'yxati: Acer, AIWA, AOC, Apple, Artel, ASUS, BenQ, BQ, Corsair, DELL, Digma, Dough, Eizo, Element, Envision, ExeGate, Framework, Fujitsu-Siemens, Gigabyte, Ginzzu, Hanns.G, Hasee, Hisense, HKC, Honor, HP, Huawei, Hyundai, Iiyama, Innocn, Irbis, KTC, KOORUI, Krez, Lenovo, LG, MAG, Monoprice, MSI, NEC, Neovo, Onn, Panasonic, Philips, Prestigio, Proview, Razer, Redragon, Samsung, Sanc, Sceptre, Sharp, Skyworth, Sony, TCL, Titan Army, Topdevice, Topview, Toshiba, Viewsonic, Viotek, Xiaomi, **Другая марка** (Ziffler/Immer/Everel yo'q).
- Monoblok kategoriyasi tavsiya qilinmasa: Электроника → Компьютеры → Настольные → Моноблок.

## Texnik kuzatuvlar (Playwright uchun)
- Maydonlar `textbox`, `combobox` (ro'yxat ochilganda `listbox` > `option` > havola) va tugma (`button`) sifatida chiqadi; matn bo'yicha topish mumkin: `getByRole('button', { name: 'Новый' })`.
- Kategoriya modali har ochilganda eng yuqori darajadan boshlanadi; ustunlar chapdan o'ngga ochiladi.
- Pastda cookie paneli bor; "Закрыть" bilan yopiladi (rozilik bermasdan).
- Rasm yuklash: yashirin `file-input` maydonlari (8 ta), `setInputFiles` ishlaydi deb kutiladi (sinab ko'rilmagan).
- `Опубликовать` qaytarib bo'lmaydigan amal: faqat egasi tasdiqlagandan keyin, kunlik limit 5 ichida.

## Hal bo'lgan masalalar (2026-11-25)
- **Telefon**: OLX profiliga saqlandi (`Sozlamalar → Profilni tahrirlash`). Endi formada `Номер телефона` avtomatik to'ladi.
- **Местоположение**: profilda `Toshkent, Yunusobod tumani`, formada avtomatik `Ташкент, Юнусабадский район`.
- **Контактное лицо** profildan to'ladi. Dastur bu uchta maydonga tegmaydi.
- **Частное лицо / Бизнес**: egasi **Бизнес** ni tanladi. Har e'londa kategoriya maydonlari ichida `Бизнес` tugmasi bosiladi (`.env`: `OLX_SELLER_TYPE=business`).
- **Qoralama oynasi**: kategoriya tanlangan, lekin e'lon joylanmagan bo'lsa, OLX saqlab qo'yadi va `/adding/` ga qaytganda "У вас есть незаконченное объявление" oynasi chiqadi. Bot har safar **`Нет, начать заново`** ni bosishi kerak.
- Formadan boshqa sahifaga o'tishda "Leave site?" dialogi chiqishi mumkin (saqlanmagan o'zgarish).

## «Опубликовать» dan keyingi oqim (pilot #6, 2026-11-25, haqiqiy joylash)
1. «Опубликовать» bosiladi → e'lon **yaratiladi** (URL'da `ad-id=...`) va OLX `/purchase/activate/promote/` sahifasini ochadi: **pullik reklama taklifi** («Быстрая продажа» 96 700 so'm oldindan belgilangan).
2. Pastdagi sticky panelda ikki tugma: `Не рекламировать` va `Добавить рекламу (...)`. **Faqat `Не рекламировать` bosiladi.** Cookie paneli bu tugmalarni yopib turadi: avval cookie `Закрыть`.
3. Tasdiq oynasi «Создать объявление без рекламы?»: `Да, создать`.
4. `/purchase/confirmation/` sahifasi: «Количество доступных объявлений будет уменьшено» (paketdan 1 ta sarflandi, to'lov yo'q).
5. E'lon `Активные` ro'yxatida paydo bo'ladi, havola: `https://www.olx.uz/d/<ad-id>/`.
- Tugallanmagan forma qoralamasi saqlanadi: `/adding/` ochilganda «У вас есть незаконченное объявление» → `Нет, начать заново`.
- OLX foto maydonida «настоящие фото, не из интернета» deb ogohlantiradi (moderatsiya natijasi hali kuzatilmoqda).
- Eslatma: `Мой бизнес` bo'limida **PRO `Импорт объявлений` / `Экспорт объявлений`** bor: OLX'ning o'zining ommaviy yuklash vositasi (keyin o'rganish kerak, qoidalarga mos ommaviy yo'l bo'lishi mumkin).

## Hisob turi va limitlar (2026-11-25, brauzerda tekshirildi)
- Hisob **oddiy (biznes emas)**: foydalanuvchi `gulshox1998`, paket yo'q, balans 0 so'm / 0 bonus.
- **Bepul e'lon limiti**: `Электроника / Компьютеры` da qoldiq **0**, keyingi bepul e'longacha 29 kun (minimal davr 30 kun). Hisobda 2 ta faol (Gigabyte monitorlar, 24-noyabr), 1 ta `Неоплаченные`, 1 ta `Неактивные` e'lon bor. Ya'ni bepul yo'l bilan oyiga taxminan 1-2 ta e'lon.
- **Paketlar** (`Компьютеры`, hammasi 30 kunlik): `Старт` 5 e'lon = 30 900 so'm; `Премиум` 10 e'lon = 61 100 so'm; `Мега` 50 e'lon = 300 000 so'm (bitta e'lon ~6 000-6 180 so'm). Paketga `Бизнес-страница` kiradi.
- OLX.uz'da yetkazib berish xizmati yo'q (OLX o'zi ogohlantiradi): e'londa "yetkazib berish" yozilmaydi.
- Eslatma: hisobdagi 2 ta faol Gigabyte monitor katalogdagi mahsulotlar bilan bir xil bo'lishi mumkin: joylashdan oldin takrorlanishni tekshirish kerak.

## Ochiq savollar
1. **Bepul e'lon limiti** (yuqorida aniqlandi: bepul qoldiq 0): OLX har kategoriyada bepul e'lonlar sonini cheklashi mumkin ("Платные услуги"). Birinchi test e'londan keyin ko'rinadi.
2. Monitor va planshet **marka ro'yxatlari** (keyingi kuzatuv).
