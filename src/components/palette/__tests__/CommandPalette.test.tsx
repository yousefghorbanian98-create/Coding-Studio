import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell } from '@/components/shell/AppShell';
import { renderWithProviders, resetStores } from '@/test/render';
import { usePreferences } from '@/stores/preferences';
import { useUiStore } from '@/stores/ui';
import { createCommands, filterCommands } from '../commands';
import i18n from '@/i18n';

describe('command palette', () => {
  beforeEach(resetStores);

  it('filters commands by their translated label', () => {
    const commands = createCommands();
    expect(filterCommands(commands, '', i18n.t).length).toBe(commands.length);
    expect(filterCommands(commands, 'inspector', i18n.t)).toHaveLength(1);
    expect(filterCommands(commands, 'zzz', i18n.t)).toHaveLength(0);
  });

  it('opens from the title bar and runs a command', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppShell />);

    await user.click(screen.getByTestId('titlebar-palette-button'));
    await waitFor(() =>
      expect(screen.getByTestId('command-palette')).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId('palette-item-toggle-inspector'));
    await waitFor(() =>
      expect(usePreferences.getState().inspectorOpen).toBe(true),
    );
    expect(useUiStore.getState().paletteOpen).toBe(false);
  });

  it('narrows the list as the user types and runs with Enter', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppShell />);

    await user.keyboard('{Control>}k{/Control}');
    const input = await screen.findByTestId('palette-input');
    await user.type(input, 'use light');

    await waitFor(() =>
      expect(screen.getAllByRole('option')).toHaveLength(1),
    );
    await user.keyboard('{Enter}');
    await waitFor(() => expect(usePreferences.getState().theme).toBe('light'));
  });

  it('shows an empty state for unknown queries', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppShell />);
    await user.keyboard('{Control>}k{/Control}');
    await user.type(await screen.findByTestId('palette-input'), 'qqqq');
    expect(await screen.findByText(/no matching commands/i)).toBeInTheDocument();
  });
});
