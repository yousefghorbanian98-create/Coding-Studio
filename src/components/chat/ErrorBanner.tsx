import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/Icon';
import { useChatStore } from '@/stores/chat';

export function ErrorBanner(): React.ReactElement {
  const { t } = useTranslation();
  const errorKey = useChatStore((s) => s.errorKey);
  const retryLast = useChatStore((s) => s.retryLast);
  const dismissError = useChatStore((s) => s.dismissError);
  const isStreaming = useChatStore((s) => s.isStreaming);

  return (
    <AnimatePresence>
      {errorKey ? (
        <motion.div
          role="alert"
          data-testid="error-banner"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.16 }}
          className={cn(
            'mb-2 flex items-center gap-2 rounded-panel border px-3 py-2',
            'border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10',
          )}
        >
          <Icon
            name="close"
            size={14}
            className="shrink-0 text-[var(--color-danger)]"
          />
          <p className="min-w-0 flex-1 text-xs text-[var(--color-ink)]">
            {t(errorKey)}
          </p>
          <button
            type="button"
            onClick={() => void retryLast()}
            disabled={isStreaming}
            data-testid="error-retry"
            className={cn(
              'rounded-md border border-[var(--color-line)] px-2.5 py-1 text-xs',
              'transition hover:border-[var(--color-brand)] disabled:opacity-50',
            )}
          >
            {t('errors.retry')}
          </button>
          <button
            type="button"
            onClick={dismissError}
            aria-label={t('common.close')}
            data-testid="error-dismiss"
            className="rounded p-1 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
          >
            <Icon name="close" size={13} />
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
