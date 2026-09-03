import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { connectRunStore, useRunStore } from '../run';
import { resetRuntime, setRuntime } from '@/services/runtime';
import { createMockRuntime } from '@/services/runtime/mockRuntime';
import { createMockSessions } from '@/mocks/sessions';
import type { ChatSession } from '@/types/chat';
import {
  deriveTitle,
  filterSessions,
  selectActiveSession,
  sessionSummary,
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
    errorKey: null,
    activeRun: null,
  });
  useRunStore.getState().reset();
}

/** Waits until the in-flight assistant message has received some text. */
async function waitForText(timeoutMs = 5000): Promise<void> {
  const started = Date.now();
  for (;;) {
    const assistant = selectActiveSession(useChatStore.getState())?.messages[1];
    if (assistant && assistant.content.length > 0) return;
    if (Date.now() - started > timeoutMs) throw new Error('no delta arrived');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

/** Waits for the mock runtime to finish a run. */
async function settle(timeoutMs = 10_000): Promise<void> {
  const started = Date.now();
  while (useChatStore.getState().isStreaming) {
    if (Date.now() - started > timeoutMs) throw new Error('run did not settle');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
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

  it('streams an assistant reply from the runtime and finalises it', async () => {
    const disconnect = connectRunStore();
    const id = useChatStore.getState().createSession();
    await useChatStore.getState().sendMessage('Hello there');
    await settle();
    disconnect();

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
    await useChatStore.getState().sendMessage('Explain the router');
    expect(selectActiveSession(useChatStore.getState())?.title).toBe(
      'Explain the router',
    );
  });

  it('ignores empty messages', async () => {
    const id = useChatStore.getState().createSession();
    await useChatStore.getState().sendMessage('   ');
    expect(useChatStore.getState().sessions.find((s) => s.id === id)?.messages).toHaveLength(0);
  });

  it('stops an in-flight stream and marks the message', async () => {
    // A long reply with a slow tick guarantees the run is still streaming when
    // we cancel. A fixed sleep would race the runtime on a slow CI machine.
    setRuntime(createMockRuntime({ scenario: 'long-streaming', tickMs: 50 }));
    const disconnect = connectRunStore();
    useChatStore.getState().createSession();
    await useChatStore.getState().sendMessage('Long answer please');

    // Cancel as soon as the first delta has landed, not after a fixed delay.
    await waitForText();
    useChatStore.getState().stopStreaming();
    await settle();
    disconnect();

    const assistant = selectActiveSession(useChatStore.getState())?.messages[1];
    expect(useChatStore.getState().isStreaming).toBe(false);
    expect(assistant?.stopped).toBe(true);
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

describe('sessionSummary', () => {
  const base: ChatSession = {
    id: 's1',
    title: 'T',
    createdAt: 0,
    updatedAt: 0,
    modelId: 'demo-balanced',
    messages: [],
  };

  it('returns null for an empty session so the row can omit the line', () => {
    expect(sessionSummary({ ...base })).toBeNull();
  });

  it('prefers the last assistant reply', () => {
    expect(
      sessionSummary({
        ...base,
        messages: [
          { id: 'a', role: 'user', content: 'question', createdAt: 0 },
          { id: 'b', role: 'assistant', content: 'the answer', createdAt: 1 },
        ],
      }),
    ).toBe('the answer');
  });

  it('falls back to the user message when nothing has replied yet', () => {
    expect(
      sessionSummary({
        ...base,
        messages: [{ id: 'a', role: 'user', content: 'only asked', createdAt: 0 }],
      }),
    ).toBe('only asked');
  });

  it('strips code fences and collapses whitespace', () => {
    expect(
      sessionSummary({
        ...base,
        messages: [
          {
            id: 'a',
            role: 'assistant',
            content: 'before\n```js\nconst x = 1;\n```\nafter',
            createdAt: 0,
          },
        ],
      }),
    ).toBe('before after');
  });

  it('truncates a long summary', () => {
    const summary = sessionSummary({
      ...base,
      messages: [
        { id: 'a', role: 'assistant', content: 'x'.repeat(200), createdAt: 0 },
      ],
    });
    expect(summary).toHaveLength(81);
    expect(summary?.endsWith('…')).toBe(true);
  });

  it('returns null when the content is only a code fence', () => {
    expect(
      sessionSummary({
        ...base,
        messages: [
          { id: 'a', role: 'assistant', content: '```\ncode\n```', createdAt: 0 },
        ],
      }),
    ).toBeNull();
  });
});

afterEach(() => {
  resetRuntime();
});
