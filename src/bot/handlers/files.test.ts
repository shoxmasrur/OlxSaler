import { describe, expect, it, vi } from 'vitest';

vi.mock('../../config/env.js', () => ({ env: { BOT_TOKEN: 'test' } }));
vi.mock('../../services/priceList/import.js', () => ({}));

const { detectKind } = await import('./files.js');
const { parseCallback } = await import('./callbacks.js');

// Minimal haqiqiy PNG (1x1)
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==',
  'base64',
);

describe('detectKind', () => {
  it('rasmni taniydi', async () => {
    expect(await detectKind(PNG)).toBe('image');
  });

  it('matnli CSV ni taniydi', async () => {
    expect(await detectKind(Buffer.from('model,narx\nGalaxy A55,4200000\n'))).toBe('csv');
  });

  it('boshqa binar faylni rad etadi', async () => {
    expect(await detectKind(Buffer.from([0x00, 0x01, 0x02, 0x03, 0x00]))).toBeNull();
  });

  it('zip (xlsx emas) ni xlsx deb olmaydi', async () => {
    const emptyZip = Buffer.from('504b0506' + '00'.repeat(18), 'hex');
    expect(await detectKind(emptyZip)).not.toBe('xlsx');
  });
});

describe('parseCallback', () => {
  it('action:productId ni ajratadi', () => {
    expect(parseCallback('approve:42')).toEqual({ action: 'approve', productId: 42 });
  });

  it("noto'g'ri formatni rad etadi", () => {
    expect(parseCallback('approve')).toBeNull();
    expect(parseCallback('approve:abc')).toBeNull();
  });
});
