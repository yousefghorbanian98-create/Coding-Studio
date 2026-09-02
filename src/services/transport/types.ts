import type { ChatMessage } from '@/types/chat';

/** A single delta emitted while an assistant reply is being produced. */
export interface StreamChunk {
  /** Text to append to the assistant message. */
  delta: string;
}

export interface CompletionRequest {
  /** Full conversation history, oldest first. */
  messages: ChatMessage[];
  modelId: string;
  signal: AbortSignal;
}

export interface CompletionResult {
  text: string;
  tokens: number;
  latencyMs: number;
  /** True when the caller aborted before the reply finished. */
  aborted: boolean;
}

/**
 * The single seam between the UI and whatever produces assistant replies.
 *
 * Implementations must:
 * - stream deltas through `onChunk` as they arrive,
 * - resolve (never reject) with `aborted: true` when `signal` fires,
 * - reject with `TransportError` for genuine failures.
 */
export interface ChatTransport {
  readonly id: string;
  complete(
    request: CompletionRequest,
    onChunk: (chunk: StreamChunk) => void,
  ): Promise<CompletionResult>;
}

export type TransportErrorKind =
  | 'network'
  | 'timeout'
  | 'unauthorized'
  | 'rate-limited'
  | 'server'
  | 'unknown';

export class TransportError extends Error {
  readonly kind: TransportErrorKind;
  readonly status?: number | undefined;

  constructor(
    kind: TransportErrorKind,
    message: string,
    status?: number,
  ) {
    super(message);
    this.name = 'TransportError';
    this.kind = kind;
    this.status = status;
  }

  /** Maps an HTTP status onto a transport error kind. */
  static fromStatus(status: number, message?: string): TransportError {
    const kind: TransportErrorKind =
      status === 401 || status === 403
        ? 'unauthorized'
        : status === 429
          ? 'rate-limited'
          : status >= 500
            ? 'server'
            : 'unknown';
    return new TransportError(
      kind,
      message ?? `Request failed with status ${status}`,
      status,
    );
  }
}

/** Translation key describing an error, for user-facing display. */
export function errorMessageKey(error: unknown): string {
  if (error instanceof TransportError) {
    switch (error.kind) {
      case 'network':
        return 'errors.network';
      case 'timeout':
        return 'errors.timeout';
      case 'unauthorized':
        return 'errors.unauthorized';
      case 'rate-limited':
        return 'errors.rateLimited';
      case 'server':
        return 'errors.server';
      default:
        return 'errors.unknown';
    }
  }
  return 'errors.unknown';
}
