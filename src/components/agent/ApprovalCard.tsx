import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/Icon';
import { selectPendingApproval, useRunStore } from '@/stores/run';
import type { ApprovalRisk } from '@/services/runtime';

const RISK_STYLE: Record<ApprovalRisk, string> = {
  low: 'border-[var(--color-line)] bg-[var(--color-surface)]',
  medium: 'border-[var(--color-warn)]/50 bg-[var(--color-warn)]/10',
  high: 'border-[var(--color-danger)]/50 bg-[var(--color-danger)]/10',
};

/**
 * Consent gate for a privileged operation.
 *
 * Rejection is the default focus so that pressing Enter or Escape can never
 * grant permission by accident.
 */
export function ApprovalCard(): React.ReactElement | null {
  const { t } = useTranslation();
  const approval = useRunStore(selectPendingApproval);
  const resolveApproval = useRunStore((s) => s.resolveApproval);
  const [command, setCommand] = useState('');
  const [busy, setBusy] = useState(false);
  const rejectRef = useRef<HTMLButtonElement>(null);

  const approvalId = approval?.id ?? null;

  useEffect(() => {
    if (!approvalId) return;
    setCommand(approval?.command ?? '');
    setBusy(false);
    // The safest action receives focus when a new request appears.
    rejectRef.current?.focus();
  }, [approvalId, approval?.command]);

  if (!approval) return null;

  const isShell = approval.kind === 'shell-command';
  const edited = isShell && command !== approval.command;

  const decide = (
    decision: 'approve-once' | 'approve-session' | 'reject',
  ): void => {
    if (busy) return;
    setBusy(true);
    void resolveApproval(approval.id, {
      decision,
      ...(edited ? { editedCommand: command } : {}),
    }).catch(() => {
      // A stale approval was already resolved elsewhere; the store clears it.
      setBusy(false);
    });
  };

  return (
    <section
      role="group"
      aria-labelledby="approval-title"
      data-testid="approval-card"
      data-risk={approval.risk}
      data-kind={approval.kind}
      onKeyDown={(event) => {
        // Escape declines rather than dismissing silently.
        if (event.key === 'Escape') {
          event.stopPropagation();
          decide('reject');
        }
      }}
      className={cn('rounded-lg border p-3', RISK_STYLE[approval.risk])}
    >
      <header className="mb-1.5 flex items-center gap-2">
        <Icon
          name="alert"
          size={14}
          className={
            approval.risk === 'high'
              ? 'text-[var(--color-danger)]'
              : 'text-[var(--color-warn)]'
          }
        />
        <h3
          id="approval-title"
          className="flex-1 text-xs font-semibold text-[var(--color-ink)]"
        >
          {approval.title}
        </h3>
        <span
          data-testid="approval-risk"
          className="rounded-full border border-current px-2 py-0.5 text-[10px]"
        >
          {t(`approvals.risk.${approval.risk}`)}
        </span>
      </header>

      <p className="text-[11px] text-[var(--color-ink-soft)]">{approval.detail}</p>

      {isShell ? (
        <label className="mt-2 block">
          <span className="mb-1 block text-[10px] text-[var(--color-ink-soft)]">
            {t('approvals.command')}
          </span>
          <input
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            data-testid="approval-command"
            spellCheck={false}
            dir="ltr"
            className={cn(
              'w-full rounded-md border border-[var(--color-line)]',
              'bg-[var(--color-surface-2)] px-2 py-1.5 font-mono text-[11px]',
              'text-[var(--color-ink)] outline-none',
              'focus-visible:border-[var(--color-brand)]',
            )}
          />
        </label>
      ) : approval.command ? (
        <pre className="mt-2 overflow-x-auto rounded bg-[var(--color-surface-2)] p-2 font-mono text-[10px]">
          {approval.command}
        </pre>
      ) : null}

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          ref={rejectRef}
          type="button"
          disabled={busy}
          onClick={() => decide('reject')}
          data-testid="approval-reject"
          className={cn(
            'rounded-md border border-[var(--color-line)] px-2.5 py-1 text-[11px]',
            'font-medium text-[var(--color-ink)] transition-colors',
            'hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]',
            'disabled:opacity-50',
          )}
        >
          {t('approvals.reject')}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => decide('approve-once')}
          data-testid="approval-approve-once"
          className={cn(
            'rounded-md bg-[var(--color-brand)] px-2.5 py-1 text-[11px]',
            'font-medium text-white transition-opacity hover:opacity-90',
            'disabled:opacity-50',
          )}
        >
          {t('approvals.approveOnce')}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => decide('approve-session')}
          data-testid="approval-approve-session"
          className={cn(
            'rounded-md border border-[var(--color-line)] px-2.5 py-1 text-[11px]',
            'text-[var(--color-ink-soft)] transition-colors',
            'hover:border-[var(--color-brand)] hover:text-[var(--color-ink)]',
            'disabled:opacity-50',
          )}
        >
          {t('approvals.approveSession')}
        </button>
        {edited ? (
          <span
            data-testid="approval-edited"
            className="text-[10px] text-[var(--color-warn)]"
          >
            {t('approvals.edited')}
          </span>
        ) : null}
      </div>
    </section>
  );
}
