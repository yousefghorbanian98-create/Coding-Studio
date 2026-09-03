/**
 * Chat store behaviour that used to be driven through the legacy transport.
 *
 * The transport was removed in the A-1 fix, so these exercise the same
 * user-visible behaviour — error surfacing, retry, dismissal and persistence —
 * against the runtime bridge, which is now the only path.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useChatStore } from '@/stores/chat';
import { useRunStore, connectRunStore } from '@/stores/run';
import { createMockSessions } from '@/mocks/sessions';
import {
  asMessageId,
  asRunId,
  asSessionId,
  resetRuntime,
  setRuntime,
  type RunHandle,
  type SendMessageInput,
  type StudioRuntimeBridge,
  type StudioRuntimeEvent,
  type RuntimeErrorKind,
} from '@/services/runtime';
import { SESSIONS_STORAGE_KEY, loadSessions } from '@/services/sessionStorage';

class ScriptedRuntime implements StudioRuntimeBridge {
  readonly sent: SendMessageInput[] = [];
  private listeners = new Set<(event: StudioRuntimeEvent) => void>();

  emit(event: StudioRuntimeEvent): void {
    for (const listener of [...this.listeners]) listener(event);
  }

  subscribe(listener: (event: StudioRuntimeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  sendMessage(input: SendMessageInput): Promise<RunHandle> {
    this.sent.push(input);
    return Promise.resolve({
      runId: asRunId('run-1'),
      sessionId: input.sessionId,
    });
  }

  cancelRun = (): Promise<void> => Promise.resolve();
  getHealth = (): Promise<never> => Promise.reject(new Error('unused'));
  getCapabilities = (): Promise<never> => Promise.reject(new Error('unused'));
  listProviders = (): Promise<never[]> => Promise.resolve([]);
  listModels = (): Promise<never[]> => Promise.resolve([]);
  listSessions = (): Promise<never[]> => Promise.resolve([]);
  createSession = (): Promise<never> => Promise.reject(new Error('unused'));
  resumeSession = (): Promise<never> => Promise.reject(new Error('unused'));
  renameSession = (): Promise<void> => Promise.resolve();
  archiveSession = (): Promise<void> => Promise.resolve();
  deleteSession = (): Promise<void> => Promise.resolve();
  respondToApproval = (): Promise<void> => Promise.resolve();
  dispose(): void {
    this.listeners.clear();
  }
}

let runtime: ScriptedRuntime;
let disconnect: () => void;
let sessionId: string;

/** Streams a complete assistant reply through the bridge. */
function streamReply(text: string): void {
  const sid = asSessionId(sessionId);
  const messageId = asMessageId('m-1');
  runtime.emit({ type: 'run.started', runId: asRunId('run-1'), sessionId: sid, mode: 'agent' });
  runtime.emit({
    type: 'message.started',
    runId: asRunId('run-1'),
    sessionId: sid,
    messageId,
    role: 'assistant',
  });
  runtime.emit({
    type: 'message.delta',
    runId: asRunId('run-1'),
    sessionId: sid,
    messageId,
    delta: text,
  });
  runtime.emit({
    type: 'message.completed',
    runId: asRunId('run-1'),
    sessionId: sid,
    messageId,
  });
  runtime.emit({ type: 'run.completed', runId: asRunId('run-1'), sessionId: sid });
}

function failRun(kind: RuntimeErrorKind): void {
  const sid = asSessionId(sessionId);
  runtime.emit({ type: 'run.started', runId: asRunId('run-1'), sessionId: sid, mode: 'agent' });
  runtime.emit({
    type: 'run.failed',
    runId: asRunId('run-1'),
    sessionId: sid,
    error: { kind, message: 'failed' },
  });
}

beforeEach(() => {
  globalThis.localStorage?.clear();
  runtime = new ScriptedRuntime();
  setRuntime(runtime);
  useRunStore.getState().reset();
  const sessions = createMockSessions();
  sessionId = sessions[0]?.id ?? '';
  useChatStore.setState({
    sessions,
    activeSessionId: sessionId,
    isStreaming: false,
    errorKey: null,
    activeRun: null,
  });
  disconnect = connectRunStore();
});

afterEach(() => {
  disconnect();
  resetRuntime();
});

describe('chat store over the runtime bridge', () => {
  it('streams the reply the runtime emitted', async () => {
    await useChatStore.getState().sendMessage('Hello');
    streamReply('Real bridge reply');

    const session = useChatStore
      .getState()
      .sessions.find((s) => s.id === sessionId);
    expect(session?.messages.at(-1)?.content).toBe('Real bridge reply');
  });

  it('passes the prompt and model to the runtime', async () => {
    useChatStore.setState({ modelId: 'studio-opus' });
    await useChatStore.getState().sendMessage('Question?');

    expect(runtime.sent).toHaveLength(1);
    expect(runtime.sent[0]?.content).toBe('Question?');
    expect(runtime.sent[0]?.modelId).toBe('studio-opus');
  });

  it('surfaces a runtime failure as a translatable error key', async () => {
    await useChatStore.getState().sendMessage('Hello');
    failRun('provider-unavailable');

    expect(useChatStore.getState().errorKey).toBe(
      'runtime.errors.provider-unavailable',
    );
  });

  it.each([
    'runtime-unavailable',
    'authentication-required',
    'rate-limited',
    'timeout',
  ] as const)('maps %s to its own message key', async (kind) => {
    await useChatStore.getState().sendMessage('Hello');
    failRun(kind);

    expect(useChatStore.getState().errorKey).toBe(`runtime.errors.${kind}`);
  });

  it('dismisses the error', async () => {
    await useChatStore.getState().sendMessage('Hello');
    failRun('timeout');
    useChatStore.getState().dismissError();

    expect(useChatStore.getState().errorKey).toBeNull();
  });

  it('retries the last prompt after a failure', async () => {
    await useChatStore.getState().sendMessage('Retry me');
    failRun('timeout');

    await useChatStore.getState().retryLast();

    expect(runtime.sent).toHaveLength(2);
    expect(runtime.sent[1]?.content).toBe('Retry me');
  });

  it('does nothing on retry when there is no user message', async () => {
    useChatStore.setState({
      sessions: [
        {
          id: 'empty',
          title: 'Empty',
          createdAt: 1,
          updatedAt: 1,
          modelId: 'studio-sonnet',
          messages: [],
        },
      ],
      activeSessionId: 'empty',
    });

    await useChatStore.getState().retryLast();
    expect(runtime.sent).toHaveLength(0);
  });
});

describe('persistence', () => {
  it('persists a completed conversation', async () => {
    await useChatStore.getState().sendMessage('Persist me');
    streamReply('Stored reply');

    const restored = loadSessions();
    const target = restored?.sessions.find((s) => s.id === sessionId);
    expect(target?.messages.at(-1)?.content).toBe('Stored reply');
  });

  it('persists session creation, rename and deletion', () => {
    const created = useChatStore.getState().createSession();
    useChatStore.getState().renameSession(created, 'Renamed');
    expect(
      loadSessions()?.sessions.find((s) => s.id === created)?.title,
    ).toBe('Renamed');

    useChatStore.getState().deleteSession(created);
    expect(loadSessions()?.sessions.some((s) => s.id === created)).toBe(false);
  });

  it('persists the active session id', () => {
    const created = useChatStore.getState().createSession();
    expect(loadSessions()?.activeSessionId).toBe(created);
  });

  it('persists a stopped partial reply', async () => {
    await useChatStore.getState().sendMessage('Stop me');
    const sid = asSessionId(sessionId);
    const messageId = asMessageId('m-1');
    runtime.emit({ type: 'run.started', runId: asRunId('run-1'), sessionId: sid, mode: 'agent' });
    runtime.emit({
      type: 'message.started',
      runId: asRunId('run-1'),
      sessionId: sid,
      messageId,
      role: 'assistant',
    });
    runtime.emit({
      type: 'message.delta',
      runId: asRunId('run-1'),
      sessionId: sid,
      messageId,
      delta: 'partial text',
    });
    runtime.emit({ type: 'run.cancelled', runId: asRunId('run-1'), sessionId: sid });

    const stored = globalThis.localStorage.getItem(SESSIONS_STORAGE_KEY) ?? '';
    expect(stored).toContain('partial text');

    const restored = loadSessions();
    const last = restored?.sessions
      .find((s) => s.id === sessionId)
      ?.messages.at(-1);
    expect(last?.stopped).toBe(true);
  });
});
