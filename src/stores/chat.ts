import { create } from 'zustand';
import type { ChatMessage, ChatSession } from '@/types/chat';
import { createMockSessions } from '@/mocks/sessions';
import { DEFAULT_MODEL_ID } from '@/mocks/models';
import { estimateTokens, runMockStream } from '@/mocks/stream';

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
  /** Not persisted — the controller for the in-flight mock stream. */
  controller: AbortController | null;

  setFilter: (filter: string) => void;
  setModel: (modelId: string) => void;
  selectSession: (id: string) => void;
  selectMessage: (id: string | null) => void;
  createSession: () => string;
  deleteSession: (id: string) => void;
  renameSession: (id: string, title: string) => void;
  clearSession: (id?: string) => void;
  sendMessage: (content: string, options?: { seed?: number; delayMs?: number }) => Promise<void>;
  stopStreaming: () => void;
}

const initialSessions = createMockSessions();

export function selectActiveSession(state: ChatState): ChatSession | undefined {
  return state.sessions.find((s) => s.id === state.activeSessionId);
}

export function filterSessions(
  sessions: ChatSession[],
  filter: string,
): ChatSession[] {
  const q = filter.trim().toLowerCase();
  const matched = q
    ? sessions.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.messages.some((m) => m.content.toLowerCase().includes(q)),
      )
    : sessions;
  return [...matched].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
}

export const useChatStore = create<ChatState>()((set, get) => ({
  sessions: initialSessions,
  activeSessionId: initialSessions[0]?.id ?? '',
  modelId: initialSessions[0]?.modelId ?? DEFAULT_MODEL_ID,
  isStreaming: false,
  selectedMessageId: null,
  filter: '',
  controller: null,

  setFilter: (filter) => set({ filter }),

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
  },

  selectMessage: (selectedMessageId) => set({ selectedMessageId }),

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
  },

  renameSession: (id, title) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, title, updatedAt: Date.now() } : s,
      ),
    })),

  clearSession: (id) =>
    set((state) => {
      const target = id ?? state.activeSessionId;
      return {
        selectedMessageId: null,
        sessions: state.sessions.map((s) =>
          s.id === target ? { ...s, messages: [], updatedAt: Date.now() } : s,
        ),
      };
    }),

  stopStreaming: () => {
    const { controller } = get();
    if (controller && !controller.signal.aborted) controller.abort();
    set({ controller: null, isStreaming: false });
    set((state) => ({
      sessions: state.sessions.map((s) => ({
        ...s,
        messages: s.messages.map((m) =>
          m.streaming ? { ...m, streaming: false, stopped: true } : m,
        ),
      })),
    }));
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

    const result = await runMockStream({
      prompt: text,
      modelId,
      signal: controller.signal,
      onChunk: appendChunk,
      ...(options?.seed !== undefined ? { seed: options.seed } : {}),
      ...(options?.delayMs !== undefined ? { delayMs: options.delayMs } : {}),
    });

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
  },
}));

export function deriveTitle(text: string): string {
  const firstLine = text.split('\n')[0]?.trim() ?? '';
  const clipped = firstLine.slice(0, 48);
  return clipped.length < firstLine.length ? `${clipped}…` : clipped || 'Untitled session';
}

export function totalTokens(session: ChatSession | undefined): number {
  if (!session) return 0;
  return session.messages.reduce((sum, m) => sum + (m.tokens ?? 0), 0);
}
