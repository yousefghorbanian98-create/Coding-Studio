import { useEffect } from 'react';
import { useChatStore } from '@/stores/chat';
import { usePreferences } from '@/stores/preferences';
import { useUiStore } from '@/stores/ui';

export interface ShortcutDefinition {
  id: string;
  keys: string[];
  labelKey: string;
}

export const SHORTCUTS: ShortcutDefinition[] = [
  { id: 'palette', keys: ['Mod', 'K'], labelKey: 'palette.open' },
  { id: 'newSession', keys: ['Mod', 'N'], labelKey: 'commands.newSession' },
  { id: 'toggleSidebar', keys: ['Mod', 'B'], labelKey: 'commands.toggleSidebar' },
  { id: 'toggleInspector', keys: ['Mod', 'I'], labelKey: 'commands.toggleInspector' },
  { id: 'toggleTheme', keys: ['Mod', 'J'], labelKey: 'commands.toggleTheme' },
  { id: 'switchLanguage', keys: ['Mod', 'Shift', 'L'], labelKey: 'commands.switchLanguage' },
  { id: 'focusComposer', keys: ['Mod', '/'], labelKey: 'commands.focusComposer' },
  { id: 'stopStreaming', keys: ['Esc'], labelKey: 'commands.stopStreaming' },
];

export function isModifier(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey;
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  );
}

/** Registers the global keyboard shortcuts for the workbench. */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const key = event.key.toLowerCase();
      const ui = useUiStore.getState();
      const prefs = usePreferences.getState();
      const chat = useChatStore.getState();

      if (isModifier(event)) {
        switch (key) {
          case 'k':
            event.preventDefault();
            ui.togglePalette();
            return;
          case 'n':
            event.preventDefault();
            chat.createSession();
            ui.requestComposerFocus();
            return;
          case 'b':
            event.preventDefault();
            prefs.toggleSidebar();
            return;
          case 'i':
            event.preventDefault();
            prefs.toggleInspector();
            return;
          case 'j':
            event.preventDefault();
            prefs.toggleTheme();
            return;
          case 'l':
            if (event.shiftKey) {
              event.preventDefault();
              prefs.toggleLanguage();
            }
            return;
          case '/':
            event.preventDefault();
            ui.requestComposerFocus();
            return;
          default:
            return;
        }
      }

      if (key === 'escape') {
        if (ui.paletteOpen || ui.shortcutsOpen || ui.settingsOpen) return;
        if (chat.isStreaming) {
          event.preventDefault();
          chat.stopStreaming();
        }
        return;
      }

      if (key === '?' && !isEditable(event.target)) {
        event.preventDefault();
        ui.setShortcutsOpen(true);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
