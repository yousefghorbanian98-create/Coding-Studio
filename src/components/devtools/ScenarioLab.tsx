import { useState } from 'react';
import { cn } from '@/lib/cn';
import { SCENARIOS, type ScenarioDescriptor, type ScenarioId } from '@/services/runtime';
import { applyScenario } from './useScenario';

/**
 * Development-only scenario switcher.
 *
 * Excluded from production builds: `import.meta.env.DEV` is statically false in
 * a production bundle, so this component and its imports are tree-shaken away.
 * Playwright drives it through `?scenario=…` rather than the UI.
 */

const GROUP_ORDER = [
  'baseline',
  'plans',
  'approvals',
  'tools',
  'errors',
  'agents',
] as const;

export function ScenarioLab(): React.ReactElement | null {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<ScenarioId | null>(null);

  if (!import.meta.env.DEV) return null;

  const grouped = GROUP_ORDER.map((group) => ({
    group,
    items: SCENARIOS.filter((s) => s.group === group),
  })).filter((entry) => entry.items.length > 0);

  const select = (scenario: ScenarioDescriptor): void => {
    setCurrent(scenario.id);
    applyScenario(scenario.id);
  };

  return (
    <div className="pointer-events-none fixed bottom-8 end-3 z-[60] flex flex-col items-end gap-2">
      {open ? (
        <div
          data-testid="scenario-lab"
          className={cn(
            'pointer-events-auto max-h-[70vh] w-72 overflow-y-auto rounded-lg border',
            'border-[var(--color-line)] bg-[var(--color-surface)] p-2 shadow-2xl',
          )}
        >
          {grouped.map(({ group, items }) => (
            <section key={group} className="mb-2">
              <h4 className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
                {group}
              </h4>
              <ul className="flex flex-col">
                {items.map((scenario) => (
                  <li key={scenario.id}>
                    <button
                      type="button"
                      onClick={() => select(scenario)}
                      data-testid={`scenario-${scenario.id}`}
                      title={scenario.description}
                      className={cn(
                        'w-full rounded px-2 py-1 text-start text-[11px]',
                        'hover:bg-[var(--color-surface-2)]',
                        current === scenario.id
                          ? 'text-[var(--color-brand)]'
                          : 'text-[var(--color-ink)]',
                      )}
                    >
                      {scenario.label}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        data-testid="scenario-lab-toggle"
        aria-expanded={open}
        className={cn(
          'pointer-events-auto rounded-full border border-[var(--color-line)]',
          'bg-[var(--color-surface)] px-3 py-1 text-[11px] shadow-lg',
          'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]',
        )}
      >
        Scenarios
      </button>
    </div>
  );
}
