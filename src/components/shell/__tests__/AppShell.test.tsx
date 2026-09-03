import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell } from '../AppShell';
import { renderWithProviders, resetStores } from '@/test/render';
import { usePreferences } from '@/stores/preferences';
import { useUiStore } from '@/stores/ui';

describe('AppShell', () => {
  beforeEach(resetStores);

  it('renders every region of the application shell', () => {
    renderWithProviders(<AppShell />);
    expect(screen.getByTestId('title-bar')).toBeInTheDocument();
    expect(screen.getByTestId('activity-rail')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('chat-area')).toBeInTheDocument();
    expect(screen.getByTestId('status-bar')).toBeInTheDocument();
    expect(screen.getByTestId('composer')).toBeInTheDocument();
  });

  it('hides the inspector until it is toggled', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppShell />);
    expect(screen.queryByTestId('inspector')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('status-inspector-toggle'));
    await waitFor(() =>
      expect(screen.getByTestId('inspector')).toBeInTheDocument(),
    );
    expect(usePreferences.getState().inspectorOpen).toBe(true);
  });

  it('collapses the sidebar with the ctrl+b shortcut', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppShell />);
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();

    await user.keyboard('{Control>}b{/Control}');
    await waitFor(() =>
      expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument(),
    );
  });

  it('opens the command palette with ctrl+k', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppShell />);
    await user.keyboard('{Control>}k{/Control}');
    await waitFor(() =>
      expect(screen.getByTestId('command-palette')).toBeInTheDocument(),
    );
    expect(useUiStore.getState().paletteOpen).toBe(true);
  });

  it('switches direction to RTL when Persian is selected', async () => {
    renderWithProviders(<AppShell />);
    act(() => {
      usePreferences.getState().setLanguage('fa');
    });
    await waitFor(() => expect(document.documentElement.dir).toBe('rtl'));
    expect(document.documentElement.lang).toBe('fa');

    act(() => {
      usePreferences.getState().setLanguage('en');
    });
    await waitFor(() => expect(document.documentElement.dir).toBe('ltr'));
  });

  it('applies the dark class for the dark theme', async () => {
    renderWithProviders(<AppShell />);
    act(() => {
      usePreferences.getState().setTheme('dark');
    });
    await waitFor(() =>
      expect(document.documentElement.classList.contains('dark')).toBe(true),
    );

    act(() => {
      usePreferences.getState().setTheme('light');
    });
    await waitFor(() =>
      expect(document.documentElement.classList.contains('dark')).toBe(false),
    );
  });

  it('exposes an accessible resize separator for the sidebar', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppShell />);
    const handle = screen.getByTestId('sidebar-resize-handle');
    expect(handle).toHaveAttribute('role', 'separator');

    const before = usePreferences.getState().sidebarWidth;
    handle.focus();
    await user.keyboard('{ArrowRight}');
    expect(usePreferences.getState().sidebarWidth).toBeGreaterThan(before);
  });
});
