import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { Composer } from '../Composer';
import { ContextMeter } from '../ContextMeter';
import { useChatStore } from '@/stores/chat';

describe('composer — queue, context and mentions', () => {
  beforeEach(() => {
    localStorage.clear();
    useChatStore.setState({ isStreaming: false });
  });

  describe('queue next message', () => {
    it('queues instead of dropping a message typed mid-run', async () => {
      const user = userEvent.setup();
      const sendMessage = vi.fn(() => Promise.resolve());
      useChatStore.setState({ isStreaming: true, sendMessage });

      renderWithProviders(<Composer />);
      await user.type(screen.getByTestId('composer-input'), 'second question');
      await user.keyboard('{Enter}');

      expect(screen.getByTestId('composer-queued')).toHaveTextContent(
        'second question',
      );
      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('sends the queued message once the run finishes', async () => {
      const user = userEvent.setup();
      const sendMessage = vi.fn(() => Promise.resolve());
      useChatStore.setState({ isStreaming: true, sendMessage });

      const { rerender } = renderWithProviders(<Composer />);
      await user.type(screen.getByTestId('composer-input'), 'later');
      await user.keyboard('{Enter}');

      useChatStore.setState({ isStreaming: false });
      rerender(<Composer />);

      await waitFor(() => {
        expect(sendMessage).toHaveBeenCalledWith('later');
      });
      expect(screen.queryByTestId('composer-queued')).not.toBeInTheDocument();
    });

    it('lets the user cancel a queued message', async () => {
      const user = userEvent.setup();
      const sendMessage = vi.fn(() => Promise.resolve());
      useChatStore.setState({ isStreaming: true, sendMessage });

      renderWithProviders(<Composer />);
      await user.type(screen.getByTestId('composer-input'), 'oops');
      await user.keyboard('{Enter}');
      await user.click(screen.getByTestId('composer-queued-cancel'));

      expect(screen.queryByTestId('composer-queued')).not.toBeInTheDocument();
      // Ending the run must not resurrect the cancelled message.
      act(() => {
        useChatStore.setState({ isStreaming: false });
      });
      expect(sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('@ file mention', () => {
    it('opens while the caret sits in an unfinished mention', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Composer />);

      await user.type(screen.getByTestId('composer-input'), 'look at @');
      expect(screen.getByTestId('file-mention')).toBeInTheDocument();
    });

    it('inserts the chosen path and closes', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Composer />);

      const input = screen.getByTestId('composer-input');
      await user.type(input, 'check @');
      const option = screen.getAllByRole('option')[0];
      const path = option?.getAttribute('data-testid')?.replace('file-mention-', '');
      await user.click(option!);

      expect(input).toHaveValue(`check @${path ?? ''} `);
      expect(screen.queryByTestId('file-mention')).not.toBeInTheDocument();
    });

    it('closes on Escape without sending', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Composer />);

      await user.type(screen.getByTestId('composer-input'), '@');
      await user.keyboard('{Escape}');
      expect(screen.queryByTestId('file-mention')).not.toBeInTheDocument();
    });

    it('stays closed for a completed mention followed by a space', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Composer />);

      await user.type(screen.getByTestId('composer-input'), '@src ');
      expect(screen.queryByTestId('file-mention')).not.toBeInTheDocument();
    });
  });

  describe('context usage', () => {
    it('reports usage as a percentage, not colour alone', () => {
      renderWithProviders(<ContextMeter />);
      expect(screen.getByTestId('context-meter')).toHaveTextContent(/%/);
    });

    it('escalates its level as the window fills', () => {
      const { unmount } = renderWithProviders(<ContextMeter />);
      expect(screen.getByTestId('context-meter')).toHaveAttribute(
        'data-level',
        'ok',
      );
      unmount();

      // Fill the window past the danger threshold.
      const { sessions, activeSessionId } = useChatStore.getState();
      useChatStore.setState({
        sessions: sessions.map((session) =>
          session.id === activeSessionId
            ? {
                ...session,
                messages: [
                  {
                    id: 'big',
                    role: 'user' as const,
                    content: 'x',
                    createdAt: 0,
                    tokens: 10_000_000,
                  },
                ],
              }
            : session,
        ),
      });

      renderWithProviders(<ContextMeter />);
      expect(screen.getByTestId('context-meter')).toHaveAttribute(
        'data-level',
        'danger',
      );
    });
  });
});
