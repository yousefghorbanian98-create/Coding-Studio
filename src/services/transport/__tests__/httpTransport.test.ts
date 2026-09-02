import { describe, expect, it, vi } from 'vitest';
import { HttpTransport } from '../httpTransport';
import { TransportError } from '../types';
import type { ChatMessage } from '@/types/chat';

const messages: ChatMessage[] = [
  { id: 'm1', role: 'user', content: 'hello', createdAt: 1 },
];

function sseResponse(chunks: string[], init: ResponseInit = {}): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, ...init });
}

function delta(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
}

describe('HttpTransport', () => {
  it('streams deltas and returns the assembled text', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(sseResponse([delta('Hel'), delta('lo'), 'data: [DONE]\n\n'])),
    );
    const transport = new HttpTransport({
      endpoint: 'https://example.test/v1/chat',
      fetchImpl,
    });

    const received: string[] = [];
    const result = await transport.complete(
      { messages, modelId: 'm', signal: new AbortController().signal },
      (chunk) => received.push(chunk.delta),
    );

    expect(received).toEqual(['Hel', 'lo']);
    expect(result.text).toBe('Hello');
    expect(result.aborted).toBe(false);
    expect(result.tokens).toBeGreaterThan(0);
  });

  it('sends the conversation and model in the request body', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(sseResponse(['data: [DONE]\n\n'])),
    );
    const transport = new HttpTransport({
      endpoint: 'https://example.test/v1/chat',
      headers: { Authorization: 'Bearer test' },
      fetchImpl,
    });

    await transport.complete(
      { messages, modelId: 'studio-opus', signal: new AbortController().signal },
      () => {},
    );

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body['model']).toBe('studio-opus');
    expect(body['stream']).toBe(true);
    expect(body['messages']).toEqual([{ role: 'user', content: 'hello' }]);
    expect((init.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer test',
    );
  });

  it('resolves with aborted when the caller stops the stream', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(() => {
      controller.abort();
      return Promise.resolve(sseResponse([delta('partial')]));
    });
    const transport = new HttpTransport({
      endpoint: 'https://example.test/v1/chat',
      fetchImpl,
    });

    const result = await transport.complete(
      { messages, modelId: 'm', signal: controller.signal },
      () => {},
    );
    expect(result.aborted).toBe(true);
  });

  it('maps 401 to an unauthorized transport error', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response('', { status: 401 })),
    );
    const transport = new HttpTransport({
      endpoint: 'https://example.test/v1/chat',
      fetchImpl,
    });

    await expect(
      transport.complete(
        { messages, modelId: 'm', signal: new AbortController().signal },
        () => {},
      ),
    ).rejects.toMatchObject({ kind: 'unauthorized' });
  });

  it('maps 429 to rate-limited and 500 to server', async () => {
    for (const [status, kind] of [
      [429, 'rate-limited'],
      [503, 'server'],
    ] as const) {
      const transport = new HttpTransport({
        endpoint: 'https://example.test/v1/chat',
        fetchImpl: () =>
          Promise.resolve(new Response('', { status })),
      });
      await expect(
        transport.complete(
          { messages, modelId: 'm', signal: new AbortController().signal },
          () => {},
        ),
      ).rejects.toMatchObject({ kind });
    }
  });

  it('wraps a network failure as a network error', async () => {
    const transport = new HttpTransport({
      endpoint: 'https://example.test/v1/chat',
      fetchImpl: () =>
        Promise.reject(new Error('ECONNREFUSED')),
    });

    const error = await transport
      .complete(
        { messages, modelId: 'm', signal: new AbortController().signal },
        () => {},
      )
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(TransportError);
    expect((error as TransportError).kind).toBe('network');
  });

  it('tolerates malformed JSON in a delta without dropping the stream', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        sseResponse(['data: not-json\n\n', delta('ok'), 'data: [DONE]\n\n']),
      ),
    );
    const transport = new HttpTransport({
      endpoint: 'https://example.test/v1/chat',
      fetchImpl,
    });

    const result = await transport.complete(
      { messages, modelId: 'm', signal: new AbortController().signal },
      () => {},
    );
    expect(result.text).toBe('ok');
  });
});
