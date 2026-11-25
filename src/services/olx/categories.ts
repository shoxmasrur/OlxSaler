/** Excel varaq nomi -> OLX kategoriya yo'li (docs/olx-form.md). */
export interface OlxCategory {
  /** Ko'rsatish uchun to'liq yo'l. */
  path: string;
  /** Modal oynada bosiladigan darajalar (rus nomlari). */
  steps: string[];
  /** Ноутбуки uchun Диагональ va Марка maydonlari majburiy. */
  laptopFields: boolean;
}

const LAPTOP: OlxCategory = {
  path: 'Электроника / Компьютеры / Ноутбуки',
  steps: ['Электроника', 'Компьютеры', 'Ноутбуки'],
  laptopFields: true,
};
const TABLET: OlxCategory = {
  path: 'Электроника / Компьютеры / Планшетные компьютеры',
  steps: ['Электроника', 'Компьютеры', 'Планшетные компьютеры'],
  laptopFields: false,
};
const MONITOR: OlxCategory = {
  path: 'Электроника / Компьютеры / Мониторы',
  steps: ['Электроника', 'Компьютеры', 'Мониторы'],
  laptopFields: false,
};
const AIO: OlxCategory = {
  path: 'Электроника / Компьютеры / Настольные / Моноблок',
  steps: ['Электроника', 'Компьютеры', 'Настольные', 'Моноблок'],
  laptopFields: false,
};

export function olxCategoryFor(sheetName: string | null | undefined): OlxCategory | null {
  const n = (sheetName ?? '').toLowerCase();
  if (n.startsWith('noutbuk')) return LAPTOP;
  if (n.startsWith('planshet')) return TABLET;
  if (n.startsWith('monitor')) return MONITOR;
  if (n.startsWith('monoblok')) return AIO;
  return null;
}
