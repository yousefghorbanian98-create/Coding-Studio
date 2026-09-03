import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Icon, type IconName } from '@/components/ui/Icon';
import { formatRelativeTime } from '@/lib/format';
import { useProjectsStore } from '@/stores/projects';
import { useChatStore } from '@/stores/chat';
import { useRuntimeStore } from '@/stores/runtime';
import type { RecentProject } from '@/services/runtime/fixtures';

const APP_VERSION = '0.1.0';

/**
 * Actions that need a real filesystem. The managed runtime does not exist yet,
 * so these are disabled and say why rather than pretending to work.
 */
const UNAVAILABLE_ACTIONS: { id: string; icon: IconName }[] = [
  { id: 'openFolder', icon: 'files' },
  { id: 'cloneRepo', icon: 'command' },
];

function ProjectRow({
  project,
  onKeyDown,
}: {
  project: RecentProject;
  onKeyDown: (event: React.KeyboardEvent) => void;
}): React.ReactElement {
  const { t, i18n } = useTranslation();
  const togglePin = useProjectsStore((state) => state.togglePin);
  const remove = useProjectsStore((state) => state.remove);
  const openable = project.state === 'available';

  return (
    <li
      data-testid={`project-${project.id}`}
      data-state={project.state}
      className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-[var(--color-surface-2)]"
    >
      <button
        type="button"
        role="option"
        aria-selected="false"
        // Opening needs a real filesystem, so it is inert everywhere; the
        // non-available states additionally explain themselves.
        aria-disabled="true"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        data-testid={`project-open-${project.id}`}
        title={project.path}
        className="flex min-w-0 flex-1 items-center gap-2 text-start"
      >
        <Icon
          name="files"
          size={14}
          className={cn(
            'shrink-0',
            openable
              ? 'text-[var(--color-brand)]'
              : 'text-[var(--color-ink-soft)]',
          )}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="truncate text-xs font-medium text-[var(--color-ink)]">
              {project.name}
            </span>
            <span className="shrink-0 text-[10px] text-[var(--color-ink-soft)]">
              {project.branch}
            </span>
          </span>
          <span className="block truncate text-[10px] text-[var(--color-ink-soft)]">
            {project.path}
          </span>
          {!openable ? (
            <span
              data-testid={`project-state-${project.id}`}
              className="block text-[10px] text-[var(--color-warn)]"
            >
              {t(`projects.state.${project.state}`)}
            </span>
          ) : null}
        </span>
        <span className="shrink-0 text-[10px] text-[var(--color-ink-soft)]">
          {formatRelativeTime(project.lastOpenedAt, i18n.language)}
        </span>
      </button>

      <button
        type="button"
        data-testid={`project-pin-${project.id}`}
        aria-pressed={project.pinned}
        aria-label={t(project.pinned ? 'projects.unpin' : 'projects.pin', {
          name: project.name,
        })}
        onClick={() => togglePin(project.id)}
        className={cn(
          'shrink-0 rounded p-1 transition',
          project.pinned
            ? 'text-[var(--color-brand)]'
            : 'text-[var(--color-ink-soft)] opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
        )}
      >
        <Icon name="sparkle" size={12} />
      </button>
      <button
        type="button"
        data-testid={`project-remove-${project.id}`}
        aria-label={t('projects.remove', { name: project.name })}
        onClick={() => remove(project.id)}
        className="shrink-0 rounded p-1 text-[var(--color-ink-soft)] opacity-0 transition hover:text-[var(--color-danger)] group-hover:opacity-100 focus-visible:opacity-100"
      >
        <Icon name="close" size={12} />
      </button>
    </li>
  );
}

/** The start page: recent workspaces, session recovery and runtime honesty. */
export function ProjectHome(): React.ReactElement {
  const { t } = useTranslation();
  const listRef = useRef<HTMLUListElement>(null);
  const projects = useProjectsStore((state) => state.projects);
  const createSession = useChatStore((state) => state.createSession);
  const sessions = useChatStore((state) => state.sessions);
  const selectSession = useChatStore((state) => state.selectSession);
  const health = useRuntimeStore((state) => state.health);

  const recoverable = sessions.find((session) => session.messages.length > 0);

  // Roving focus through the list, so it is one tab stop.
  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const items = [
      ...(listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ??
        []),
    ];
    const index = items.indexOf(event.currentTarget as HTMLElement);
    const delta = event.key === 'ArrowDown' ? 1 : -1;
    items[(index + delta + items.length) % items.length]?.focus();
  };

  return (
    <div
      data-testid="project-home"
      className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-8"
    >
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-[var(--color-ink)]">
          {t('projects.title')}
        </h1>
        <p className="text-xs text-[var(--color-ink-soft)]">
          {t('projects.subtitle')}
        </p>
      </header>

      {/* Never imply a provider is connected. */}
      <div
        data-testid="project-runtime-status"
        className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[11px]"
      >
        <span className="rounded-full bg-[var(--color-brand-soft)] px-2 py-0.5 text-[var(--color-brand)]">
          {t('projects.runtime.demo')}
        </span>
        <span className="text-[var(--color-ink-soft)]">
          {t('projects.runtime.mockProvider')}
        </span>
        <span className="text-[var(--color-ink-soft)]">
          {t(`runtime.status.${health?.status ?? 'idle'}`)}
        </span>
        <span className="ms-auto text-[var(--color-ink-soft)]">
          {t('projects.version', { version: APP_VERSION })}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="project-new-session"
          onClick={() => createSession()}
          className="rounded-md bg-[var(--color-brand)] px-3 py-1.5 text-xs font-medium text-white"
        >
          {t('projects.newSession')}
        </button>
        {recoverable ? (
          <button
            type="button"
            data-testid="project-recover-session"
            onClick={() => selectSession(recoverable.id)}
            className="rounded-md border border-[var(--color-line)] px-3 py-1.5 text-xs text-[var(--color-ink)]"
          >
            {t('projects.recover')}
          </button>
        ) : null}
        {UNAVAILABLE_ACTIONS.map((action) => (
          <button
            key={action.id}
            type="button"
            aria-disabled="true"
            data-testid={`project-${action.id}`}
            title={t('projects.needsRuntime')}
            className="flex cursor-not-allowed items-center gap-1.5 rounded-md border border-[var(--color-line)] px-3 py-1.5 text-xs text-[var(--color-ink-soft)]"
          >
            <Icon name={action.icon} size={12} />
            {t(`projects.${action.id}`)}
          </button>
        ))}
      </div>
      <p className="-mt-3 text-[10px] text-[var(--color-ink-soft)]">
        {t('projects.needsRuntime')}
      </p>

      <section className="flex flex-col gap-1">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
          {t('projects.recent')}
        </h2>
        {projects.length === 0 ? (
          <p
            data-testid="projects-empty"
            className="rounded-md border border-dashed border-[var(--color-line)] px-3 py-6 text-center text-[11px] text-[var(--color-ink-soft)]"
          >
            {t('projects.empty')}
          </p>
        ) : (
          <ul
            ref={listRef}
            role="listbox"
            aria-label={t('projects.recent')}
            className="flex flex-col"
          >
            {projects.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                onKeyDown={onKeyDown}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
