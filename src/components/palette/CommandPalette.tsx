import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@base-ui-components/react/dialog';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/Icon';
import { Kbd } from '@/components/ui/Kbd';
import { useUiStore } from '@/stores/ui';
import { createCommands, filterCommands, type Command } from './commands';

export function CommandPalette(): React.ReactElement {
  const { t } = useTranslation();
  const open = useUiStore((s) => s.paletteOpen);
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // Rebuilt whenever the palette opens so state-dependent commands (such as
  // cancelling a run) reflect the situation at that moment.
  const commands = useMemo(() => (open ? createCommands() : []), [open]);
  const results = useMemo(
    () => filterCommands(commands, query, t),
    [commands, query, t],
  );

  // Remember what had focus so closing the palette puts the caret back where
  // the user left it rather than dumping focus on the document body.
  useEffect(() => {
    if (open) {
      returnFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      return;
    }
    setQuery('');
    setActiveIndex(0);
    const target = returnFocusRef.current;
    returnFocusRef.current = null;
    if (target?.isConnected === true) target.focus();
  }, [open]);

  // Never leave the highlight parked on a command that cannot be run.
  useEffect(() => {
    const first = results.findIndex(
      (command) => command.disabledReasonKey === undefined,
    );
    setActiveIndex(first === -1 ? 0 : first);
  }, [results]);

  const runCommand = (command: Command): void => {
    if (command.disabledReasonKey !== undefined) return;
    setPaletteOpen(false);
    command.run();
  };

  /** Finds the next runnable command, skipping disabled entries. */
  const step = (from: number, delta: number): number => {
    if (results.length === 0) return 0;
    let index = from;
    for (let hops = 0; hops < results.length; hops += 1) {
      index = (index + delta + results.length) % results.length;
      if (results[index]?.disabledReasonKey === undefined) return index;
    }
    return from;
  };

  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => step(index, 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => step(index, -1));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(step(-1, 1));
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(step(0, -1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const command = results[activeIndex];
      if (command) runCommand(command);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setPaletteOpen}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" />
        <Dialog.Popup
          data-testid="command-palette"
          aria-label={t('palette.title')}
          className={cn(
            'fixed left-1/2 top-24 z-50 w-[min(92vw,560px)] -translate-x-1/2',
            'overflow-hidden rounded-xl border border-[var(--color-line)]',
            'bg-[var(--color-surface)] shadow-2xl',
          )}
          onKeyDown={onKeyDown}
        >
          <div className="flex items-center gap-2 border-b border-[var(--color-line)] px-3">
            <Icon name="command" size={15} className="text-[var(--color-ink-soft)]" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('palette.placeholder')}
              data-testid="palette-input"
              aria-label={t('palette.placeholder')}
              className="h-11 w-full bg-transparent text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-soft)] focus:outline-none"
            />
            <Kbd keys={['Esc']} />
          </div>

          <div ref={listRef} className="max-h-80 overflow-y-auto p-1.5">
            {results.length === 0 ? (
              <p className="px-3 py-8 text-center text-xs text-[var(--color-ink-soft)]">
                {t('palette.empty')}
              </p>
            ) : (
              <ul role="listbox" aria-label={t('palette.title')}>
                {results.map((command, index) => (
                  <li key={command.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={index === activeIndex}
                      aria-disabled={command.disabledReasonKey !== undefined}
                      data-testid={`palette-item-${command.id}`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => runCommand(command)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-start text-xs',
                        index === activeIndex
                          ? 'bg-[var(--color-brand-soft)] text-[var(--color-ink)]'
                          : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-2)]',
                        command.disabledReasonKey !== undefined &&
                          'cursor-not-allowed opacity-55',
                      )}
                    >
                      <Icon name={command.icon} size={14} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">
                          {t(command.labelKey)}
                        </span>
                        {command.disabledReasonKey === undefined ? null : (
                          <span
                            data-testid={`palette-disabled-${command.id}`}
                            className="block truncate text-[10px] text-[var(--color-warn)]"
                          >
                            {t(command.disabledReasonKey)}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-[10px] uppercase tracking-wide text-[var(--color-ink-soft)]">
                        {t(`palette.groups.${command.group}`)}
                      </span>
                      {command.keys ? <Kbd keys={command.keys} /> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
