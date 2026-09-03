import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { useRuntimeStore } from '@/stores/runtime';
import type { ChatMode } from '@/services/runtime';

const MODES: ChatMode[] = ['ask', 'plan', 'agent'];

/**
 * Switches how the runtime handles the next message.
 *
 * A radiogroup rather than a listbox: the three options are always visible, so
 * arrow-key selection is the expected keyboard behaviour.
 */
export function ModeSelector(): React.ReactElement {
  const { t } = useTranslation();
  const mode = useRuntimeStore((s) => s.mode);
  const setMode = useRuntimeStore((s) => s.setMode);

  return (
    <div
      role="radiogroup"
      aria-label={t('chat.mode')}
      data-testid="mode-selector"
      className={cn(
        'inline-flex h-8 items-center gap-0.5 rounded-md border p-0.5',
        'border-[var(--color-line)] bg-[var(--color-surface-2)]',
      )}
    >
      {MODES.map((value) => {
        const selected = value === mode;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => setMode(value)}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
              event.preventDefault();
              const step = event.key === 'ArrowRight' ? 1 : -1;
              const index = MODES.indexOf(mode);
              const next = MODES[(index + step + MODES.length) % MODES.length];
              if (next) setMode(next);
            }}
            data-testid={`mode-${value}`}
            className={cn(
              'rounded px-2 py-1 text-[11px] font-medium transition-colors',
              selected
                ? 'bg-[var(--color-brand)] text-white'
                : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]',
            )}
          >
            {t(`runtime.mode.${value}`)}
          </button>
        );
      })}
    </div>
  );
}
