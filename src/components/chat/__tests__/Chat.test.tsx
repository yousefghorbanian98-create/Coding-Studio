import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell } from '@/components/shell/AppShell';
import { renderWithProviders, resetStores } from '@/test/render';
import { selectActiveSession, useChatStore } from '@/stores/chat';
import { useRunStore } from '@/stores/run';
import { setRuntime, resetRuntime } from '@/services/runtime';
import { createMockRuntime } from '@/services/runtime/mockRuntime';
import { parseBlocks } from '@/lib/markdown';

describe('chat area', () => {
  beforeEach(resetStores);
  afterEach(() => {
    resetRuntime();
    useRunStore.getState().reset();
  });

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
    // A long reply with a deliberate tick keeps the run observably in flight.
    // With the default 3-chunk reply the whole run can finish before the
    // assertions execute, so the stop button would already be gone.
    setRuntime(createMockRuntime({ scenario: 'long-streaming', tickMs: 40 }));
    const user = userEvent.setup();
    renderWithProviders(<AppShell />);

    await user.click(screen.getByTestId('sidebar-new-session'));
    await user.type(screen.getByTestId('composer-input'), 'Hello Coding Studio');
    await user.click(screen.getByTestId('send-button'));

    await waitFor(() => expect(screen.getByTestId('stop-button')).toBeInTheDocument());
    expect(screen.getByTestId('message-user')).toHaveTextContent(
      'Hello Coding Studio',
    );

    // The stop button only proves a run is active. Cancelling here would race
    // the runtime: on a slower machine no message.started has been projected
    // yet, so there would be no assistant message to assert `stopped` on.
    // Wait for the transcript to actually contain streamed assistant text.
    await waitFor(() => {
      const assistant = selectActiveSession(useChatStore.getState())
        ?.messages[1];
      expect(assistant?.content.length ?? 0).toBeGreaterThan(0);
    });

    await user.click(screen.getByTestId('stop-button'));
    await waitFor(() => expect(useChatStore.getState().isStreaming).toBe(false));
    expect(screen.getByTestId('send-button')).toBeInTheDocument();

    const assistant = selectActiveSession(useChatStore.getState())?.messages[1];
    expect(assistant?.stopped).toBe(true);
    // Cancelling keeps whatever had already streamed.
    expect(assistant?.content.length ?? 0).toBeGreaterThan(0);
    expect(assistant?.streaming).toBe(false);
  });

  it('cancels cleanly when no delta has arrived yet', async () => {
    // The opposite race: stop before the runtime has produced anything. A tick
    // longer than the test guarantees no delta can land first, so this pins the
    // zero-delta path deterministically rather than by timing luck.
    setRuntime(createMockRuntime({ tickMs: 10_000 }));
    const user = userEvent.setup();
    renderWithProviders(<AppShell />);

    await user.click(screen.getByTestId('sidebar-new-session'));
    await user.type(screen.getByTestId('composer-input'), 'Stop me early');
    await user.click(screen.getByTestId('send-button'));

    await waitFor(() =>
      expect(screen.getByTestId('stop-button')).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId('stop-button'));

    await waitFor(() => expect(useChatStore.getState().isStreaming).toBe(false));
    await waitFor(() => expect(useRunStore.getState().phase).toBe('cancelled'));

    const session = selectActiveSession(useChatStore.getState());
    expect(session?.messages[0]?.role).toBe('user');

    // An assistant turn may already have been opened by message.started. What
    // must never happen is inventing reply text for a run that never spoke:
    // the bubble stays empty, sealed and marked stopped.
    const assistant = session?.messages[1];
    if (assistant) {
      expect(assistant.content).toBe('');
      expect(assistant.stopped).toBe(true);
      expect(assistant.streaming).toBe(false);
    }
    expect(screen.getByTestId('send-button')).toBeInTheDocument();

    // A delta arriving later must not resurrect the cancelled run.
    const before = selectActiveSession(useChatStore.getState())?.messages.length;
    await new Promise((resolve) => setTimeout(resolve, 100));
    const after = selectActiveSession(useChatStore.getState());
    expect(after?.messages).toHaveLength(before ?? 0);
    expect(after?.messages[1]?.content ?? '').toBe('');
  }, 20_000);

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

  it('lists the available models in the selector', async () => {
    renderWithProviders(<AppShell />);
    // The mock runtime serves the provider-neutral fixture catalogue.
    expect(await screen.findByTestId('model-selector')).toHaveTextContent(
      'Demo Balanced',
    );
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
