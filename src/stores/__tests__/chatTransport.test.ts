import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMockSessions } from '@/mocks/sessions';
import { selectActiveSession, useChatStore } from '../chat';
import {
  TransportError,
  resetTransport,
  setTransport,
  type ChatTransport,
  type CompletionRequest,
  type CompletionResult,
  type StreamChunk,
} from '@/services/transport';
import { loadSessions } from '@/services/sessionStorage';

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
    errorKey: null,
  });
}

/** Transport that emits fixed chunks, or fails with a chosen error. */
class StubTransport implements ChatTransport {
  readonly id = 'stub';
  seenModel = '';
  seenHistory: string[] = [];

  constructor(
    private readonly chunks: string[],
    private readonly failWith?: TransportError,
  ) {}

  async complete(
    request: CompletionRequest,
    onChunk: (chunk: StreamChunk) => void,
  ): Promise<CompletionResult> {
    this.seenModel = request.modelId;
    this.seenHistory = request.messages.map((m) => m.content);
    if (this.failWith) throw this.failWith;

    let text = '';
    for (const delta of this.chunks) {
      if (request.signal.aborted) break;
      text += delta;
      onChunk({ delta });
      await Promise.resolve();
    }
    return {
      text,
      tokens: text.length,
      latencyMs: 5,
      aborted: request.signal.aborted,
    };
  }
}

describe('chat store transport integration', () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();
  });
  afterEach(() => resetTransport());

  it('streams through the injected transport', async () => {
    setTransport(new StubTransport(['Real ', 'backend ', 'reply']));
    useChatStore.getState().createSession();
    await useChatStore.getState().sendMessage('hello');

    const assistant = selectActiveSession(useChatStore.getState())?.messages[1];
    expect(assistant?.content).toBe('Real backend reply');
    expect(assistant?.streaming).toBe(false);
    expect(useChatStore.getState().errorKey).toBeNull();
  });

  it('passes the model and conversation history to the transport', async () => {
    const stub = new StubTransport(['ok']);
    setTransport(stub);
    useChatStore.getState().createSession();
    useChatStore.getState().setModel('studio-opus');
    await useChatStore.getState().sendMessage('first question');

    expect(stub.seenModel).toBe('studio-opus');
    expect(stub.seenHistory).toContain('first question');
  });

  it('surfaces a transport failure as a translatable error key', async () => {
    setTransport(
      new StubTransport([], new TransportError('unauthorized', 'nope', 401)),
    );
    useChatStore.getState().createSession();
    await useChatStore.getState().sendMessage('hello');

    expect(useChatStore.getState().errorKey).toBe('errors.unauthorized');
    expect(useChatStore.getState().isStreaming).toBe(false);
    const assistant = selectActiveSession(useChatStore.getState())?.messages[1];
    expect(assistant?.stopped).toBe(true);
  });

  it('maps each error kind to its own message key', async () => {
    const cases = [
      ['network', 'errors.network'],
      ['timeout', 'errors.timeout'],
      ['rate-limited', 'errors.rateLimited'],
      ['server', 'errors.server'],
    ] as const;

    for (const [kind, key] of cases) {
      resetStore();
      setTransport(new StubTransport([], new TransportError(kind, 'x')));
      useChatStore.getState().createSession();
      await useChatStore.getState().sendMessage('hello');
      expect(useChatStore.getState().errorKey).toBe(key);
    }
  });

  it('dismisses the error', async () => {
    setTransport(new StubTransport([], new TransportError('server', 'x')));
    useChatStore.getState().createSession();
    await useChatStore.getState().sendMessage('hello');
    expect(useChatStore.getState().errorKey).not.toBeNull();

    useChatStore.getState().dismissError();
    expect(useChatStore.getState().errorKey).toBeNull();
  });

  it('retries the last prompt after a failure', async () => {
    setTransport(new StubTransport([], new TransportError('network', 'x')));
    useChatStore.getState().createSession();
    await useChatStore.getState().sendMessage('retry me');
    expect(useChatStore.getState().errorKey).toBe('errors.network');

    setTransport(new StubTransport(['recovered']));
    await useChatStore.getState().retryLast();

    const messages = selectActiveSession(useChatStore.getState())?.messages ?? [];
    expect(useChatStore.getState().errorKey).toBeNull();
    expect(messages.filter((m) => m.role === 'user')).toHaveLength(1);
    expect(messages.at(-1)?.content).toBe('recovered');
  });

  it('does nothing on retry when there is no user message', async () => {
    useChatStore.getState().createSession();
    await useChatStore.getState().retryLast();
    expect(selectActiveSession(useChatStore.getState())?.messages).toHaveLength(0);
  });

  it('still honours the explicit mock options used by existing tests', async () => {
    setTransport(new StubTransport(['should not be used']));
    useChatStore.getState().createSession();
    await useChatStore.getState().sendMessage('hi', { delayMs: 0, seed: 0 });

    const assistant = selectActiveSession(useChatStore.getState())?.messages[1];
    expect(assistant?.content).not.toBe('should not be used');
    expect(assistant?.content.length).toBeGreaterThan(20);
  });
});

describe('chat store persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();
  });
  afterEach(() => resetTransport());

  it('persists a completed conversation', async () => {
    setTransport(new StubTransport(['stored']));
    const id = useChatStore.getState().createSession();
    await useChatStore.getState().sendMessage('remember this');

    const stored = loadSessions();
    const session = stored?.sessions.find((s) => s.id === id);
    expect(session?.messages.map((m) => m.content)).toEqual([
      'remember this',
      'stored',
    ]);
  });

  it('persists session creation, rename and deletion', () => {
    const id = useChatStore.getState().createSession();
    expect(loadSessions()?.sessions.some((s) => s.id === id)).toBe(true);

    useChatStore.getState().renameSession(id, 'Renamed');
    expect(
      loadSessions()?.sessions.find((s) => s.id === id)?.title,
    ).toBe('Renamed');

    useChatStore.getState().deleteSession(id);
    expect(loadSessions()?.sessions.some((s) => s.id === id)).toBe(false);
  });

  it('persists the active session id', () => {
    const first = useChatStore.getState().sessions[1]!.id;
    useChatStore.getState().selectSession(first);
    expect(loadSessions()?.activeSessionId).toBe(first);
  });

  it('persists a stopped partial reply', async () => {
    setTransport(new StubTransport(Array.from({ length: 50 }, () => 'x ')));
    useChatStore.getState().createSession();
    const pending = useChatStore.getState().sendMessage('long one');
    useChatStore.getState().stopStreaming();
    await pending;

    const stored = loadSessions();
    const assistant = stored?.sessions
      .flatMap((s) => s.messages)
      .find((m) => m.role === 'assistant' && m.stopped);
    expect(assistant?.streaming).toBeUndefined();
  });
});
