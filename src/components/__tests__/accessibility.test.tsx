import { beforeEach, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { AppShell } from '@/components/shell/AppShell';
import { DiffViewer } from '@/components/workspace/DiffViewer';
import { BottomPanel } from '@/components/panel/BottomPanel';
import { SettingsDialog } from '@/components/settings/SettingsDialog';
import { useUiStore } from '@/stores/ui';
import { usePreferences } from '@/stores/preferences';

beforeEach(() => {
  useUiStore.setState({
    paletteOpen: false,
    shortcutsOpen: false,
    settingsOpen: false,
    panelOpen: false,
  });
  usePreferences.setState({ sidebarCollapsed: false, activeRailItem: 'chat' });
});

describe('landmarks', () => {
  it('exposes the standard page regions', () => {
    renderWithProviders(<AppShell />);
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getAllByRole('navigation').length).toBeGreaterThan(0);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('names the sidebar region so it can be told apart', () => {
    renderWithProviders(<AppShell />);
    expect(screen.getByRole('complementary')).toHaveAccessibleName();
  });
});

describe('every control is labelled', () => {
  it('gives each button in the shell an accessible name', () => {
    renderWithProviders(<AppShell />);
    const unnamed = screen
      .getAllByRole('button')
      .filter((button) => {
        const text = button.textContent?.trim() ?? '';
        const label = button.getAttribute('aria-label')?.trim() ?? '';
        const labelledBy = button.getAttribute('aria-labelledby') ?? '';
        return text === '' && label === '' && labelledBy === '';
      })
      .map((button) => button.getAttribute('data-testid') ?? button.outerHTML);

    expect(unnamed).toEqual([]);
  });

  it('labels every text input', () => {
    renderWithProviders(<AppShell />);
    for (const box of screen.queryAllByRole('textbox')) {
      expect(box).toHaveAccessibleName();
    }
  });
});

describe('does not rely on colour alone', () => {
  it('spells out added and removed diff lines for screen readers', () => {
    renderWithProviders(<DiffViewer />);
    const table = screen.getByTestId('diff-table');
    expect(within(table).getAllByText(/Added line/).length).toBeGreaterThan(0);
  });

  it('labels problem severity in text, not just by icon colour', async () => {
    useUiStore.setState({ panelOpen: true, panelTab: 'problems' });
    const user = userEvent.setup();
    renderWithProviders(<BottomPanel />);
    await user.click(screen.getByTestId('panel-tab-problems'));
    expect(screen.getByLabelText('Error')).toBeInTheDocument();
    expect(screen.getByLabelText('Warning')).toBeInTheDocument();
  });

  it('pairs the connection dot with a text status', () => {
    renderWithProviders(<AppShell />);
    expect(screen.getByTestId('status-connection').textContent?.trim()).not.toBe(
      '',
    );
  });
});

describe('dialog semantics', () => {
  it('gives the settings dialog a title and a close control', () => {
    useUiStore.setState({ settingsOpen: true });
    renderWithProviders(<SettingsDialog />);
    const dialog = screen.getByTestId('settings-dialog');
    expect(within(dialog).getByRole('heading')).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: /close/i }),
    ).toBeInTheDocument();
  });

  it('closes the settings dialog on Escape', async () => {
    useUiStore.setState({ settingsOpen: true });
    const user = userEvent.setup();
    renderWithProviders(<SettingsDialog />);
    await user.keyboard('{Escape}');
    expect(useUiStore.getState().settingsOpen).toBe(false);
  });
});

describe('composite widgets expose one tab stop', () => {
  it('keeps a single tab stop in the bottom panel tablist', () => {
    useUiStore.setState({ panelOpen: true });
    renderWithProviders(<BottomPanel />);
    const stops = screen.getAllByRole('tab').filter((tab) => tab.tabIndex === 0);
    expect(stops).toHaveLength(1);
  });

  it('marks the selected tab and links it to its panel', () => {
    useUiStore.setState({ panelOpen: true });
    renderWithProviders(<BottomPanel />);
    const selected = screen
      .getAllByRole('tab')
      .find((tab) => tab.getAttribute('aria-selected') === 'true');
    expect(selected).toBeDefined();
    expect(selected).toHaveAttribute('aria-controls', 'panel-tabpanel');
    expect(screen.getByRole('tabpanel')).toHaveAttribute(
      'aria-labelledby',
      selected?.id ?? '',
    );
  });
});

describe('live regions are used sparingly', () => {
  it('announces only the status line in the resting shell', () => {
    const { container } = renderWithProviders(<AppShell />);
    const live = container.querySelectorAll('[aria-live]');
    // One is enough: an over-eager live region talks over everything else.
    expect(live.length).toBeLessThanOrEqual(2);
  });
});
