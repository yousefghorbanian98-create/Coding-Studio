import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { cn } from '@/lib/cn';
import { Icon, type IconName } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { usePreferences } from '@/stores/preferences';
import { useUiStore } from '@/stores/ui';

interface RailItem {
  id: string;
  icon: IconName;
  labelKey: string;
}

export const RAIL_ITEMS: RailItem[] = [
  { id: 'chat', icon: 'chat', labelKey: 'rail.chat' },
  { id: 'sessions', icon: 'sessions', labelKey: 'rail.sessions' },
  { id: 'files', icon: 'files', labelKey: 'rail.files' },
  { id: 'search', icon: 'search', labelKey: 'rail.search' },
  { id: 'extensions', icon: 'extensions', labelKey: 'rail.extensions' },
];

export function ActivityRail(): React.ReactElement {
  const { t } = useTranslation();
  const activeRailItem = usePreferences((s) => s.activeRailItem);
  const setActiveRailItem = usePreferences((s) => s.setActiveRailItem);
  const sidebarCollapsed = usePreferences((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = usePreferences((s) => s.setSidebarCollapsed);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);

  const onSelect = (id: string): void => {
    if (id === activeRailItem && !sidebarCollapsed) {
      setSidebarCollapsed(true);
      return;
    }
    setActiveRailItem(id);
    setSidebarCollapsed(false);
  };

  return (
    <nav
      data-testid="activity-rail"
      aria-label={t('rail.chat')}
      className={cn(
        'flex w-12 shrink-0 flex-col items-center gap-1 border-e',
        'border-[var(--color-line)] bg-[var(--color-surface)] py-2',
      )}
    >
      {RAIL_ITEMS.map((item) => {
        const active = item.id === activeRailItem && !sidebarCollapsed;
        return (
          <div key={item.id} className="relative">
            {active ? (
              <motion.span
                layoutId="rail-active"
                className="absolute inset-y-1 start-[-6px] w-0.5 rounded-full bg-[var(--color-brand)]"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            ) : null}
            <IconButton
              label={t(item.labelKey)}
              active={active}
              aria-current={active ? 'page' : undefined}
              data-testid={`rail-${item.id}`}
              onClick={() => onSelect(item.id)}
              className="h-10 w-10"
            >
              <Icon name={item.icon} size={19} />
            </IconButton>
          </div>
        );
      })}

      <div className="mt-auto">
        <IconButton
          label={t('rail.settings')}
          data-testid="rail-settings"
          onClick={() => setSettingsOpen(true)}
          className="h-10 w-10"
        >
          <Icon name="settings" size={19} />
        </IconButton>
      </div>
    </nav>
  );
}
