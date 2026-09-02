import { isTauri } from '@/lib/env';
import { setTransport } from '@/services/transport';
import { useOllamaStore } from '@/stores/ollama';
import { OllamaTransport } from './ollamaTransport';

/**
 * Chooses the transport for this environment and probes the daemon.
 *
 * Inside Tauri the real Ollama adapter is installed. In the browser preview the
 * MockTransport configured by default stays in place, so the shell remains
 * usable and the UI shows the "unavailable" state.
 */
export function bootstrapOllama(): void {
  if (isTauri()) {
    setTransport(new OllamaTransport());
  }
  void useOllamaStore.getState().refresh();
}
