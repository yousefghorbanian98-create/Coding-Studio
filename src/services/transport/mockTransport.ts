import { estimateTokens, runMockStream } from '@/mocks/stream';
import type {
  ChatTransport,
  CompletionRequest,
  CompletionResult,
  StreamChunk,
} from './types';

export interface MockTransportOptions {
  delayMs?: number;
  seed?: number;
}

/**
 * Default transport: replays a canned reply token-by-token.
 * Keeps the app fully usable with no backend configured.
 */
export class MockTransport implements ChatTransport {
  readonly id = 'mock';
  private readonly options: MockTransportOptions;

  constructor(options: MockTransportOptions = {}) {
    this.options = options;
  }

  async complete(
    request: CompletionRequest,
    onChunk: (chunk: StreamChunk) => void,
  ): Promise<CompletionResult> {
    const lastUser = [...request.messages]
      .reverse()
      .find((message) => message.role === 'user');

    const result = await runMockStream({
      prompt: lastUser?.content ?? '',
      modelId: request.modelId,
      signal: request.signal,
      onChunk: (delta) => onChunk({ delta }),
      ...(this.options.delayMs !== undefined
        ? { delayMs: this.options.delayMs }
        : {}),
      ...(this.options.seed !== undefined ? { seed: this.options.seed } : {}),
    });

    return {
      text: result.text,
      tokens: estimateTokens(result.text),
      latencyMs: result.latencyMs,
      aborted: result.aborted,
    };
  }
}
