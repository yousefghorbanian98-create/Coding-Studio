import { create } from 'zustand';
import {
  DEFAULT_MODEL_ID,
  DEFAULT_PROVIDER_ID,
  RuntimeError,
  getRuntime,
  runtimeErrorKey,
  type ChatMode,
  type ModelDescriptor,
  type ProviderDescriptor,
  type RuntimeErrorKind,
  type RuntimeHealth,
} from '@/services/runtime';

/**
 * Connection and provider selection state.
 *
 * The eight UI states the product must cover map onto `ConnectionState`; the
 * chat store owns per-run streaming state.
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

const MODEL_KEY = 'coding-studio:model';
const PROVIDER_KEY = 'coding-studio:provider';
const MODE_KEY = 'coding-studio:mode';

function readStored(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode); selection stays in memory.
  }
}

export interface RuntimeState {
  status: ConnectionState;
  health: RuntimeHealth | null;
  providers: ProviderDescriptor[];
  models: ModelDescriptor[];
  providerId: string;
  modelId: string;
  mode: ChatMode;
  errorKind: RuntimeErrorKind | null;
  errorDetail: string | null;
  lastCheckedAt: number | null;

  refresh: () => Promise<void>;
  selectProvider: (providerId: string) => Promise<void>;
  selectModel: (modelId: string) => void;
  setMode: (mode: ChatMode) => void;
  setStatus: (status: ConnectionState) => void;
  clearError: () => void;
}

export const useRuntimeStore = create<RuntimeState>()((set, get) => ({
  status: 'idle',
  health: null,
  providers: [],
  models: [],
  providerId: readStored(PROVIDER_KEY) ?? DEFAULT_PROVIDER_ID,
  modelId: readStored(MODEL_KEY) ?? DEFAULT_MODEL_ID,
  mode: (readStored(MODE_KEY) as ChatMode | null) ?? 'ask',
  errorKind: null,
  errorDetail: null,
  lastCheckedAt: null,

  refresh: async () => {
    set({ status: 'connecting', errorKind: null, errorDetail: null });
    const runtime = getRuntime();

    let health: RuntimeHealth;
    try {
      health = await runtime.getHealth();
    } catch {
      set({
        status: 'unavailable',
        health: null,
        models: [],
        errorKind: 'runtime-unavailable',
        errorDetail: null,
        lastCheckedAt: Date.now(),
      });
      return;
    }

    if (health.status === 'unavailable' || health.status === 'crashed') {
      set({
        status: 'unavailable',
        health,
        models: [],
        errorKind:
          health.status === 'crashed' ? 'runtime-crashed' : 'runtime-unavailable',
        errorDetail: health.detail ?? null,
        lastCheckedAt: Date.now(),
      });
      return;
    }

    try {
      const providers = await runtime.listProviders();
      const providerId = providers.some((p) => p.id === get().providerId)
        ? get().providerId
        : (providers.find((p) => !p.disabled)?.id ?? DEFAULT_PROVIDER_ID);
      const models = await runtime.listModels(providerId);

      if (models.length === 0) {
        set({
          status: 'no-models',
          health,
          providers,
          providerId,
          models: [],
          errorKind: null,
          errorDetail: null,
          lastCheckedAt: Date.now(),
        });
        return;
      }

      // Keep the stored choice when it is still offered.
      const modelId = models.some((m) => m.id === get().modelId)
        ? get().modelId
        : (models[0]?.id ?? DEFAULT_MODEL_ID);

      set({
        status: 'ready',
        health,
        providers,
        providerId,
        models,
        modelId,
        errorKind: null,
        errorDetail: null,
        lastCheckedAt: Date.now(),
      });
      writeStored(PROVIDER_KEY, providerId);
      writeStored(MODEL_KEY, modelId);
    } catch (error) {
      const kind =
        error instanceof RuntimeError ? error.kind : ('unknown' as const);
      set({
        status: 'error',
        health,
        models: [],
        errorKind: kind,
        errorDetail: error instanceof Error ? error.message : null,
        lastCheckedAt: Date.now(),
      });
    }
  },

  selectProvider: async (providerId) => {
    set({ providerId });
    writeStored(PROVIDER_KEY, providerId);
    await get().refresh();
  },

  selectModel: (modelId) => {
    set({ modelId });
    writeStored(MODEL_KEY, modelId);
  },

  setMode: (mode) => {
    set({ mode });
    writeStored(MODE_KEY, mode);
  },

  setStatus: (status) => set({ status }),

  clearError: () => set({ errorKind: null, errorDetail: null }),
}));

/** i18n key for the current error, or null when healthy. */
export function selectErrorKey(state: RuntimeState): string | null {
  return state.errorKind ? runtimeErrorKey(state.errorKind) : null;
}

export function selectActiveModel(state: RuntimeState): ModelDescriptor | null {
  return state.models.find((model) => model.id === state.modelId) ?? null;
}

export function selectActiveProvider(
  state: RuntimeState,
): ProviderDescriptor | null {
  return state.providers.find((p) => p.id === state.providerId) ?? null;
}
