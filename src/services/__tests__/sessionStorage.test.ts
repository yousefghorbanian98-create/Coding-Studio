import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SESSIONS_STORAGE_KEY,
  clearSessions,
  loadSessions,
  saveSessions,
} from '../sessionStorage';
import type { ChatSession } from '@/types/chat';

function session(overrides: Partial<ChatSession> = {}): ChatSession {
  return {
    id: 's1',
    title: 'A session',
    createdAt: 1000,
    updatedAt: 2000,
    modelId: 'studio-sonnet',
    messages: [
      { id: 'm1', role: 'user', content: 'hi', createdAt: 1000, tokens: 1 },
      {
        id: 'm2',
        role: 'assistant',
        content: 'hello',
        createdAt: 1001,
        modelId: 'studio-sonnet',
      },
    ],
    ...overrides,
  };
}

describe('session persistence', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips sessions through storage', () => {
    saveSessions([session()], 's1');
    const loaded = loadSessions();
    expect(loaded?.activeSessionId).toBe('s1');
    expect(loaded?.sessions).toHaveLength(1);
    expect(loaded?.sessions[0]?.messages).toHaveLength(2);
    expect(loaded?.sessions[0]?.title).toBe('A session');
  });

  it('returns null when nothing is stored', () => {
    expect(loadSessions()).toBeNull();
  });

  it('returns null for corrupt JSON instead of throwing', () => {
    localStorage.setItem(SESSIONS_STORAGE_KEY, '{not json');
    expect(loadSessions()).toBeNull();
  });

  it('rejects a payload from a different schema version', () => {
    localStorage.setItem(
      SESSIONS_STORAGE_KEY,
      JSON.stringify({ version: 999, sessions: [session()], activeSessionId: 's1' }),
    );
    expect(loadSessions()).toBeNull();
  });

  it('drops malformed sessions and messages', () => {
    localStorage.setItem(
      SESSIONS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        activeSessionId: 's1',
        sessions: [
          session(),
          { id: 42 },
          null,
          { id: 'bad', title: 'x', messages: [{ id: 'm', role: 'wizard', content: 'y' }] },
        ],
      }),
    );
    const loaded = loadSessions();
    expect(loaded?.sessions).toHaveLength(2);
    // The session with an invalid role keeps the session but drops the message.
    expect(loaded?.sessions[1]?.messages).toHaveLength(0);
  });

  it('never persists a message as still streaming', () => {
    saveSessions(
      [
        session({
          messages: [
            {
              id: 'm1',
              role: 'assistant',
              content: 'partial',
              createdAt: 1,
              streaming: true,
            },
          ],
        }),
      ],
      's1',
    );
    const loaded = loadSessions();
    const message = loaded?.sessions[0]?.messages[0];
    expect(message?.streaming).toBeUndefined();
    expect(message?.stopped).toBe(true);
  });

  it('falls back to the first session when the active id is unknown', () => {
    saveSessions([session()], 'does-not-exist');
    expect(loadSessions()?.activeSessionId).toBe('s1');
  });

  it('treats an empty session list as nothing stored', () => {
    saveSessions([], 'x');
    expect(loadSessions()).toBeNull();
  });

  it('swallows storage write failures', () => {
    const failing = {
      setItem: vi.fn(() => {
        throw new Error('QuotaExceeded');
      }),
      getItem: vi.fn(() => null),
      removeItem: vi.fn(),
    } as unknown as Storage;
    expect(() => saveSessions([session()], 's1', failing)).not.toThrow();
  });

  it('swallows storage read failures', () => {
    const failing = {
      getItem: vi.fn(() => {
        throw new Error('SecurityError');
      }),
    } as unknown as Storage;
    expect(loadSessions(failing)).toBeNull();
  });

  it('clears stored sessions', () => {
    saveSessions([session()], 's1');
    clearSessions();
    expect(loadSessions()).toBeNull();
  });
});
