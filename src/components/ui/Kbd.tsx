import { cn } from '@/lib/cn';
import { renderKey } from '@/lib/platform';

export function Kbd({ keys }: { keys: string[] }): React.ReactElement {
  return (
    <span className="inline-flex items-center gap-1" dir="ltr">
      {keys.map((key) => (
        <kbd
          key={key}
          className={cn(
            'rounded border border-[var(--color-line)] bg-[var(--color-surface-2)]',
            'px-1.5 py-0.5 font-mono text-[10px] leading-none text-[var(--color-ink-soft)]',
          )}
        >
          {renderKey(key)}
        </kbd>
      ))}
    </span>
  );
}
