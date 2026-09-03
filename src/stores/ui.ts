import { create } from 'zustand';

export type PanelTab = 'terminal' | 'problems' | 'output' | 'tasks' | 'logs';

export interface UiState {
  paletteOpen: boolean;
  shortcutsOpen: boolean;
  settingsOpen: boolean;
  composerFocusToken: number;
  panelOpen: boolean;
  panelTab: PanelTab;
  setPaletteOpen: (open: boolean) => void;
  togglePalette: () => void;
  setShortcutsOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  requestComposerFocus: () => void;
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;
  setPanelTab: (tab: PanelTab) => void;
}

export const useUiStore = create<UiState>()((set, get) => ({
  paletteOpen: false,
  shortcutsOpen: false,
  settingsOpen: false,
  composerFocusToken: 0,
  panelOpen: false,
  panelTab: 'terminal',
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  togglePalette: () => set({ paletteOpen: !get().paletteOpen }),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  requestComposerFocus: () =>
    set({ composerFocusToken: get().composerFocusToken + 1 }),
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  togglePanel: () => set({ panelOpen: !get().panelOpen }),
  setPanelTab: (panelTab) => set({ panelTab, panelOpen: true }),
}));
