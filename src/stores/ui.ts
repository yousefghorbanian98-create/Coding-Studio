import { create } from 'zustand';

export interface UiState {
  paletteOpen: boolean;
  shortcutsOpen: boolean;
  settingsOpen: boolean;
  composerFocusToken: number;
  setPaletteOpen: (open: boolean) => void;
  togglePalette: () => void;
  setShortcutsOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  requestComposerFocus: () => void;
}

export const useUiStore = create<UiState>()((set, get) => ({
  paletteOpen: false,
  shortcutsOpen: false,
  settingsOpen: false,
  composerFocusToken: 0,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  togglePalette: () => set({ paletteOpen: !get().paletteOpen }),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  requestComposerFocus: () =>
    set({ composerFocusToken: get().composerFocusToken + 1 }),
}));
