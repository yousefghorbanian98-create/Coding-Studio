import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useChatStore } from '@/stores/chat';
import type { ChatSession } from '@/types/chat';

interface Action {
  id: string;
  label: string;
  icon: IconName;
  danger?: boolean;
  run: () => void;
}

export interface SessionRowActionsProps {
  session: ChatSession;
  onRename: () => void;
  onDelete: () => void;
}

/**
 * Per-session overflow menu.
 *
 * A plain popup is used rather than a menu library: the action list is short
 * and this keeps the dependency footprint flat.
 */
export function SessionRowActions({
  session,
  onRename,
  onDelete,
}: SessionRowActionsProps): React.ReactElement {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const togglePinned = useChatStore((s) => s.togglePinned);
  const setArchived = useChatStore((s) => s.setArchived);
  const duplicateSession = useChatStore((s) => s.duplicateSession);

  useEffect(() => {
    if (!open) return;
    const onDocument = (event: MouseEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocument);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocument);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const archived = session.archived === true;
  const actions: Action[] = [
    {
      id: 'rename',
      label: t('common.rename'),
      icon: 'chat',
      run: onRename,
    },
    {
      id: 'pin',
      label: session.pinned === true ? t('sessions.unpin') : t('sessions.pin'),
      icon: 'sparkle',
      run: () => togglePinned(session.id),
    },
    {
      id: 'duplicate',
      label: t('sessions.duplicate'),
      icon: 'copy',
      run: () => void duplicateSession(session.id),
    },
    {
      id: 'archive',
      label: archived ? t('sessions.restore') : t('sessions.archive'),
      icon: 'sessions',
      run: () => setArchived(session.id, !archived),
    },
    {
      id: 'delete',
      label: t('common.delete'),
      icon: 'trash',
      danger: true,
      run: onDelete,
    },
  ];

  // A pinned session cannot also be archived, so hide the pin entry there.
  const visible = archived
    ? actions.filter((action) => action.id !== 'pin')
    : actions;

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('sessions.actionsFor', { title: session.title })}
        data-testid={`session-actions-${session.id}`}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'rounded p-1 text-[var(--color-ink-soft)] transition',
          'hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]',
          !open && 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
        )}
      >
        <Icon name="sessions" size={13} />
      </button>

      {open ? (
        <div
          role="menu"
          data-testid={`session-menu-${session.id}`}
          className={cn(
            'absolute end-0 top-full z-30 mt-1 w-44 rounded-md border',
            'border-[var(--color-line)] bg-[var(--color-surface)] p-1 shadow-xl',
          )}
        >
          {visible.map((action) => (
            <button
              key={action.id}
              type="button"
              role="menuitem"
              data-testid={`session-action-${action.id}-${session.id}`}
              onClick={() => {
                setOpen(false);
                action.run();
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-xs',
                'hover:bg-[var(--color-surface-2)]',
                action.danger === true
                  ? 'text-[var(--color-danger)]'
                  : 'text-[var(--color-ink)]',
              )}
            >
              <Icon name={action.icon} size={12} className="shrink-0" />
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
