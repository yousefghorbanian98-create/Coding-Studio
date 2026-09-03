import type { IconName } from '@/components/ui/Icon';

export type SettingsSectionId =
  | 'appearance'
  | 'runtime'
  | 'providers'
  | 'permissions'
  | 'privacy'
  | 'about';

export interface SettingsSection {
  id: SettingsSectionId;
  labelKey: string;
  icon: IconName;
}

/**
 * Only the sections this build can honour are listed.
 *
 * The mission names many more (Projects, Agents, Memory, MCP, Git, Terminal,
 * Advanced), but they would be empty shells today. They are documented as
 * future work in the About section instead of shipping as dead pages.
 */
export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  { id: 'appearance', labelKey: 'settings.sections.appearance', icon: 'sun' },
  { id: 'runtime', labelKey: 'settings.sections.runtime', icon: 'sparkle' },
  { id: 'providers', labelKey: 'settings.sections.providers', icon: 'globe' },
  { id: 'permissions', labelKey: 'settings.sections.permissions', icon: 'check' },
  { id: 'privacy', labelKey: 'settings.sections.privacy', icon: 'alert' },
  { id: 'about', labelKey: 'settings.sections.about', icon: 'command' },
];

/** Sections named in the product plan that are deliberately not built yet. */
export const FUTURE_SECTIONS = [
  'Projects',
  'Agents',
  'Memory',
  'MCP',
  'Git',
  'Terminal',
  'Advanced',
] as const;
