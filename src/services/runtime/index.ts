import { createMockRuntime } from './mockRuntime';
import { safeParseRuntimeEvent } from './schemas';
import type { StudioRuntimeBridge, StudioRuntimeEvent } from './types';

export * from './types';
export * from './scenarios';
export * from './scenarioState';
export {
  runtimeEventSchema,
  safeParseRuntimeEvent,
  type RuntimeEventParseResult,
} from './schemas';
export {
  MockStudioRuntime,
  createMockRuntime,
  MOCK_DEFAULTS,
  type MockClock,
  type MockRuntimeOptions,
} from './mockRuntime';
export * from './fixtures';
export * from './workspace';

/** A rejected event, kept for the Agent Logs panel and diagnostics. */
export interface RuntimeDiagnostic {
  at: number;
  reason: string;
  eventType: string | null;
}

const diagnostics: RuntimeDiagnostic[] = [];
const MAX_DIAGNOSTICS = 50;

export function recordDiagnostic(entry: RuntimeDiagnostic): void {
  diagnostics.push(entry);
  if (diagnostics.length > MAX_DIAGNOSTICS) diagnostics.shift();
}

export function getDiagnostics(): readonly RuntimeDiagnostic[] {
  return diagnostics;
}

export function clearDiagnostics(): void {
  diagnostics.length = 0;
}

let active: StudioRuntimeBridge = createMockRuntime();

/** The runtime the application talks to. */
export function getRuntime(): StudioRuntimeBridge {
  return active;
}

/** Swaps the runtime — the single seam the Jcode supervisor will use. */
export function setRuntime(runtime: StudioRuntimeBridge): void {
  if (active !== runtime) active.dispose();
  active = runtime;
}

/** Restores a fresh mock runtime and clears diagnostics. */
export function resetRuntime(): StudioRuntimeBridge {
  active.dispose();
  clearDiagnostics();
  active = createMockRuntime();
  return active;
}

/**
 * Subscribes with validation applied.
 *
 * Invalid payloads are dropped and recorded as diagnostics rather than being
 * delivered to the UI or thrown, so a malformed event can never crash the app.
 */
export function subscribeValidated(
  runtime: StudioRuntimeBridge,
  listener: (event: StudioRuntimeEvent) => void,
): () => void {
  return runtime.subscribe((raw: unknown) => {
    const result = safeParseRuntimeEvent(raw);
    if (!result.ok) {
      recordDiagnostic({
        at: Date.now(),
        reason: result.reason,
        eventType: result.eventType,
      });
      return;
    }
    listener(result.event);
  });
}
