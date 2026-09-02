import type { TFunction } from 'i18next';
import type { IconName } from '@/components/ui/Icon';
import { useChatStore } from '@/stores/chat';
import { usePreferences } from '@/stores/preferences';
import { useUiStore } from '@/stores/ui';

export type CommandGroup = 'general' | 'view' | 'appearance' | 'session';

export interface Command {
  id: string;
  labelKey: string;
  group: CommandGroup;
  icon: IconName;
  keys?: string[];
  run: () => void;
}

export function createCommands(): Command[] {
  const ui = (): ReturnType<typeof useUiStore.getState> => useUiStore.getState();
  const prefs = (): ReturnType<typeof usePreferences.getState> =>
    usePreferences.getState();
  const chat = (): ReturnType<typeof useChatStore.getState> =>
    useChatStore.getState();

  return [
    {
      id: 'new-session',
      labelKey: 'commands.newSession',
      group: 'session',
      icon: 'plus',
      keys: ['Mod', 'N'],
      run: () => {
        chat().createSession();
        ui().requestComposerFocus();
      },
    },
    {
      id: 'clear-session',
      labelKey: 'commands.clearSession',
      group: 'session',
      icon: 'trash',
      run: () => chat().clearSession(),
    },
    {
      id: 'stop-streaming',
      labelKey: 'commands.stopStreaming',
      group: 'session',
      icon: 'stop',
      keys: ['Esc'],
      run: () => chat().stopStreaming(),
    },
    {
      id: 'toggle-sidebar',
      labelKey: 'commands.toggleSidebar',
      group: 'view',
      icon: 'sidebar',
      keys: ['Mod', 'B'],
      run: () => prefs().toggleSidebar(),
    },
    {
      id: 'toggle-inspector',
      labelKey: 'commands.toggleInspector',
      group: 'view',
      icon: 'inspector',
      keys: ['Mod', 'I'],
      run: () => prefs().toggleInspector(),
    },
    {
      id: 'focus-composer',
      labelKey: 'commands.focusComposer',
      group: 'view',
      icon: 'chat',
      keys: ['Mod', '/'],
      run: () => ui().requestComposerFocus(),
    },
    {
      id: 'toggle-panel',
      labelKey: 'commands.togglePanel',
      group: 'view',
      icon: 'sessions',
      keys: ['Mod', '`'],
      run: () => ui().togglePanel(),
    },
    {
      id: 'toggle-theme',
      labelKey: 'commands.toggleTheme',
      group: 'appearance',
      icon: 'moon',
      keys: ['Mod', 'J'],
      run: () => prefs().toggleTheme(),
    },
    {
      id: 'theme-light',
      labelKey: 'commands.themeLight',
      group: 'appearance',
      icon: 'sun',
      run: () => prefs().setTheme('light'),
    },
    {
      id: 'theme-dark',
      labelKey: 'commands.themeDark',
      group: 'appearance',
      icon: 'moon',
      run: () => prefs().setTheme('dark'),
    },
    {
      id: 'theme-system',
      labelKey: 'commands.themeSystem',
      group: 'appearance',
      icon: 'settings',
      run: () => prefs().setTheme('system'),
    },
    {
      id: 'switch-language',
      labelKey: 'commands.switchLanguage',
      group: 'appearance',
      icon: 'globe',
      keys: ['Mod', 'Shift', 'L'],
      run: () => prefs().toggleLanguage(),
    },
    {
      id: 'open-settings',
      labelKey: 'settings.title',
      group: 'general',
      icon: 'settings',
      run: () => ui().setSettingsOpen(true),
    },
    {
      id: 'open-shortcuts',
      labelKey: 'shortcuts.title',
      group: 'general',
      icon: 'command',
      run: () => ui().setShortcutsOpen(true),
    },
  ];
}

export function filterCommands(
  commands: Command[],
  query: string,
  t: TFunction,
): Command[] {
  const q = query.trim().toLowerCase();
  if (!q) return commands;
  return commands.filter((command) =>
    String(t(command.labelKey)).toLowerCase().includes(q),
  );
}
