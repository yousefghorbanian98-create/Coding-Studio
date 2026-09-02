import { create } from 'zustand';
import { getOllamaBridge } from '@/services/ollama/ipc';
import {
  ollamaErrorKey,
  type HealthStatus,
  type OllamaErrorPayload,
  type OllamaModel,
} from '@/services/ollama/schemas';

/**
 * The eight connection states the UI must render.
 * `streaming` and `cancelled` are driven by the chat store, mirrored here so
 * the status bar has one source of truth.
 */
export type ConnectionState =
  | 'idle'
  | 'connecting'
  | 'ready'
  | 'unavailable'
  | 'no-models'
  | 'streaming'
  | 'cancelled'
  | 'error';

export interface OllamaState {
  status: ConnectionState;
  endpoint: string;
  version: string | null;
  models: OllamaModel[];
  selectedModelId: string | null;
  error: OllamaErrorPayload | null;
  lastCheckedAt: number | null;

  refresh: () => Promise<void>;
  setEndpoint: (endpoint: string) => Promise<void>;
  selectModel: (id: string) => void;
  setStatus: (status: ConnectionState) => void;
  clearError: () => void;
}

const SELECTED_MODEL_KEY = 'coding-studio:ollama-model';

function readStoredModel(): string | null {
  try {
    return localStorage.getItem(SELECTED_MODEL_KEY);
  } catch {
    return null;
  }
}

function storeModel(id: string): void {
  try {
    localStorage.setItem(SELECTED_MODEL_KEY, id);
  } catch {
    // Persisting the choice is best-effort.
  }
}

export const useOllamaStore = create<OllamaState>()((set, get) => ({
  status: 'idle',
  endpoint: 'http://127.0.0.1:11434',
  version: null,
  models: [],
  selectedModelId: readStoredModel(),
  error: null,
  lastCheckedAt: null,

  refresh: async () => {
    set({ status: 'connecting', error: null });
    const bridge = getOllamaBridge();

    let health: HealthStatus;
    try {
      health = await bridge.health();
    } catch (error) {
      set({
        status: 'unavailable',
        error: {
          kind: 'unavailable',
          message:
            error instanceof Error ? error.message : 'Could not reach the backend',
        },
        lastCheckedAt: Date.now(),
      });
      return;
    }

    if (!health.reachable) {
      set({
        status: 'unavailable',
        endpoint: health.endpoint,
        version: null,
        models: [],
        error: health.error ?? {
          kind: 'unavailable',
          message: 'Ollama is not running',
        },
        lastCheckedAt: Date.now(),
      });
      return;
    }

    try {
      const models = await bridge.models();
      if (models.length === 0) {
        set({
          status: 'no-models',
          endpoint: health.endpoint,
          version: health.version ?? null,
          models: [],
          error: { kind: 'no-models', message: 'No models installed' },
          lastCheckedAt: Date.now(),
        });
        return;
      }

      // Keep the stored choice when it is still installed.
      const previous = get().selectedModelId;
      const selectedModelId =
        previous && models.some((model) => model.id === previous)
          ? previous
          : (models[0]?.id ?? null);

      set({
        status: 'ready',
        endpoint: health.endpoint,
        version: health.version ?? null,
        models,
        selectedModelId,
        error: null,
        lastCheckedAt: Date.now(),
      });
    } catch (error) {
      const payload = error as Partial<OllamaErrorPayload>;
      const kind = payload.kind ?? 'backend';
      set({
        status: kind === 'no-models' ? 'no-models' : 'error',
        endpoint: health.endpoint,
        version: health.version ?? null,
        models: [],
        error: {
          kind,
          message: payload.message ?? 'Could not list models',
        },
        lastCheckedAt: Date.now(),
      });
    }
  },

  setEndpoint: async (endpoint) => {
    const applied = await getOllamaBridge().setEndpoint(endpoint);
    set({ endpoint: applied });
    await get().refresh();
  },

  selectModel: (id) => {
    storeModel(id);
    set({ selectedModelId: id });
  },

  setStatus: (status) => set({ status }),
  clearError: () => set({ error: null }),
}));

/** Translation key for the current error, if any. */
export function selectErrorKey(state: OllamaState): string | null {
  return state.error ? ollamaErrorKey(state.error.kind) : null;
}

export function selectActiveModel(state: OllamaState): OllamaModel | undefined {
  return state.models.find((model) => model.id === state.selectedModelId);
}
