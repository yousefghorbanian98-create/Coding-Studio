import type { IconName } from '@/components/ui/Icon';

export interface RailItem {
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
