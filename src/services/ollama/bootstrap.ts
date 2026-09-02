import { isTauri } from '@/lib/env';
import { setTransport } from '@/services/transport';
import { useOllamaStore } from '@/stores/ollama';
import { OllamaTransport } from './ollamaTransport';
import { setOllamaBridge } from './ipc';
import { MockOllamaBridge } from './mockBridge';

/**
 * Chooses the transport for this environment and probes the daemon.
 *
 * Inside Tauri the real Rust adapter is installed and talks to the daemon over
 * IPC. In a plain browser (Live Preview, Playwright, Storybook) there is no
 * backend to reach, so the retained Mock Adapter stands in and the shell stays
 * fully explorable with fixture models.
 */
export function bootstrapOllama(): void {
  if (isTauri()) {
    setOllamaBridge(null);
    setTransport(new OllamaTransport());
  } else {
    setOllamaBridge(new MockOllamaBridge());
  }
  void useOllamaStore.getState().refresh();
}
