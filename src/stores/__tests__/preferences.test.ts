import { beforeEach, describe, expect, it } from 'vitest';
import {
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  clampFontScale,
  clampSidebarWidth,
  resolveTheme,
  usePreferences,
} from '../preferences';

describe('preferences store', () => {
  beforeEach(() => {
    usePreferences.getState().reset();
  });

  it('clamps the sidebar width to the allowed range', () => {
    expect(clampSidebarWidth(10)).toBe(SIDEBAR_MIN_WIDTH);
    expect(clampSidebarWidth(9999)).toBe(SIDEBAR_MAX_WIDTH);
    expect(clampSidebarWidth(320.4)).toBe(320);
  });

  it('clamps the font scale', () => {
    expect(clampFontScale(0.1)).toBe(0.85);
    expect(clampFontScale(5)).toBe(1.3);
    expect(clampFontScale(1.05)).toBe(1.05);
  });

  it('persists the sidebar width through the store', () => {
    usePreferences.getState().setSidebarWidth(1000);
    expect(usePreferences.getState().sidebarWidth).toBe(SIDEBAR_MAX_WIDTH);
  });

  it('toggles the sidebar and inspector', () => {
    expect(usePreferences.getState().sidebarCollapsed).toBe(false);
    usePreferences.getState().toggleSidebar();
    expect(usePreferences.getState().sidebarCollapsed).toBe(true);

    expect(usePreferences.getState().inspectorOpen).toBe(false);
    usePreferences.getState().toggleInspector();
    expect(usePreferences.getState().inspectorOpen).toBe(true);
  });

  it('toggles between explicit light and dark themes', () => {
    usePreferences.getState().setTheme('light');
    usePreferences.getState().toggleTheme();
    expect(usePreferences.getState().theme).toBe('dark');
    usePreferences.getState().toggleTheme();
    expect(usePreferences.getState().theme).toBe('light');
  });

  it('resolves an explicit theme without consulting the system', () => {
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('toggles the language between en and fa', () => {
    expect(usePreferences.getState().language).toBe('en');
    usePreferences.getState().toggleLanguage();
    expect(usePreferences.getState().language).toBe('fa');
    usePreferences.getState().toggleLanguage();
    expect(usePreferences.getState().language).toBe('en');
  });

  it('writes preferences to localStorage', () => {
    usePreferences.getState().setDensity('compact');
    const raw = localStorage.getItem('coding-studio:preferences');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw ?? '{}').state.density).toBe('compact');
  });
});
