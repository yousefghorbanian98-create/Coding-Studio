import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGE_DIRECTION } from '@/i18n';
import { resolveTheme, usePreferences } from '@/stores/preferences';

/**
 * Applies persisted appearance preferences (theme, direction, language,
 * density, font scale) to the document element.
 */
export function useAppearance(): void {
  const { i18n } = useTranslation();
  const theme = usePreferences((s) => s.theme);
  const language = usePreferences((s) => s.language);
  const density = usePreferences((s) => s.density);
  const fontScale = usePreferences((s) => s.fontScale);

  useEffect(() => {
    const root = document.documentElement;
    const apply = (): void => {
      const resolved = resolveTheme(theme);
      root.classList.toggle('dark', resolved === 'dark');
      root.dataset['theme'] = resolved;
    };
    apply();

    if (theme !== 'system' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = language;
    root.dir = LANGUAGE_DIRECTION[language];
    if (i18n.language !== language) void i18n.changeLanguage(language);
  }, [language, i18n]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset['density'] = density;
    root.style.fontSize = `${16 * fontScale}px`;
  }, [density, fontScale]);
}
