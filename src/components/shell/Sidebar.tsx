import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { SessionList } from '@/components/sessions/SessionList';
import { Explorer } from '@/components/workspace/Explorer';
import { SearchPanel } from '@/components/workspace/SearchPanel';
import { DiffViewer } from '@/components/workspace/DiffViewer';
import { usePreferences } from '@/stores/preferences';
import { useChatStore } from '@/stores/chat';
import { useUiStore } from '@/stores/ui';
import { ResizeHandle } from './ResizeHandle';

export function Sidebar(): React.ReactElement | null {
  const { t } = useTranslation();
  const collapsed = usePreferences((s) => s.sidebarCollapsed);
  const width = usePreferences((s) => s.sidebarWidth);
  const activeRailItem = usePreferences((s) => s.activeRailItem);
  const filter = useChatStore((s) => s.filter);
  const setFilter = useChatStore((s) => s.setFilter);
  const createSession = useChatStore((s) => s.createSession);
  const requestComposerFocus = useUiStore((s) => s.requestComposerFocus);

  const title = useMemo(() => {
    switch (activeRailItem) {
      case 'files':
        return t('rail.files');
      case 'search':
        return t('rail.search');
      case 'changes':
        return t('rail.changes');
      case 'extensions':
        return t('rail.extensions');
      default:
        return t('sidebar.sessions');
    }
  }, [activeRailItem, t]);

  if (collapsed) return null;

  // The files, search and changes views own their whole surface, so the
  // session header and filter only make sense for the session-based views.
  const isWorkspaceView =
    activeRailItem === 'files' ||
    activeRailItem === 'search' ||
    activeRailItem === 'changes';

  return (
    <div className="flex shrink-0" data-testid="sidebar" style={{ width }}>
      <aside
        aria-label={title}
        className={cn(
          'flex min-w-0 flex-1 flex-col border-e border-[var(--color-line)]',
          'bg-[var(--color-surface)]',
        )}
      >
        {isWorkspaceView ? (
          <div className="flex min-h-0 flex-1 flex-col">
            {activeRailItem === 'files' ? <Explorer /> : null}
            {activeRailItem === 'search' ? <SearchPanel /> : null}
            {activeRailItem === 'changes' ? <DiffViewer /> : null}
          </div>
        ) : (
          <>
            <div className="flex h-10 items-center gap-1 px-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-soft)]">
                {title}
              </h2>
              <div className="ms-auto flex items-center">
                <IconButton
                  label={t('sidebar.newSession')}
                  data-testid="sidebar-new-session"
                  onClick={() => {
                    createSession();
                    requestComposerFocus();
                  }}
                >
                  <Icon name="plus" size={15} />
                </IconButton>
              </div>
            </div>

            <div className="px-3 pb-2">
              <label className="relative block">
                <span className="sr-only">{t('sidebar.search')}</span>
                <span className="pointer-events-none absolute inset-y-0 start-2 grid place-items-center text-[var(--color-ink-soft)]">
                  <Icon name="search" size={13} />
                </span>
                <input
                  type="search"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  placeholder={t('sidebar.search')}
                  data-testid="sidebar-search"
                  className={cn(
                    'h-8 w-full rounded-md border border-[var(--color-line)]',
                    'bg-[var(--color-surface-2)] ps-7 pe-2 text-xs text-[var(--color-ink)]',
                    'placeholder:text-[var(--color-ink-soft)]',
                    'focus:border-[var(--color-brand)] focus:outline-none',
                  )}
                />
              </label>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
              <SessionList />
            </div>
          </>
        )}
      </aside>
      <ResizeHandle />
    </div>
  );
}
