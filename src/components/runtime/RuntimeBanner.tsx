import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/Icon';
import { selectErrorKey, useRuntimeStore } from '@/stores/runtime';

/**
 * Explains why agent features are blocked and offers the recovery action.
 *
 * Renders nothing while the runtime is healthy so the composer keeps its space.
 */
export function RuntimeBanner(): React.ReactElement | null {
  const { t } = useTranslation();
  const status = useRuntimeStore((s) => s.status);
  const detail = useRuntimeStore((s) => s.errorDetail);
  const errorKey = useRuntimeStore(selectErrorKey);
  const refresh = useRuntimeStore((s) => s.refresh);

  const visible =
    status === 'unavailable' || status === 'no-models' || status === 'error';

  const title =
    status === 'unavailable'
      ? t('runtime.banner.unavailableTitle')
      : status === 'no-models'
        ? t('runtime.banner.noModelsTitle')
        : t('runtime.banner.errorTitle');

  const body =
    status === 'unavailable'
      ? t('runtime.banner.unavailableBody')
      : status === 'no-models'
        ? t('runtime.banner.noModelsBody')
        : (errorKey ? t(errorKey) : null);

  return (
    <AnimatePresence initial={false}>
      {visible ? (
        <motion.div
          role="alert"
          data-testid="runtime-banner"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.15 }}
          className="overflow-hidden"
        >
          <div
            className={cn(
              'mb-2 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs',
              'border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10',
            )}
          >
            <Icon
              name="alert"
              size={14}
              className="mt-0.5 shrink-0 text-[var(--color-danger)]"
            />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-[var(--color-ink)]">{title}</p>
              {body ? (
                <p className="mt-0.5 text-[var(--color-ink-soft)]">{body}</p>
              ) : null}
              {detail ? (
                <p className="mt-0.5 font-mono text-[10px] text-[var(--color-ink-soft)]">
                  {detail}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => void refresh()}
              data-testid="runtime-banner-retry"
              className={cn(
                'shrink-0 rounded-md border border-[var(--color-line)] px-2 py-1',
                'text-[11px] text-[var(--color-ink)] transition-colors',
                'hover:border-[var(--color-brand)]',
              )}
            >
              {t('runtime.retry')}
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
