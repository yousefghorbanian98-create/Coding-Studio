import { create } from 'zustand';
import {
  getRuntime,
  subscribeValidated,
  type AgentState,
  type ApprovalDecision,
  type ApprovalId,
  type ApprovalRequest,
  type FileChange,
  type RunId,
  type RuntimeErrorPayload,
  type RuntimePlan,
  type RuntimeTask,
  type SessionId,
  type StudioRuntimeEvent,
  type ToolCall,
} from '@/services/runtime';

/** Lifecycle of the run currently displayed in the workspace. */
export type RunPhase =
  | 'idle'
  | 'starting'
  | 'streaming'
  | 'awaiting-approval'
  | 'cancelling'
  | 'cancelled'
  | 'completed'
  | 'failed';

export interface RunState {
  phase: RunPhase;
  runId: RunId | null;
  sessionId: SessionId | null;
  /** Assistant text accumulated for the active run. */
  text: string;
  plan: RuntimePlan | null;
  tasks: RuntimeTask[];
  toolCalls: ToolCall[];
  agents: AgentState[];
  changes: FileChange[];
  approvals: ApprovalRequest[];
  error: RuntimeErrorPayload | null;
  summary: string | null;
  usedTokens: number;
  maxTokens: number;

  /** Applies a validated runtime event. Ignores events for other runs. */
  apply: (event: StudioRuntimeEvent) => void;
  beginRun: (runId: RunId, sessionId: SessionId) => void;
  requestCancel: () => Promise<void>;
  resolveApproval: (
    approvalId: ApprovalId,
    decision: ApprovalDecision,
  ) => Promise<void>;
  reset: () => void;
}

const EMPTY = {
  phase: 'idle' as RunPhase,
  runId: null,
  sessionId: null,
  text: '',
  plan: null,
  tasks: [],
  toolCalls: [],
  agents: [],
  changes: [],
  approvals: [],
  error: null,
  summary: null,
  usedTokens: 0,
  maxTokens: 128_000,
};

/** Replaces an item matched by id, or appends it when new. */
function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const index = list.findIndex((entry) => entry.id === item.id);
  if (index === -1) return [...list, item];
  const next = [...list];
  next[index] = item;
  return next;
}

export const useRunStore = create<RunState>()((set, get) => ({
  ...EMPTY,

  beginRun: (runId, sessionId) =>
    set({ ...EMPTY, phase: 'starting', runId, sessionId }),

  apply: (event) => {
    const state = get();

    // Events carrying a run id must match the active run: a late event from a
    // superseded run must never mutate the current one.
    if ('runId' in event && state.runId !== null && event.runId !== state.runId) {
      return;
    }

    // Some events are session-scoped and carry no run id (context.updated is
    // the notable one). Without this guard a background session's token usage
    // would overwrite the meter for the run the user is actually watching.
    if (
      !('runId' in event) &&
      'sessionId' in event &&
      state.sessionId !== null &&
      event.sessionId !== state.sessionId
    ) {
      return;
    }

    switch (event.type) {
      case 'run.started':
        set({ phase: 'streaming', runId: event.runId, sessionId: event.sessionId });
        break;

      case 'message.delta':
        // Deltas after cancellation are discarded.
        if (state.phase === 'cancelling' || state.phase === 'cancelled') return;
        set({ text: state.text + event.delta });
        break;

      case 'message.completed':
        break;

      case 'plan.created':
      case 'plan.updated':
        set({ plan: event.plan });
        break;

      case 'task.created':
      case 'task.updated':
        set({ tasks: upsert(state.tasks, event.task) });
        break;

      case 'tool.started':
      case 'tool.completed':
      case 'tool.failed':
        set({ toolCalls: upsert(state.toolCalls, event.call) });
        break;

      case 'tool.output':
        set({
          toolCalls: state.toolCalls.map((call) =>
            call.id === event.callId
              ? { ...call, output: (call.output ?? '') + event.chunk }
              : call,
          ),
        });
        break;

      case 'agent.started':
      case 'agent.updated':
      case 'agent.completed':
        set({ agents: upsert(state.agents, event.agent) });
        break;

      case 'file.changed':
        set({
          changes: [
            ...state.changes.filter((c) => c.path !== event.change.path),
            event.change,
          ],
        });
        break;

      case 'approval.requested':
        set({
          phase: 'awaiting-approval',
          approvals: upsert(state.approvals, event.approval),
        });
        break;

      case 'approval.resolved':
        set({
          approvals: state.approvals.filter((a) => a.id !== event.approvalId),
          phase: state.phase === 'awaiting-approval' ? 'streaming' : state.phase,
        });
        break;

      case 'run.cancel_requested':
        set({ phase: 'cancelling' });
        break;

      case 'run.cancelled':
        set({ phase: 'cancelled', approvals: [] });
        break;

      case 'run.failed':
        set({ phase: 'failed', error: event.error, approvals: [] });
        break;

      case 'run.completed':
        // A duplicate completion must not resurrect a cancelled run.
        if (state.phase === 'cancelled' || state.phase === 'failed') return;
        set({
          phase: 'completed',
          summary: event.summary ?? null,
          approvals: [],
        });
        break;

      case 'context.updated':
        set({ usedTokens: event.usedTokens, maxTokens: event.maxTokens });
        break;

      default:
        break;
    }
  },

  requestCancel: async () => {
    const { runId, phase } = get();
    if (!runId || phase === 'cancelled' || phase === 'completed') return;
    set({ phase: 'cancelling' });
    await getRuntime().cancelRun(runId);
  },

  resolveApproval: async (approvalId, decision) => {
    await getRuntime().respondToApproval(approvalId, decision);
  },

  reset: () => set({ ...EMPTY }),
}));

/** Wires the store to a runtime. Returns the unsubscribe function. */
export function connectRunStore(): () => void {
  return subscribeValidated(getRuntime(), (event) => {
    useRunStore.getState().apply(event);
  });
}

export function selectPendingApproval(state: RunState): ApprovalRequest | null {
  return state.approvals[0] ?? null;
}

export function selectIsBusy(state: RunState): boolean {
  return (
    state.phase === 'starting' ||
    state.phase === 'streaming' ||
    state.phase === 'awaiting-approval' ||
    state.phase === 'cancelling'
  );
}
