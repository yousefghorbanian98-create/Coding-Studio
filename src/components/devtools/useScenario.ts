import { useEffect } from 'react';
import {
  MockStudioRuntime,
  getRuntime,
  scenarioFromSearch,
  scenarioAppState,
  type ScenarioId,
} from '@/services/runtime';
import { useRuntimeStore } from '@/stores/runtime';
import { useRunStore } from '@/stores/run';
import { useChatStore } from '@/stores/chat';
import { useProjectsStore } from '@/stores/projects';

/** Switches the mock runtime scenario and resets dependent state. */
export function applyScenario(scenario: ScenarioId): void {
  const runtime = getRuntime();
  if (runtime instanceof MockStudioRuntime) {
    runtime.setScenario(scenario);
  }
  useRunStore.getState().reset();

  // Some scenarios describe the workspace *before* a run starts — an empty
  // project, a populated project home, a session left mid-stream. Those cannot
  // arrive as runtime events, so they are applied to the stores directly.
  const state = scenarioAppState(scenario);
  if (state.sessions !== null) {
    useChatStore.getState().loadSessions(state.sessions);
  }
  const projects = useProjectsStore.getState();
  if (state.recentProjects) projects.reset();
  else projects.clear();

  void useRuntimeStore.getState().refresh();
}

/** Applies `?scenario=` on startup. Safe to call in any environment. */
export function useScenarioFromUrl(): void {
  useEffect(() => {
    const scenario = scenarioFromSearch(globalThis.location?.search ?? '');
    if (scenario) applyScenario(scenario);
  }, []);
}
