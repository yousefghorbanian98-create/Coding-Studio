import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Kbd } from '@/components/ui/Kbd';
import { useWindowControls } from '@/hooks/useWindowControls';
import { useUiStore } from '@/stores/ui';
import { usePreferences } from '@/stores/preferences';
import { useChatStore, selectActiveSession } from '@/stores/chat';

export function TitleBar(): React.ReactElement {
  const { t } = useTranslation();
  const controls = useWindowControls();
  const togglePalette = useUiStore((s) => s.togglePalette);
  const toggleTheme = usePreferences((s) => s.toggleTheme);
  const theme = usePreferences((s) => s.theme);
  const toggleLanguage = usePreferences((s) => s.toggleLanguage);
  const language = usePreferences((s) => s.language);
  const session = useChatStore(selectActiveSession);

  return (
    <header
      data-testid="title-bar"
      data-tauri-drag-region
      onPointerDown={(event) => {
        if (
          controls.available &&
          event.target instanceof HTMLElement &&
          event.target.hasAttribute('data-tauri-drag-region')
        ) {
          controls.startDragging();
        }
      }}
      onDoubleClick={(event) => {
        if (
          controls.available &&
          event.target instanceof HTMLElement &&
          event.target.hasAttribute('data-tauri-drag-region')
        ) {
          controls.toggleMaximize();
        }
      }}
      className={cn(
        'flex h-9 shrink-0 select-none items-center gap-2 border-b',
        'border-[var(--color-line)] bg-[var(--color-surface)] px-2',
      )}
    >
      <div className="flex items-center gap-2 ps-1" data-tauri-drag-region>
        <span
          className="grid h-5 w-5 place-items-center rounded bg-[var(--color-brand)] text-white"
          aria-hidden="true"
        >
          <Icon name="sparkle" size={13} />
        </span>
        <span className="text-xs font-semibold tracking-tight">
          {t('app.name')}
        </span>
      </div>

      <div
        className="flex flex-1 items-center justify-center"
        data-tauri-drag-region
      >
        <button
          type="button"
          onClick={togglePalette}
          data-testid="titlebar-palette-button"
          className={cn(
            'group flex h-6 min-w-56 max-w-md items-center gap-2 rounded-md border',
            'border-[var(--color-line)] bg-[var(--color-surface-2)] px-2',
            'text-[11px] text-[var(--color-ink-soft)] transition-colors',
            'hover:border-[var(--color-brand)] hover:text-[var(--color-ink)]',
          )}
        >
          <Icon name="search" size={12} />
          <span className="truncate">
            {session ? session.title : t('palette.open')}
          </span>
          <span className="ms-auto">
            <Kbd keys={['Mod', 'K']} />
          </span>
        </button>
      </div>

      <div className="flex items-center gap-0.5" data-tauri-drag-region>
        <IconButton
          label={t('commands.switchLanguage')}
          onClick={toggleLanguage}
          data-testid="titlebar-language"
        >
          <span className="text-[10px] font-bold uppercase">{language}</span>
        </IconButton>
        <IconButton
          label={t('commands.toggleTheme')}
          onClick={toggleTheme}
          data-testid="titlebar-theme"
        >
          <Icon name={theme === 'light' ? 'sun' : 'moon'} size={15} />
        </IconButton>

        {controls.available ? (
          <div className="ms-1 flex items-center">
            <WindowButton label={t('titlebar.minimize')} onClick={controls.minimize}>
              <Icon name="minimize" size={14} />
            </WindowButton>
            <WindowButton
              label={
                controls.isMaximized ? t('titlebar.restore') : t('titlebar.maximize')
              }
              onClick={controls.toggleMaximize}
            >
              <Icon name={controls.isMaximized ? 'restore' : 'maximize'} size={13} />
            </WindowButton>
            <WindowButton label={t('titlebar.close')} onClick={controls.close} danger>
              <Icon name="close" size={14} />
            </WindowButton>
          </div>
        ) : null}
      </div>
    </header>
  );
}

function WindowButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 w-10 items-center justify-center text-[var(--color-ink-soft)]',
        'transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]',
        danger && 'hover:bg-[var(--color-danger)] hover:text-white',
      )}
    >
      {children}
    </button>
  );
}
