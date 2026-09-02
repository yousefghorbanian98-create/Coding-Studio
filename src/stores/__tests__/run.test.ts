import { beforeEach, describe, expect, it } from 'vitest';
import { useRunStore } from '../run';
import {
  asApprovalId,
  asMessageId,
  asRunId,
  asSessionId,
  asToolCallId,
  type ApprovalRequest,
  type StudioRuntimeEvent,
  type ToolCall,
} from '@/services/runtime';

const RUN = asRunId('run-1');
const OTHER_RUN = asRunId('run-2');
const SESSION = asSessionId('sess-1');
const MESSAGE = asMessageId('msg-1');

function delta(text: string, runId = RUN): StudioRuntimeEvent {
  return {
    type: 'message.delta',
    runId,
    sessionId: SESSION,
    messageId: MESSAGE,
    delta: text,
  };
}

const approval: ApprovalRequest = {
  id: asApprovalId('appr-1'),
  runId: RUN,
  sessionId: SESSION,
  kind: 'shell-command',
  title: 'Run tests',
  detail: 'npm test',
  risk: 'high',
  command: 'npm test',
  requestedAt: 1,
};

const toolCall: ToolCall = {
  id: asToolCallId('tool-1'),
  runId: RUN,
  kind: 'run-tests',
  title: 'npm test',
  status: 'running',
  startedAt: 1,
};

function apply(...events: StudioRuntimeEvent[]): void {
  for (const event of events) useRunStore.getState().apply(event);
}

beforeEach(() => {
  useRunStore.getState().reset();
  useRunStore.getState().beginRun(RUN, SESSION);
});

describe('run store', () => {
  it('accumulates streamed deltas', () => {
    apply(delta('Hel'), delta('lo'));
    expect(useRunStore.getState().text).toBe('Hello');
    expect(useRunStore.getState().phase).toBe('starting');
  });

  it('moves to streaming when the run starts', () => {
    apply({ type: 'run.started', runId: RUN, sessionId: SESSION, mode: 'ask' });
    expect(useRunStore.getState().phase).toBe('streaming');
  });

  it('ignores events belonging to a different run', () => {
    apply(delta('mine'), delta('theirs', OTHER_RUN));
    expect(useRunStore.getState().text).toBe('mine');
  });

  it('discards deltas that arrive after cancellation', () => {
    apply(
      delta('partial'),
      { type: 'run.cancel_requested', runId: RUN, sessionId: SESSION },
      delta(' extra'),
    );
    expect(useRunStore.getState().text).toBe('partial');
    expect(useRunStore.getState().phase).toBe('cancelling');
  });

  it('keeps the partial text once cancelled', () => {
    apply(
      delta('partial'),
      { type: 'run.cancelled', runId: RUN, sessionId: SESSION },
      delta(' more'),
    );
    const state = useRunStore.getState();
    expect(state.phase).toBe('cancelled');
    expect(state.text).toBe('partial');
  });

  it('does not let a duplicate completion resurrect a cancelled run', () => {
    apply(
      { type: 'run.cancelled', runId: RUN, sessionId: SESSION },
      { type: 'run.completed', runId: RUN, sessionId: SESSION, summary: 'done' },
    );
    const state = useRunStore.getState();
    expect(state.phase).toBe('cancelled');
    expect(state.summary).toBeNull();
  });

  it('does not overwrite a failure with a completion', () => {
    apply(
      {
        type: 'run.failed',
        runId: RUN,
        sessionId: SESSION,
        error: { kind: 'run-failed', message: 'boom' },
      },
      { type: 'run.completed', runId: RUN, sessionId: SESSION },
    );
    expect(useRunStore.getState().phase).toBe('failed');
    expect(useRunStore.getState().error?.kind).toBe('run-failed');
  });

  it('tracks approvals and clears them once resolved', () => {
    apply({ type: 'approval.requested', approval });
    expect(useRunStore.getState().phase).toBe('awaiting-approval');
    expect(useRunStore.getState().approvals).toHaveLength(1);

    apply({
      type: 'approval.resolved',
      approvalId: approval.id,
      runId: RUN,
      decision: 'approve-once',
    });
    const state = useRunStore.getState();
    expect(state.approvals).toHaveLength(0);
    expect(state.phase).toBe('streaming');
  });

  it('never records the same approval twice', () => {
    apply(
      { type: 'approval.requested', approval },
      { type: 'approval.requested', approval },
    );
    expect(useRunStore.getState().approvals).toHaveLength(1);
  });

  it('replaces a tool call rather than duplicating it', () => {
    apply(
      { type: 'tool.started', call: toolCall },
      {
        type: 'tool.completed',
        call: { ...toolCall, status: 'completed', durationMs: 12 },
      },
    );
    const calls = useRunStore.getState().toolCalls;
    expect(calls).toHaveLength(1);
    expect(calls[0]?.status).toBe('completed');
  });

  it('appends streamed tool output', () => {
    apply(
      { type: 'tool.started', call: toolCall },
      { type: 'tool.output', callId: toolCall.id, runId: RUN, chunk: 'a' },
      { type: 'tool.output', callId: toolCall.id, runId: RUN, chunk: 'b' },
    );
    expect(useRunStore.getState().toolCalls[0]?.output).toBe('ab');
  });

  it('deduplicates file changes by path', () => {
    apply(
      {
        type: 'file.changed',
        runId: RUN,
        change: { path: 'a.ts', kind: 'modified', additions: 1, deletions: 0 },
      },
      {
        type: 'file.changed',
        runId: RUN,
        change: { path: 'a.ts', kind: 'modified', additions: 5, deletions: 2 },
      },
    );
    const changes = useRunStore.getState().changes;
    expect(changes).toHaveLength(1);
    expect(changes[0]?.additions).toBe(5);
  });

  it('tracks context usage', () => {
    apply({
      type: 'context.updated',
      sessionId: SESSION,
      usedTokens: 500,
      maxTokens: 128_000,
    });
    expect(useRunStore.getState().usedTokens).toBe(500);
  });

  it('resets back to an empty run', () => {
    apply(delta('text'), { type: 'approval.requested', approval });
    useRunStore.getState().reset();
    const state = useRunStore.getState();
    expect(state.text).toBe('');
    expect(state.approvals).toHaveLength(0);
    expect(state.phase).toBe('idle');
  });
});
