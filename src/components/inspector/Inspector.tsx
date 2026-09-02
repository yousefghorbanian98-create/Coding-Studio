import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { formatDateTime, formatNumber } from '@/lib/format';
import { findModel } from '@/services/runtime/fixtures';
import { selectActiveSession, totalTokens, useChatStore } from '@/stores/chat';
import { usePreferences } from '@/stores/preferences';

export function Inspector(): React.ReactElement {
  const { t } = useTranslation();
  const open = usePreferences((s) => s.inspectorOpen);
  const setInspectorOpen = usePreferences((s) => s.setInspectorOpen);
  const language = usePreferences((s) => s.language);
  const session = useChatStore(selectActiveSession);
  const selectedMessageId = useChatStore((s) => s.selectedMessageId);
  const message = session?.messages.find((m) => m.id === selectedMessageId);
  const model = findModel(session?.modelId ?? '');

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.aside
          key="inspector"
          data-testid="inspector"
          aria-label={t('inspector.title')}
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 300, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 40 }}
          className={cn(
            'flex shrink-0 flex-col overflow-hidden border-s',
            'border-[var(--color-line)] bg-[var(--color-surface)]',
          )}
        >
          <div className="flex h-10 shrink-0 items-center gap-2 px-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-soft)]">
              {t('inspector.title')}
            </h2>
            <div className="ms-auto">
              <IconButton
                label={t('inspector.hide')}
                data-testid="inspector-close"
                onClick={() => setInspectorOpen(false)}
                className="h-6 w-6"
              >
                <Icon name="close" size={13} />
              </IconButton>
            </div>
          </div>

          <div className="min-h-0 w-[300px] flex-1 overflow-y-auto px-3 pb-3">
            <Section title={t('inspector.session')}>
              <Row label={t('inspector.session')} value={session?.title ?? '—'} />
              <Row label={t('inspector.model')} value={model?.name ?? '—'} />
              <Row
                label={t('inspector.messages')}
                value={formatNumber(session?.messages.length ?? 0, language)}
              />
              <Row
                label={t('inspector.tokens')}
                value={formatNumber(totalTokens(session), language)}
              />
              <Row
                label={t('inspector.created')}
                value={
                  session ? formatDateTime(session.createdAt, language) : '—'
                }
              />
            </Section>

            <Section title={t('inspector.details')}>
              {message ? (
                <>
                  <Row label="ID" value={message.id} mono />
                  <Row label="Role" value={message.role} />
                  <Row
                    label={t('inspector.tokens')}
                    value={formatNumber(message.tokens ?? 0, language)}
                  />
                  <Row
                    label={t('inspector.latency')}
                    value={
                      message.latencyMs
                        ? `${formatNumber(message.latencyMs, language)} ms`
                        : '—'
                    }
                  />
                  <p className="mt-2 max-h-40 overflow-y-auto rounded-md bg-[var(--color-surface-2)] p-2 text-[11px] leading-relaxed text-[var(--color-ink-soft)]">
                    {message.content.slice(0, 400) || '—'}
                  </p>
                </>
              ) : (
                <p className="text-[11px] text-[var(--color-ink-soft)]">
                  {t('inspector.noSelection')}
                </p>
              )}
            </Section>

            <Section title={t('inspector.files')}>
              <ul className="flex flex-col gap-1">
                {['src/App.tsx', 'src/stores/chat.ts', 'vite.config.ts'].map(
                  (file) => (
                    <li
                      key={file}
                      dir="ltr"
                      className="flex items-center gap-1.5 rounded px-1 py-0.5 font-mono text-[11px] text-[var(--color-ink-soft)]"
                    >
                      <Icon name="files" size={11} />
                      {file}
                    </li>
                  ),
                )}
              </ul>
            </Section>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section className="border-b border-[var(--color-line)] py-3 last:border-b-0">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-soft)]">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}): React.ReactElement {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5 text-[11px]">
      <span className="shrink-0 text-[var(--color-ink-soft)]">{label}</span>
      <span
        className={cn('truncate text-end text-[var(--color-ink)]', mono && 'font-mono')}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}
