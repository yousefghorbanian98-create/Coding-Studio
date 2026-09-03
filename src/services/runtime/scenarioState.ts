/**
 * App-state side of a scenario.
 *
 * The mock runtime covers everything that arrives as a *runtime event*, but
 * four mandatory scenarios describe state that exists before any run starts:
 * whether the workspace has sessions, whether the project home has recent
 * entries, and whether a previous run was interrupted. Those cannot be
 * expressed as an event stream, so they live here as a pure description that
 * `applyScenario` hands to the stores.
 *
 * Pure and deterministic: fixed ids, fixed timestamps, no randomness.
 */

import type { ChatSession } from '@/types/chat';
import { createMockSessions } from '@/mocks/sessions';
import type { ScenarioId } from './scenarios';

const HOUR = 60 * 60 * 1000;
const BASE = Date.parse('2026-09-01T09:00:00.000Z');

/** A session whose last run never finished, as after an unclean shutdown. */
export function createInterruptedSession(): ChatSession {
  return {
    id: 'sess-interrupted',
    title: 'Refactor the runtime bridge',
    createdAt: BASE - 3 * HOUR,
    updatedAt: BASE - 2 * HOUR,
    modelId: 'studio-sonnet',
    messages: [
      {
        id: 'm-int-1',
        role: 'user',
        content: 'Split the bridge into a transport and a codec layer.',
        createdAt: BASE - 3 * HOUR,
        tokens: 16,
      },
      {
        id: 'm-int-2',
        role: 'assistant',
        modelId: 'studio-sonnet',
        content:
          'Starting with the transport seam so the codec can be swapped later. ' +
          'First I will extract the event',
        createdAt: BASE - 2 * HOUR,
        tokens: 41,
        stopped: true,
        interrupted: true,
      },
    ],
  };
}

export interface ScenarioAppState {
  /** Sessions the chat store should show, or null to leave it untouched. */
  sessions: ChatSession[] | null;
  /** Whether the project home should list recent workspaces. */
  recentProjects: boolean;
}

/**
 * Describes the pre-run state a scenario needs.
 *
 * Scenarios not listed here only exercise runtime events, so they keep the
 * default workspace and are reported as `sessions: null`.
 */
export function scenarioAppState(scenario: ScenarioId): ScenarioAppState {
  switch (scenario) {
    case 'empty-project':
      // Nothing at all: no sessions and no recent projects.
      return { sessions: [], recentProjects: false };
    case 'recent-projects':
      // Project home is the subject, so the transcript starts empty.
      return { sessions: [], recentProjects: true };
    case 'interrupted-session':
      return {
        sessions: [createInterruptedSession(), ...createMockSessions()],
        recentProjects: true,
      };
    default:
      return { sessions: null, recentProjects: true };
  }
}
