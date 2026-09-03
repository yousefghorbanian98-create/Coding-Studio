import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/Icon';
import { useRunStore } from '@/stores/run';
import type { PlanStepStatus } from '@/services/runtime';

const STEP_STYLE: Record<PlanStepStatus, string> = {
  pending: 'border-[var(--color-line)] text-[var(--color-ink-soft)]',
  running: 'border-[var(--color-warn)] text-[var(--color-warn)]',
  blocked: 'border-[var(--color-warn)] text-[var(--color-warn)]',
  completed: 'border-[var(--color-ok)] text-[var(--color-ok)]',
  failed: 'border-[var(--color-danger)] text-[var(--color-danger)]',
  skipped: 'border-[var(--color-line)] text-[var(--color-ink-soft)]',
};

/** The plan proposed by the agent, with its per-step status. */
export function PlanCard(): React.ReactElement | null {
  const { t } = useTranslation();
  const plan = useRunStore((s) => s.plan);

  if (!plan) return null;

  return (
    <section
      data-testid="plan-card"
      data-status={plan.status}
      aria-label={t('agent.plan')}
      className={cn(
        'rounded-lg border border-[var(--color-line)]',
        'bg-[var(--color-surface)] p-3',
      )}
    >
      <header className="mb-2 flex items-center gap-2">
        <Icon name="check" size={13} className="text-[var(--color-brand)]" />
        <h3 className="flex-1 text-xs font-semibold text-[var(--color-ink)]">
          {plan.title}
        </h3>
        <span
          data-testid="plan-status"
          className="rounded-full border border-[var(--color-line)] px-2 py-0.5 text-[10px] text-[var(--color-ink-soft)]"
        >
          {t(`agent.planStatus.${plan.status}`)}
        </span>
      </header>

      <ol className="flex flex-col gap-1.5">
        {plan.steps.map((step, index) => (
          <li
            key={step.id}
            data-testid={`plan-step-${step.id}`}
            data-status={step.status}
            className="flex items-start gap-2 text-xs"
          >
            <span
              aria-hidden="true"
              className={cn(
                'mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[9px]',
                STEP_STYLE[step.status],
              )}
            >
              {index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-[var(--color-ink)]">
                {step.title}
              </span>
              <span className="block text-[11px] text-[var(--color-ink-soft)]">
                {step.detail}
              </span>
            </span>
            <span className="sr-only">{t(`agent.taskStatus.${step.status}`)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
