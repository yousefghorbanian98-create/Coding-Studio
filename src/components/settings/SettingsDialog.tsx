import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@base-ui-components/react/dialog';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/Icon';
import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES } from '@/i18n';
import {
  usePreferences,
  type Density,
  type ThemeMode,
} from '@/stores/preferences';
import { useUiStore } from '@/stores/ui';
import { SETTINGS_SECTIONS, type SettingsSectionId } from './sections';
import { RuntimePanel } from './panels/RuntimePanel';
import { ProvidersPanel } from './panels/ProvidersPanel';
import { PermissionsPanel } from './panels/PermissionsPanel';
import { AboutPanel, PrivacyPanel } from './panels/AboutPanel';

export function SettingsDialog(): React.ReactElement {
  const { t } = useTranslation();
  const open = useUiStore((s) => s.settingsOpen);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const [section, setSection] = useState<SettingsSectionId>('appearance');

  const onNavKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const ids = SETTINGS_SECTIONS.map((item) => item.id);
    const delta = event.key === 'ArrowDown' ? 1 : -1;
    const next = ids[(ids.indexOf(section) + delta + ids.length) % ids.length];
    if (next !== undefined) {
      setSection(next);
      document
        .querySelector<HTMLElement>(`[data-testid="settings-nav-${next}"]`)
        ?.focus();
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setSettingsOpen}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" />
        <Dialog.Popup
          data-testid="settings-dialog"
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex h-[min(86vh,560px)]',
            'w-[min(94vw,720px)] -translate-x-1/2 -translate-y-1/2',
            'overflow-hidden rounded-xl border border-[var(--color-line)]',
            'bg-[var(--color-surface)] shadow-2xl',
          )}
        >
          <nav
            aria-label={t('settings.title')}
            onKeyDown={onNavKeyDown}
            className={cn(
              'flex w-40 shrink-0 flex-col gap-0.5 border-e p-2',
              'border-[var(--color-line)] bg-[var(--color-surface-2)]',
            )}
          >
            {SETTINGS_SECTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                data-testid={`settings-nav-${item.id}`}
                aria-current={section === item.id ? 'page' : undefined}
                tabIndex={section === item.id ? 0 : -1}
                onClick={() => setSection(item.id)}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-start text-xs',
                  'transition-colors',
                  section === item.id
                    ? 'bg-[var(--color-surface)] font-medium text-[var(--color-ink)]'
                    : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]',
                )}
              >
                <Icon name={item.icon} size={13} className="shrink-0" />
                <span className="truncate">{t(item.labelKey)}</span>
              </button>
            ))}
          </nav>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-2 border-b border-[var(--color-line)] px-4 py-3">
              <Dialog.Title className="text-sm font-semibold">
                {t('settings.title')}
              </Dialog.Title>
              <Dialog.Close
                aria-label={t('common.close')}
                className="ms-auto rounded p-1 text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-2)]"
              >
                <Icon name="close" size={14} />
              </Dialog.Close>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {section === 'appearance' ? <AppearancePanel /> : null}
              {section === 'runtime' ? <RuntimePanel /> : null}
              {section === 'providers' ? <ProvidersPanel /> : null}
              {section === 'permissions' ? <PermissionsPanel /> : null}
              {section === 'privacy' ? <PrivacyPanel /> : null}
              {section === 'about' ? <AboutPanel /> : null}
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function AppearancePanel(): React.ReactElement {
  const { t } = useTranslation();
  const prefs = usePreferences();

  const themes: { id: ThemeMode; labelKey: string }[] = [
    { id: 'light', labelKey: 'settings.light' },
    { id: 'dark', labelKey: 'settings.dark' },
    { id: 'system', labelKey: 'settings.system' },
  ];
  const densities: { id: Density; labelKey: string }[] = [
    { id: 'comfortable', labelKey: 'settings.comfortable' },
    { id: 'compact', labelKey: 'settings.compact' },
  ];

  return (
    <div data-testid="settings-panel-appearance">
      <Field label={t('settings.theme')}>
        <SegmentedControl
          testId="settings-theme"
          options={themes.map((item) => ({
            id: item.id,
            label: t(item.labelKey),
          }))}
          value={prefs.theme}
          onChange={(value) => prefs.setTheme(value as ThemeMode)}
        />
      </Field>

      <Field label={t('settings.language')}>
        <SegmentedControl
          testId="settings-language"
          options={SUPPORTED_LANGUAGES.map((lang) => ({
            id: lang,
            label: LANGUAGE_LABELS[lang],
          }))}
          value={prefs.language}
          onChange={(value) => prefs.setLanguage(value as 'en' | 'fa')}
        />
      </Field>

      <Field label={t('settings.density')}>
        <SegmentedControl
          testId="settings-density"
          options={densities.map((item) => ({
            id: item.id,
            label: t(item.labelKey),
          }))}
          value={prefs.density}
          onChange={(value) => prefs.setDensity(value as Density)}
        />
      </Field>

      <Field
        label={`${t('settings.fontSize')} — ${Math.round(prefs.fontScale * 100)}%`}
      >
        <input
          type="range"
          min={85}
          max={130}
          step={5}
          value={Math.round(prefs.fontScale * 100)}
          data-testid="settings-font-scale"
          aria-label={t('settings.fontSize')}
          onChange={(event) =>
            prefs.setFontScale(Number(event.target.value) / 100)
          }
          className="w-full accent-[var(--color-brand)]"
        />
      </Field>

      <div className="mt-4 flex items-center gap-2">
        <p className="text-[11px] text-[var(--color-ink-soft)]">
          {t('settings.saved')}
        </p>
        <button
          type="button"
          onClick={() => prefs.reset()}
          data-testid="settings-reset"
          className={cn(
            'ms-auto rounded-md border border-[var(--color-line)] px-2.5 py-1',
            'text-xs hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]',
          )}
        >
          {t('settings.reset')}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="mb-3">
      <p className="mb-1.5 text-[11px] font-medium text-[var(--color-ink-soft)]">
        {label}
      </p>
      {children}
    </div>
  );
}

function SegmentedControl({
  options,
  value,
  onChange,
  testId,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  testId: string;
}): React.ReactElement {
  return (
    <div
      role="radiogroup"
      data-testid={testId}
      className="inline-flex rounded-md border border-[var(--color-line)] bg-[var(--color-surface-2)] p-0.5"
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={value === option.id}
          data-testid={`${testId}-${option.id}`}
          onClick={() => onChange(option.id)}
          className={cn(
            'rounded px-3 py-1 text-xs transition',
            value === option.id
              ? 'bg-[var(--color-surface)] font-medium text-[var(--color-ink)] shadow-sm'
              : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
