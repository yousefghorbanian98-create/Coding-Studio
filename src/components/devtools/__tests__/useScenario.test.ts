import { beforeEach, describe, expect, it } from 'vitest';
import { applyScenario } from '../useScenario';
import { useChatStore } from '@/stores/chat';
import { useProjectsStore } from '@/stores/projects';
import { useRunStore } from '@/stores/run';

beforeEach(() => {
  globalThis.localStorage?.clear();
  useProjectsStore.getState().reset();
});

describe('applyScenario', () => {
  it('empties both the workspace and the project home', () => {
    applyScenario('empty-project');
    expect(useChatStore.getState().sessions).toEqual([]);
    expect(useProjectsStore.getState().projects).toEqual([]);
  });

  it('keeps recent projects while clearing sessions', () => {
    applyScenario('empty-project');
    applyScenario('recent-projects');
    expect(useChatStore.getState().sessions).toEqual([]);
    expect(useProjectsStore.getState().projects.length).toBeGreaterThan(0);
  });

  it('restores an interrupted session the user cannot resume', () => {
    applyScenario('interrupted-session');
    const first = useChatStore.getState().sessions[0];
    expect(first?.messages.at(-1)?.interrupted).toBe(true);
    // The interrupted session must also be the one on screen.
    expect(useChatStore.getState().activeSessionId).toBe(first?.id);
  });

  it('leaves the seeded workspace alone for event-driven scenarios', () => {
    applyScenario('interrupted-session');
    const before = useChatStore.getState().sessions.length;
    applyScenario('normal-response');
    expect(useChatStore.getState().sessions).toHaveLength(before);
  });

  it('clears leftover run state when switching scenarios', () => {
    useRunStore.setState({ phase: 'completed', summary: 'Old summary.' });
    applyScenario('normal-response');
    expect(useRunStore.getState().summary).toBeNull();
    expect(useRunStore.getState().phase).toBe('idle');
  });
});
