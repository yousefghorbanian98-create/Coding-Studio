import { beforeEach, describe, expect, it } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { CommandPalette } from '../CommandPalette';
import { ShortcutsDialog } from '@/components/settings/ShortcutsDialog';
import { SHORTCUTS } from '@/hooks/useKeyboardShortcuts';
import { useUiStore } from '@/stores/ui';
import { useChatStore } from '@/stores/chat';
import { useRuntimeStore } from '@/stores/runtime';

beforeEach(() => {
  useUiStore.setState({
    paletteOpen: true,
    shortcutsOpen: false,
    settingsOpen: false,
  });
  useChatStore.setState({ isStreaming: false });
});

describe('fuzzy search in the palette', () => {
  it('finds a command from an abbreviation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CommandPalette />);
    await user.type(screen.getByTestId('palette-input'), 'tsb');
    expect(screen.getByTestId('palette-item-toggle-sidebar')).toBeInTheDocument();
  });

  it('ranks the literal match first', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CommandPalette />);
    await user.type(screen.getByTestId('palette-input'), 'sidebar');
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute(
      'data-testid',
      'palette-item-toggle-sidebar',
    );
  });

  it('shows an empty state for a query nothing matches', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CommandPalette />);
    await user.type(screen.getByTestId('palette-input'), 'zzzqqq');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });
});

describe('disabled commands', () => {
  it('explains why cancelling is unavailable when nothing is running', () => {
    renderWithProviders(<CommandPalette />);
    const item = screen.getByTestId('palette-item-stop-streaming');
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(
      screen.getByTestId('palette-disabled-stop-streaming'),
    ).toHaveTextContent(/nothing is running/i);
  });

  it('enables cancelling once a run is in flight', () => {
    useChatStore.setState({ isStreaming: true });
    renderWithProviders(<CommandPalette />);
    expect(screen.getByTestId('palette-item-stop-streaming')).toHaveAttribute(
      'aria-disabled',
      'false',
    );
  });

  it('marks Open project as needing the managed runtime', () => {
    renderWithProviders(<CommandPalette />);
    expect(screen.getByTestId('palette-disabled-open-project')).toHaveTextContent(
      /managed runtime/i,
    );
  });

  it('does nothing when a disabled command is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CommandPalette />);
    await user.click(screen.getByTestId('palette-item-open-project'));
    expect(useUiStore.getState().paletteOpen).toBe(true);
  });

  it('never starts the highlight on a disabled command', () => {
    renderWithProviders(<CommandPalette />);
    const selected = screen
      .getAllByRole('option')
      .find((o) => o.getAttribute('aria-selected') === 'true');
    expect(selected?.getAttribute('aria-disabled')).toBe('false');
  });

  it('skips disabled commands while arrowing', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CommandPalette />);
    for (let i = 0; i < 8; i += 1) {
      await user.keyboard('{ArrowDown}');
      const selected = screen
        .getAllByRole('option')
        .find((o) => o.getAttribute('aria-selected') === 'true');
      expect(selected?.getAttribute('aria-disabled')).toBe('false');
    }
  });
});

describe('keyboard navigation', () => {
  it('jumps to the first and last runnable command with Home and End', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CommandPalette />);
    await user.keyboard('{End}');
    const last = screen
      .getAllByRole('option')
      .find((o) => o.getAttribute('aria-selected') === 'true');
    expect(last?.getAttribute('aria-disabled')).toBe('false');

    await user.keyboard('{Home}');
    const options = screen.getAllByRole('option');
    const firstRunnable = options.find(
      (o) => o.getAttribute('aria-disabled') === 'false',
    );
    expect(firstRunnable).toHaveAttribute('aria-selected', 'true');
  });

  it('switches the agent mode from the palette', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CommandPalette />);
    await user.click(screen.getByTestId('palette-item-mode-plan'));
    expect(useRuntimeStore.getState().mode).toBe('plan');
  });

  it('restores focus to the trigger after closing', async () => {
    const user = userEvent.setup();
    useUiStore.setState({ paletteOpen: false });
    renderWithProviders(
      <>
        <button type="button" data-testid="trigger">
          open
        </button>
        <CommandPalette />
      </>,
    );

    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    act(() => useUiStore.setState({ paletteOpen: true }));
    await waitFor(() =>
      expect(screen.getByTestId('command-palette')).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId('palette-item-toggle-sidebar'));
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});

describe('shortcuts reference', () => {
  beforeEach(() => {
    useUiStore.setState({ paletteOpen: false, shortcutsOpen: true });
  });

  it('lists every registered shortcut', () => {
    renderWithProviders(<ShortcutsDialog />);
    for (const shortcut of SHORTCUTS) {
      expect(screen.getByTestId(`shortcut-${shortcut.id}`)).toBeInTheDocument();
    }
  });

  it('filters by label', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ShortcutsDialog />);
    await user.type(screen.getByTestId('shortcuts-search'), 'sidebar');
    expect(screen.getByTestId('shortcut-toggleSidebar')).toBeInTheDocument();
    expect(screen.queryByTestId('shortcut-palette')).not.toBeInTheDocument();
  });

  it('filters by key name', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ShortcutsDialog />);
    await user.type(screen.getByTestId('shortcuts-search'), 'esc');
    expect(screen.getByTestId('shortcut-stopStreaming')).toBeInTheDocument();
  });

  it('shows an empty state when nothing matches', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ShortcutsDialog />);
    await user.type(screen.getByTestId('shortcuts-search'), 'zzzqqq');
    expect(screen.getByTestId('shortcuts-empty')).toBeInTheDocument();
  });
});

describe('shortcut safety', () => {
  it('avoids the browser and Windows bindings that must keep working', () => {
    // Ctrl+W/T/N-in-browser, Ctrl+C/V/X, Ctrl+Q, F5 and Alt+F4 must not be
    // taken over by the app.
    const reserved = new Set(['W', 'T', 'C', 'V', 'X', 'Q', 'F5', 'F4', 'A', 'S', 'P']);
    for (const shortcut of SHORTCUTS) {
      if (!shortcut.keys.includes('Mod')) continue;
      const final = shortcut.keys[shortcut.keys.length - 1] ?? '';
      // Shift-qualified combinations are safe even on reserved letters.
      if (shortcut.keys.includes('Shift')) continue;
      expect(reserved.has(final)).toBe(false);
    }
  });

  it('declares a unique binding for every shortcut', () => {
    const combos = SHORTCUTS.map((s) => s.keys.join('+'));
    expect(new Set(combos).size).toBe(combos.length);
  });
});
