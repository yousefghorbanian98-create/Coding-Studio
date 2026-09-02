import type { OllamaBridge, OllamaChatParams } from './ipc';
import type { HealthStatus, OllamaEvent, OllamaModel } from './schemas';

export const FIXTURE_MODELS: OllamaModel[] = [
  {
    id: 'llama3.2:3b',
    name: 'llama3.2:3b',
    family: 'llama',
    parameterSize: '3.2B',
    quantization: 'Q4_K_M',
    sizeBytes: 2_019_393_189,
    modifiedAt: '2026-08-20T09:12:00Z',
  },
  {
    id: 'qwen2.5-coder:7b',
    name: 'qwen2.5-coder:7b',
    family: 'qwen2',
    parameterSize: '7.6B',
    quantization: 'Q4_K_M',
    sizeBytes: 4_683_073_184,
    modifiedAt: '2026-08-18T14:03:00Z',
  },
  {
    id: 'deepseek-coder-v2:16b',
    name: 'deepseek-coder-v2:16b',
    family: 'deepseek2',
    parameterSize: '15.7B',
    quantization: 'Q4_0',
    sizeBytes: 8_905_138_176,
    modifiedAt: '2026-07-30T08:41:00Z',
  },
];

export interface MockBridgeOptions {
  /** Health result; defaults to reachable. */
  health?: HealthStatus;
  models?: OllamaModel[];
  /** Chunks streamed for a chat request. */
  chunks?: string[];
  /** Emit this error instead of completing. */
  failWith?: { kind: OllamaEvent extends never ? never : string; message: string };
  /** Delay between chunks, in ms. */
  chunkDelayMs?: number;
}

/**
 * In-memory bridge for tests, Storybook and the browser preview.
 * Keeps the mock adapter available exactly as required by the sprint.
 */
export class MockOllamaBridge implements OllamaBridge {
  private readonly options: MockBridgeOptions;
  private cancelled = new Set<string>();
  endpointValue = 'http://127.0.0.1:11434';

  constructor(options: MockBridgeOptions = {}) {
    this.options = options;
  }

  health(): Promise<HealthStatus> {
    return Promise.resolve(
      this.options.health ?? {
        reachable: true,
        endpoint: this.endpointValue,
        version: '0.5.1',
      },
    );
  }

  models(): Promise<OllamaModel[]> {
    return Promise.resolve(this.options.models ?? FIXTURE_MODELS);
  }

  endpoint(): Promise<string> {
    return Promise.resolve(this.endpointValue);
  }

  setEndpoint(endpoint: string): Promise<string> {
    this.endpointValue = endpoint;
    return Promise.resolve(endpoint);
  }

  async chat(
    params: OllamaChatParams,
    onEvent: (event: OllamaEvent) => void,
  ): Promise<void> {
    onEvent({ type: 'connecting', streamId: params.streamId });

    if (this.options.failWith) {
      onEvent({
        type: 'error',
        streamId: params.streamId,
        error: {
          kind: this.options.failWith.kind as never,
          message: this.options.failWith.message,
        },
      });
      return;
    }

    const chunks = this.options.chunks ?? ['Hello ', 'from ', 'Ollama.'];
    for (const delta of chunks) {
      if (this.cancelled.has(params.streamId)) {
        onEvent({ type: 'cancelled', streamId: params.streamId });
        this.cancelled.delete(params.streamId);
        return;
      }
      if (this.options.chunkDelayMs) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.options.chunkDelayMs),
        );
      }
      onEvent({ type: 'chunk', streamId: params.streamId, delta });
    }

    if (this.cancelled.has(params.streamId)) {
      onEvent({ type: 'cancelled', streamId: params.streamId });
      this.cancelled.delete(params.streamId);
      return;
    }

    onEvent({
      type: 'done',
      streamId: params.streamId,
      evalCount: chunks.join('').length,
    });
  }

  cancel(streamId: string): Promise<boolean> {
    this.cancelled.add(streamId);
    return Promise.resolve(true);
  }
}
