import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useOllamaStore, selectActiveModel, selectErrorKey } from '../ollama';
import { setOllamaBridge } from '@/services/ollama/ipc';
import { FIXTURE_MODELS, MockOllamaBridge } from '@/services/ollama/mockBridge';
import type { OllamaBridge } from '@/services/ollama/ipc';

function reset(): void {
  useOllamaStore.setState({
    status: 'idle',
    endpoint: 'http://127.0.0.1:11434',
    version: null,
    models: [],
    selectedModelId: null,
    error: null,
    lastCheckedAt: null,
  });
}

describe('ollama connection store', () => {
  beforeEach(() => {
    localStorage.clear();
    reset();
  });
  afterEach(() => setOllamaBridge(null));

  it('reaches the ready state and selects the first model', async () => {
    setOllamaBridge(new MockOllamaBridge());
    await useOllamaStore.getState().refresh();

    const state = useOllamaStore.getState();
    expect(state.status).toBe('ready');
    expect(state.version).toBe('0.5.1');
    expect(state.models).toHaveLength(FIXTURE_MODELS.length);
    expect(state.selectedModelId).toBe(FIXTURE_MODELS[0]!.id);
    expect(selectActiveModel(state)?.family).toBe('llama');
  });

  it('enters the unavailable state when Ollama is offline', async () => {
    setOllamaBridge(
      new MockOllamaBridge({
        health: {
          reachable: false,
          endpoint: 'http://127.0.0.1:11434',
          error: { kind: 'unavailable', message: 'connection refused' },
        },
      }),
    );
    await useOllamaStore.getState().refresh();

    const state = useOllamaStore.getState();
    expect(state.status).toBe('unavailable');
    expect(state.models).toHaveLength(0);
    expect(selectErrorKey(state)).toBe('ollama.errors.unavailable');
  });

  it('enters the no-models state when nothing is installed', async () => {
    setOllamaBridge(new MockOllamaBridge({ models: [] }));
    await useOllamaStore.getState().refresh();

    const state = useOllamaStore.getState();
    expect(state.status).toBe('no-models');
    expect(selectErrorKey(state)).toBe('ollama.errors.noModels');
  });

  it('enters the error state when listing models fails', async () => {
    const base = new MockOllamaBridge();
    const bridge: OllamaBridge = {
      health: () => base.health(),
      models: () =>
        Promise.reject(Object.assign(new Error('boom'), { kind: 'backend' })),
      endpoint: () => base.endpoint(),
      setEndpoint: (value) => base.setEndpoint(value),
      chat: (params, onEvent) => base.chat(params, onEvent),
      cancel: (id) => base.cancel(id),
    };
    setOllamaBridge(bridge);
    await useOllamaStore.getState().refresh();

    const state = useOllamaStore.getState();
    expect(state.status).toBe('error');
    expect(selectErrorKey(state)).toBe('ollama.errors.backend');
  });

  it('treats a thrown health check as unavailable', async () => {
    const base = new MockOllamaBridge();
    const bridge: OllamaBridge = {
      health: () => Promise.reject(new Error('ipc gone')),
      models: () => base.models(),
      endpoint: () => base.endpoint(),
      setEndpoint: (value) => base.setEndpoint(value),
      chat: (params, onEvent) => base.chat(params, onEvent),
      cancel: (id) => base.cancel(id),
    };
    setOllamaBridge(bridge);
    await useOllamaStore.getState().refresh();
    expect(useOllamaStore.getState().status).toBe('unavailable');
  });

  it('keeps a still-installed model selection across a refresh', async () => {
    setOllamaBridge(new MockOllamaBridge());
    await useOllamaStore.getState().refresh();

    const second = FIXTURE_MODELS[1]!.id;
    useOllamaStore.getState().selectModel(second);
    await useOllamaStore.getState().refresh();

    expect(useOllamaStore.getState().selectedModelId).toBe(second);
  });

  it('falls back when the stored model is no longer installed', async () => {
    setOllamaBridge(new MockOllamaBridge());
    await useOllamaStore.getState().refresh();
    useOllamaStore.getState().selectModel('ghost:1b');

    setOllamaBridge(new MockOllamaBridge({ models: [FIXTURE_MODELS[2]!] }));
    await useOllamaStore.getState().refresh();

    expect(useOllamaStore.getState().selectedModelId).toBe(FIXTURE_MODELS[2]!.id);
  });

  it('persists the selected model to localStorage', async () => {
    setOllamaBridge(new MockOllamaBridge());
    await useOllamaStore.getState().refresh();
    useOllamaStore.getState().selectModel(FIXTURE_MODELS[1]!.id);

    expect(localStorage.getItem('coding-studio:ollama-model')).toBe(
      FIXTURE_MODELS[1]!.id,
    );
  });

  it('updates the endpoint and re-probes', async () => {
    const bridge = new MockOllamaBridge();
    setOllamaBridge(bridge);
    await useOllamaStore.getState().setEndpoint('http://10.0.0.5:11434');

    expect(bridge.endpointValue).toBe('http://10.0.0.5:11434');
    expect(useOllamaStore.getState().status).toBe('ready');
  });

  it('exposes every connection state the UI renders', () => {
    const states = [
      'idle',
      'connecting',
      'ready',
      'unavailable',
      'no-models',
      'streaming',
      'cancelled',
      'error',
    ] as const;
    for (const status of states) {
      useOllamaStore.getState().setStatus(status);
      expect(useOllamaStore.getState().status).toBe(status);
    }
  });

  it('clears the error', async () => {
    setOllamaBridge(new MockOllamaBridge({ models: [] }));
    await useOllamaStore.getState().refresh();
    expect(useOllamaStore.getState().error).not.toBeNull();

    useOllamaStore.getState().clearError();
    expect(useOllamaStore.getState().error).toBeNull();
    expect(selectErrorKey(useOllamaStore.getState())).toBeNull();
  });
});
