import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/Icon';
import { LANGUAGE_LABELS } from '@/i18n';
import { formatNumber } from '@/lib/format';
import { useOllamaStore, selectActiveModel } from '@/stores/ollama';
import { selectActiveSession, totalTokens, useChatStore } from '@/stores/chat';
import { usePreferences } from '@/stores/preferences';
import { useUiStore } from '@/stores/ui';

export function StatusBar(): React.ReactElement {
  const { t } = useTranslation();
  const language = usePreferences((s) => s.language);
  const inspectorOpen = usePreferences((s) => s.inspectorOpen);
  const toggleInspector = usePreferences((s) => s.toggleInspector);
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const session = useChatStore(selectActiveSession);
  const modelId = useChatStore((s) => s.modelId);
  const connection = useOllamaStore((s) => s.status);
  const model = useOllamaStore(selectActiveModel);
  const tokens = totalTokens(session);

  return (
    <footer
      data-testid="status-bar"
      className={cn(
        'flex h-6 shrink-0 items-center gap-3 border-t border-[var(--color-line)]',
        'bg-[var(--color-surface)] px-3 text-[11px] text-[var(--color-ink-soft)]',
      )}
    >
      <span
        className="inline-flex items-center gap-1.5"
        data-testid="status-state"
        aria-live="polite"
      >
        <span
          data-testid="status-dot"
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            isStreaming || connection === 'connecting'
              ? 'animate-pulse bg-[var(--color-warn)]'
              : connection === 'unavailable' || connection === 'error'
                ? 'bg-[var(--color-danger)]'
                : connection === 'no-models'
                  ? 'bg-[var(--color-warn)]'
                  : 'bg-[var(--color-ok)]',
          )}
        />
        <span data-testid="status-connection">
          {isStreaming
            ? t('status.streaming')
            : connection === 'connecting'
              ? t('ollama.status.connecting')
              : connection === 'unavailable'
                ? t('ollama.status.unavailable')
                : connection === 'no-models'
                  ? t('ollama.status.noModels')
                  : connection === 'error'
                    ? t('ollama.status.error')
                    : connection === 'cancelled'
                      ? t('ollama.status.cancelled')
                      : t('status.ready')}
        </span>
      </span>

      <span className="inline-flex items-center gap-1">
        <Icon name="branch" size={11} />
        main
      </span>

      <span className="hidden sm:inline" data-testid="status-model">
        {model?.name ?? modelId}
      </span>

      <span className="ms-auto inline-flex items-center gap-3">
        <span data-testid="status-tokens">
          {t('status.tokens', { count: tokens }).replace(
            String(tokens),
            formatNumber(tokens, language),
          )}
        </span>
        <span>{LANGUAGE_LABELS[language]}</span>
        <button
          type="button"
          onClick={toggleInspector}
          data-testid="status-inspector-toggle"
          className="inline-flex items-center gap-1 rounded px-1 hover:text-[var(--color-ink)]"
        >
          <Icon name="inspector" size={11} />
          {inspectorOpen ? t('inspector.hide') : t('inspector.show')}
        </button>
        <button
          type="button"
          onClick={() => setShortcutsOpen(true)}
          className="rounded px-1 hover:text-[var(--color-ink)]"
        >
          {t('ollama.label')}
        </button>
      </span>
    </footer>
  );
}
