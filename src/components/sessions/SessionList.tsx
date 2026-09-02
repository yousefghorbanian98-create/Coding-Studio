import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/Icon';
import { formatRelativeTime } from '@/lib/format';
import { filterSessions, useChatStore } from '@/stores/chat';
import { usePreferences } from '@/stores/preferences';

export function SessionList(): React.ReactElement {
  const { t } = useTranslation();
  const language = usePreferences((s) => s.language);
  const sessions = useChatStore((s) => s.sessions);
  const filter = useChatStore((s) => s.filter);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const selectSession = useChatStore((s) => s.selectSession);
  const deleteSession = useChatStore((s) => s.deleteSession);

  const visible = filterSessions(sessions, filter);

  if (visible.length === 0) {
    return (
      <p className="px-2 py-6 text-center text-xs text-[var(--color-ink-soft)]">
        {t('sidebar.empty')}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-0.5" data-testid="session-list">
      <AnimatePresence initial={false}>
        {visible.map((session) => {
          const active = session.id === activeSessionId;
          return (
            <motion.li
              key={session.id}
              layout
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.16 }}
            >
              <div
                className={cn(
                  'group flex items-center gap-2 rounded-md px-2 py-1.5',
                  'transition-colors',
                  active
                    ? 'bg-[var(--color-brand-soft)] text-[var(--color-ink)]'
                    : 'hover:bg-[var(--color-surface-2)]',
                )}
              >
                <button
                  type="button"
                  onClick={() => selectSession(session.id)}
                  aria-current={active ? 'true' : undefined}
                  data-testid={`session-item-${session.id}`}
                  className="min-w-0 flex-1 text-start"
                >
                  <span className="flex items-center gap-1.5">
                    {session.pinned ? (
                      <Icon
                        name="sparkle"
                        size={11}
                        className="shrink-0 text-[var(--color-brand)]"
                      />
                    ) : null}
                    <span className="truncate text-xs font-medium">
                      {session.title}
                    </span>
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[var(--color-ink-soft)]">
                    <span>
                      {t('sidebar.messages', { count: session.messages.length })}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{formatRelativeTime(session.updatedAt, language)}</span>
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`${t('common.delete')}: ${session.title}`}
                  onClick={() => deleteSession(session.id)}
                  className={cn(
                    'shrink-0 rounded p-1 text-[var(--color-ink-soft)] opacity-0',
                    'transition hover:text-[var(--color-danger)]',
                    'group-hover:opacity-100 focus-visible:opacity-100',
                  )}
                >
                  <Icon name="trash" size={13} />
                </button>
              </div>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
