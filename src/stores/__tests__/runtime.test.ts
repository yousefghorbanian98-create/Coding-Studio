import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  selectActiveModel,
  selectActiveProvider,
  selectErrorKey,
  useRuntimeStore,
} from '../runtime';
import {
  MockStudioRuntime,
  RuntimeError,
  resetRuntime,
  setRuntime,
  type StudioRuntimeBridge,
} from '@/services/runtime';

function reset(): void {
  useRuntimeStore.setState({
    status: 'idle',
    health: null,
    providers: [],
    models: [],
    providerId: 'demo',
    modelId: 'demo-balanced',
    mode: 'ask',
    errorKind: null,
    errorDetail: null,
    lastCheckedAt: null,
  });
}

/** Wraps a runtime, overriding selected methods without losing the prototype. */
function withOverrides(
  base: MockStudioRuntime,
  overrides: Partial<StudioRuntimeBridge>,
): StudioRuntimeBridge {
  return {
    getHealth: () => base.getHealth(),
    getCapabilities: () => base.getCapabilities(),
    listProviders: () => base.listProviders(),
    listModels: (id) => base.listModels(id),
    listSessions: () => base.listSessions(),
    createSession: (i) => base.createSession(i),
    resumeSession: (id) => base.resumeSession(id),
    renameSession: (id, t) => base.renameSession(id, t),
    archiveSession: (id) => base.archiveSession(id),
    deleteSession: (id) => base.deleteSession(id),
    sendMessage: (i) => base.sendMessage(i),
    cancelRun: (id) => base.cancelRun(id),
    respondToApproval: (id, d) => base.respondToApproval(id, d),
    subscribe: (l) => base.subscribe(l),
    dispose: () => base.dispose(),
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  reset();
});

afterEach(() => {
  resetRuntime();
});

describe('runtime store', () => {
  it('reaches ready and selects a provider and model', async () => {
    setRuntime(new MockStudioRuntime());
    await useRuntimeStore.getState().refresh();

    const state = useRuntimeStore.getState();
    expect(state.status).toBe('ready');
    expect(state.health?.kind).toBe('mock');
    expect(state.models.length).toBeGreaterThan(0);
    expect(selectActiveModel(state)?.id).toBe('demo-balanced');
    expect(selectActiveProvider(state)?.id).toBe('demo');
    expect(selectErrorKey(state)).toBeNull();
  });

  it('enters unavailable when the runtime is not running', async () => {
    setRuntime(new MockStudioRuntime({ scenario: 'runtime-unavailable' }));
    await useRuntimeStore.getState().refresh();

    const state = useRuntimeStore.getState();
    expect(state.status).toBe('unavailable');
    expect(state.models).toHaveLength(0);
    expect(selectErrorKey(state)).toBe('runtime.errors.runtime-unavailable');
  });

  it('reports a crashed runtime distinctly', async () => {
    setRuntime(new MockStudioRuntime({ scenario: 'runtime-crash' }));
    await useRuntimeStore.getState().refresh();

    const state = useRuntimeStore.getState();
    expect(state.status).toBe('unavailable');
    expect(selectErrorKey(state)).toBe('runtime.errors.runtime-crashed');
    expect(state.errorDetail).toBeTruthy();
  });

  it('enters no-models when the provider offers nothing', async () => {
    const base = new MockStudioRuntime();
    setRuntime(withOverrides(base, { listModels: () => Promise.resolve([]) }));
    await useRuntimeStore.getState().refresh();

    expect(useRuntimeStore.getState().status).toBe('no-models');
  });

  it('enters error when listing providers fails', async () => {
    const base = new MockStudioRuntime();
    setRuntime(
      withOverrides(base, {
        listProviders: () =>
          Promise.reject(new RuntimeError('run-failed', 'boom')),
      }),
    );
    await useRuntimeStore.getState().refresh();

    const state = useRuntimeStore.getState();
    expect(state.status).toBe('error');
    expect(selectErrorKey(state)).toBe('runtime.errors.run-failed');
  });

  it('treats a thrown health check as unavailable', async () => {
    const base = new MockStudioRuntime();
    setRuntime(
      withOverrides(base, { getHealth: () => Promise.reject(new Error('gone')) }),
    );
    await useRuntimeStore.getState().refresh();

    expect(useRuntimeStore.getState().status).toBe('unavailable');
  });

  it('persists and restores the model selection', async () => {
    setRuntime(new MockStudioRuntime());
    await useRuntimeStore.getState().refresh();

    useRuntimeStore.getState().selectModel('demo-reasoning');
    expect(localStorage.getItem('coding-studio:model')).toBe('demo-reasoning');

    await useRuntimeStore.getState().refresh();
    expect(useRuntimeStore.getState().modelId).toBe('demo-reasoning');
  });

  it('falls back when the stored model is no longer offered', async () => {
    setRuntime(new MockStudioRuntime());
    await useRuntimeStore.getState().refresh();
    useRuntimeStore.getState().selectModel('ghost-model');

    await useRuntimeStore.getState().refresh();
    expect(useRuntimeStore.getState().modelId).toBe('demo-balanced');
  });

  it('persists the chat mode', () => {
    useRuntimeStore.getState().setMode('agent');
    expect(useRuntimeStore.getState().mode).toBe('agent');
    expect(localStorage.getItem('coding-studio:mode')).toBe('agent');
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
      useRuntimeStore.getState().setStatus(status);
      expect(useRuntimeStore.getState().status).toBe(status);
    }
  });

  it('clears the error', async () => {
    setRuntime(new MockStudioRuntime({ scenario: 'runtime-unavailable' }));
    await useRuntimeStore.getState().refresh();
    expect(useRuntimeStore.getState().errorKind).not.toBeNull();

    useRuntimeStore.getState().clearError();
    expect(selectErrorKey(useRuntimeStore.getState())).toBeNull();
  });
});
