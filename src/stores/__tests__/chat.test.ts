import { beforeEach, describe, expect, it } from 'vitest';
import { createMockSessions } from '@/mocks/sessions';
import {
  deriveTitle,
  filterSessions,
  selectActiveSession,
  totalTokens,
  useChatStore,
} from '../chat';

function resetStore(): void {
  const sessions = createMockSessions();
  useChatStore.setState({
    sessions,
    activeSessionId: sessions[0]!.id,
    modelId: sessions[0]!.modelId,
    isStreaming: false,
    selectedMessageId: null,
    filter: '',
    controller: null,
  });
}

describe('chat store', () => {
  beforeEach(resetStore);

  it('derives a session title from the first message', () => {
    expect(deriveTitle('Fix the resize handle')).toBe('Fix the resize handle');
    expect(deriveTitle('x'.repeat(80))).toHaveLength(49);
    expect(deriveTitle('   ')).toBe('Untitled session');
  });

  it('filters sessions by title and message content', () => {
    const sessions = useChatStore.getState().sessions;
    expect(filterSessions(sessions, 'RTL')).toHaveLength(1);
    expect(filterSessions(sessions, 'virtualis').length).toBeGreaterThan(0);
    expect(filterSessions(sessions, 'zzzz')).toHaveLength(0);
  });

  it('sorts pinned sessions first', () => {
    const sorted = filterSessions(useChatStore.getState().sessions, '');
    expect(sorted[0]?.pinned).toBe(true);
  });

  it('creates and selects a new session', () => {
    const before = useChatStore.getState().sessions.length;
    const id = useChatStore.getState().createSession();
    expect(useChatStore.getState().sessions).toHaveLength(before + 1);
    expect(useChatStore.getState().activeSessionId).toBe(id);
    expect(selectActiveSession(useChatStore.getState())?.messages).toHaveLength(0);
  });

  it('deletes a session and falls back to another one', () => {
    const id = useChatStore.getState().activeSessionId;
    useChatStore.getState().deleteSession(id);
    expect(useChatStore.getState().sessions.some((s) => s.id === id)).toBe(false);
    expect(useChatStore.getState().activeSessionId).not.toBe(id);
  });

  it('clears the messages of the active session', () => {
    useChatStore.getState().clearSession();
    expect(selectActiveSession(useChatStore.getState())?.messages).toHaveLength(0);
  });

  it('streams a mock assistant reply and finalises it', async () => {
    const id = useChatStore.getState().createSession();
    await useChatStore.getState().sendMessage('Hello there', { delayMs: 0, seed: 0 });

    const session = useChatStore.getState().sessions.find((s) => s.id === id);
    expect(session?.messages).toHaveLength(2);
    expect(session?.messages[0]?.role).toBe('user');

    const assistant = session?.messages[1];
    expect(assistant?.role).toBe('assistant');
    expect(assistant?.streaming).toBe(false);
    expect(assistant?.content.length).toBeGreaterThan(20);
    expect(assistant?.tokens).toBeGreaterThan(0);
    expect(useChatStore.getState().isStreaming).toBe(false);
  });

  it('titles a new session from the first user message', async () => {
    useChatStore.getState().createSession();
    await useChatStore.getState().sendMessage('Explain the router', { delayMs: 0, seed: 1 });
    expect(selectActiveSession(useChatStore.getState())?.title).toBe(
      'Explain the router',
    );
  });

  it('ignores empty messages', async () => {
    const id = useChatStore.getState().createSession();
    await useChatStore.getState().sendMessage('   ', { delayMs: 0 });
    expect(useChatStore.getState().sessions.find((s) => s.id === id)?.messages).toHaveLength(0);
  });

  it('stops an in-flight stream and marks the message', async () => {
    useChatStore.getState().createSession();
    const pending = useChatStore
      .getState()
      .sendMessage('Long answer please', { delayMs: 5, seed: 0 });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(useChatStore.getState().isStreaming).toBe(true);
    useChatStore.getState().stopStreaming();
    await pending;

    const assistant = selectActiveSession(useChatStore.getState())?.messages[1];
    expect(useChatStore.getState().isStreaming).toBe(false);
    expect(assistant?.stopped).toBe(true);
    expect(assistant?.streaming).toBe(false);
  });

  it('changes the model for the active session', () => {
    useChatStore.getState().setModel('studio-opus');
    expect(useChatStore.getState().modelId).toBe('studio-opus');
    expect(selectActiveSession(useChatStore.getState())?.modelId).toBe('studio-opus');
  });

  it('sums the tokens of a session', () => {
    const session = selectActiveSession(useChatStore.getState());
    expect(totalTokens(session)).toBeGreaterThan(0);
    expect(totalTokens(undefined)).toBe(0);
  });
});
