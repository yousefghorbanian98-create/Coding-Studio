import { useTranslation } from 'react-i18next';
import { Dialog } from '@base-ui-components/react/dialog';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/Icon';
import { Kbd } from '@/components/ui/Kbd';
import { SHORTCUTS } from '@/hooks/useKeyboardShortcuts';
import { useUiStore } from '@/stores/ui';

export function ShortcutsDialog(): React.ReactElement {
  const { t } = useTranslation();
  const open = useUiStore((s) => s.shortcutsOpen);
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen);

  return (
    <Dialog.Root open={open} onOpenChange={setShortcutsOpen}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" />
        <Dialog.Popup
          data-testid="shortcuts-dialog"
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[min(92vw,420px)]',
            '-translate-x-1/2 -translate-y-1/2 rounded-xl border',
            'border-[var(--color-line)] bg-[var(--color-surface)] p-4 shadow-2xl',
          )}
        >
          <div className="mb-3 flex items-center gap-2">
            <Dialog.Title className="text-sm font-semibold">
              {t('shortcuts.title')}
            </Dialog.Title>
            <Dialog.Close
              aria-label={t('common.close')}
              className="ms-auto rounded p-1 text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-2)]"
            >
              <Icon name="close" size={14} />
            </Dialog.Close>
          </div>

          <ul className="flex flex-col">
            {SHORTCUTS.map((shortcut) => (
              <li
                key={shortcut.id}
                className="flex items-center justify-between gap-3 border-b border-[var(--color-line)] py-2 text-xs last:border-b-0"
              >
                <span className="text-[var(--color-ink-soft)]">
                  {t(shortcut.labelKey)}
                </span>
                <Kbd keys={shortcut.keys} />
              </li>
            ))}
          </ul>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
