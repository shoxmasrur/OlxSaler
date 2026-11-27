/* global document, location, setTimeout */
/**
 * OLX statistikasini egasining o'z Chrome sessiyasidan yig'ish (Claude in Chrome orqali ishga
 * tushiriladi). Faqat sahifada KO'RINIB turgan raqamlar o'qiladi, xuddi odam ko'zi bilan
 * ko'rgandek: kirish kaliti, cookie yoki yopiq API ishlatilmaydi, sahifalash tugmasidan boshqa
 * hech narsa bosilmaydi va o'zgartirilmaydi.
 *
 * 1) https://www.olx.uz/myaccount/ da: `await collectAds()` -> e'lonlar ro'yxati.
 * 2) https://www.olx.uz/myaccount/answers/ da: `collectChats()` -> suhbatlar (xabar matnisiz).
 * Natija `{ takenAt, ads, chats }` ko'rinishida faylga yoziladi va `npm run stats:ingest -- <fayl>`.
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Joriy sahifadagi e'lon kartochkalari: OLX ID, sarlavha, 👁/⭐/📞 va xabarlar soni. */
function readAdCards() {
  return [...document.querySelectorAll('[data-testid="inventory-item-stats"]')].flatMap((s) => {
    let card = s;
    while (card && !/ID: \d+/.test(card.innerText)) card = card.parentElement;
    if (!card) return [];
    const adId = /ID: (\d+)/.exec(card.innerText)[1];
    const v = {};
    s.querySelectorAll('li').forEach((li) => {
      v[li.querySelector('svg')?.getAttribute('aria-label')] = Number(li.innerText.trim()) || 0;
    });
    const title = card.innerText.split('\n').find((t) => t.trim().length >= 10) ?? '';
    const msg = card.querySelector('[data-testid="inventory-message-counter"]')?.innerText.trim();
    return [
      {
        adId,
        title: title.trim(),
        views: v.Views ?? 0,
        observed: v.Observed ?? 0,
        phones: v.Phones ?? 0,
        messages: Number(msg) || 0,
      },
    ];
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function collectAds() {
  if (!location.pathname.startsWith('/myaccount')) throw new Error('myaccount sahifasi emas');
  const all = new Map();
  for (let page = 1; page <= 20; page++) {
    if (page > 1) {
      const btn = [...document.querySelectorAll('button')].find(
        (b) => b.innerText.trim() === String(page),
      );
      if (!btn) break;
      const firstBefore = readAdCards()[0]?.adId;
      btn.click();
      // Yuklanish paytida kartochkalar bir zum bo'sh bo'ladi: yangi sahifa chiqmaguncha kutamiz.
      const loaded = () => {
        const first = readAdCards()[0]?.adId;
        return first !== undefined && first !== firstBefore;
      };
      for (let i = 0; i < 50 && !loaded(); i++) await sleep(300);
      await sleep(1000);
    }
    for (const ad of readAdCards()) all.set(ad.adId, ad);
  }
  return [...all.values()];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function collectChats() {
  const readTitle = document.querySelector('[data-testid="read-section-title"]');
  return [...document.querySelectorAll('[data-testid^="conversations-list-item-"]')].map((el) => {
    const t = (id) => el.querySelector(`[data-testid="${id}"]`)?.innerText.trim() ?? '';
    return {
      id: el.dataset.testid.replace('conversations-list-item-', ''),
      userName: t('list-item-user-name'),
      adTitle: t('list-item-context-title'),
      lastLabel: t('list-item-datetime'),
      // O'qilmaganlar bo'limi "o'qilganlar" sarlavhasidan oldin keladi.
      unread: readTitle ? Boolean(readTitle.compareDocumentPosition(el) & 2) : false,
    };
  });
}
