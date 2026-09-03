import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './locales/en';
import { fa } from './locales/fa';

export const SUPPORTED_LANGUAGES = ['en', 'fa'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_DIRECTION: Record<Language, 'ltr' | 'rtl'> = {
  en: 'ltr',
  fa: 'rtl',
};

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: 'English',
  fa: 'فارسی',
};

export function isLanguage(value: unknown): value is Language {
  return (
    typeof value === 'string' &&
    (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
  );
}

export const resources = {
  en: { translation: en },
  fa: { translation: fa },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
