import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { useRuntimeStore } from '@/stores/runtime';
import { RUNTIME_EVENT_SCHEMA_VERSION, getDiagnostics } from '@/services/runtime';

function Row({
  label,
  value,
  tone = 'normal',
  testId,
}: {
  label: string;
  value: string;
  tone?: 'normal' | 'muted' | 'warn';
  testId?: string;
}): React.ReactElement {
  return (
    <div className="flex items-baseline gap-3 border-b border-[var(--color-line)] py-1.5 last:border-b-0">
      <span className="text-[11px] text-[var(--color-ink-soft)]">{label}</span>
      <span
        {...(testId === undefined ? {} : { 'data-testid': testId })}
        dir="ltr"
        className={cn(
          'ms-auto text-[11px]',
          tone === 'warn' && 'text-[var(--color-warn)]',
          tone === 'muted' && 'text-[var(--color-ink-soft)]',
          tone === 'normal' && 'text-[var(--color-ink)]',
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function RuntimePanel(): React.ReactElement {
  const { t } = useTranslation();
  const health = useRuntimeStore((s) => s.health);
  const status = useRuntimeStore((s) => s.status);
  const refresh = useRuntimeStore((s) => s.refresh);
  const lastCheckedAt = useRuntimeStore((s) => s.lastCheckedAt);
  const rejected = getDiagnostics().length;

  const appVersion =
    (import.meta.env['VITE_APP_VERSION'] as string | undefined) ?? '0.1.0';

  return (
    <div data-testid="settings-panel-runtime">
      <p className="mb-3 text-[11px] leading-relaxed text-[var(--color-ink-soft)]">
        {t('settings.runtime.intro')}
      </p>

      <Row
        label={t('settings.runtime.active')}
        value={health?.kind ?? 'mock'}
        testId="runtime-kind"
      />
      <Row
        label={t('settings.runtime.status')}
        value={t(`runtime.status.${status === 'ready' ? 'ready' : status}`, {
          defaultValue: status,
        })}
        testId="runtime-status"
      />
      <Row
        label={t('settings.runtime.version')}
        value={health?.version ?? '—'}
        testId="runtime-version"
      />
      <Row
        label={t('settings.runtime.schema')}
        value={RUNTIME_EVENT_SCHEMA_VERSION}
        testId="runtime-schema"
      />
      <Row
        label={t('settings.runtime.appVersion')}
        value={appVersion}
        testId="runtime-app-version"
      />
      <Row
        label={t('settings.runtime.rejectedEvents')}
        value={String(rejected)}
        tone={rejected > 0 ? 'warn' : 'muted'}
        testId="runtime-rejected"
      />
      <Row
        label={t('settings.runtime.jcode')}
        value={t('settings.runtime.notInstalled')}
        tone="muted"
        testId="runtime-jcode"
      />
      <Row
        label={t('settings.runtime.ruflo')}
        value={t('settings.runtime.futureIntegration')}
        tone="muted"
        testId="runtime-ruflo"
      />

      <div className="mt-4 flex items-center gap-2">
        <p className="text-[10px] text-[var(--color-ink-soft)]">
          {lastCheckedAt === null
            ? t('settings.runtime.neverChecked')
            : t('settings.runtime.lastChecked', {
                time: new Date(lastCheckedAt).toLocaleTimeString(),
              })}
        </p>
        <button
          type="button"
          data-testid="runtime-recheck"
          onClick={() => void refresh()}
          className={cn(
            'ms-auto rounded-md border border-[var(--color-line)] px-2.5 py-1',
            'text-xs hover:border-[var(--color-brand)]',
          )}
        >
          {t('settings.runtime.recheck')}
        </button>
      </div>
    </div>
  );
}
