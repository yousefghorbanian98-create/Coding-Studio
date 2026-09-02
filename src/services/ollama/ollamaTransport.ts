import { estimateTokens } from '@/mocks/stream';
import {
  TransportError,
  type ChatTransport,
  type CompletionRequest,
  type CompletionResult,
  type StreamChunk,
  type TransportErrorKind,
} from '@/services/transport';
import { getOllamaBridge, type OllamaBridge } from './ipc';
import type { OllamaErrorKind, OllamaEvent } from './schemas';

let streamCounter = 0;
function nextStreamId(): string {
  streamCounter += 1;
  return `stream-${Date.now().toString(36)}-${streamCounter.toString(36)}`;
}

/** Maps a backend error kind onto the transport-level kind used by the store. */
export function toTransportKind(kind: OllamaErrorKind): TransportErrorKind {
  switch (kind) {
    case 'unavailable':
      return 'network';
    case 'timeout':
      return 'timeout';
    case 'no-models':
    case 'model-not-found':
    case 'protocol':
      return 'unknown';
    case 'backend':
      return 'server';
    case 'cancelled':
    default:
      return 'unknown';
  }
}

/**
 * ChatTransport backed by the Rust Ollama adapter.
 *
 * Implements the same seam as MockTransport, so the chat store is unchanged:
 * resolves with `aborted: true` on cancellation, rejects with TransportError
 * on genuine failures.
 */
export class OllamaTransport implements ChatTransport {
  readonly id = 'ollama';
  private readonly bridge: OllamaBridge;

  constructor(bridge?: OllamaBridge) {
    this.bridge = bridge ?? getOllamaBridge();
  }

  async complete(
    request: CompletionRequest,
    onChunk: (chunk: StreamChunk) => void,
  ): Promise<CompletionResult> {
    const streamId = nextStreamId();
    const started = Date.now();
    let text = '';
    let cancelled = false;
    let failure: TransportError | null = null;
    let evalCount: number | undefined;

    // A stop request must reach Rust, which owns the HTTP connection.
    const onAbort = (): void => {
      cancelled = true;
      void this.bridge.cancel(streamId);
    };
    if (request.signal.aborted) onAbort();
    else request.signal.addEventListener('abort', onAbort, { once: true });

    const handleEvent = (event: OllamaEvent): void => {
      switch (event.type) {
        case 'chunk':
          text += event.delta;
          onChunk({ delta: event.delta });
          break;
        case 'cancelled':
          cancelled = true;
          break;
        case 'done':
          evalCount = event.evalCount;
          break;
        case 'error':
          failure = new TransportError(
            toTransportKind(event.error.kind),
            event.error.message,
          );
          break;
        case 'connecting':
        default:
          break;
      }
    };

    try {
      await this.bridge.chat(
        {
          streamId,
          model: request.modelId,
          messages: request.messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        },
        handleEvent,
      );
    } catch (error) {
      if (!cancelled && !failure) {
        failure = new TransportError(
          'network',
          error instanceof Error ? error.message : 'Ollama request failed',
        );
      }
    } finally {
      request.signal.removeEventListener('abort', onAbort);
    }

    // Cancellation is a normal outcome; keep whatever text arrived.
    if (cancelled || request.signal.aborted) {
      return {
        text,
        tokens: evalCount ?? estimateTokens(text),
        latencyMs: Date.now() - started,
        aborted: true,
      };
    }

    if (failure) throw failure;

    return {
      text,
      tokens: evalCount ?? estimateTokens(text),
      latencyMs: Date.now() - started,
      aborted: false,
    };
  }
}
