import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { FUTURE_SECTIONS } from '../sections';

export function PrivacyPanel(): React.ReactElement {
  const { t } = useTranslation();
  const points = [
    t('settings.privacy.local'),
    t('settings.privacy.noTelemetry'),
    t('settings.privacy.noCredentials'),
    t('settings.privacy.noNetwork'),
  ];

  return (
    <div data-testid="settings-panel-privacy">
      <p className="mb-3 text-[11px] leading-relaxed text-[var(--color-ink-soft)]">
        {t('settings.privacy.intro')}
      </p>
      <ul className="flex flex-col gap-1.5" data-testid="privacy-points">
        {points.map((point) => (
          <li
            key={point}
            className="flex gap-2 text-[11px] leading-relaxed text-[var(--color-ink)]"
          >
            <span aria-hidden="true" className="text-[var(--color-ok)]">
              •
            </span>
            {point}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[10px] leading-relaxed text-[var(--color-ink-soft)]">
        {t('settings.privacy.storageNote')}
      </p>
    </div>
  );
}

export function AboutPanel(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <div data-testid="settings-panel-about">
      <p className="mb-3 text-[11px] leading-relaxed text-[var(--color-ink-soft)]">
        {t('settings.about.intro')}
      </p>

      <div
        className={cn(
          'mb-4 rounded-md border border-[var(--color-warn)]/40',
          'bg-[var(--color-warn)]/10 p-2.5',
        )}
      >
        <p
          data-testid="about-honesty"
          className="text-[11px] leading-relaxed text-[var(--color-ink)]"
        >
          {t('settings.about.mocked')}
        </p>
      </div>

      <h3 className="mb-1.5 text-[11px] font-medium text-[var(--color-ink-soft)]">
        {t('settings.about.futureSections')}
      </h3>
      <ul
        data-testid="about-future-sections"
        className="flex flex-wrap gap-1.5"
      >
        {FUTURE_SECTIONS.map((name) => (
          <li
            key={name}
            className={cn(
              'rounded border border-[var(--color-line)] px-1.5 py-0.5',
              'text-[10px] text-[var(--color-ink-soft)]',
            )}
          >
            {name}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] leading-relaxed text-[var(--color-ink-soft)]">
        {t('settings.about.futureNote')}
      </p>
    </div>
  );
}
