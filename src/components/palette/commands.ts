import type { TFunction } from 'i18next';
import type { IconName } from '@/components/ui/Icon';
import { useChatStore } from '@/stores/chat';
import { usePreferences } from '@/stores/preferences';
import { useUiStore } from '@/stores/ui';
import { useRuntimeStore } from '@/stores/runtime';
import { fuzzyRank } from '@/lib/fuzzy';

export type CommandGroup = 'general' | 'view' | 'appearance' | 'session';

export interface Command {
  id: string;
  labelKey: string;
  group: CommandGroup;
  icon: IconName;
  keys?: string[];
  run: () => void;
  /** When set, the command is shown but not runnable, with this reason. */
  disabledReasonKey?: string;
}

export function createCommands(): Command[] {
  const ui = (): ReturnType<typeof useUiStore.getState> => useUiStore.getState();
  const prefs = (): ReturnType<typeof usePreferences.getState> =>
    usePreferences.getState();
  const chat = (): ReturnType<typeof useChatStore.getState> =>
    useChatStore.getState();
  const runtime = (): ReturnType<typeof useRuntimeStore.getState> =>
    useRuntimeStore.getState();

  const streaming = useChatStore.getState().isStreaming;

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
      // Cancelling with nothing running would be a no-op button.
      ...(streaming ? {} : { disabledReasonKey: 'commands.noActiveRun' }),
      run: () => chat().stopStreaming(),
    },
    {
      id: 'open-project',
      labelKey: 'commands.openProject',
      group: 'general',
      icon: 'files',
      disabledReasonKey: 'commands.needsRuntime',
      run: () => undefined,
    },
    {
      id: 'mode-ask',
      labelKey: 'commands.modeAsk',
      group: 'session',
      icon: 'chat',
      run: () => runtime().setMode('ask'),
    },
    {
      id: 'mode-plan',
      labelKey: 'commands.modePlan',
      group: 'session',
      icon: 'sessions',
      run: () => runtime().setMode('plan'),
    },
    {
      id: 'mode-agent',
      labelKey: 'commands.modeAgent',
      group: 'session',
      icon: 'sparkle',
      run: () => runtime().setMode('agent'),
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

/**
 * Ranks commands with a subsequence match so "tsb" finds "Toggle sidebar".
 *
 * The group name is appended to the searchable text, which lets someone type
 * "appearance" to see everything in that group.
 */
export function filterCommands(
  commands: Command[],
  query: string,
  t: TFunction,
): Command[] {
  if (query.trim().length === 0) return commands;
  return fuzzyRank(
    commands,
    query,
    (command) =>
      `${String(t(command.labelKey))} ${String(t(`palette.groups.${command.group}`))}`,
  ).map((scored) => scored.item);
}
