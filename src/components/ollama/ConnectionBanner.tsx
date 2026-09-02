import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/cn';
import { Icon, type IconName } from '@/components/ui/Icon';
import { selectErrorKey, useOllamaStore } from '@/stores/ollama';

type Tone = 'danger' | 'warn' | 'info';

const TONE_CLASSES: Record<Tone, string> = {
  danger: 'border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10',
  warn: 'border-[var(--color-warn)]/40 bg-[var(--color-warn)]/10',
  info: 'border-[var(--color-line)] bg-[var(--color-surface-2)]',
};

/**
 * Surfaces the non-streaming Ollama connection states above the composer:
 * unavailable, no models installed, and backend/protocol errors.
 */
export function ConnectionBanner(): React.ReactElement {
  const { t } = useTranslation();
  const status = useOllamaStore((s) => s.status);
  const endpoint = useOllamaStore((s) => s.endpoint);
  const refresh = useOllamaStore((s) => s.refresh);
  const errorKey = useOllamaStore(selectErrorKey);

  const visible =
    status === 'unavailable' || status === 'no-models' || status === 'error';

  const tone: Tone = status === 'no-models' ? 'warn' : 'danger';
  const icon: IconName = status === 'no-models' ? 'files' : 'close';

  const titleKey =
    status === 'unavailable'
      ? 'ollama.banner.unavailableTitle'
      : status === 'no-models'
        ? 'ollama.banner.noModelsTitle'
        : 'ollama.banner.errorTitle';

  const bodyKey =
    status === 'unavailable'
      ? 'ollama.banner.unavailableBody'
      : status === 'no-models'
        ? 'ollama.banner.noModelsBody'
        : (errorKey ?? 'ollama.errors.backend');

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          role="alert"
          data-testid="connection-banner"
          data-status={status}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.16 }}
          className={cn(
            'mb-2 flex items-start gap-2.5 rounded-panel border px-3 py-2.5',
            TONE_CLASSES[tone],
          )}
        >
          <Icon
            name={icon}
            size={14}
            className={cn(
              'mt-0.5 shrink-0',
              tone === 'danger'
                ? 'text-[var(--color-danger)]'
                : 'text-[var(--color-warn)]',
            )}
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold">{t(titleKey)}</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--color-ink-soft)]">
              {t(bodyKey)}
            </p>
            {status === 'unavailable' ? (
              <code
                dir="ltr"
                className="mt-1 block font-mono text-[10px] text-[var(--color-ink-soft)]"
              >
                {endpoint}
              </code>
            ) : null}
            {status === 'no-models' ? (
              <code
                dir="ltr"
                className="mt-1 block rounded bg-[var(--color-surface)] px-2 py-1 font-mono text-[10px]"
              >
                ollama pull llama3.2
              </code>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            data-testid="connection-retry"
            className={cn(
              'shrink-0 rounded-md border border-[var(--color-line)] px-2.5 py-1',
              'text-xs transition hover:border-[var(--color-brand)]',
            )}
          >
            {t('ollama.retry')}
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
