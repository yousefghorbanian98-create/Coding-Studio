import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Language } from '@/i18n';

export type ThemeMode = 'light' | 'dark' | 'system';
export type Density = 'comfortable' | 'compact';

export const SIDEBAR_MIN_WIDTH = 200;
export const SIDEBAR_MAX_WIDTH = 480;
export const SIDEBAR_DEFAULT_WIDTH = 280;

export interface PreferencesState {
  theme: ThemeMode;
  language: Language;
  density: Density;
  fontScale: number;
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  inspectorOpen: boolean;
  activeRailItem: string;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  setDensity: (density: Density) => void;
  setFontScale: (scale: number) => void;
  setSidebarWidth: (width: number) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleInspector: () => void;
  setInspectorOpen: (open: boolean) => void;
  setActiveRailItem: (id: string) => void;
  reset: () => void;
}

export const clampSidebarWidth = (width: number): number =>
  Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(width)));

export const clampFontScale = (scale: number): number =>
  Math.min(1.3, Math.max(0.85, Math.round(scale * 100) / 100));

const defaults = {
  theme: 'system' as ThemeMode,
  language: 'en' as Language,
  density: 'comfortable' as Density,
  fontScale: 1,
  sidebarWidth: SIDEBAR_DEFAULT_WIDTH,
  sidebarCollapsed: false,
  inspectorOpen: false,
  activeRailItem: 'chat',
};

export const PREFERENCES_STORAGE_KEY = 'coding-studio:preferences';

export const usePreferences = create<PreferencesState>()(
  persist(
    (set, get) => ({
      ...defaults,
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => {
        const current = get().theme;
        const resolved =
          current === 'system' ? resolveSystemTheme() : current;
        set({ theme: resolved === 'dark' ? 'light' : 'dark' });
      },
      setLanguage: (language) => set({ language }),
      toggleLanguage: () =>
        set({ language: get().language === 'en' ? 'fa' : 'en' }),
      setDensity: (density) => set({ density }),
      setFontScale: (fontScale) => set({ fontScale: clampFontScale(fontScale) }),
      setSidebarWidth: (width) =>
        set({ sidebarWidth: clampSidebarWidth(width) }),
      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      toggleInspector: () => set({ inspectorOpen: !get().inspectorOpen }),
      setInspectorOpen: (inspectorOpen) => set({ inspectorOpen }),
      setActiveRailItem: (activeRailItem) => set({ activeRailItem }),
      reset: () => set({ ...defaults }),
    }),
    {
      name: PREFERENCES_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        language: state.language,
        density: state.density,
        fontScale: state.fontScale,
        sidebarWidth: state.sidebarWidth,
        sidebarCollapsed: state.sidebarCollapsed,
        inspectorOpen: state.inspectorOpen,
        activeRailItem: state.activeRailItem,
      }),
    },
  ),
);

export function resolveSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'system' ? resolveSystemTheme() : mode;
}
