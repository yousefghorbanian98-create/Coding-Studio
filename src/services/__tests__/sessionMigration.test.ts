import { beforeEach, describe, expect, it } from 'vitest';
import {
  SESSIONS_SCHEMA_VERSION,
  SESSIONS_STORAGE_KEY,
  loadSessions,
  saveSessions,
} from '../sessionStorage';
import type { ChatSession } from '@/types/chat';

function write(payload: unknown): void {
  localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(payload));
}

const V1_SESSION = {
  id: 's1',
  title: 'Legacy session',
  createdAt: 1,
  updatedAt: 2,
  modelId: 'studio-sonnet',
  pinned: true,
  messages: [
    { id: 'm1', role: 'user', content: 'hi', createdAt: 1 },
    { id: 'm2', role: 'assistant', content: 'partial', createdAt: 2, streaming: true },
  ],
};

beforeEach(() => {
  localStorage.clear();
});

describe('schema migration', () => {
  it('reads a v1 payload and treats missing archived as not archived', () => {
    write({ version: 1, sessions: [V1_SESSION], activeSessionId: 's1' });
    const loaded = loadSessions();
    expect(loaded?.sessions[0]?.archived).toBeUndefined();
    expect(loaded?.sessions[0]?.pinned).toBe(true);
  });

  it('converts a v1 in-flight reply into an interrupted message', () => {
    write({ version: 1, sessions: [V1_SESSION], activeSessionId: 's1' });
    const message = loadSessions()?.sessions[0]?.messages[1];
    expect(message?.streaming).toBeUndefined();
    expect(message?.stopped).toBe(true);
    expect(message?.interrupted).toBe(true);
    expect(message?.content).toBe('partial');
  });

  it('keeps a plain stopped message from being relabelled as interrupted', () => {
    write({
      version: 1,
      sessions: [
        {
          ...V1_SESSION,
          messages: [
            { id: 'm1', role: 'assistant', content: 'x', createdAt: 1, stopped: true },
          ],
        },
      ],
      activeSessionId: 's1',
    });
    const message = loadSessions()?.sessions[0]?.messages[0];
    expect(message?.stopped).toBe(true);
    expect(message?.interrupted).toBeUndefined();
  });

  it('round-trips the current schema version', () => {
    const session: ChatSession = {
      id: 's1',
      title: 'Current',
      createdAt: 1,
      updatedAt: 2,
      modelId: 'm',
      archived: true,
      messages: [],
    };
    saveSessions([session], 's1');
    const raw = JSON.parse(
      localStorage.getItem(SESSIONS_STORAGE_KEY) ?? '{}',
    ) as { version: number };
    expect(raw.version).toBe(SESSIONS_SCHEMA_VERSION);
    expect(loadSessions()?.sessions[0]?.archived).toBe(true);
  });

  it('falls back to seed data for an unknown future version', () => {
    write({ version: 99, sessions: [V1_SESSION], activeSessionId: 's1' });
    expect(loadSessions()).toBeNull();
  });

  it('never persists a streaming flag', () => {
    saveSessions(
      [
        {
          id: 's1',
          title: 'x',
          createdAt: 1,
          updatedAt: 1,
          modelId: 'm',
          messages: [
            { id: 'm1', role: 'assistant', content: 'y', createdAt: 1, streaming: true },
          ],
        },
      ],
      's1',
    );
    expect(localStorage.getItem(SESSIONS_STORAGE_KEY)).not.toContain('streaming');
    expect(loadSessions()?.sessions[0]?.messages[0]?.interrupted).toBe(true);
  });
});

describe('corrupt storage', () => {
  it('survives invalid JSON', () => {
    localStorage.setItem(SESSIONS_STORAGE_KEY, '{not json');
    expect(loadSessions()).toBeNull();
  });

  it('drops malformed sessions rather than failing the whole load', () => {
    write({
      version: 2,
      sessions: [{ id: 5 }, V1_SESSION],
      activeSessionId: 's1',
    });
    expect(loadSessions()?.sessions).toHaveLength(1);
  });

  it('drops malformed messages inside an otherwise valid session', () => {
    write({
      version: 2,
      sessions: [
        { ...V1_SESSION, messages: [{ id: 'ok', role: 'user', content: 'a', createdAt: 1 }, null, { role: 'nope' }] },
      ],
      activeSessionId: 's1',
    });
    expect(loadSessions()?.sessions[0]?.messages).toHaveLength(1);
  });

  it('repairs an active id that points at a missing session', () => {
    write({ version: 2, sessions: [V1_SESSION], activeSessionId: 'gone' });
    expect(loadSessions()?.activeSessionId).toBe('s1');
  });

  it('is idempotent across repeated loads (StrictMode double init)', () => {
    write({ version: 1, sessions: [V1_SESSION], activeSessionId: 's1' });
    const first = loadSessions();
    const second = loadSessions();
    expect(second?.sessions[0]?.id).toBe(first?.sessions[0]?.id);
    expect(second?.sessions).toHaveLength(first?.sessions.length ?? 0);
  });
});
