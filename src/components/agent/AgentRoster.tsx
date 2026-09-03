import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/Icon';
import { useRunStore, selectIsBusy } from '@/stores/run';
import { useUiStore } from '@/stores/ui';
import type { AgentState, AgentStatus } from '@/services/runtime';

const STATUS_STYLE: Record<AgentStatus, string> = {
  idle: 'text-[var(--color-ink-soft)]',
  working: 'text-[var(--color-warn)]',
  blocked: 'text-[var(--color-danger)]',
  done: 'text-[var(--color-ok)]',
  failed: 'text-[var(--color-danger)]',
};

/** Elapsed time for a working agent; final duration once it has stopped. */
function useDuration(agent: AgentState): string | null {
  const [now, setNow] = useState(() => Date.now());
  const running = agent.status === 'working' && agent.startedAt !== undefined;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  if (agent.startedAt === undefined) return null;
  const elapsed = Math.max(0, (running ? now : agent.startedAt) - agent.startedAt);
  const seconds = Math.floor(elapsed / 1000);
  if (seconds < 60) return `${String(seconds)}s`;
  return `${String(Math.floor(seconds / 60))}m ${String(seconds % 60)}s`;
}

function AgentRow({ agent }: { agent: AgentState }): React.ReactElement {
  const { t } = useTranslation();
  const statusLabel = t(`agent.agentStatus.${agent.status}`);
  const duration = useDuration(agent);
  const busy = useRunStore(selectIsBusy);
  const requestCancel = useRunStore((state) => state.requestCancel);
  const setPanelTab = useUiStore((state) => state.setPanelTab);

  return (
    <li
      data-testid={`agent-card-${agent.id}`}
      data-status={agent.status}
      className={cn(
        'flex items-start gap-2 rounded-md border border-[var(--color-line)]',
        'bg-[var(--color-surface-2)] px-2.5 py-2 text-xs',
      )}
    >
      <Icon
        name="sparkle"
        size={13}
        className={cn('mt-0.5 shrink-0', STATUS_STYLE[agent.status])}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span
            title={agent.name}
            className="truncate font-medium text-[var(--color-ink)]"
          >
            {agent.name}
          </span>
          {/* Status is text, never colour alone. */}
          <span
            className={cn('shrink-0 text-[10px]', STATUS_STYLE[agent.status])}
          >
            {statusLabel}
          </span>
        </div>
        <p
          title={agent.currentTask ?? agent.role}
          className="truncate text-[11px] text-[var(--color-ink-soft)]"
        >
          {agent.currentTask ?? agent.role}
        </p>
      </div>
      {duration !== null ? (
        <span
          data-testid={`agent-duration-${agent.id}`}
          className="shrink-0 tabular-nums text-[10px] text-[var(--color-ink-soft)]"
        >
          {duration}
        </span>
      ) : null}
      <span
        className="shrink-0 text-[10px] text-[var(--color-ink-soft)]"
        title={t('agent.completedTasks', { count: agent.completedTasks })}
      >
        {agent.completedTasks}
      </span>

      <button
        type="button"
        data-testid={`agent-inspect-${agent.id}`}
        onClick={() => setPanelTab('tasks')}
        aria-label={t('agent.inspect', { name: agent.name })}
        className="shrink-0 rounded p-1 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
      >
        <Icon name="search" size={11} />
      </button>
      <button
        type="button"
        data-testid={`agent-stop-${agent.id}`}
        onClick={() => void requestCancel()}
        // The mock has no per-agent cancellation, so stopping any agent stops
        // the run. Disabled once nothing is running, rather than lying.
        disabled={!busy}
        aria-label={t('agent.stop', { name: agent.name })}
        title={t('agent.stopHint')}
        className="shrink-0 rounded p-1 text-[var(--color-ink-soft)] hover:text-[var(--color-danger)] disabled:pointer-events-none disabled:opacity-30"
      >
        <Icon name="stop" size={11} />
      </button>
    </li>
  );
}

/**
 * Shows the mock multi-agent roster. Rendered only while a run has reported
 * agents, so single-agent scenarios keep the chat column uncluttered.
 */
export function AgentRoster(): React.ReactElement | null {
  const { t } = useTranslation();
  const agents = useRunStore((state) => state.agents);

  if (agents.length === 0) return null;

  return (
    <section
      data-testid="agent-roster"
      aria-label={t('agent.agents')}
      className={cn(
        'rounded-lg border border-[var(--color-line)]',
        'bg-[var(--color-surface)] p-3',
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <Icon name="sparkle" size={13} className="text-[var(--color-brand)]" />
        <h3 className="flex-1 text-xs font-semibold text-[var(--color-ink)]">
          {t('agent.agents')}
        </h3>
        <span className="text-[10px] text-[var(--color-ink-soft)]">
          {agents.length}
        </span>
      </div>

      <ul className="flex flex-col gap-1.5">
        {agents.map((agent) => (
          <AgentRow key={agent.id} agent={agent} />
        ))}
      </ul>
    </section>
  );
}
