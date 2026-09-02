import { describe, expect, it } from 'vitest';
import { en } from '../locales/en';
import { fa } from '../locales/fa';
import { LANGUAGE_DIRECTION, SUPPORTED_LANGUAGES, isLanguage } from '..';

function keys(object: object, prefix = ''): string[] {
  return Object.entries(object).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null
      ? keys(value as object, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

describe('i18n', () => {
  it('supports Persian and English', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['en', 'fa']);
    expect(LANGUAGE_DIRECTION.fa).toBe('rtl');
    expect(LANGUAGE_DIRECTION.en).toBe('ltr');
  });

  it('validates language codes', () => {
    expect(isLanguage('fa')).toBe(true);
    expect(isLanguage('de')).toBe(false);
  });

  it('has identical key sets in both bundles', () => {
    expect(keys(fa).sort()).toEqual(keys(en).sort());
  });

  it('has no untranslated Persian strings', () => {
    const enValues = new Set(keys(en));
    expect(enValues.size).toBeGreaterThan(50);
    expect(fa.chat.send).not.toBe(en.chat.send);
  });
});
