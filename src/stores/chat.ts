import { create } from 'zustand';
import type { ChatMessage, ChatSession } from '@/types/chat';
import { createMockSessions } from '@/mocks/sessions';
import {
  DEFAULT_MODEL_ID,
  asSessionId,
  getRuntime,
  type SendMessageInput,
} from '@/services/runtime';
import { useRunStore } from './run';
import { useRuntimeStore } from './runtime';
import { estimateTokens } from '@/mocks/stream';
import {
  MockTransport,
  errorMessageKey,
  getTransport,
} from '@/services/transport';
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
  /** Not persisted — the controller for the in-flight stream. */
  controller: AbortController | null;
  /** i18n key of the last transport failure, or null. */
  errorKey: string | null;

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
  sendMessage: (content: string, options?: { seed?: number; delayMs?: number }) => Promise<void>;
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
  controller: null,
  errorKey: null,

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
    const { controller } = get();
    if (controller && !controller.signal.aborted) controller.abort();
    // Stop the runtime-side run too, otherwise its tools keep reporting.
    void useRunStore.getState().requestCancel();
    set({ controller: null, isStreaming: false });
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

  sendMessage: async (content, options) => {
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
    const assistantMessage: ChatMessage = {
      id: createId('msg'),
      role: 'assistant',
      content: '',
      createdAt: now + 1,
      modelId,
      streaming: true,
    };

    const controller = new AbortController();

    set((state) => ({
      isStreaming: true,
      controller,
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              updatedAt: now,
              title:
                s.messages.length === 0 ? deriveTitle(text) : s.title,
              messages: [...s.messages, userMessage, assistantMessage],
            }
          : s,
      ),
    }));

    const appendChunk = (chunk: string): void => {
      set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === assistantMessage.id
                    ? { ...m, content: m.content + chunk }
                    : m,
                ),
              }
            : s,
        ),
      }));
    };

    // Ask the runtime bridge to drive the run in parallel. This is what makes
    // plans, tool calls and approvals appear: the run store is subscribed to
    // those events. The text itself still streams over the transport below.
    const runtimeState = useRuntimeStore.getState();
    const runtimeInput: SendMessageInput = {
      sessionId: asSessionId(sessionId),
      content: text,
      mode: runtimeState.mode,
      providerId: runtimeState.providerId,
      modelId: runtimeState.modelId,
    };
    void getRuntime()
      .sendMessage(runtimeInput)
      .catch(() => {
        // A runtime that refuses the run is already reported through its own
        // events and the connection banner; the transport reply still applies.
      });

    // Route through the pluggable transport. The mock is the default, so a
    // missing backend degrades to canned replies instead of an error.
    const transport =
      options?.seed !== undefined || options?.delayMs !== undefined
        ? new MockTransport({
            ...(options.seed !== undefined ? { seed: options.seed } : {}),
            ...(options.delayMs !== undefined
              ? { delayMs: options.delayMs }
              : {}),
          })
        : getTransport();

    const history = [
      ...(get().sessions.find((s) => s.id === sessionId)?.messages ?? []),
    ].filter((m) => m.id !== assistantMessage.id);

    try {
      const result = await transport.complete(
        { messages: history, modelId, signal: controller.signal },
        (chunk) => appendChunk(chunk.delta),
      );

      set((state) => ({
        isStreaming: false,
        controller: null,
        sessions: state.sessions.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                updatedAt: Date.now(),
                messages: s.messages.map((m) =>
                  m.id === assistantMessage.id
                    ? {
                        ...m,
                        streaming: false,
                        stopped: result.aborted,
                        tokens: estimateTokens(m.content),
                        latencyMs: result.latencyMs,
                      }
                    : m,
                ),
              }
            : s,
        ),
      }));
    } catch (error) {
      // Keep whatever text arrived, mark it stopped, and surface the reason.
      set((state) => ({
        isStreaming: false,
        controller: null,
        errorKey: errorMessageKey(error),
        sessions: state.sessions.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                updatedAt: Date.now(),
                messages: s.messages.map((m) =>
                  m.id === assistantMessage.id
                    ? {
                        ...m,
                        streaming: false,
                        stopped: true,
                        tokens: estimateTokens(m.content),
                      }
                    : m,
                ),
              }
            : s,
        ),
      }));
    }

    persist();
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
