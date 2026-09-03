import { describe, expect, it } from 'vitest';
import { SCENARIOS, type ScenarioId } from '../scenarios';
import { createInterruptedSession, scenarioAppState } from '../scenarioState';

describe('scenario app state', () => {
  it('empties the workspace for the empty-project scenario', () => {
    const state = scenarioAppState('empty-project');
    expect(state.sessions).toEqual([]);
    expect(state.recentProjects).toBe(false);
  });

  it('keeps recent projects but clears sessions for recent-projects', () => {
    const state = scenarioAppState('recent-projects');
    expect(state.sessions).toEqual([]);
    expect(state.recentProjects).toBe(true);
  });

  it('seeds an interrupted assistant message for interrupted-session', () => {
    const state = scenarioAppState('interrupted-session');
    const first = state.sessions?.[0];
    expect(first?.id).toBe('sess-interrupted');
    // The whole point of the scenario: a run the app can never resume.
    expect(first?.messages.at(-1)?.interrupted).toBe(true);
    expect(first?.messages.at(-1)?.stopped).toBe(true);
  });

  it('leaves the workspace alone for event-driven scenarios', () => {
    for (const id of ['normal-response', 'tests-failed', 'multi-agent'] as const) {
      expect(scenarioAppState(id).sessions).toBeNull();
    }
  });

  it('answers for every declared scenario without throwing', () => {
    for (const scenario of SCENARIOS) {
      const state = scenarioAppState(scenario.id satisfies ScenarioId);
      expect(typeof state.recentProjects).toBe('boolean');
    }
  });

  it('is deterministic — repeated calls produce identical data', () => {
    expect(createInterruptedSession()).toEqual(createInterruptedSession());
  });
});
