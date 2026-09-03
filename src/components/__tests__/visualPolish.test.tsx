import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { AppShell } from '@/components/shell/AppShell';
import { ChatArea } from '@/components/chat/ChatArea';
import { useChatStore } from '@/stores/chat';
import { MessageContent } from '@/components/chat/MessageContent';
import { AgentRoster } from '@/components/agent/AgentRoster';
import { useRunStore } from '@/stores/run';
import { asAgentId, type AgentState } from '@/services/runtime';

/**
 * Slice 14 visual-polish invariants. These are the rules that are cheap to
 * break by accident and expensive to notice by eye, so they are pinned here
 * rather than left to the screenshot diff.
 */
describe('visual polish', () => {
  describe('no horizontal overflow from long content', () => {
    it('breaks long unbroken words in prose', () => {
      // whitespace-pre-wrap preserves wrapping opportunities but does not
      // create them, so a long URL or hash needs an explicit break rule.
      renderWithProviders(
        <MessageContent content={'see https://example.com/' + 'x'.repeat(300)} />,
      );
      const paragraph = screen
        .getByTestId('message-content')
        .querySelector('p');
      expect(paragraph?.className).toContain('break-words');
    });

    it('keeps code blocks scrollable instead of stretching the column', () => {
      renderWithProviders(
        <MessageContent content={'```\n' + 'y'.repeat(400) + '\n```'} />,
      );
      const pre = screen.getByTestId('message-content').querySelector('pre');
      expect(pre?.className).toContain('overflow-x-auto');
    });

    it('gives the shell a fixed viewport that never scrolls as a whole', async () => {
      renderWithProviders(<AppShell />);
      // findBy* lets the runtime health check settle, so the async state
      // updates it triggers happen inside act().
      const shell = await screen.findByTestId('app-shell');
      expect(shell.className).toContain('overflow-hidden');
    });
  });

  describe('truncated text stays discoverable', () => {
    const agent: AgentState = {
      id: asAgentId('a1'),
      name: 'An agent with a very long name that will certainly be clipped',
      role: 'Reviews the diff',
      status: 'working',
      currentTask: 'A task description long enough to be truncated in the UI',
      completedTasks: 0,
    };

    it('pairs every truncating agent row with a title tooltip', () => {
      useRunStore.setState({ agents: [agent] });
      renderWithProviders(<AgentRoster />);

      for (const node of screen
        .getByTestId('agent-card-a1')
        .querySelectorAll('.truncate')) {
        expect(node.getAttribute('title')).toBeTruthy();
      }
      useRunStore.setState({ agents: [] });
    });
  });

  describe('states are covered, not blank', () => {
    it('offers a guided empty state when a session has no messages', () => {
      // Empty the active session before rendering, so React never observes
      // an out-of-act store mutation.
      const { sessions, activeSessionId } = useChatStore.getState();
      useChatStore.setState({
        sessions: sessions.map((session) =>
          session.id === activeSessionId
            ? { ...session, messages: [] }
            : session,
        ),
      });

      renderWithProviders(<ChatArea />);

      // An empty column must guide, not just sit blank.
      const empty = screen.getByTestId('chat-empty');
      expect(empty).toBeInTheDocument();
      expect(empty.querySelectorAll('button').length).toBeGreaterThan(0);
    });
  });
});
