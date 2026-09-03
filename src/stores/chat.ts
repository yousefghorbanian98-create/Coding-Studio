import { create } from 'zustand';
import type { ChatMessage, ChatSession } from '@/types/chat';
import { createMockSessions } from '@/mocks/sessions';
import {
  DEFAULT_MODEL_ID,
  asSessionId,
  getRuntime,
  type SendMessageInput,
  type StudioRuntimeEvent,
} from '@/services/runtime';
import { useRunStore, setChatProjection } from './run';
import { useRuntimeStore } from './runtime';
import { estimateTokens } from '@/lib/tokens';
import {
  loadSessions,
  saveSessions,
  type LoadedSessions,
} from '@/services/sessionStorage';

let counter = 0;
export function createId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}

export interface ChatState {
  sessions: ChatSession[];
  activeSessionId: string;
  modelId: string;
  isStreaming: boolean;
  selectedMessageId: string | null;
  filter: string;
  /** When true the sidebar lists archived sessions instead of active ones. */
  showArchived: boolean;
  setShowArchived: (showArchived: boolean) => void;
  /** i18n key of the last runtime failure, or null. */
  errorKey: string | null;
  /** Correlation for the run currently projected into the transcript. */
  activeRun: {
    runId: string;
    sessionId: string;
    /** Runtime message id -> local ChatMessage id. */
    messageIds: Record<string, string>;
    /** Message ids already finalised, so a duplicate completion is a no-op. */
    completed: string[];
  } | null;

  setFilter: (filter: string) => void;
  setModel: (modelId: string) => void;
  selectSession: (id: string) => void;
  selectMessage: (id: string | null) => void;
  createSession: () => string;
  deleteSession: (id: string) => void;
  renameSession: (id: string, title: string) => void;
  togglePinned: (id: string) => void;
  setArchived: (id: string, archived: boolean) => void;
  duplicateSession: (id: string) => string | null;
  clearSession: (id?: string) => void;
  /** Replaces the whole workspace. Used by the Scenario Lab and tests. */
  loadSessions: (sessions: ChatSession[]) => void;
  sendMessage: (content: string) => Promise<void>;
  /**
   * Authoritative projection of runtime events onto the visible transcript.
   * This is the only writer of assistant text.
   */
  applyRuntimeEvent: (event: StudioRuntimeEvent) => void;
  stopStreaming: () => void;
  retryLast: () => Promise<void>;
  dismissError: () => void;
}

const restored: LoadedSessions | null = loadSessions();
const initialSessions = restored?.sessions ?? createMockSessions();
const initialActiveId =
  restored?.activeSessionId ?? initialSessions[0]?.id ?? '';

export function selectActiveSession(state: ChatState): ChatSession | undefined {
  return state.sessions.find((s) => s.id === state.activeSessionId);
}

export function filterSessions(
  sessions: ChatSession[],
  filter: string,
  showArchived = false,
): ChatSession[] {
  const q = filter.trim().toLowerCase();
  const scoped = sessions.filter(
    (s) => (s.archived === true) === showArchived,
  );
  const matched = q
    ? scoped.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.messages.some((m) => m.content.toLowerCase().includes(q)),
      )
    : scoped;
  return [...matched].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
}

export const useChatStore = create<ChatState>()((set, get) => ({
  sessions: initialSessions,
  activeSessionId: initialActiveId,
  modelId:
    initialSessions.find((s) => s.id === initialActiveId)?.modelId ??
    DEFAULT_MODEL_ID,
  isStreaming: false,
  selectedMessageId: null,
  filter: '',
  showArchived: false,
  errorKey: null,
  activeRun: null,

  setFilter: (filter) => set({ filter }),

  setShowArchived: (showArchived) => set({ showArchived }),

  togglePinned: (id) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, pinned: s.pinned !== true } : s,
      ),
    }));
    persist();
  },

  setArchived: (id, archived) => {
    set((state) => {
      const sessions = state.sessions.map((s) =>
        // Archiving also unpins: a pinned archive would sort above live work.
        s.id === id ? { ...s, archived, pinned: archived ? false : s.pinned === true } : s,
      );
      // Never leave the archived session selected in the active list.
      const activeSessionId =
        archived && state.activeSessionId === id
          ? (sessions.find((s) => s.archived !== true)?.id ?? '')
          : state.activeSessionId;
      return { sessions, activeSessionId };
    });
    persist();
  },

  duplicateSession: (id) => {
    const source = get().sessions.find((s) => s.id === id);
    if (!source) return null;
    const now = Date.now();
    const copy: ChatSession = {
      ...source,
      id: createId('sess'),
      title: `${source.title} (copy)`,
      createdAt: now,
      updatedAt: now,
      pinned: false,
      archived: false,
      // Clone the transcript with fresh ids so the two sessions stay separate.
      messages: source.messages.map((message) => ({
        ...message,
        id: createId('msg'),
        streaming: false,
      })),
    };
    set((state) => ({
      sessions: [copy, ...state.sessions],
      activeSessionId: copy.id,
      selectedMessageId: null,
    }));
    persist();
    return copy.id;
  },

  setModel: (modelId) => {
    set((state) => ({
      modelId,
      sessions: state.sessions.map((s) =>
        s.id === state.activeSessionId ? { ...s, modelId } : s,
      ),
    }));
  },

  selectSession: (id) => {
    get().stopStreaming();
    const session = get().sessions.find((s) => s.id === id);
    set({
      activeSessionId: id,
      selectedMessageId: null,
      modelId: session?.modelId ?? get().modelId,
    });
    persist();
  },

  selectMessage: (selectedMessageId) => set({ selectedMessageId }),

  loadSessions: (sessions) => {
    get().stopStreaming();
    set({
      sessions,
      activeSessionId: sessions[0]?.id ?? '',
      selectedMessageId: null,
      filter: '',
      errorKey: null,
    });
    persist();
  },

  createSession: () => {
    get().stopStreaming();
    const now = Date.now();
    const session: ChatSession = {
      id: createId('sess'),
      title: 'Untitled session',
      createdAt: now,
      updatedAt: now,
      modelId: get().modelId,
      messages: [],
    };
    set((state) => ({
      sessions: [session, ...state.sessions],
      activeSessionId: session.id,
      selectedMessageId: null,
    }));
    persist();
    return session.id;
  },

  deleteSession: (id) => {
    set((state) => {
      const sessions = state.sessions.filter((s) => s.id !== id);
      const activeSessionId =
        state.activeSessionId === id
          ? (sessions[0]?.id ?? '')
          : state.activeSessionId;
      return { sessions, activeSessionId };
    });
    persist();
  },

  renameSession: (id, title) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, title, updatedAt: Date.now() } : s,
      ),
    }));
    persist();
  },

  clearSession: (id) => {
    set((state) => {
      const target = id ?? state.activeSessionId;
      return {
        selectedMessageId: null,
        sessions: state.sessions.map((s) =>
          s.id === target ? { ...s, messages: [], updatedAt: Date.now() } : s,
        ),
      };
    });
    persist();
  },

  stopStreaming: () => {
    // Cancellation routes only through the runtime bridge.
    void useRunStore.getState().requestCancel();
    set({ isStreaming: false });
    set((state) => ({
      sessions: state.sessions.map((s) => ({
        ...s,
        messages: s.messages.map((m) =>
          m.streaming ? { ...m, streaming: false, stopped: true } : m,
        ),
      })),
    }));
    persist();
  },

  applyRuntimeEvent: (event) => {
    const state = get();

    // -- correlation ------------------------------------------------------
    // A run is claimed on run.started. Every later event must match both the
    // run and the session, so a superseded run or a background session can
    // never write into the visible transcript.
    if (event.type === 'run.started') {
      set({
        activeRun: {
          runId: event.runId,
          sessionId: event.sessionId,
          messageIds: {},
          completed: [],
        },
        isStreaming: true,
      });
      return;
    }

    const run = state.activeRun;
    if (run === null) return;
    if ('runId' in event && event.runId !== run.runId) return;
    if ('sessionId' in event && event.sessionId !== run.sessionId) return;

    const finish = (patch: Partial<ChatMessage>, streamingOnly = true): void => {
      set((current) => ({
        sessions: current.sessions.map((s) =>
          s.id === run.sessionId
            ? {
                ...s,
                updatedAt: Date.now(),
                messages: s.messages.map((m) =>
                  !streamingOnly || m.streaming === true ? { ...m, ...patch } : m,
                ),
              }
            : s,
        ),
      }));
    };

    switch (event.type) {
      case 'message.started': {
        if (event.role !== 'assistant') return;
        // Ignore a repeated start for a message that already exists.
        if (run.messageIds[event.messageId] !== undefined) return;

        const localId = createId('msg');
        const message: ChatMessage = {
          id: localId,
          role: 'assistant',
          content: '',
          createdAt: Date.now(),
          modelId: get().modelId,
          streaming: true,
        };
        set((current) => ({
          activeRun:
            current.activeRun === null
              ? null
              : {
                  ...current.activeRun,
                  messageIds: {
                    ...current.activeRun.messageIds,
                    [event.messageId]: localId,
                  },
                },
          sessions: current.sessions.map((s) =>
            s.id === run.sessionId
              ? { ...s, messages: [...s.messages, message] }
              : s,
          ),
        }));
        return;
      }

      case 'message.delta': {
        // Text that arrives after the user cancelled must be dropped.
        if (run.completed.includes(event.messageId)) return;
        const localId = run.messageIds[event.messageId];
        if (localId === undefined) return;

        set((current) => ({
          sessions: current.sessions.map((s) =>
            s.id === run.sessionId
              ? {
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id === localId
                      ? { ...m, content: m.content + event.delta }
                      : m,
                  ),
                }
              : s,
          ),
        }));
        return;
      }

      case 'message.completed': {
        // A duplicate completion must not append or duplicate anything.
        if (run.completed.includes(event.messageId)) return;
        const localId = run.messageIds[event.messageId];
        if (localId === undefined) return;

        set((current) => ({
          activeRun:
            current.activeRun === null
              ? null
              : {
                  ...current.activeRun,
                  completed: [...current.activeRun.completed, event.messageId],
                },
          sessions: current.sessions.map((s) =>
            s.id === run.sessionId
              ? {
                  ...s,
                  updatedAt: Date.now(),
                  messages: s.messages.map((m) =>
                    m.id === localId
                      ? {
                          ...m,
                          streaming: false,
                          ...(event.tokens !== undefined
                            ? { tokens: event.tokens }
                            : { tokens: estimateTokens(m.content) }),
                        }
                      : m,
                  ),
                }
              : s,
          ),
        }));
        persist();
        return;
      }

      case 'run.completed':
        set({ isStreaming: false, activeRun: null });
        persist();
        return;

      case 'run.cancelled':
        // Keep the partial text; mark it stopped and seal every message so a
        // late delta cannot extend it.
        finish({ streaming: false, stopped: true });
        set((current) => ({
          isStreaming: false,
          activeRun:
            current.activeRun === null
              ? null
              : {
                  ...current.activeRun,
                  completed: Object.keys(current.activeRun.messageIds),
                },
        }));
        persist();
        return;

      case 'run.failed':
        finish({ streaming: false, stopped: true });
        set({
          isStreaming: false,
          activeRun: null,
          errorKey: `runtime.errors.${event.error.kind}`,
        });
        persist();
        return;

      default:
        return;
    }
  },

  sendMessage: async (content) => {
    const text = content.trim();
    if (!text || get().isStreaming) return;

    const sessionId = get().activeSessionId;
    const modelId = get().modelId;
    const now = Date.now();

    const userMessage: ChatMessage = {
      id: createId('msg'),
      role: 'user',
      content: text,
      createdAt: now,
      tokens: estimateTokens(text),
    };

    set((state) => ({
      isStreaming: true,
      errorKey: null,
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              updatedAt: now,
              title: s.messages.length === 0 ? deriveTitle(text) : s.title,
              messages: [...s.messages, userMessage],
            }
          : s,
      ),
    }));
    persist();

    // The runtime bridge is the ONLY path. The assistant message is created
    // and filled in by `applyRuntimeEvent` as message.started/delta/completed
    // arrive, so there is exactly one source of transcript text.
    const runtimeState = useRuntimeStore.getState();
    const runtimeInput: SendMessageInput = {
      sessionId: asSessionId(sessionId),
      content: text,
      mode: runtimeState.mode,
      providerId: runtimeState.providerId,
      modelId,
    };

    try {
      await getRuntime().sendMessage(runtimeInput);
    } catch {
      // A runtime that refuses the run emits no events, so settle here.
      set({ isStreaming: false, errorKey: 'runtime.errors.runtime-unavailable' });
      persist();
    }
  },

  retryLast: async () => {
    const state = get();
    if (state.isStreaming) return;
    const session = state.sessions.find((s) => s.id === state.activeSessionId);
    const lastUser = [...(session?.messages ?? [])]
      .reverse()
      .find((m) => m.role === 'user');
    if (!lastUser) return;

    // Drop the failed assistant turn before replaying the prompt.
    set((current) => ({
      errorKey: null,
      sessions: current.sessions.map((s) =>
        s.id === current.activeSessionId
          ? {
              ...s,
              messages: s.messages.filter(
                (m, index) =>
                  !(m.role === 'assistant' && index === s.messages.length - 1),
              ),
            }
          : s,
      ),
    }));

    // Remove the trailing user message too; sendMessage re-adds it.
    set((current) => ({
      sessions: current.sessions.map((s) =>
        s.id === current.activeSessionId
          ? { ...s, messages: s.messages.filter((m) => m.id !== lastUser.id) }
          : s,
      ),
    }));

    await get().sendMessage(lastUser.content);
  },

  dismissError: () => set({ errorKey: null }),
}));

/** Writes the current sessions to storage. */
function persist(): void {
  const { sessions, activeSessionId } = useChatStore.getState();
  saveSessions(sessions, activeSessionId);
}

export function deriveTitle(text: string): string {
  const firstLine = text.split('\n')[0]?.trim() ?? '';
  const clipped = firstLine.slice(0, 48);
  return clipped.length < firstLine.length ? `${clipped}…` : clipped || 'Untitled session';
}

export function totalTokens(session: ChatSession | undefined): number {
  if (!session) return 0;
  return session.messages.reduce((sum, m) => sum + (m.tokens ?? 0), 0);
}

/**
 * A one-line preview of what a session was about: the last assistant reply,
 * falling back to the last user message. Returns null for an empty session so
 * the caller can omit the line entirely rather than render a blank row.
 */
export function sessionSummary(session: ChatSession): string | null {
  const last =
    [...session.messages].reverse().find((m) => m.role === 'assistant') ??
    [...session.messages].reverse().find((m) => m.role === 'user');
  if (!last) return null;

  const text = last.content.replace(/```[\s\S]*?```/g, ' ').replace(/\s+/g, ' ').trim();
  if (text.length === 0) return null;
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

// Register the transcript projection with the runtime subscription. Doing it
// here keeps `run.ts` free of a circular import back into this module.
setChatProjection((event) => {
  useChatStore.getState().applyRuntimeEvent(event);
});
