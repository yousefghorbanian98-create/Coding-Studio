import { isTauri } from '@/lib/env';
import {
  healthStatusSchema,
  ollamaModelsSchema,
  safeParseEvent,
  type HealthStatus,
  type OllamaEvent,
  type OllamaModel,
} from './schemas';

/**
 * Thin, validated wrapper around the Tauri commands.
 *
 * The frontend never talks to localhost:11434 directly — every call goes
 * through Rust, which owns the HTTP client.
 */

export interface OllamaChatParams {
  streamId: string;
  model: string;
  messages: { role: string; content: string }[];
}

export interface OllamaBridge {
  health(): Promise<HealthStatus>;
  models(): Promise<OllamaModel[]>;
  endpoint(): Promise<string>;
  setEndpoint(endpoint: string): Promise<string>;
  chat(params: OllamaChatParams, onEvent: (event: OllamaEvent) => void): Promise<void>;
  cancel(streamId: string): Promise<boolean>;
}

type InvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

async function tauriApi(): Promise<{
  invoke: InvokeFn;
  Channel: new <T>() => { onmessage: (message: T) => void };
}> {
  const core = (await import('@tauri-apps/api/core')) as unknown as {
    invoke: InvokeFn;
    Channel: new <T>() => { onmessage: (message: T) => void };
  };
  return { invoke: core.invoke, Channel: core.Channel };
}

class TauriOllamaBridge implements OllamaBridge {
  async health(): Promise<HealthStatus> {
    const { invoke } = await tauriApi();
    return healthStatusSchema.parse(await invoke('ollama_health'));
  }

  async models(): Promise<OllamaModel[]> {
    const { invoke } = await tauriApi();
    return ollamaModelsSchema.parse(await invoke('ollama_models'));
  }

  async endpoint(): Promise<string> {
    const { invoke } = await tauriApi();
    return String(await invoke('ollama_endpoint'));
  }

  async setEndpoint(endpoint: string): Promise<string> {
    const { invoke } = await tauriApi();
    return String(await invoke('ollama_set_endpoint', { endpoint }));
  }

  async chat(
    params: OllamaChatParams,
    onEvent: (event: OllamaEvent) => void,
  ): Promise<void> {
    const { invoke, Channel } = await tauriApi();
    const channel = new Channel<unknown>();
    channel.onmessage = (message): void => {
      const event = safeParseEvent(message);
      // Drop anything that does not match the contract rather than crashing.
      if (event) onEvent(event);
    };

    await invoke('ollama_chat', {
      request: {
        streamId: params.streamId,
        model: params.model,
        messages: params.messages,
      },
      channel,
    });
  }

  async cancel(streamId: string): Promise<boolean> {
    const { invoke } = await tauriApi();
    return Boolean(await invoke('ollama_cancel', { streamId }));
  }
}

/** Bridge used in the browser preview and in tests: reports "unavailable". */
export class UnavailableOllamaBridge implements OllamaBridge {
  health(): Promise<HealthStatus> {
    return Promise.resolve({
      reachable: false,
      endpoint: 'http://127.0.0.1:11434',
      error: {
        kind: 'unavailable',
        message: 'The desktop backend is not available in this preview.',
      },
    });
  }

  models(): Promise<OllamaModel[]> {
    return Promise.resolve([]);
  }

  endpoint(): Promise<string> {
    return Promise.resolve('http://127.0.0.1:11434');
  }

  setEndpoint(endpoint: string): Promise<string> {
    return Promise.resolve(endpoint);
  }

  chat(
    params: OllamaChatParams,
    onEvent: (event: OllamaEvent) => void,
  ): Promise<void> {
    onEvent({
      type: 'error',
      streamId: params.streamId,
      error: {
        kind: 'unavailable',
        message: 'The desktop backend is not available in this preview.',
      },
    });
    return Promise.resolve();
  }

  cancel(): Promise<boolean> {
    return Promise.resolve(false);
  }
}

let bridge: OllamaBridge | null = null;

export function getOllamaBridge(): OllamaBridge {
  bridge ??= isTauri() ? new TauriOllamaBridge() : new UnavailableOllamaBridge();
  return bridge;
}

/** Overrides the bridge — used by tests and Storybook. */
export function setOllamaBridge(next: OllamaBridge | null): void {
  bridge = next;
}
