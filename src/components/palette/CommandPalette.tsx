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

  const commands = useMemo(() => createCommands(), []);
  const results = useMemo(
    () => filterCommands(commands, query, t),
    [commands, query, t],
  );

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const runCommand = (command: Command): void => {
    setPaletteOpen(false);
    command.run();
  };

  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % Math.max(results.length, 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(
        (index) => (index - 1 + results.length) % Math.max(results.length, 1),
      );
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
                      data-testid={`palette-item-${command.id}`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => runCommand(command)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-start text-xs',
                        index === activeIndex
                          ? 'bg-[var(--color-brand-soft)] text-[var(--color-ink)]'
                          : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-2)]',
                      )}
                    >
                      <Icon name={command.icon} size={14} />
                      <span className="flex-1 truncate">{t(command.labelKey)}</span>
                      <span className="text-[10px] uppercase tracking-wide text-[var(--color-ink-soft)]">
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
