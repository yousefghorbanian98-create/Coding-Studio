import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { SessionList } from '../SessionList';
import { useChatStore } from '@/stores/chat';
import type { ChatSession } from '@/types/chat';

function session(overrides: Partial<ChatSession>): ChatSession {
  return {
    id: 'a',
    title: 'Alpha',
    createdAt: 1000,
    updatedAt: 1000,
    modelId: 'studio-sonnet',
    messages: [],
    ...overrides,
  };
}

beforeEach(() => {
  useChatStore.setState({
    sessions: [
      session({ id: 'a', title: 'Alpha', updatedAt: 3000 }),
      session({ id: 'b', title: 'Beta', updatedAt: 2000 }),
      session({ id: 'c', title: 'Gamma', archived: true }),
    ],
    activeSessionId: 'a',
    filter: '',
    showArchived: false,
    isStreaming: false,

    selectedMessageId: null,
  });
});

async function openMenu(id: string): Promise<void> {
  const user = userEvent.setup();
  await user.click(screen.getByTestId(`session-actions-${id}`));
}

describe('SessionList', () => {
  it('lists active sessions and hides archived ones', () => {
    renderWithProviders(<SessionList />);
    expect(screen.getByTestId('session-item-a')).toBeInTheDocument();
    expect(screen.queryByTestId('session-item-c')).not.toBeInTheDocument();
  });

  it('shows an archive-specific empty state', () => {
    useChatStore.setState({ showArchived: true, sessions: [session({ id: 'a' })] });
    renderWithProviders(<SessionList />);
    expect(screen.getByTestId('session-list-empty')).toHaveTextContent(
      /archived/i,
    );
  });

  it('opens the row menu as an accessible menu', async () => {
    renderWithProviders(<SessionList />);
    await openMenu('a');
    expect(screen.getByTestId('session-menu-a')).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem').length).toBeGreaterThan(0);
    expect(screen.getByTestId('session-actions-a')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('closes the row menu on Escape', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SessionList />);
    await openMenu('a');
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('session-menu-a')).not.toBeInTheDocument();
  });

  it('renames a session inline and commits on Enter', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SessionList />);
    await openMenu('a');
    await user.click(screen.getByTestId('session-action-rename-a'));

    const input = screen.getByTestId('session-rename-input-a');
    await user.clear(input);
    await user.type(input, 'Renamed{Enter}');

    expect(
      useChatStore.getState().sessions.find((s) => s.id === 'a')?.title,
    ).toBe('Renamed');
  });

  it('abandons a rename on Escape', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SessionList />);
    await openMenu('a');
    await user.click(screen.getByTestId('session-action-rename-a'));
    await user.type(screen.getByTestId('session-rename-input-a'), 'x{Escape}');
    expect(
      useChatStore.getState().sessions.find((s) => s.id === 'a')?.title,
    ).toBe('Alpha');
  });

  it('ignores a rename to an empty title', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SessionList />);
    await openMenu('a');
    await user.click(screen.getByTestId('session-action-rename-a'));
    const input = screen.getByTestId('session-rename-input-a');
    await user.clear(input);
    await user.type(input, '   {Enter}');
    expect(
      useChatStore.getState().sessions.find((s) => s.id === 'a')?.title,
    ).toBe('Alpha');
  });

  it('pins a session from the menu', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SessionList />);
    await openMenu('b');
    await user.click(screen.getByTestId('session-action-pin-b'));
    expect(
      useChatStore.getState().sessions.find((s) => s.id === 'b')?.pinned,
    ).toBe(true);
  });

  it('archives a session from the menu', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SessionList />);
    await openMenu('b');
    await user.click(screen.getByTestId('session-action-archive-b'));
    // AnimatePresence keeps the row mounted for its exit transition.
    await waitForElementToBeRemoved(() =>
      screen.queryByTestId('session-item-b'),
    );
  });

  it('duplicates a session from the menu', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SessionList />);
    await openMenu('a');
    await user.click(screen.getByTestId('session-action-duplicate-a'));
    expect(screen.getByText('Alpha (copy)')).toBeInTheDocument();
  });

  it('requires confirmation before deleting', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SessionList />);
    await openMenu('b');
    await user.click(screen.getByTestId('session-action-delete-b'));

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(useChatStore.getState().sessions).toHaveLength(3);

    await user.click(screen.getByTestId('session-confirm-delete-b'));
    expect(
      useChatStore.getState().sessions.some((s) => s.id === 'b'),
    ).toBe(false);
  });

  it('cancels a pending delete without removing anything', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SessionList />);
    await openMenu('b');
    await user.click(screen.getByTestId('session-action-delete-b'));
    await user.click(screen.getByTestId('session-confirm-cancel-b'));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(useChatStore.getState().sessions).toHaveLength(3);
  });

  it('offers restore instead of archive for archived sessions', async () => {
    useChatStore.setState({ showArchived: true });
    const user = userEvent.setup();
    renderWithProviders(<SessionList />);
    await openMenu('c');
    expect(screen.getByTestId('session-action-archive-c')).toHaveTextContent(
      /restore/i,
    );
    expect(screen.queryByTestId('session-action-pin-c')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('session-action-archive-c'));
    expect(
      useChatStore.getState().sessions.find((s) => s.id === 'c')?.archived,
    ).toBe(false);
  });
});

/**
 * Regression: the summary line was only covered by a unit test of the pure
 * `sessionSummary` helper, so deleting the markup that renders it left the
 * whole suite green while the feature disappeared from the sidebar. These
 * assert the rendered output instead.
 */
describe('session summary line (rendered)', () => {
  it('shows the last reply under the session title', () => {
    useChatStore.setState({
      sessions: [
        session({
          id: 'a',
          title: 'Alpha',
          messages: [
            {
              id: 'm1',
              role: 'user',
              content: 'How do I split the bridge?',
              createdAt: 1,
            },
            {
              id: 'm2',
              role: 'assistant',
              content: 'Extract the transport seam first.',
              createdAt: 2,
            },
          ],
        }),
      ],
      activeSessionId: 'a',
    });
    renderWithProviders(<SessionList />);

    expect(screen.getByTestId('session-summary-a')).toHaveTextContent(
      'Extract the transport seam first.',
    );
  });

  it('renders no summary element for an empty session', () => {
    useChatStore.setState({
      sessions: [session({ id: 'a', title: 'Alpha', messages: [] })],
      activeSessionId: 'a',
    });
    renderWithProviders(<SessionList />);

    expect(screen.queryByTestId('session-summary-a')).toBeNull();
  });
});
