import { describe, expect, it } from 'vitest';
import { MockStudioRuntime, type MockClock } from '../mockRuntime';
import { SCENARIOS, type ScenarioId } from '../scenarios';
import { safeParseRuntimeEvent } from '../schemas';
import type { SendMessageInput, StudioRuntimeEvent } from '../types';

/** Deterministic clock: nothing fires until the test advances it. */
function createTestClock(): MockClock & { advance: (ms: number) => void } {
  let now = 0;
  let nextHandle = 1;
  const pending = new Map<number, { at: number; fn: () => void }>();

  return {
    now: () => now,
    setTimeout(fn, ms) {
      const handle = nextHandle++;
      pending.set(handle, { at: now + ms, fn });
      return handle;
    },
    clearTimeout(handle) {
      pending.delete(handle);
    },
    advance(ms) {
      const target = now + ms;
      for (;;) {
        const due = [...pending.entries()]
          .filter(([, timer]) => timer.at <= target)
          .sort((a, b) => a[1].at - b[1].at);
        const next = due[0];
        if (!next) break;
        pending.delete(next[0]);
        now = Math.max(now, next[1].at);
        next[1].fn();
      }
      now = target;
    },
  };
}

const input: SendMessageInput = {
  sessionId: 'sess-0001' as SendMessageInput['sessionId'],
  content: 'Hello',
  mode: 'agent',
  providerId: 'demo',
  modelId: 'demo-balanced',
};

/**
 * Scenarios that deliberately stay in flight so the user can cancel them.
 * They settle only once `cancelRun` is called.
 */
const IN_FLIGHT: readonly ScenarioId[] = [
  'running-tests',
  'cancel-during-streaming',
  'cancel-during-tool',
];

/** Drives a scenario to completion and returns everything it emitted. */
function runScenario(
  scenario: ScenarioId,
  options: { cancel?: boolean } = {},
): { events: StudioRuntimeEvent[]; raw: unknown[] } {
  const clock = createTestClock();
  const runtime = new MockStudioRuntime({ scenario, clock, tickMs: 10 });
  const events: StudioRuntimeEvent[] = [];
  const raw: unknown[] = [];

  runtime.subscribe((payload: unknown) => {
    raw.push(payload);
    const parsed = safeParseRuntimeEvent(payload);
    if (parsed.ok) events.push(parsed.event);
  });

  void runtime.sendMessage(input).catch(() => undefined);

  if (options.cancel === true) {
    // Interrupt part-way so the cancel lands while work is still in flight.
    clock.advance(30);
    const started = events.find((event) => event.type === 'run.started');
    if (started !== undefined && 'runId' in started) {
      void runtime.cancelRun(started.runId).catch(() => undefined);
    }
  }

  clock.advance(60_000);
  runtime.dispose();
  return { events, raw };
}

const ALL_IDS = SCENARIOS.map((s) => s.id);

describe('scenario catalogue', () => {
  it('declares all thirty mandatory scenarios', () => {
    expect(ALL_IDS).toHaveLength(30);
  });

  it('gives every scenario a unique id', () => {
    expect(new Set(ALL_IDS).size).toBe(ALL_IDS.length);
  });

  it('gives every scenario a label, description and group', () => {
    for (const scenario of SCENARIOS) {
      expect(scenario.label.length).toBeGreaterThan(0);
      expect(scenario.description.length).toBeGreaterThan(0);
      expect(scenario.group.length).toBeGreaterThan(0);
    }
  });
});

describe('every scenario runs deterministically', () => {
  it.each(ALL_IDS)('%s produces a stable event stream', (id) => {
    const first = runScenario(id);
    const second = runScenario(id);

    // Same scenario, same clock, same output — no randomness anywhere.
    expect(second.events.map((e) => e.type)).toEqual(
      first.events.map((e) => e.type),
    );
  });

  it.each(ALL_IDS)('%s settles rather than running forever', (id) => {
    const { events } = runScenario(id);
    const types = events.map((e) => e.type);

    // 'runtime-unavailable' rejects at the health check, so a run never
    // starts and no events are emitted. That is the behaviour under test.
    if (id === 'runtime-unavailable') {
      expect(types).toEqual([]);
      return;
    }

    // 'running-tests' and 'cancel-during-tool' park mid-tool on purpose so a
    // cancel can be demonstrated; the test below covers how they finish.
    if (id === 'running-tests' || id === 'cancel-during-tool') {
      expect(types).toContain('tool.started');
      expect(types).not.toContain('run.completed');
      return;
    }

    const settled = types.some(
      (type) =>
        type === 'run.completed' ||
        type === 'run.failed' ||
        // Approval scenarios deliberately park until a decision arrives.
        type === 'approval.requested',
    );
    expect(settled).toBe(true);
  });

  it.each(IN_FLIGHT)('%s settles once the run is cancelled', (id) => {
    const types = runScenario(id, { cancel: true }).events.map((e) => e.type);
    expect(types).toContain('run.cancelled');
  });

  it.each(ALL_IDS)('%s emits only schema-valid events', (id) => {
    const { raw } = runScenario(id);
    const invalid = raw.filter((payload) => !safeParseRuntimeEvent(payload).ok);

    // The invalid-event scenario exists precisely to emit one bad payload.
    if (id === 'invalid-event') {
      expect(invalid.length).toBeGreaterThan(0);
    } else {
      expect(invalid).toEqual([]);
    }
  });

  it('never leaves a timer pending after dispose', () => {
    const clock = createTestClock();
    const runtime = new MockStudioRuntime({
      scenario: 'long-streaming',
      clock,
      tickMs: 10,
    });
    let received = 0;
    runtime.subscribe(() => {
      received += 1;
    });
    void runtime.sendMessage(input).catch(() => undefined);
    clock.advance(50);
    runtime.dispose();

    const afterDispose = received;
    clock.advance(60_000);
    expect(received).toBe(afterDispose);
  });
});

describe('scenarios cover the required product situations', () => {
  const eventTypesFor = (id: ScenarioId): string[] =>
    runScenario(id).events.map((e) => e.type);

  it('surfaces plans for the plan scenarios', () => {
    for (const id of [
      'plan-awaiting-approval',
      'plan-rejected',
      'plan-edited',
    ] as const) {
      expect(eventTypesFor(id)).toContain('plan.created');
    }
  });

  it('requests approval for each approval scenario', () => {
    for (const id of [
      'file-edit-approval',
      'shell-approval',
      'package-install-approval',
    ] as const) {
      expect(eventTypesFor(id)).toContain('approval.requested');
    }
  });

  it('runs tools for the tool scenarios', () => {
    for (const id of [
      'running-tests',
      'tests-passed',
      'tests-failed',
      'multi-file-changes',
      'large-diff',
    ] as const) {
      expect(eventTypesFor(id)).toContain('tool.started');
    }
  });

  it('fails rather than completing for each error scenario', () => {
    for (const id of [
      'runtime-crash',
      'provider-unavailable',
      'authentication-required',
      'rate-limited',
      'context-limit',
      'permission-denied',
      'timeout',
    ] as const) {
      expect(eventTypesFor(id)).toContain('run.failed');
    }
  });

  it('demonstrates multiple agents for the orchestration scenario', () => {
    const types = eventTypesFor('multi-agent');
    expect(types.some((type) => type.startsWith('agent.'))).toBe(true);
  });

  it('streams a long reply with many deltas', () => {
    const deltas = runScenario('long-streaming').events.filter(
      (e) => e.type === 'message.delta',
    );
    expect(deltas.length).toBeGreaterThan(5);
  });

  it('narrates the outcome for the task-summary scenario', () => {
    const completed = runScenario('task-summary').events.find(
      (e) => e.type === 'run.completed',
    );
    expect(completed).toBeDefined();
    // Without a summary the scenario would be indistinguishable from a
    // normal response, which is exactly what it is meant to demonstrate.
    expect(
      completed && 'summary' in completed ? completed.summary : undefined,
    ).toMatch(/\S/);
  });

  it('revises the plan for the plan-edited scenario', () => {
    const updates = runScenario('plan-edited').events.filter(
      (e) => e.type === 'plan.updated',
    );
    expect(updates.length).toBeGreaterThan(0);
    const revised = updates[0];
    expect(revised && 'plan' in revised ? revised.plan.title : '').toContain(
      'revised',
    );
  });

  it('does not revise the plan for plan-awaiting-approval', () => {
    const updates = runScenario('plan-awaiting-approval').events.filter(
      (e) => e.type === 'plan.updated',
    );
    expect(updates).toEqual([]);
  });

  it('keeps distinct scenarios from producing identical streams', () => {
    const normal = eventTypesFor('normal-response').join(',');
    const failed = eventTypesFor('tests-failed').join(',');
    expect(normal).not.toBe(failed);
  });
});
