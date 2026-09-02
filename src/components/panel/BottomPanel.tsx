import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { useUiStore, type PanelTab } from '@/stores/ui';
import { getDiagnostics } from '@/services/runtime';
import {
  FIXTURE_OUTPUT,
  FIXTURE_PROBLEMS,
  FIXTURE_TERMINAL,
  OUTPUT_CHANNELS,
  respondToCommand,
  type OutputLevel,
  type ProblemSeverity,
  type TerminalEntry,
} from '@/services/runtime/workspace';

const TABS: PanelTab[] = ['terminal', 'problems', 'output', 'logs'];

const SEVERITY_ICON: Record<ProblemSeverity, { name: 'alert' | 'dot'; className: string }> = {
  error: { name: 'alert', className: 'text-[var(--color-danger)]' },
  warning: { name: 'alert', className: 'text-[var(--color-warn)]' },
  info: { name: 'dot', className: 'text-[var(--color-ink-soft)]' },
};

const LEVEL_CLASS: Record<OutputLevel, string> = {
  debug: 'text-[var(--color-ink-soft)]',
  info: 'text-[var(--color-ink)]',
  warn: 'text-[var(--color-warn)]',
  error: 'text-[var(--color-danger)]',
};

function formatOffset(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const millis = ms % 1000;
  return `${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

function TerminalTab(): React.ReactElement {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<TerminalEntry[]>([...FIXTURE_TERMINAL]);
  const [command, setCommand] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  // Pin the scroll to the newest entry. scrollTop is used instead of
  // scrollIntoView so the page around the panel never jumps.
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [entries.length]);

  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    const trimmed = command.trim();
    if (trimmed.length === 0) return;
    const result = respondToCommand(trimmed);
    setEntries((current) => [
      ...current,
      {
        id: `term-${current.length + 1}-${trimmed.length}`,
        command: trimmed,
        output: result.output,
        status: result.status,
        exitCode: result.exitCode,
      },
    ]);
    setCommand('');
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="panel-terminal">
      <div
        ref={logRef}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-2 font-mono text-[11px]"
      >
        {entries.map((entry) => (
          <div key={entry.id} className="mb-2" data-testid={`terminal-entry-${entry.id}`}>
            <p dir="ltr" className="text-[var(--color-brand)]">
              <span aria-hidden="true">$ </span>
              {entry.command}
            </p>
            <pre
              dir="ltr"
              className={cn(
                'whitespace-pre-wrap break-all',
                entry.status === 'failure'
                  ? 'text-[var(--color-danger)]'
                  : 'text-[var(--color-ink-soft)]',
              )}
            >
              {entry.output}
            </pre>
          </div>
        ))}
      </div>
      <form
        onSubmit={submit}
        className="flex items-center gap-2 border-t border-[var(--color-line)] px-3 py-1.5"
      >
        <span aria-hidden="true" className="font-mono text-[11px] text-[var(--color-brand)]">
          $
        </span>
        <label className="sr-only" htmlFor="terminal-input">
          {t('panel.terminalInput')}
        </label>
        <input
          id="terminal-input"
          dir="ltr"
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          data-testid="terminal-input"
          placeholder={t('panel.terminalHint')}
          className={cn(
            'flex-1 bg-transparent font-mono text-[11px] text-[var(--color-ink)]',
            'outline-none placeholder:text-[var(--color-ink-soft)]',
          )}
        />
      </form>
    </div>
  );
}

function ProblemsTab(): React.ReactElement {
  const { t } = useTranslation();
  return (
    <ul
      className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5"
      data-testid="panel-problems"
    >
      {FIXTURE_PROBLEMS.map((problem) => {
        const icon = SEVERITY_ICON[problem.severity];
        return (
          <li
            key={problem.id}
            data-testid={`problem-${problem.id}`}
            className="flex items-start gap-2 rounded px-1.5 py-1 text-[11px] hover:bg-[var(--color-surface-2)]"
          >
            <Icon
              name={icon.name}
              size={12}
              className={cn('mt-0.5 shrink-0', icon.className)}
              aria-label={t(`panel.severity.${problem.severity}`)}
            />
            <span className="min-w-0 flex-1 text-[var(--color-ink)]">
              {problem.message}
            </span>
            <span dir="ltr" className="shrink-0 text-[10px] text-[var(--color-ink-soft)]">
              {problem.path}:{problem.line}:{problem.column} · {problem.source}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function OutputTab(): React.ReactElement {
  const [channel, setChannel] = useState<string>(OUTPUT_CHANNELS[0]);
  const lines = FIXTURE_OUTPUT.filter((line) => line.channel === channel);
  const { t } = useTranslation();

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="panel-output">
      <div className="flex items-center gap-2 px-3 py-1.5">
        <label className="sr-only" htmlFor="output-channel">
          {t('panel.channel')}
        </label>
        <select
          id="output-channel"
          value={channel}
          onChange={(event) => setChannel(event.target.value)}
          data-testid="output-channel"
          className={cn(
            'rounded border border-[var(--color-line)] bg-[var(--color-surface-2)]',
            'px-1.5 py-0.5 text-[11px] text-[var(--color-ink)] outline-none',
          )}
        >
          {OUTPUT_CHANNELS.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto px-3 pb-2 font-mono text-[11px]">
        {lines.map((line) => (
          <li key={line.id} data-testid={`output-${line.id}`} className="flex gap-2">
            <span className="shrink-0 tabular-nums text-[var(--color-ink-soft)]">
              {formatOffset(line.offsetMs)}
            </span>
            <span dir="ltr" className={cn('min-w-0 flex-1', LEVEL_CLASS[line.level])}>
              {line.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LogsTab(): React.ReactElement {
  const { t } = useTranslation();
  const diagnostics = getDiagnostics();

  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto px-3 py-2 text-[11px]"
      data-testid="panel-logs"
    >
      <p className="mb-2 text-[var(--color-ink-soft)]">{t('panel.logsHint')}</p>
      {diagnostics.length === 0 ? (
        <p data-testid="logs-empty" className="text-[var(--color-ink-soft)]">
          {t('panel.logsEmpty')}
        </p>
      ) : (
        <ul className="font-mono">
          {diagnostics.map((entry, index) => (
            <li key={`${entry.at}-${index}`} className="flex gap-2">
              <span className="shrink-0 text-[var(--color-danger)]">
                {entry.eventType ?? 'unknown'}
              </span>
              <span dir="ltr" className="min-w-0 flex-1 text-[var(--color-ink-soft)]">
                {entry.reason}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function BottomPanel(): React.ReactElement | null {
  const { t } = useTranslation();
  const open = useUiStore((s) => s.panelOpen);
  const tab = useUiStore((s) => s.panelTab);
  const setTab = useUiStore((s) => s.setPanelTab);
  const setOpen = useUiStore((s) => s.setPanelOpen);

  if (!open) return null;

  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const index = TABS.indexOf(tab);
    const next = TABS[(index + delta + TABS.length) % TABS.length];
    if (next) {
      setTab(next);
      document.querySelector<HTMLElement>(`[data-testid="panel-tab-${next}"]`)?.focus();
    }
  };

  return (
    <section
      data-testid="bottom-panel"
      aria-label={t('panel.title')}
      className={cn(
        'flex h-56 shrink-0 flex-col border-t border-[var(--color-line)]',
        'bg-[var(--color-surface)]',
      )}
    >
      <div className="flex items-center gap-1 border-b border-[var(--color-line)] px-2">
        <div role="tablist" aria-label={t('panel.title')} className="flex flex-1">
          {TABS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`panel-tab-${id}`}
              data-testid={`panel-tab-${id}`}
              aria-selected={tab === id}
              aria-controls="panel-tabpanel"
              tabIndex={tab === id ? 0 : -1}
              onClick={() => setTab(id)}
              onKeyDown={onKeyDown}
              className={cn(
                'border-b-2 px-2.5 py-1.5 text-[11px] transition-colors',
                tab === id
                  ? 'border-[var(--color-brand)] text-[var(--color-ink)]'
                  : 'border-transparent text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]',
              )}
            >
              {t(`panel.tabs.${id}`)}
            </button>
          ))}
        </div>
        <IconButton
          label={t('panel.close')}
          data-testid="panel-close"
          onClick={() => setOpen(false)}
        >
          <Icon name="close" size={13} />
        </IconButton>
      </div>

      <div
        id="panel-tabpanel"
        role="tabpanel"
        aria-labelledby={`panel-tab-${tab}`}
        className="flex min-h-0 flex-1 flex-col"
      >
        {tab === 'terminal' ? <TerminalTab /> : null}
        {tab === 'problems' ? <ProblemsTab /> : null}
        {tab === 'output' ? <OutputTab /> : null}
        {tab === 'logs' ? <LogsTab /> : null}
      </div>
    </section>
  );
}
