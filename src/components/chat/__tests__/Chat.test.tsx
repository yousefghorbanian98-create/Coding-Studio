import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell } from '@/components/shell/AppShell';
import { renderWithProviders, resetStores } from '@/test/render';
import { selectActiveSession, useChatStore } from '@/stores/chat';
import { parseBlocks } from '@/lib/markdown';

describe('chat area', () => {
  beforeEach(resetStores);

  it('renders the mock transcript of the active session', () => {
    renderWithProviders(<AppShell />);
    expect(screen.getAllByTestId('message-assistant').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('message-user').length).toBeGreaterThan(0);
  });

  it('shows the session list from the mock data', () => {
    renderWithProviders(<AppShell />);
    const list = screen.getByTestId('session-list');
    expect(within(list).getAllByRole('listitem').length).toBeGreaterThan(2);
  });

  it('filters the session list', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppShell />);
    await user.type(screen.getByTestId('sidebar-search'), 'RTL');
    await waitFor(() =>
      expect(
        within(screen.getByTestId('session-list')).getAllByRole('listitem'),
      ).toHaveLength(1),
    );
  });

  it('disables the send button while the composer is empty', () => {
    renderWithProviders(<AppShell />);
    expect(screen.getByTestId('send-button')).toBeDisabled();
  });

  it('sends a message and streams a mock reply, then allows stopping', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppShell />);

    await user.click(screen.getByTestId('sidebar-new-session'));
    await user.type(screen.getByTestId('composer-input'), 'Hello Coding Studio');
    await user.click(screen.getByTestId('send-button'));

    await waitFor(() => expect(screen.getByTestId('stop-button')).toBeInTheDocument());
    expect(screen.getByTestId('message-user')).toHaveTextContent(
      'Hello Coding Studio',
    );

    await user.click(screen.getByTestId('stop-button'));
    await waitFor(() => expect(useChatStore.getState().isStreaming).toBe(false));
    expect(screen.getByTestId('send-button')).toBeInTheDocument();

    const assistant = selectActiveSession(useChatStore.getState())?.messages[1];
    expect(assistant?.stopped).toBe(true);
  });

  it('sends on Enter but keeps a newline on Shift+Enter', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppShell />);
    await user.click(screen.getByTestId('sidebar-new-session'));

    const input = screen.getByTestId('composer-input');
    await user.type(input, 'line one{Shift>}{Enter}{/Shift}line two');
    expect(input).toHaveValue('line one\nline two');

    await user.type(input, '{Enter}');
    await waitFor(() => expect(useChatStore.getState().isStreaming).toBe(true));
    useChatStore.getState().stopStreaming();
  });

  it('lists the mock models in the selector', () => {
    renderWithProviders(<AppShell />);
    expect(screen.getByTestId('model-selector')).toHaveTextContent('Studio Sonnet');
  });
});

describe('message markdown parser', () => {
  it('separates code fences from prose', () => {
    const blocks = parseBlocks('Intro\n\n```ts\nconst a = 1;\n```\n\nOutro');
    expect(blocks.map((b) => b.type)).toEqual(['text', 'code', 'text']);
    expect(blocks[1]?.lang).toBe('ts');
    expect(blocks[1]?.content.trim()).toBe('const a = 1;');
  });

  it('handles an unterminated fence while streaming', () => {
    const blocks = parseBlocks('Here:\n```ts\nconst a =');
    expect(blocks).toHaveLength(2);
    expect(blocks[1]?.type).toBe('code');
  });
});
