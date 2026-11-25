import { describe, expect, it } from 'vitest';
import { scrubSecrets } from './scrub.js';

const TOKEN = '1234567890:AAFakeTokenForTestsOnly_abcdefghijklmnop';

describe('scrubSecrets', () => {
  it('Telegram manzilidagi tokenni yashiradi (token qiymatini bilmasa ham)', () => {
    const text = `request to https://api.telegram.org/bot${TOKEN}/setMyCommands failed`;
    const out = scrubSecrets(text, undefined);
    expect(out).toBe('request to https://api.telegram.org/bot<TOKEN>/setMyCommands failed');
    expect(out).not.toContain('AAFake');
  });

  it("token matnning istalgan joyida bo'lsa ham yashiradi", () => {
    expect(scrubSecrets(`token=${TOKEN}; yana ${TOKEN}`, TOKEN)).toBe(
      'token=<TOKEN>; yana <TOKEN>',
    );
  });

  it("oddiy matnni o'zgartirmaydi", () => {
    expect(scrubSecrets('Bot ishga tushdi', TOKEN)).toBe('Bot ishga tushdi');
    expect(scrubSecrets('Bot ishga tushdi', undefined)).toBe('Bot ishga tushdi');
  });
});
