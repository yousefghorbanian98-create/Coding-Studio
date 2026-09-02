import type { ChatMessage, ChatSession } from '@/types/chat';

export const SESSIONS_STORAGE_KEY = 'coding-studio:sessions';
export const SESSIONS_SCHEMA_VERSION = 1;

interface PersistedShape {
  version: number;
  sessions: ChatSession[];
  activeSessionId: string;
}

/** Narrow unknown JSON into a ChatSession, dropping anything malformed. */
function reviveSession(input: unknown): ChatSession | null {
  if (typeof input !== 'object' || input === null) return null;
  const raw = input as Record<string, unknown>;

  if (typeof raw['id'] !== 'string' || typeof raw['title'] !== 'string') {
    return null;
  }

  const messages = Array.isArray(raw['messages'])
    ? raw['messages'].flatMap((entry) => {
        if (typeof entry !== 'object' || entry === null) return [];
        const message = entry as Record<string, unknown>;
        const role = message['role'];
        if (
          typeof message['id'] !== 'string' ||
          typeof message['content'] !== 'string' ||
          (role !== 'user' && role !== 'assistant' && role !== 'system')
        ) {
          return [];
        }
        const revived: ChatMessage = {
            id: message['id'],
            role,
            content: message['content'],
            createdAt:
              typeof message['createdAt'] === 'number'
                ? message['createdAt']
                : Date.now(),
            ...(typeof message['modelId'] === 'string'
              ? { modelId: message['modelId'] }
              : {}),
            ...(typeof message['tokens'] === 'number'
              ? { tokens: message['tokens'] }
              : {}),
            ...(typeof message['latencyMs'] === 'number'
              ? { latencyMs: message['latencyMs'] }
              : {}),
            // A reply that was mid-flight when the app closed is not streaming
            // any more; persist it as a stopped message.
            ...(message['stopped'] === true || message['streaming'] === true
              ? { stopped: true }
              : {}),
        };
        return [revived];
      })
    : [];

  const now = Date.now();
  return {
    id: raw['id'],
    title: raw['title'],
    createdAt: typeof raw['createdAt'] === 'number' ? raw['createdAt'] : now,
    updatedAt: typeof raw['updatedAt'] === 'number' ? raw['updatedAt'] : now,
    modelId: typeof raw['modelId'] === 'string' ? raw['modelId'] : '',
    ...(raw['pinned'] === true ? { pinned: true } : {}),
    messages,
  };
}

export interface LoadedSessions {
  sessions: ChatSession[];
  activeSessionId: string;
}

/**
 * Reads persisted sessions. Returns null when nothing valid is stored, so the
 * caller can fall back to seed data. Never throws — corrupt storage must not
 * prevent the app from starting.
 */
export function loadSessions(
  storage: Storage = localStorage,
): LoadedSessions | null {
  let raw: string | null = null;
  try {
    raw = storage.getItem(SESSIONS_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedShape>;
    if (parsed.version !== SESSIONS_SCHEMA_VERSION) return null;
    if (!Array.isArray(parsed.sessions)) return null;

    const sessions = parsed.sessions.flatMap((entry) => {
      const session = reviveSession(entry);
      return session ? [session] : [];
    });
    if (sessions.length === 0) return null;

    const activeSessionId =
      typeof parsed.activeSessionId === 'string' &&
      sessions.some((session) => session.id === parsed.activeSessionId)
        ? parsed.activeSessionId
        : (sessions[0]?.id ?? '');

    return { sessions, activeSessionId };
  } catch {
    return null;
  }
}

/** Writes sessions to storage. Silently ignores quota/serialisation errors. */
export function saveSessions(
  sessions: ChatSession[],
  activeSessionId: string,
  storage: Storage = localStorage,
): void {
  try {
    const payload: PersistedShape = {
      version: SESSIONS_SCHEMA_VERSION,
      // Never persist a half-streamed message as still streaming.
      sessions: sessions.map((session) => ({
        ...session,
        messages: session.messages.map(({ streaming: _streaming, ...rest }) =>
          _streaming ? { ...rest, stopped: true } : rest,
        ),
      })),
      activeSessionId,
    };
    storage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage full or unavailable — persistence is best-effort.
  }
}

export function clearSessions(storage: Storage = localStorage): void {
  try {
    storage.removeItem(SESSIONS_STORAGE_KEY);
  } catch {
    // ignore
  }
}
