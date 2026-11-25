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

### Марка монитора / планшета
Ro'yxatlari hali yig'ilmagan (keyingi kuzatuv). Taxmin: "Другая марка" varianti bor.

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

## Ochiq savollar
1. **Bepul e'lon limiti**: OLX har kategoriyada bepul e'lonlar sonini cheklashi mumkin ("Платные услуги"). Birinchi test e'londan keyin ko'rinadi.
2. Monitor va planshet **marka ro'yxatlari** (keyingi kuzatuv).
