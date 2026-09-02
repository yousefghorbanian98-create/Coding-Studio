import { estimateTokens } from '@/mocks/stream';
import { readSseStream } from './sse';
import {
  TransportError,
  type ChatTransport,
  type CompletionRequest,
  type CompletionResult,
  type StreamChunk,
} from './types';

export interface HttpTransportOptions {
  /** Base URL of the completions endpoint. */
  endpoint: string;
  /** Extra headers, e.g. an Authorization header supplied by the host app. */
  headers?: Record<string, string>;
  /** Abort the request if the server sends nothing for this long. */
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/** Shape of an OpenAI-compatible streaming delta payload. */
interface DeltaPayload {
  choices?: { delta?: { content?: string }; finish_reason?: string | null }[];
}

function extractDelta(data: string): string | null {
  if (data === '[DONE]') return null;
  try {
    const parsed = JSON.parse(data) as DeltaPayload;
    return parsed.choices?.[0]?.delta?.content ?? '';
  } catch {
    // Tolerate a non-JSON keepalive rather than killing the stream.
    return '';
  }
}

/**
 * Streams completions from an OpenAI-compatible SSE endpoint.
 *
 * No credentials are read from the environment or persisted; callers pass
 * headers explicitly so secrets stay out of the repository and out of state.
 */
export class HttpTransport implements ChatTransport {
  readonly id = 'http';
  private readonly options: HttpTransportOptions;

  constructor(options: HttpTransportOptions) {
    this.options = options;
  }

  async complete(
    request: CompletionRequest,
    onChunk: (chunk: StreamChunk) => void,
  ): Promise<CompletionResult> {
    const doFetch = this.options.fetchImpl ?? globalThis.fetch;
    const started = Date.now();
    let text = '';

    // Combine the caller's signal with an inactivity timeout.
    const controller = new AbortController();
    const onAbort = (): void => controller.abort();
    request.signal.addEventListener('abort', onAbort, { once: true });

    let timer: ReturnType<typeof setTimeout> | undefined;
    const armTimeout = (): void => {
      if (this.options.timeoutMs === undefined) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => controller.abort(), this.options.timeoutMs);
    };
    armTimeout();

    const finish = (aborted: boolean): CompletionResult => ({
      text,
      tokens: estimateTokens(text),
      latencyMs: Date.now() - started,
      aborted,
    });

    try {
      const response = await doFetch(this.options.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...this.options.headers,
        },
        body: JSON.stringify({
          model: request.modelId,
          stream: true,
          messages: request.messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw TransportError.fromStatus(response.status, response.statusText);
      }
      if (!response.body) {
        throw new TransportError('server', 'Response had no body');
      }

      for await (const event of readSseStream(response.body, controller.signal)) {
        armTimeout();
        const delta = extractDelta(event.data);
        if (delta === null) break; // [DONE]
        if (delta) {
          text += delta;
          onChunk({ delta });
        }
      }

      return finish(request.signal.aborted);
    } catch (error) {
      // A caller-initiated abort is a normal outcome, not a failure.
      if (request.signal.aborted) return finish(true);

      if (error instanceof TransportError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new TransportError('timeout', 'The request timed out');
      }
      throw new TransportError(
        'network',
        error instanceof Error ? error.message : 'Network request failed',
      );
    } finally {
      if (timer) clearTimeout(timer);
      request.signal.removeEventListener('abort', onAbort);
    }
  }
}
