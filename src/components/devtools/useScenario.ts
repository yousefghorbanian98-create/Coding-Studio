import { useEffect } from 'react';
import {
  MockStudioRuntime,
  getRuntime,
  scenarioFromSearch,
  type ScenarioId,
} from '@/services/runtime';
import { useRuntimeStore } from '@/stores/runtime';
import { useRunStore } from '@/stores/run';

/** Switches the mock runtime scenario and resets dependent state. */
export function applyScenario(scenario: ScenarioId): void {
  const runtime = getRuntime();
  if (runtime instanceof MockStudioRuntime) {
    runtime.setScenario(scenario);
  }
  useRunStore.getState().reset();
  void useRuntimeStore.getState().refresh();
}

/** Applies `?scenario=` on startup. Safe to call in any environment. */
export function useScenarioFromUrl(): void {
  useEffect(() => {
    const scenario = scenarioFromSearch(globalThis.location?.search ?? '');
    if (scenario) applyScenario(scenario);
  }, []);
}

