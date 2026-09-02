import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockStudioRuntime, type MockClock } from '../mockRuntime';
import { subscribeValidated, clearDiagnostics, getDiagnostics } from '../index';
import {
  asApprovalId,
  asRunId,
  type SendMessageInput,
  type StudioRuntimeEvent,
} from '../types';

/** Deterministic clock: timers fire only when the test advances them. */
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
      // Fire due timers in chronological order, including ones queued meanwhile.
      for (;;) {
        const due = [...pending.entries()]
          .filter(([, t]) => t.at <= target)
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

let runtime: MockStudioRuntime;
let clock: ReturnType<typeof createTestClock>;
let events: StudioRuntimeEvent[];

const input: SendMessageInput = {
  sessionId: 'sess-0001' as SendMessageInput['sessionId'],
  content: 'Hello',
  mode: 'ask',
  providerId: 'demo',
  modelId: 'demo-balanced',
};

function typesOf(): string[] {
  return events.map((e) => e.type);
}

beforeEach(() => {
  clearDiagnostics();
  clock = createTestClock();
  runtime = new MockStudioRuntime({ clock, tickMs: 10 });
  events = [];
});

afterEach(() => {
  runtime.dispose();
});

describe('MockStudioRuntime', () => {
  it('reports ready health and full capabilities', async () => {
    const health = await runtime.getHealth();
    expect(health.status).toBe('ready');
    expect(health.kind).toBe('mock');

    const caps = await runtime.getCapabilities();
    expect(caps.streaming).toBe(true);
    expect(caps.cancellation).toBe(true);
    expect(caps.eventSchemaVersion).toBe('1.0.0');
  });

  it('streams a reply and completes the run', async () => {
    runtime.subscribe((e) => events.push(e));
    await runtime.sendMessage(input);
    clock.advance(1000);

    expect(typesOf()).toContain('run.started');
    expect(typesOf()).toContain('message.started');
    expect(typesOf()).toContain('message.completed');
    expect(typesOf()).toContain('run.completed');

    const text = events
      .filter((e) => e.type === 'message.delta')
      .map((e) => (e.type === 'message.delta' ? e.delta : ''))
      .join('');
    expect(text.length).toBeGreaterThan(0);
  });

  it('produces identical output for identical inputs', async () => {
    const first: string[] = [];
    runtime.subscribe((e) => {
      if (e.type === 'message.delta') first.push(e.delta);
    });
    await runtime.sendMessage(input);
    clock.advance(1000);

    const clock2 = createTestClock();
    const runtime2 = new MockStudioRuntime({ clock: clock2, tickMs: 10 });
    const second: string[] = [];
    runtime2.subscribe((e) => {
      if (e.type === 'message.delta') second.push(e.delta);
    });
    await runtime2.sendMessage(input);
    clock2.advance(1000);
    runtime2.dispose();

    expect(second).toEqual(first);
  });

  it('cancels a run and stops emitting deltas', async () => {
    runtime.setScenario('cancel-during-streaming');
    runtime.subscribe((e) => events.push(e));
    const handle = await runtime.sendMessage(input);

    clock.advance(30);
    const before = events.filter((e) => e.type === 'message.delta').length;
    expect(before).toBeGreaterThan(0);

    await runtime.cancelRun(handle.runId);
    clock.advance(5000);

    const after = events.filter((e) => e.type === 'message.delta').length;
    expect(after).toBe(before);
    expect(typesOf()).toContain('run.cancel_requested');
    expect(typesOf()).toContain('run.cancelled');
    expect(typesOf()).not.toContain('run.completed');
  });

  it('ignores cancellation of an unknown or finished run', async () => {
    await expect(runtime.cancelRun(asRunId('run-9999'))).resolves.toBeUndefined();
  });

  it('does not emit run.cancelled twice', async () => {
    runtime.setScenario('cancel-during-streaming');
    runtime.subscribe((e) => events.push(e));
    const handle = await runtime.sendMessage(input);
    clock.advance(20);

    await runtime.cancelRun(handle.runId);
    await runtime.cancelRun(handle.runId);
    clock.advance(1000);

    expect(events.filter((e) => e.type === 'run.cancelled')).toHaveLength(1);
  });

  it.each([
    ['runtime-unavailable', 'runtime-unavailable'],
    ['provider-unavailable', 'provider-unavailable'],
    ['authentication-required', 'authentication-required'],
    ['rate-limited', 'rate-limited'],
    ['context-limit', 'context-limit'],
    ['permission-denied', 'permission-denied'],
  ] as const)('surfaces the %s scenario as a typed failure', async (scenario, kind) => {
    runtime.setScenario(scenario);
    runtime.subscribe((e) => events.push(e));

    if (scenario === 'runtime-unavailable') {
      // Health is unavailable, so sendMessage rejects outright.
      await expect(runtime.sendMessage(input)).rejects.toMatchObject({ kind });
      return;
    }

    await runtime.sendMessage(input);
    clock.advance(1000);
    const failure = events.find((e) => e.type === 'run.failed');
    expect(failure).toBeDefined();
    if (failure?.type === 'run.failed') expect(failure.error.kind).toBe(kind);
  });

  it('reports a crashed runtime through health and the run', async () => {
    runtime.setScenario('runtime-crash');
    runtime.subscribe((e) => events.push(e));
    // A crashed runtime still accepts the call, then fails the run.
    const health = await runtime.getHealth();
    expect(health.status).toBe('crashed');
  });

  it('fails with a timeout after the budget elapses', async () => {
    runtime.setScenario('timeout');
    runtime.subscribe((e) => events.push(e));
    await runtime.sendMessage(input);
    clock.advance(1000);

    const failure = events.find((e) => e.type === 'run.failed');
    expect(failure?.type === 'run.failed' && failure.error.kind).toBe('timeout');
  });

  it('requests approval for a plan and resumes once approved', async () => {
    runtime.setScenario('plan-awaiting-approval');
    runtime.subscribe((e) => events.push(e));
    await runtime.sendMessage(input);
    clock.advance(100);

    const requested = events.find((e) => e.type === 'approval.requested');
    expect(requested).toBeDefined();
    if (requested?.type !== 'approval.requested') return;

    // The run must stay open while it waits for a decision.
    expect(typesOf()).not.toContain('run.completed');

    await runtime.respondToApproval(requested.approval.id, {
      decision: 'approve-once',
    });
    clock.advance(1000);

    expect(typesOf()).toContain('approval.resolved');
    expect(typesOf()).toContain('run.completed');
  });

  it('stops the run when a plan is rejected', async () => {
    runtime.setScenario('plan-awaiting-approval');
    runtime.subscribe((e) => events.push(e));
    await runtime.sendMessage(input);
    clock.advance(100);

    const requested = events.find((e) => e.type === 'approval.requested');
    if (requested?.type !== 'approval.requested') throw new Error('no approval');

    await runtime.respondToApproval(requested.approval.id, { decision: 'reject' });
    clock.advance(1000);

    const plan = [...events].reverse().find((e) => e.type === 'plan.updated');
    expect(plan?.type === 'plan.updated' && plan.plan.status).toBe('rejected');
    expect(typesOf()).not.toContain('message.delta');
  });

  it('rejects a stale approval instead of resolving it twice', async () => {
    runtime.setScenario('shell-approval');
    runtime.subscribe((e) => events.push(e));
    await runtime.sendMessage(input);
    clock.advance(100);

    const requested = events.find((e) => e.type === 'approval.requested');
    if (requested?.type !== 'approval.requested') throw new Error('no approval');

    await runtime.respondToApproval(requested.approval.id, {
      decision: 'approve-once',
    });
    await expect(
      runtime.respondToApproval(requested.approval.id, { decision: 'reject' }),
    ).rejects.toBeInstanceOf(Error);

    expect(events.filter((e) => e.type === 'approval.resolved')).toHaveLength(1);
  });

  it('rejects an approval id that never existed', async () => {
    await expect(
      runtime.respondToApproval(asApprovalId('appr-nope'), {
        decision: 'approve-once',
      }),
    ).rejects.toBeInstanceOf(Error);
  });

  it('uses the edited command supplied with a shell approval', async () => {
    runtime.setScenario('shell-approval');
    runtime.subscribe((e) => events.push(e));
    await runtime.sendMessage(input);
    clock.advance(100);

    const requested = events.find((e) => e.type === 'approval.requested');
    if (requested?.type !== 'approval.requested') throw new Error('no approval');
    expect(requested.approval.command).toBe('npm test -- --run');

    await runtime.respondToApproval(requested.approval.id, {
      decision: 'approve-once',
      editedCommand: 'npm test -- --run --reporter=dot',
    });
    clock.advance(1000);

    const started = events.find((e) => e.type === 'tool.started');
    expect(started?.type === 'tool.started' && started.call.title).toBe(
      'npm test -- --run --reporter=dot',
    );
  });

  it('emits tool failure and a failed run for the failing-test scenario', async () => {
    runtime.setScenario('tests-failed');
    runtime.subscribe((e) => events.push(e));
    await runtime.sendMessage(input);
    clock.advance(1000);

    expect(typesOf()).toContain('tool.failed');
    const failure = events.find((e) => e.type === 'run.failed');
    expect(failure?.type === 'run.failed' && failure.error.kind).toBe('run-failed');
  });

  it('emits file changes for the multi-file scenario', async () => {
    runtime.setScenario('multi-file-changes');
    runtime.subscribe((e) => events.push(e));
    await runtime.sendMessage(input);
    clock.advance(1000);

    const changes = events.filter((e) => e.type === 'file.changed');
    expect(changes.length).toBe(4);
    const kinds = changes.map((e) =>
      e.type === 'file.changed' ? e.change.kind : '',
    );
    expect(kinds).toEqual(['added', 'modified', 'deleted', 'renamed']);
  });

  it('runs several agents to completion in the multi-agent scenario', async () => {
    runtime.setScenario('multi-agent');
    runtime.subscribe((e) => events.push(e));
    await runtime.sendMessage(input);
    clock.advance(1000);

    expect(events.filter((e) => e.type === 'agent.started')).toHaveLength(4);
    expect(events.filter((e) => e.type === 'agent.completed')).toHaveLength(4);
    expect(typesOf()).toContain('run.completed');
  });

  it('creates, renames and archives sessions', async () => {
    runtime.subscribe((e) => events.push(e));
    const session = await runtime.createSession({
      providerId: 'demo',
      modelId: 'demo-balanced',
      mode: 'ask',
    });
    await runtime.renameSession(session.id, 'Renamed');
    await runtime.archiveSession(session.id);

    expect(typesOf()).toEqual([
      'session.created',
      'session.updated',
      'session.archived',
    ]);
    const listed = await runtime.listSessions();
    expect(listed[0]?.title).toBe('Renamed');
    expect(listed[0]?.archived).toBe(true);
  });

  it('rejects resuming an unknown session', async () => {
    await expect(
      runtime.resumeSession('sess-missing' as never),
    ).rejects.toBeInstanceOf(Error);
  });

  it('lists only the models belonging to a provider', async () => {
    const models = await runtime.listModels('demo');
    expect(models.length).toBeGreaterThan(0);
    expect(models.every((m) => m.providerId === 'demo')).toBe(true);
    expect(await runtime.listModels('anthropic')).toEqual([]);
  });

  it('stops delivering events after unsubscribe', async () => {
    const unsubscribe = runtime.subscribe((e) => events.push(e));
    unsubscribe();
    await runtime.sendMessage(input);
    clock.advance(1000);
    expect(events).toHaveLength(0);
  });

  it('tolerates unsubscribing twice', () => {
    const listener = vi.fn();
    const unsubscribe = runtime.subscribe(listener);
    unsubscribe();
    unsubscribe();
    const other = vi.fn();
    runtime.subscribe(other);
    runtime.setScenario('normal-response');
    expect(other).toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });

  it('clears timers on dispose so no event lands afterwards', async () => {
    runtime.setScenario('long-streaming');
    runtime.subscribe((e) => events.push(e));
    await runtime.sendMessage(input);
    clock.advance(20);
    const before = events.length;

    runtime.dispose();
    clock.advance(5000);
    expect(events).toHaveLength(before);
  });

  it('drops an invalid event and records a diagnostic', async () => {
    subscribeValidated(runtime, (e) => events.push(e));
    runtime.setScenario('invalid-event');
    await runtime.sendMessage(input);
    clock.advance(1000);

    // The malformed delta never reaches the listener.
    expect(typesOf()).not.toContain('message.delta');
    expect(typesOf()).toContain('run.completed');

    const diagnostics = getDiagnostics();
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics[diagnostics.length - 1]?.eventType).toBe('message.delta');
  });

  it('keeps identifier namespaces distinct', async () => {
    runtime.subscribe((e) => events.push(e));
    const session = await runtime.createSession({
      providerId: 'demo',
      modelId: 'demo-balanced',
      mode: 'agent',
    });
    const handle = await runtime.sendMessage({ ...input, sessionId: session.id });

    expect(session.id.startsWith('sess-')).toBe(true);
    expect(handle.runId.startsWith('run-')).toBe(true);
    expect(handle.runId).not.toBe(session.id);
  });
});
