import { describe, expect, it } from 'vitest';
import { OllamaTransport, toTransportKind } from '../ollamaTransport';
import { MockOllamaBridge } from '../mockBridge';
import type { OllamaBridge, OllamaChatParams } from '../ipc';
import type { OllamaEvent } from '../schemas';
import { TransportError } from '@/services/transport';
import type { ChatMessage } from '@/types/chat';

const messages: ChatMessage[] = [
  { id: 'm1', role: 'user', content: 'hello', createdAt: 1 },
];

function delegate(
  base: MockOllamaBridge,
  overrides: Partial<OllamaBridge>,
): OllamaBridge {
  return {
    health: () => base.health(),
    models: () => base.models(),
    endpoint: () => base.endpoint(),
    setEndpoint: (value) => base.setEndpoint(value),
    chat: (params, onEvent) => base.chat(params, onEvent),
    cancel: (id) => base.cancel(id),
    ...overrides,
  };
}

function run(
  bridge: OllamaBridge,
  signal = new AbortController().signal,
  onDelta: (delta: string) => void = () => {},
): Promise<{ text: string; aborted: boolean; tokens: number }> {
  return new OllamaTransport(bridge).complete(
    { messages, modelId: 'llama3.2:3b', signal },
    (chunk) => onDelta(chunk.delta),
  );
}

describe('OllamaTransport', () => {
  it('streams deltas and assembles the reply', async () => {
    const deltas: string[] = [];
    const result = await run(
      new MockOllamaBridge({ chunks: ['Hel', 'lo'] }),
      undefined,
      (delta) => deltas.push(delta),
    );

    expect(deltas).toEqual(['Hel', 'lo']);
    expect(result.text).toBe('Hello');
    expect(result.aborted).toBe(false);
  });

  it('forwards the selected model and conversation to the bridge', async () => {
    let seen: OllamaChatParams | null = null;
    const bridge = delegate(new MockOllamaBridge(), {
      chat: (params, onEvent) => {
        seen = params;
        onEvent({ type: 'done', streamId: params.streamId });
        return Promise.resolve();
      },
    });

    await run(bridge);
    expect(seen).not.toBeNull();
    expect(seen!.model).toBe('llama3.2:3b');
    expect(seen!.messages).toEqual([{ role: 'user', content: 'hello' }]);
  });

  it('reports cancellation and keeps the partial text', async () => {
    const bridge = new MockOllamaBridge({
      chunks: Array.from({ length: 20 }, (_, i) => `${i} `),
      chunkDelayMs: 5,
    });
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 20);

    const result = await run(bridge, controller.signal);
    expect(result.aborted).toBe(true);
    expect(result.text.length).toBeGreaterThan(0);
  });

  it('cancels immediately when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await run(new MockOllamaBridge(), controller.signal);
    expect(result.aborted).toBe(true);
  });

  it('rejects with a TransportError when the backend fails', async () => {
    const bridge = new MockOllamaBridge({
      failWith: { kind: 'backend', message: 'Ollama exploded' },
    });
    const error = await run(bridge).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TransportError);
    expect((error as TransportError).kind).toBe('server');
  });

  it('maps an unavailable backend to a network transport error', async () => {
    const bridge = new MockOllamaBridge({
      failWith: { kind: 'unavailable', message: 'offline' },
    });
    const error = await run(bridge).catch((e: unknown) => e);
    expect((error as TransportError).kind).toBe('network');
  });

  it('maps a timeout from the backend', async () => {
    const bridge = new MockOllamaBridge({
      failWith: { kind: 'timeout', message: 'slow' },
    });
    const error = await run(bridge).catch((e: unknown) => e);
    expect((error as TransportError).kind).toBe('timeout');
  });

  it('surfaces a rejected invoke as a network error', async () => {
    const bridge = delegate(new MockOllamaBridge(), {
      chat: () => Promise.reject(new Error('ipc down')),
    });
    const error = await run(bridge).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TransportError);
    expect((error as TransportError).kind).toBe('network');
  });

  it('prefers evalCount from the backend for the token count', async () => {
    const bridge = delegate(new MockOllamaBridge(), {
      chat: (params, onEvent) => {
        const events: OllamaEvent[] = [
          { type: 'chunk', streamId: params.streamId, delta: 'hi' },
          { type: 'done', streamId: params.streamId, evalCount: 99 },
        ];
        events.forEach(onEvent);
        return Promise.resolve();
      },
    });
    const result = await run(bridge);
    expect(result.tokens).toBe(99);
  });

  it('maps every backend error kind to a transport kind', () => {
    expect(toTransportKind('unavailable')).toBe('network');
    expect(toTransportKind('timeout')).toBe('timeout');
    expect(toTransportKind('backend')).toBe('server');
    expect(toTransportKind('model-not-found')).toBe('unknown');
    expect(toTransportKind('no-models')).toBe('unknown');
    expect(toTransportKind('protocol')).toBe('unknown');
  });
});
