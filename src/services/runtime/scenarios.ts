/**
 * Deterministic scenarios driving the mock runtime.
 *
 * Every scenario is a pure description: the mock runtime turns it into a
 * timed event sequence. Nothing here uses randomness or wall-clock branching,
 * so screenshots and Playwright runs are reproducible.
 */

export type ScenarioId =
  | 'empty-project'
  | 'recent-projects'
  | 'normal-response'
  | 'long-streaming'
  | 'code-block-streaming'
  | 'plan-awaiting-approval'
  | 'plan-rejected'
  | 'plan-edited'
  | 'file-edit-approval'
  | 'shell-approval'
  | 'package-install-approval'
  | 'running-tests'
  | 'tests-passed'
  | 'tests-failed'
  | 'multi-file-changes'
  | 'large-diff'
  | 'cancel-during-streaming'
  | 'cancel-during-tool'
  | 'runtime-unavailable'
  | 'runtime-crash'
  | 'provider-unavailable'
  | 'authentication-required'
  | 'rate-limited'
  | 'context-limit'
  | 'permission-denied'
  | 'timeout'
  | 'invalid-event'
  | 'interrupted-session'
  | 'multi-agent'
  | 'task-summary';

export interface ScenarioDescriptor {
  id: ScenarioId;
  /** Short label shown in the Scenario Lab. */
  label: string;
  group: 'baseline' | 'plans' | 'approvals' | 'tools' | 'errors' | 'agents';
  description: string;
}

export const SCENARIOS: readonly ScenarioDescriptor[] = [
  {
    id: 'empty-project',
    label: 'Empty project',
    group: 'baseline',
    description: 'No sessions and no recent projects.',
  },
  {
    id: 'recent-projects',
    label: 'Recent projects',
    group: 'baseline',
    description: 'Project home populated with recent workspaces.',
  },
  {
    id: 'normal-response',
    label: 'Normal response',
    group: 'baseline',
    description: 'A short assistant reply that streams and completes.',
  },
  {
    id: 'long-streaming',
    label: 'Long streaming response',
    group: 'baseline',
    description: 'A multi-paragraph reply for scroll and performance checks.',
  },
  {
    id: 'code-block-streaming',
    label: 'Code block streaming',
    group: 'baseline',
    description: 'A reply containing a fenced code block.',
  },
  {
    id: 'plan-awaiting-approval',
    label: 'Plan awaiting approval',
    group: 'plans',
    description: 'Plan mode produces a plan that blocks on approval.',
  },
  {
    id: 'plan-rejected',
    label: 'Plan rejected',
    group: 'plans',
    description: 'The plan is declined and the run stops cleanly.',
  },
  {
    id: 'plan-edited',
    label: 'Plan edited',
    group: 'plans',
    description: 'An extra instruction is added before approval.',
  },
  {
    id: 'file-edit-approval',
    label: 'File edit approval',
    group: 'approvals',
    description: 'A file modification requires consent.',
  },
  {
    id: 'shell-approval',
    label: 'Shell command approval',
    group: 'approvals',
    description: 'A shell command that can be edited before approval.',
  },
  {
    id: 'package-install-approval',
    label: 'Package installation approval',
    group: 'approvals',
    description: 'A dependency install flagged as high risk.',
  },
  {
    id: 'running-tests',
    label: 'Running tests',
    group: 'tools',
    description: 'A long-running test tool call in progress.',
  },
  {
    id: 'tests-passed',
    label: 'Successful tests',
    group: 'tools',
    description: 'The test run completes green.',
  },
  {
    id: 'tests-failed',
    label: 'Failed tests',
    group: 'tools',
    description: 'The test run fails with readable output.',
  },
  {
    id: 'multi-file-changes',
    label: 'Multi-file changes',
    group: 'tools',
    description: 'Several files added, modified and renamed.',
  },
  {
    id: 'large-diff',
    label: 'Large diff',
    group: 'tools',
    description: 'A change set big enough to exercise virtualisation.',
  },
  {
    id: 'cancel-during-streaming',
    label: 'Cancel during streaming',
    group: 'baseline',
    description: 'Cancellation mid-reply keeps the partial text.',
  },
  {
    id: 'cancel-during-tool',
    label: 'Cancel during tool execution',
    group: 'tools',
    description: 'Cancellation while a tool call is running.',
  },
  {
    id: 'runtime-unavailable',
    label: 'Runtime unavailable',
    group: 'errors',
    description: 'The runtime cannot be reached.',
  },
  {
    id: 'runtime-crash',
    label: 'Runtime crash',
    group: 'errors',
    description: 'The runtime dies mid-run.',
  },
  {
    id: 'provider-unavailable',
    label: 'Provider unavailable',
    group: 'errors',
    description: 'The selected provider is down.',
  },
  {
    id: 'authentication-required',
    label: 'Authentication required',
    group: 'errors',
    description: 'The provider needs credentials that are not configured.',
  },
  {
    id: 'rate-limited',
    label: 'Rate limited',
    group: 'errors',
    description: 'The provider rejects the request as too frequent.',
  },
  {
    id: 'context-limit',
    label: 'Context limit reached',
    group: 'errors',
    description: 'The conversation exceeds the model context window.',
  },
  {
    id: 'permission-denied',
    label: 'Permission denied',
    group: 'errors',
    description: 'A tool call is blocked by workspace permissions.',
  },
  {
    id: 'timeout',
    label: 'Timeout',
    group: 'errors',
    description: 'The run exceeds its time budget.',
  },
  {
    id: 'invalid-event',
    label: 'Invalid runtime event',
    group: 'errors',
    description: 'A malformed event is dropped and reported as a diagnostic.',
  },
  {
    id: 'interrupted-session',
    label: 'Interrupted restored session',
    group: 'errors',
    description: 'A reloaded session whose run never finished.',
  },
  {
    id: 'multi-agent',
    label: 'Multi-agent demonstration',
    group: 'agents',
    description: 'Several mock agents working in parallel.',
  },
  {
    id: 'task-summary',
    label: 'Successful task summary',
    group: 'agents',
    description: 'A completed run with a closing summary.',
  },
];

export const DEFAULT_SCENARIO: ScenarioId = 'normal-response';

const SCENARIO_IDS = new Set<string>(SCENARIOS.map((s) => s.id));

export function isScenarioId(value: string): value is ScenarioId {
  return SCENARIO_IDS.has(value);
}

/**
 * Reads the scenario from a URL query string (`?scenario=…`).
 * Returns null when absent or unrecognised, so callers keep their default.
 */
export function scenarioFromSearch(search: string): ScenarioId | null {
  const value = new URLSearchParams(search).get('scenario');
  return value && isScenarioId(value) ? value : null;
}
