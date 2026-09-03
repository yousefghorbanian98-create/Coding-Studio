/**
 * A-1 regression suite — the visible transcript must be driven by runtime
 * events, not by a second transport.
 *
 * Every test here was first run against the pre-fix implementation (where
 * `chat.ts` called both `getRuntime().sendMessage` and `transport.complete`)
 * and confirmed to fail. See docs/reviews/frontend-final-adversarial-review.md
 * for the recorded red-to-green evidence.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { useChatStore, selectActiveSession } from '@/stores/chat';
import { useRunStore, connectRunStore } from '@/stores/run';
import {
  asRunId,
  asSessionId,
  asMessageId,
  setRuntime,
  resetRuntime,
  type StudioRuntimeBridge,
  type StudioRuntimeEvent,
  type SendMessageInput,
  type RunHandle,
} from '@/services/runtime';
import { SESSIONS_STORAGE_KEY, loadSessions } from '@/services/sessionStorage';
import type { ChatSession } from '@/types/chat';

const SENTINEL = 'ZQX-SENTINEL-4417';
const SESSION = 'sess-proj';
const OTHER_SESSION = 'sess-other';

/**
 * A bridge that emits exactly what a test asks for. Nothing is scheduled, so
 * ordering is fully deterministic and no timers can leak between tests.
 */
class ScriptedRuntime implements StudioRuntimeBridge {
  readonly sent: SendMessageInput[] = [];
  readonly cancelled: string[] = [];
  private listeners = new Set<(event: StudioRuntimeEvent) => void>();
  private seq = 0;

  emit(event: StudioRuntimeEvent): void {
    for (const listener of [...this.listeners]) listener(event);
  }

  subscribe(listener: (event: StudioRuntimeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  listenerCount(): number {
    return this.listeners.size;
  }

  sendMessage(input: SendMessageInput): Promise<RunHandle> {
    this.sent.push(input);
    this.seq += 1;
    return Promise.resolve({
      runId: asRunId(`run-${String(this.seq)}`),
      sessionId: input.sessionId,
    });
  }

  cancelRun(runId: string): Promise<void> {
    this.cancelled.push(runId);
    return Promise.resolve();
  }

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

function session(id: string, title: string): ChatSession {
  return {
    id,
    title,
    createdAt: 1000,
    updatedAt: 1000,
    modelId: 'studio-sonnet',
    messages: [],
  };
}

/** Drives a full successful run for the active session. */
async function streamOnce(text: string): Promise<{ runId: string }> {
  await useChatStore.getState().sendMessage('Say something');
  const runId = runtime.sent.length > 0 ? `run-${String(runtime.sent.length)}` : 'run-1';
  const sessionId = asSessionId(SESSION);
  const messageId = asMessageId('m-rt-1');

  runtime.emit({
    type: 'run.started',
    runId: asRunId(runId),
    sessionId,
    mode: 'agent',
  });
  runtime.emit({
    type: 'message.started',
    runId: asRunId(runId),
    sessionId,
    messageId,
    role: 'assistant',
  });
  runtime.emit({
    type: 'message.delta',
    runId: asRunId(runId),
    sessionId,
    messageId,
    delta: text,
  });
  runtime.emit({
    type: 'message.completed',
    runId: asRunId(runId),
    sessionId,
    messageId,
    tokens: 7,
  });
  runtime.emit({ type: 'run.completed', runId: asRunId(runId), sessionId });
  return { runId };
}

function assistantMessages(): { content: string }[] {
  const active = selectActiveSession(useChatStore.getState());
  return (active?.messages ?? []).filter((m) => m.role === 'assistant');
}

beforeEach(() => {
  globalThis.localStorage?.clear();
  runtime = new ScriptedRuntime();
  setRuntime(runtime);
  useRunStore.getState().reset();
  useChatStore.setState({
    sessions: [session(SESSION, 'Projection'), session(OTHER_SESSION, 'Other')],
    activeSessionId: SESSION,
    isStreaming: false,
    errorKey: null,
  });
  disconnect = connectRunStore();
});

afterEach(() => {
  disconnect();
  resetRuntime();
});

describe('A-1 · runtime events drive the visible transcript', () => {
  // Test 1
  it('renders a sentinel that only ever existed in a message.delta', async () => {
    await streamOnce(SENTINEL);

    const texts = assistantMessages().map((m) => m.content);
    expect(texts.join('')).toContain(SENTINEL);
  });

  // Test 2
  it('persists the sentinel so it survives a reload', async () => {
    await streamOnce(SENTINEL);

    const raw = globalThis.localStorage.getItem(SESSIONS_STORAGE_KEY) ?? '';
    expect(raw).toContain(SENTINEL);

    const restored = loadSessions();
    const target = restored?.sessions.find((s) => s.id === SESSION);
    expect(
      target?.messages.some((m) => m.content.includes(SENTINEL)),
    ).toBe(true);
  });

  // Test 3
  it('invokes the runtime bridge exactly once per user send', async () => {
    await useChatStore.getState().sendMessage('One send');
    expect(runtime.sent).toHaveLength(1);
  });

  // Test 12
  it('correlates plans and tools with the same run as the visible text', async () => {
    const { runId } = await streamOnce(SENTINEL);
    expect(useRunStore.getState().runId).toBe(runId);
    expect(useRunStore.getState().sessionId).toBe(SESSION);
    expect(assistantMessages().map((m) => m.content).join('')).toContain(
      SENTINEL,
    );
  });
});

describe('A-1 · persistence is exactly once', () => {
  // Test 5
  it('persists one assistant message for one completed run', async () => {
    await streamOnce(SENTINEL);
    expect(assistantMessages()).toHaveLength(1);
  });

  // Test 6
  it('ignores a duplicated completion event', async () => {
    await streamOnce(SENTINEL);

    runtime.emit({
      type: 'message.completed',
      runId: asRunId('run-1'),
      sessionId: asSessionId(SESSION),
      messageId: asMessageId('m-rt-1'),
      tokens: 7,
    });
    runtime.emit({
      type: 'run.completed',
      runId: asRunId('run-1'),
      sessionId: asSessionId(SESSION),
    });

    expect(assistantMessages()).toHaveLength(1);
    expect(assistantMessages()[0]?.content).toBe(SENTINEL);
  });
});

describe('A-1 · cancellation', () => {
  // Test 7
  it('keeps partial text and blocks deltas that arrive afterwards', async () => {
    await useChatStore.getState().sendMessage('Long one');
    const sessionId = asSessionId(SESSION);
    const messageId = asMessageId('m-rt-1');

    runtime.emit({
      type: 'run.started',
      runId: asRunId('run-1'),
      sessionId,
      mode: 'agent',
    });
    runtime.emit({
      type: 'message.started',
      runId: asRunId('run-1'),
      sessionId,
      messageId,
      role: 'assistant',
    });
    runtime.emit({
      type: 'message.delta',
      runId: asRunId('run-1'),
      sessionId,
      messageId,
      delta: 'PARTIAL-',
    });

    useChatStore.getState().stopStreaming();
    runtime.emit({
      type: 'run.cancelled',
      runId: asRunId('run-1'),
      sessionId,
    });

    runtime.emit({
      type: 'message.delta',
      runId: asRunId('run-1'),
      sessionId,
      messageId,
      delta: 'LATE-TEXT',
    });

    const text = assistantMessages().map((m) => m.content).join('');
    expect(text).toContain('PARTIAL-');
    expect(text).not.toContain('LATE-TEXT');
  });

  // Test 11 (cancellation path only routes through the bridge)
  it('cancels through the runtime bridge', async () => {
    await useChatStore.getState().sendMessage('Long one');
    runtime.emit({
      type: 'run.started',
      runId: asRunId('run-1'),
      sessionId: asSessionId(SESSION),
      mode: 'agent',
    });

    useChatStore.getState().stopStreaming();
    expect(runtime.cancelled).toContain('run-1');
  });
});

describe('A-1 · correlation and isolation', () => {
  // Test 8
  it('rejects a delta addressed to another session', async () => {
    await streamOnce('GOOD');

    runtime.emit({
      type: 'message.delta',
      runId: asRunId('run-1'),
      sessionId: asSessionId(OTHER_SESSION),
      messageId: asMessageId('m-rt-1'),
      delta: 'LEAKED',
    });

    const all = useChatStore
      .getState()
      .sessions.flatMap((s) => s.messages.map((m) => m.content))
      .join('');
    expect(all).not.toContain('LEAKED');
  });

  // Test 9
  it('rejects a delta addressed to another run', async () => {
    await streamOnce('GOOD');

    runtime.emit({
      type: 'message.delta',
      runId: asRunId('run-999'),
      sessionId: asSessionId(SESSION),
      messageId: asMessageId('m-rt-1'),
      delta: 'WRONGRUN',
    });

    const all = useChatStore
      .getState()
      .sessions.flatMap((s) => s.messages.map((m) => m.content))
      .join('');
    expect(all).not.toContain('WRONGRUN');
  });

  // Test 10
  it('does not leak text into another session when the user switches', async () => {
    await useChatStore.getState().sendMessage('Start');
    const sessionId = asSessionId(SESSION);
    const messageId = asMessageId('m-rt-1');

    runtime.emit({
      type: 'run.started',
      runId: asRunId('run-1'),
      sessionId,
      mode: 'agent',
    });
    runtime.emit({
      type: 'message.started',
      runId: asRunId('run-1'),
      sessionId,
      messageId,
      role: 'assistant',
    });

    // User switches away mid-stream.
    useChatStore.getState().selectSession(OTHER_SESSION);

    runtime.emit({
      type: 'message.delta',
      runId: asRunId('run-1'),
      sessionId,
      messageId,
      delta: SENTINEL,
    });

    const other = useChatStore
      .getState()
      .sessions.find((s) => s.id === OTHER_SESSION);
    expect(
      other?.messages.some((m) => m.content.includes(SENTINEL)),
    ).toBe(false);

    // It must still land on the session that actually started the run.
    const origin = useChatStore
      .getState()
      .sessions.find((s) => s.id === SESSION);
    expect(
      origin?.messages.some((m) => m.content.includes(SENTINEL)),
    ).toBe(true);
  });
});

describe('A-1 · failure and recovery', () => {
  // Test 11
  it('surfaces a recoverable error when the run fails', async () => {
    await useChatStore.getState().sendMessage('Boom');
    const sessionId = asSessionId(SESSION);

    runtime.emit({
      type: 'run.started',
      runId: asRunId('run-1'),
      sessionId,
      mode: 'agent',
    });
    runtime.emit({
      type: 'run.failed',
      runId: asRunId('run-1'),
      sessionId,
      error: {
        kind: 'provider-unavailable',
        message: 'provider down',
      },
    });

    expect(useChatStore.getState().errorKey).not.toBeNull();
    expect(useChatStore.getState().isStreaming).toBe(false);
    // The session must remain usable rather than wedged mid-stream.
    const streaming = useChatStore
      .getState()
      .sessions.flatMap((s) => s.messages)
      .filter((m) => m.streaming === true);
    expect(streaming).toEqual([]);
  });
});

describe('A-1 · StrictMode safety', () => {
  // Test 13
  it('does not duplicate the transcript across mount/unmount/remount', async () => {
    // Simulate React StrictMode running the effect twice.
    const second = connectRunStore();
    second();

    await streamOnce(SENTINEL);

    const texts = assistantMessages().map((m) => m.content);
    expect(texts).toHaveLength(1);
    expect(texts[0]).toBe(SENTINEL);
  });

  it('leaves exactly one live subscription', () => {
    const extra = connectRunStore();
    extra();
    expect(runtime.listenerCount()).toBe(1);
  });
});

describe('A-1 · the legacy transport is gone', () => {
  const SRC = join(process.cwd(), 'src');

  function walk(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return /\.tsx?$/.test(entry.name) ? [full] : [];
    });
  }

  // Test 14
  it('has no src/services/transport directory', () => {
    expect(existsSync(join(SRC, 'services', 'transport'))).toBe(false);
  });

  it('has no source file importing a transport module', () => {
    const offenders = walk(SRC).filter((file) => {
      // This guard names the forbidden symbols, so it must exempt itself.
      if (file.endsWith('transcriptProjection.test.ts')) return false;
      const text = readFileSync(file, 'utf8');
      return (
        /from\s+['"][^'"]*services\/transport/.test(text) ||
        /\b(getTransport|setTransport|resetTransport|MockTransport|HttpTransport)\b/.test(
          text,
        )
      );
    });
    expect(offenders).toEqual([]);
  });
});
