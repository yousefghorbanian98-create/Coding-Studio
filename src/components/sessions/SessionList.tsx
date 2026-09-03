import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/Icon';
import { formatRelativeTime } from '@/lib/format';
import { filterSessions, useChatStore } from '@/stores/chat';
import { usePreferences } from '@/stores/preferences';
import { SessionRowActions } from './SessionRowActions';

export function SessionList(): React.ReactElement {
  const { t } = useTranslation();
  const language = usePreferences((s) => s.language);
  const sessions = useChatStore((s) => s.sessions);
  const filter = useChatStore((s) => s.filter);
  const showArchived = useChatStore((s) => s.showArchived);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const selectSession = useChatStore((s) => s.selectSession);
  const deleteSession = useChatStore((s) => s.deleteSession);
  const renameSession = useChatStore((s) => s.renameSession);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const visible = filterSessions(sessions, filter, showArchived);

  const commitRename = (id: string): void => {
    const title = draftTitle.trim();
    if (title.length > 0) renameSession(id, title);
    setRenamingId(null);
  };

  if (visible.length === 0) {
    return (
      <p
        data-testid="session-list-empty"
        className="px-2 py-6 text-center text-xs text-[var(--color-ink-soft)]"
      >
        {showArchived ? t('sessions.noArchived') : t('sidebar.empty')}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-0.5" data-testid="session-list">
      <AnimatePresence initial={false}>
        {visible.map((session) => {
          const active = session.id === activeSessionId;
          const renaming = renamingId === session.id;
          const confirming = pendingDeleteId === session.id;

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
                {renaming ? (
                  <input
                    autoFocus
                    value={draftTitle}
                    aria-label={t('common.rename')}
                    data-testid={`session-rename-input-${session.id}`}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    onBlur={() => commitRename(session.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') commitRename(session.id);
                      if (event.key === 'Escape') setRenamingId(null);
                    }}
                    className={cn(
                      'min-w-0 flex-1 rounded border border-[var(--color-brand)]',
                      'bg-[var(--color-surface)] px-1.5 py-0.5 text-xs',
                      'text-[var(--color-ink)] outline-none',
                    )}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => selectSession(session.id)}
                    aria-current={active ? 'true' : undefined}
                    data-testid={`session-item-${session.id}`}
                    className="min-w-0 flex-1 text-start"
                  >
                    <span className="flex items-center gap-1.5">
                      {session.pinned === true ? (
                        <Icon
                          name="sparkle"
                          size={11}
                          aria-label={t('sessions.pinned')}
                          className="shrink-0 text-[var(--color-brand)]"
                        />
                      ) : null}
                      <span
                        title={session.title}
                        className="truncate text-xs font-medium"
                      >
                        {session.title}
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[var(--color-ink-soft)]">
                      <span>
                        {t('sidebar.messages', {
                          count: session.messages.length,
                        })}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {formatRelativeTime(session.updatedAt, language)}
                      </span>
                    </span>
                  </button>
                )}

                {renaming ? null : (
                  <SessionRowActions
                    session={session}
                    onRename={() => {
                      setDraftTitle(session.title);
                      setRenamingId(session.id);
                    }}
                    onDelete={() => setPendingDeleteId(session.id)}
                  />
                )}
              </div>

              {confirming ? (
                <div
                  role="alertdialog"
                  aria-label={t('sessions.confirmDelete', {
                    title: session.title,
                  })}
                  data-testid={`session-confirm-${session.id}`}
                  className={cn(
                    'mx-2 mb-1 mt-1 rounded-md border border-[var(--color-line)]',
                    'bg-[var(--color-surface-2)] p-2',
                  )}
                >
                  <p className="mb-2 text-[11px] text-[var(--color-ink-soft)]">
                    {t('sessions.confirmDelete', { title: session.title })}
                  </p>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      data-testid={`session-confirm-delete-${session.id}`}
                      onClick={() => {
                        deleteSession(session.id);
                        setPendingDeleteId(null);
                      }}
                      className="rounded bg-[var(--color-danger)] px-2 py-1 text-[11px] text-white"
                    >
                      {t('common.delete')}
                    </button>
                    <button
                      type="button"
                      data-testid={`session-confirm-cancel-${session.id}`}
                      onClick={() => setPendingDeleteId(null)}
                      className={cn(
                        'rounded border border-[var(--color-line)] px-2 py-1',
                        'text-[11px] text-[var(--color-ink)]',
                      )}
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                </div>
              ) : null}
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
