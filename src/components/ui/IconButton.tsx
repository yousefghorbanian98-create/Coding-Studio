import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Tooltip } from '@base-ui-components/react/tooltip';
import { cn } from '@/lib/cn';

export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  tone?: 'default' | 'danger';
  showTooltip?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { label, active, tone = 'default', showTooltip = true, className, children, ...rest },
    ref,
  ) {
    const button = (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        title={showTooltip ? undefined : label}
        data-active={active ? '' : undefined}
        className={cn(
          'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
          'text-[var(--color-ink-soft)] transition-colors duration-150',
          'hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]',
          'data-[active]:bg-[var(--color-brand-soft)] data-[active]:text-[var(--color-brand)]',
          'disabled:pointer-events-none disabled:opacity-40',
          tone === 'danger' && 'hover:text-[var(--color-danger)]',
          className,
        )}
        {...rest}
      >
        {children}
      </button>
    );

    if (!showTooltip) return button;

    return (
      <Tooltip.Root>
        <Tooltip.Trigger render={button} />
        <Tooltip.Portal>
          <Tooltip.Positioner sideOffset={6}>
            <Tooltip.Popup
              className={cn(
                'z-50 rounded-md border border-[var(--color-line)]',
                'bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-ink)] shadow-lg',
              )}
            >
              {label}
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    );
  },
);
