import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useRunStore } from '@/stores/run';
import type { ToolCall, ToolKind, ToolStatus } from '@/services/runtime';

const KIND_ICON: Record<ToolKind, IconName> = {
  thinking: 'sparkle',
  'read-file': 'files',
  search: 'search',
  'edit-file': 'files',
  'run-command': 'command',
  'run-tests': 'check',
};

const STATUS_STYLE: Record<ToolStatus, string> = {
  running: 'text-[var(--color-warn)]',
  completed: 'text-[var(--color-ok)]',
  failed: 'text-[var(--color-danger)]',
  cancelled: 'text-[var(--color-ink-soft)]',
};

function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return '';
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function TimelineCard({ call }: { call: ToolCall }): React.ReactElement {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const detail = call.error ?? call.output ?? call.input;
  const statusLabel = t(`agent.toolStatus.${call.status}`);

  return (
    <li
      data-testid={`tool-card-${call.id}`}
      data-status={call.status}
      className={cn(
        'rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)]',
        'px-2.5 py-2 text-xs',
      )}
    >
      <div className="flex items-center gap-2">
        <Icon
          name={KIND_ICON[call.kind]}
          size={13}
          className={cn('shrink-0', STATUS_STYLE[call.status])}
        />
        <span className="min-w-0 flex-1 truncate font-medium text-[var(--color-ink)]">
          {call.title}
        </span>
        <span className={cn('shrink-0 text-[10px]', STATUS_STYLE[call.status])}>
          {statusLabel}
        </span>
        {call.durationMs !== undefined ? (
          <span className="shrink-0 text-[10px] text-[var(--color-ink-soft)]">
            {formatDuration(call.durationMs)}
          </span>
        ) : null}
        {detail ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={t(open ? 'agent.hideDetails' : 'agent.showDetails')}
            data-testid={`tool-toggle-${call.id}`}
            className="shrink-0 rounded p-0.5 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
          >
            <Icon name="chevron" size={12} className={open ? 'rotate-90' : ''} />
          </button>
        ) : null}
      </div>

      {open && detail ? (
        <pre
          data-testid={`tool-detail-${call.id}`}
          className={cn(
            'mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded',
            'bg-[var(--color-surface-2)] p-2 font-mono text-[10px]',
            'text-[var(--color-ink-soft)]',
          )}
        >
          {detail}
        </pre>
      ) : null}
    </li>
  );
}

/** Structured view of what the agent did during the run. */
export function ToolTimeline(): React.ReactElement | null {
  const { t } = useTranslation();
  const calls = useRunStore((s) => s.toolCalls);

  if (calls.length === 0) return null;

  return (
    <section data-testid="tool-timeline" aria-label={t('agent.timeline')}>
      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
        {t('agent.timeline')}
      </h3>
      <ul className="flex flex-col gap-1.5">
        {calls.map((call) => (
          <TimelineCard key={call.id} call={call} />
        ))}
      </ul>
    </section>
  );
}
