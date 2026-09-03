import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/Icon';
import { useRuntimeStore } from '@/stores/runtime';
import type { ProviderAuthState } from '@/services/runtime';

const AUTH_TONE: Record<ProviderAuthState, string> = {
  demo: 'border-[var(--color-brand)] text-[var(--color-brand)]',
  configured: 'border-[var(--color-ok)] text-[var(--color-ok)]',
  'not-configured': 'border-[var(--color-line)] text-[var(--color-ink-soft)]',
  unavailable: 'border-[var(--color-danger)] text-[var(--color-danger)]',
};

export function ProvidersPanel(): React.ReactElement {
  const { t } = useTranslation();
  const providers = useRuntimeStore((s) => s.providers);
  const models = useRuntimeStore((s) => s.models);
  const providerId = useRuntimeStore((s) => s.providerId);
  const modelId = useRuntimeStore((s) => s.modelId);
  const status = useRuntimeStore((s) => s.status);
  const selectProvider = useRuntimeStore((s) => s.selectProvider);
  const selectModel = useRuntimeStore((s) => s.selectModel);

  const loading = status === 'connecting';

  return (
    <div data-testid="settings-panel-providers">
      <p className="mb-3 text-[11px] leading-relaxed text-[var(--color-ink-soft)]">
        {t('settings.providers.intro')}
      </p>

      {loading ? (
        <p
          data-testid="providers-loading"
          className="py-6 text-center text-[11px] text-[var(--color-ink-soft)]"
        >
          {t('settings.providers.loading')}
        </p>
      ) : providers.length === 0 ? (
        <p
          data-testid="providers-empty"
          className="py-6 text-center text-[11px] text-[var(--color-ink-soft)]"
        >
          {t('settings.providers.empty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5" data-testid="providers-list">
          {providers.map((provider) => {
            const active = provider.id === providerId;
            return (
              <li key={provider.id}>
                <button
                  type="button"
                  disabled={provider.disabled}
                  aria-current={active ? 'true' : undefined}
                  data-testid={`provider-${provider.id}`}
                  onClick={() => void selectProvider(provider.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-start',
                    'transition-colors',
                    active
                      ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)]'
                      : 'border-[var(--color-line)] hover:bg-[var(--color-surface-2)]',
                    provider.disabled && 'cursor-not-allowed opacity-60',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-[var(--color-ink)]">
                      {provider.name}
                    </span>
                    <span className="block truncate text-[10px] text-[var(--color-ink-soft)]">
                      {provider.disabled &&
                      provider.disabledReasonKey !== undefined
                        ? t(provider.disabledReasonKey)
                        : provider.vendor}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'shrink-0 rounded border px-1.5 py-0.5 text-[10px]',
                      AUTH_TONE[provider.authState],
                    )}
                  >
                    {t(`settings.providers.auth.${provider.authState}`)}
                  </span>
                  {active ? (
                    <Icon
                      name="check"
                      size={13}
                      className="shrink-0 text-[var(--color-brand)]"
                    />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <h3 className="mb-1.5 mt-4 text-[11px] font-medium text-[var(--color-ink-soft)]">
        {t('settings.providers.models')}
      </h3>
      {models.length === 0 ? (
        <p
          data-testid="models-empty"
          className="py-3 text-[11px] text-[var(--color-ink-soft)]"
        >
          {t('settings.providers.noModels')}
        </p>
      ) : (
        <div role="radiogroup" aria-label={t('settings.providers.models')}>
          {models.map((model) => (
            <button
              key={model.id}
              type="button"
              role="radio"
              aria-checked={model.id === modelId}
              data-testid={`settings-model-${model.id}`}
              onClick={() => selectModel(model.id)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-start',
                model.id === modelId
                  ? 'bg-[var(--color-brand-soft)]'
                  : 'hover:bg-[var(--color-surface-2)]',
              )}
            >
              <span className="min-w-0 flex-1 truncate text-xs text-[var(--color-ink)]">
                {model.name}
              </span>
              <span className="shrink-0 text-[10px] text-[var(--color-ink-soft)]">
                {model.contextK}K
              </span>
            </button>
          ))}
        </div>
      )}

      <p
        data-testid="providers-no-credentials"
        className={cn(
          'mt-4 rounded-md border border-[var(--color-line)]',
          'bg-[var(--color-surface-2)] p-2.5 text-[10px] leading-relaxed',
          'text-[var(--color-ink-soft)]',
        )}
      >
        {t('settings.providers.noCredentials')}
      </p>
    </div>
  );
}
