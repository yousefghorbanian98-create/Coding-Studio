import { beforeEach, describe, expect, it } from 'vitest';
import { filterSessions, useChatStore } from '../chat';
import type { ChatSession } from '@/types/chat';

function session(overrides: Partial<ChatSession>): ChatSession {
  return {
    id: 'a',
    title: 'Session A',
    createdAt: 1000,
    updatedAt: 1000,
    modelId: 'studio-sonnet',
    messages: [],
    ...overrides,
  };
}

function seed(sessions: ChatSession[]): void {
  useChatStore.setState({
    sessions,
    activeSessionId: sessions[0]?.id ?? '',
    filter: '',
    showArchived: false,
    isStreaming: false,

    selectedMessageId: null,
  });
}

beforeEach(() => {
  seed([
    session({ id: 'a', title: 'Alpha', updatedAt: 3000 }),
    session({ id: 'b', title: 'Beta', updatedAt: 2000 }),
    session({ id: 'c', title: 'Gamma', updatedAt: 1000, archived: true }),
  ]);
});

const byId = (id: string): ChatSession | undefined =>
  useChatStore.getState().sessions.find((s) => s.id === id);

describe('pinning', () => {
  it('toggles the pinned flag', () => {
    useChatStore.getState().togglePinned('b');
    expect(byId('b')?.pinned).toBe(true);
    useChatStore.getState().togglePinned('b');
    expect(byId('b')?.pinned).toBe(false);
  });

  it('sorts pinned sessions above more recent unpinned ones', () => {
    useChatStore.getState().togglePinned('b');
    const order = filterSessions(useChatStore.getState().sessions, '').map(
      (s) => s.id,
    );
    expect(order).toEqual(['b', 'a']);
  });
});

describe('archiving', () => {
  it('hides archived sessions from the active list', () => {
    const active = filterSessions(useChatStore.getState().sessions, '');
    expect(active.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('lists only archived sessions when asked', () => {
    const archived = filterSessions(useChatStore.getState().sessions, '', true);
    expect(archived.map((s) => s.id)).toEqual(['c']);
  });

  it('unpins a session when it is archived', () => {
    useChatStore.getState().togglePinned('a');
    useChatStore.getState().setArchived('a', true);
    expect(byId('a')?.pinned).toBe(false);
    expect(byId('a')?.archived).toBe(true);
  });

  it('moves the selection away from an archived active session', () => {
    useChatStore.getState().setArchived('a', true);
    expect(useChatStore.getState().activeSessionId).toBe('b');
  });

  it('restores an archived session back into the active list', () => {
    useChatStore.getState().setArchived('c', false);
    const active = filterSessions(useChatStore.getState().sessions, '');
    expect(active.map((s) => s.id)).toContain('c');
  });

  it('keeps searching within the current scope only', () => {
    const sessions = useChatStore.getState().sessions;
    expect(filterSessions(sessions, 'gamma')).toEqual([]);
    expect(filterSessions(sessions, 'gamma', true)).toHaveLength(1);
  });
});

describe('duplication', () => {
  it('copies the transcript under a new id and title', () => {
    seed([
      session({
        id: 'a',
        title: 'Alpha',
        messages: [{ id: 'm1', role: 'user', content: 'hi', createdAt: 1 }],
      }),
    ]);
    const id = useChatStore.getState().duplicateSession('a');
    expect(id).not.toBeNull();
    const copy = byId(id!);
    expect(copy?.title).toBe('Alpha (copy)');
    expect(copy?.messages).toHaveLength(1);
    expect(copy?.messages[0]?.id).not.toBe('m1');
  });

  it('selects the duplicate and never carries pin or archive state over', () => {
    useChatStore.getState().togglePinned('a');
    const id = useChatStore.getState().duplicateSession('a');
    expect(useChatStore.getState().activeSessionId).toBe(id);
    expect(byId(id!)?.pinned).toBe(false);
    expect(byId(id!)?.archived).toBe(false);
  });

  it('returns null for an unknown session instead of throwing', () => {
    expect(useChatStore.getState().duplicateSession('nope')).toBeNull();
  });
});
