import { describe, expect, it } from 'vitest';
import { safeParseRuntimeEvent } from '../schemas';
import { RUNTIME_EVENT_TYPES } from '../types';

/** One minimal valid payload per event type in the contract. */
const VALID: Record<string, unknown> = {
  'runtime.health_changed': {
    type: 'runtime.health_changed',
    health: { status: 'ready', kind: 'mock', version: 'mock-1.0.0' },
  },
  'session.created': {
    type: 'session.created',
    session: {
      id: 's1',
      title: 'T',
      createdAt: 1,
      updatedAt: 1,
      providerId: 'demo',
      modelId: 'demo-balanced',
      mode: 'ask',
      pinned: false,
      archived: false,
      messageCount: 0,
    },
  },
  'session.updated': {
    type: 'session.updated',
    session: {
      id: 's1',
      title: 'T',
      createdAt: 1,
      updatedAt: 2,
      providerId: 'demo',
      modelId: 'demo-balanced',
      mode: 'agent',
      pinned: true,
      archived: false,
      messageCount: 3,
    },
  },
  'session.archived': { type: 'session.archived', sessionId: 's1' },
  'run.started': { type: 'run.started', runId: 'r1', sessionId: 's1', mode: 'ask' },
  'run.cancel_requested': {
    type: 'run.cancel_requested',
    runId: 'r1',
    sessionId: 's1',
  },
  'run.cancelled': { type: 'run.cancelled', runId: 'r1', sessionId: 's1' },
  'run.failed': {
    type: 'run.failed',
    runId: 'r1',
    sessionId: 's1',
    error: { kind: 'run-failed', message: 'boom' },
  },
  'run.completed': { type: 'run.completed', runId: 'r1', sessionId: 's1' },
  'message.started': {
    type: 'message.started',
    runId: 'r1',
    sessionId: 's1',
    messageId: 'm1',
    role: 'assistant',
  },
  'message.delta': {
    type: 'message.delta',
    runId: 'r1',
    sessionId: 's1',
    messageId: 'm1',
    delta: 'hi',
  },
  'message.completed': {
    type: 'message.completed',
    runId: 'r1',
    sessionId: 's1',
    messageId: 'm1',
  },
  'plan.created': {
    type: 'plan.created',
    plan: {
      id: 'p1',
      runId: 'r1',
      sessionId: 's1',
      title: 'Plan',
      status: 'awaiting-approval',
      steps: [{ id: 't1', title: 'Step', detail: 'D', status: 'pending' }],
    },
  },
  'plan.updated': {
    type: 'plan.updated',
    plan: {
      id: 'p1',
      runId: 'r1',
      sessionId: 's1',
      title: 'Plan',
      status: 'approved',
      steps: [],
    },
  },
  'task.created': {
    type: 'task.created',
    task: { id: 't1', runId: 'r1', title: 'Task', status: 'pending' },
  },
  'task.updated': {
    type: 'task.updated',
    task: { id: 't1', runId: 'r1', title: 'Task', status: 'completed' },
  },
  'tool.started': {
    type: 'tool.started',
    call: {
      id: 'c1',
      runId: 'r1',
      kind: 'run-tests',
      title: 'npm test',
      status: 'running',
      startedAt: 1,
    },
  },
  'tool.output': { type: 'tool.output', callId: 'c1', runId: 'r1', chunk: 'out' },
  'tool.completed': {
    type: 'tool.completed',
    call: {
      id: 'c1',
      runId: 'r1',
      kind: 'run-tests',
      title: 'npm test',
      status: 'completed',
      startedAt: 1,
    },
  },
  'tool.failed': {
    type: 'tool.failed',
    call: {
      id: 'c1',
      runId: 'r1',
      kind: 'run-tests',
      title: 'npm test',
      status: 'failed',
      startedAt: 1,
    },
  },
  'file.changed': {
    type: 'file.changed',
    runId: 'r1',
    change: { path: 'a.ts', kind: 'modified', additions: 1, deletions: 0 },
  },
  'approval.requested': {
    type: 'approval.requested',
    approval: {
      id: 'a1',
      runId: 'r1',
      sessionId: 's1',
      kind: 'shell-command',
      title: 'Run',
      detail: 'D',
      risk: 'high',
      requestedAt: 1,
    },
  },
  'approval.resolved': {
    type: 'approval.resolved',
    approvalId: 'a1',
    runId: 'r1',
    decision: 'approve-once',
  },
  'agent.started': {
    type: 'agent.started',
    agent: {
      id: 'ag1',
      name: 'Primary',
      role: 'Coordinator',
      status: 'working',
      completedTasks: 0,
    },
  },
  'agent.updated': {
    type: 'agent.updated',
    agent: {
      id: 'ag1',
      name: 'Primary',
      role: 'Coordinator',
      status: 'blocked',
      completedTasks: 1,
    },
  },
  'agent.completed': {
    type: 'agent.completed',
    agent: {
      id: 'ag1',
      name: 'Primary',
      role: 'Coordinator',
      status: 'done',
      completedTasks: 2,
    },
  },
  'context.updated': {
    type: 'context.updated',
    sessionId: 's1',
    usedTokens: 10,
    maxTokens: 128000,
  },
  'notification.created': {
    type: 'notification.created',
    id: 'n1',
    level: 'info',
    title: 'Done',
  },
};

describe('runtime event contract', () => {
  it('covers every declared event type with a fixture', () => {
    expect(Object.keys(VALID).sort()).toEqual([...RUNTIME_EVENT_TYPES].sort());
  });

  it.each(RUNTIME_EVENT_TYPES)('accepts a valid %s event', (type) => {
    const result = safeParseRuntimeEvent(VALID[type]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.event.type).toBe(type);
  });

  it('rejects an unknown event type without throwing', () => {
    const result = safeParseRuntimeEvent({ type: 'meltdown' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.eventType).toBe('meltdown');
  });

  it('rejects a delta whose payload has the wrong shape', () => {
    const result = safeParseRuntimeEvent({
      type: 'message.delta',
      runId: 'r1',
      sessionId: 's1',
      messageId: 'm1',
      delta: 42,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.eventType).toBe('message.delta');
      expect(result.reason).toContain('delta');
    }
  });

  it('rejects an event that is missing required identifiers', () => {
    const result = safeParseRuntimeEvent({ type: 'run.started', mode: 'ask' });
    expect(result.ok).toBe(false);
  });

  it('rejects a bad enum value', () => {
    const result = safeParseRuntimeEvent({
      type: 'run.started',
      runId: 'r1',
      sessionId: 's1',
      mode: 'telepathy',
    });
    expect(result.ok).toBe(false);
  });

  it('rejects non-object payloads without throwing', () => {
    for (const input of [null, undefined, 'x', 7, [], true]) {
      const result = safeParseRuntimeEvent(input);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.eventType).toBeNull();
    }
  });

  it('rejects negative counters', () => {
    const result = safeParseRuntimeEvent({
      type: 'context.updated',
      sessionId: 's1',
      usedTokens: -1,
      maxTokens: 100,
    });
    expect(result.ok).toBe(false);
  });

  it('always reports a non-empty reason on failure', () => {
    const result = safeParseRuntimeEvent({ type: 'tool.output' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason.length).toBeGreaterThan(0);
  });
});
