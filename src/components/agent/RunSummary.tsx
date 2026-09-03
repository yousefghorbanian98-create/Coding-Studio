import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/Icon';
import { useRunStore } from '@/stores/run';

/**
 * Closing line for a finished run.
 *
 * The runtime sends `run.completed.summary` for the outcomes worth narrating
 * (plan rejected, operation declined, tests passed, task summary). Without
 * this the text was parsed, stored and then dropped before reaching the user.
 */
export function RunSummary(): React.ReactElement | null {
  const { t } = useTranslation();
  const summary = useRunStore((s) => s.summary);
  const phase = useRunStore((s) => s.phase);

  // Only meaningful once the run has actually finished.
  if (phase !== 'completed' || summary === null || summary === '') return null;

  return (
    <section
      data-testid="run-summary"
      aria-label={t('agent.summary')}
      className={cn(
        'flex items-start gap-2 rounded-lg border border-[var(--color-line)]',
        'bg-[var(--color-surface)] px-2.5 py-2 text-xs text-[var(--color-ink)]',
      )}
    >
      <Icon
        name="check"
        size={13}
        className="mt-0.5 shrink-0 text-[var(--color-ok)]"
      />
      <p className="min-w-0 flex-1">{summary}</p>
    </section>
  );
}
