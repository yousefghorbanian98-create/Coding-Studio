import {
  DEFAULT_MODEL_ID,
  DEFAULT_PROVIDER_ID,
  FIXTURE_MODELS,
  FIXTURE_PROVIDERS,
} from './fixtures';
import { DEFAULT_SCENARIO, type ScenarioId } from './scenarios';
import {
  RuntimeError,
  asAgentId,
  asApprovalId,
  asMessageId,
  asPlanId,
  asRunId,
  asSessionId,
  asTaskId,
  asToolCallId,
  type ApprovalDecision,
  type ApprovalId,
  type ApprovalRequest,
  type ChatMode,
  type CreateSessionInput,
  type ModelDescriptor,
  type ProviderDescriptor,
  type RunHandle,
  type RunId,
  type RuntimeCapabilities,
  type RuntimeErrorKind,
  type RuntimeHealth,
  type RuntimeUnsubscribe,
  type SendMessageInput,
  type SessionId,
  type SessionSummary,
  type StudioRuntimeBridge,
  type StudioRuntimeEvent,
  type StudioSession,
  RUNTIME_EVENT_SCHEMA_VERSION,
} from './types';

/** Scheduler seam so tests can drive time without real waiting. */
export interface MockClock {
  setTimeout(handler: () => void, ms: number): number;
  clearTimeout(handle: number): void;
  now(): number;
}

const realClock: MockClock = {
  setTimeout: (handler, ms) => globalThis.setTimeout(handler, ms) as unknown as number,
  clearTimeout: (handle) => {
    globalThis.clearTimeout(handle);
  },
  now: () => Date.now(),
};

export interface MockRuntimeOptions {
  scenario?: ScenarioId;
  clock?: MockClock;
  /** Delay between streamed deltas. Zero makes runs synchronous-ish. */
  tickMs?: number;
  /** Seeds the session list; defaults to a single demo session. */
  sessions?: SessionSummary[];
}

/** Scenarios that fail before any streaming begins. */
const IMMEDIATE_FAILURES: Partial<Record<ScenarioId, RuntimeErrorKind>> = {
  'runtime-unavailable': 'runtime-unavailable',
  'provider-unavailable': 'provider-unavailable',
  'authentication-required': 'authentication-required',
  'rate-limited': 'rate-limited',
  'context-limit': 'context-limit',
  'permission-denied': 'permission-denied',
};

const NORMAL_REPLY = [
  'I reviewed the workspace and here is what I found. ',
  'The shell layout is already provider-neutral, so the change is contained. ',
  'I would keep the existing transport seam and route runs through it.',
];

const LONG_REPLY = Array.from(
  { length: 18 },
  (_, i) =>
    `Step ${String(i + 1)}: this paragraph exists to exercise scrolling, ` +
    'virtualisation and streaming performance in a predictable way. ',
);

const CODE_REPLY = [
  'Here is the helper you asked for:\n\n',
  '```ts\n',
  'export function formatPath(path: string): string {\n',
  '  return path.replace(/\\\\/g, "/");\n',
  '}\n',
  '```\n\n',
  'It normalises Windows separators before display.',
];

function replyFor(scenario: ScenarioId): string[] {
  switch (scenario) {
    case 'long-streaming':
      return LONG_REPLY;
    case 'code-block-streaming':
      return CODE_REPLY;
    case 'cancel-during-streaming':
      return LONG_REPLY;
    default:
      return NORMAL_REPLY;
  }
}

interface ActiveRun {
  runId: RunId;
  sessionId: SessionId;
  timers: Set<number>;
  cancelled: boolean;
  /** Approval the run is currently blocked on. */
  pendingApproval?: ApprovalRequest;
  resumeAfterApproval?: (decision: ApprovalDecision) => void;
}

/**
 * In-process runtime used for development, Storybook and tests.
 *
 * Deterministic by construction: identifiers come from a counter, timings come
 * from the injected clock, and no scenario branches on randomness.
 */
export class MockStudioRuntime implements StudioRuntimeBridge {
  private readonly listeners = new Set<(event: StudioRuntimeEvent) => void>();
  private readonly runs = new Map<string, ActiveRun>();
  private readonly sessions = new Map<string, StudioSession>();
  private readonly clock: MockClock;
  private readonly tickMs: number;
  private scenario: ScenarioId;
  private counter = 0;
  private disposed = false;
  private health: RuntimeHealth;

  constructor(options: MockRuntimeOptions = {}) {
    this.clock = options.clock ?? realClock;
    this.tickMs = options.tickMs ?? 24;
    this.scenario = options.scenario ?? DEFAULT_SCENARIO;
    this.health = this.healthForScenario();

    const seeded = options.sessions ?? [];
    for (const summary of seeded) {
      this.sessions.set(summary.id, { ...summary, messages: [] });
    }
  }

  // -- identity ------------------------------------------------------------

  private nextId(prefix: string): string {
    this.counter += 1;
    return `${prefix}-${String(this.counter).padStart(4, '0')}`;
  }

  // -- scenario ------------------------------------------------------------

  /** Switches scenario. Cancels in-flight runs so state stays coherent. */
  setScenario(scenario: ScenarioId): void {
    for (const run of [...this.runs.values()]) this.abortRun(run, false);
    this.scenario = scenario;
    this.health = this.healthForScenario();
    this.emit({ type: 'runtime.health_changed', health: this.health });
  }

  getScenario(): ScenarioId {
    return this.scenario;
  }

  private healthForScenario(): RuntimeHealth {
    if (this.scenario === 'runtime-unavailable') {
      return {
        status: 'unavailable',
        kind: 'mock',
        version: 'mock-1.0.0',
        detail: 'The demo runtime is not running.',
      };
    }
    if (this.scenario === 'runtime-crash') {
      return {
        status: 'crashed',
        kind: 'mock',
        version: 'mock-1.0.0',
        detail: 'The demo runtime stopped unexpectedly.',
      };
    }
    return { status: 'ready', kind: 'mock', version: 'mock-1.0.0' };
  }

  // -- subscription --------------------------------------------------------

  subscribe(listener: (event: StudioRuntimeEvent) => void): RuntimeUnsubscribe {
    this.listeners.add(listener);
    let active = true;
    // Idempotent: StrictMode double-invocation must not unsubscribe a later
    // listener, and calling the returned function twice is harmless.
    return () => {
      if (!active) return;
      active = false;
      this.listeners.delete(listener);
    };
  }

  private emit(event: StudioRuntimeEvent): void {
    if (this.disposed) return;
    for (const listener of [...this.listeners]) listener(event);
  }

  /** Emits a deliberately malformed payload, for the invalid-event scenario. */
  emitRawForTesting(payload: unknown): void {
    if (this.disposed) return;
    for (const listener of [...this.listeners]) {
      (listener as (value: unknown) => void)(payload);
    }
  }

  // -- capabilities --------------------------------------------------------

  getHealth(): Promise<RuntimeHealth> {
    return Promise.resolve(this.health);
  }

  getCapabilities(): Promise<RuntimeCapabilities> {
    return Promise.resolve({
      streaming: true,
      cancellation: true,
      plans: true,
      tools: true,
      approvals: true,
      multiAgent: true,
      fileSystem: false,
      terminal: false,
      eventSchemaVersion: RUNTIME_EVENT_SCHEMA_VERSION,
    });
  }

  listProviders(): Promise<ProviderDescriptor[]> {
    return Promise.resolve([...FIXTURE_PROVIDERS]);
  }

  listModels(providerId: string): Promise<ModelDescriptor[]> {
    return Promise.resolve(
      FIXTURE_MODELS.filter((model) => model.providerId === providerId),
    );
  }

  // -- sessions ------------------------------------------------------------

  listSessions(): Promise<SessionSummary[]> {
    return Promise.resolve(
      [...this.sessions.values()].map((session) => this.toSummary(session)),
    );
  }

  private toSummary(session: StudioSession): SessionSummary {
    const { messages, ...summary } = session;
    return { ...summary, messageCount: messages.length };
  }

  createSession(input: CreateSessionInput): Promise<StudioSession> {
    const now = this.clock.now();
    const session: StudioSession = {
      id: asSessionId(this.nextId('sess')),
      title: input.title ?? 'Untitled session',
      createdAt: now,
      updatedAt: now,
      providerId: input.providerId,
      modelId: input.modelId,
      mode: input.mode,
      pinned: false,
      archived: false,
      messageCount: 0,
      messages: [],
    };
    this.sessions.set(session.id, session);
    this.emit({ type: 'session.created', session: this.toSummary(session) });
    return Promise.resolve(session);
  }

  resumeSession(sessionId: SessionId): Promise<StudioSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return Promise.reject(
        new RuntimeError('unknown', `Unknown session ${sessionId}`),
      );
    }
    return Promise.resolve(session);
  }

  renameSession(sessionId: SessionId, title: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return Promise.reject(
        new RuntimeError('unknown', `Unknown session ${sessionId}`),
      );
    }
    session.title = title;
    session.updatedAt = this.clock.now();
    this.emit({ type: 'session.updated', session: this.toSummary(session) });
    return Promise.resolve();
  }

  archiveSession(sessionId: SessionId): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return Promise.resolve();
    session.archived = true;
    this.emit({ type: 'session.archived', sessionId });
    return Promise.resolve();
  }

  deleteSession(sessionId: SessionId): Promise<void> {
    this.sessions.delete(sessionId);
    return Promise.resolve();
  }

  // -- runs ----------------------------------------------------------------

  sendMessage(input: SendMessageInput): Promise<RunHandle> {
    if (this.health.status === 'unavailable') {
      return Promise.reject(
        new RuntimeError('runtime-unavailable', 'The runtime is unavailable.'),
      );
    }

    const runId = asRunId(this.nextId('run'));
    const run: ActiveRun = {
      runId,
      sessionId: input.sessionId,
      timers: new Set(),
      cancelled: false,
    };
    this.runs.set(runId, run);

    this.emit({
      type: 'run.started',
      runId,
      sessionId: input.sessionId,
      mode: input.mode,
    });

    this.schedule(run, 0, () => {
      this.driveScenario(run, input);
    });

    return Promise.resolve({ runId, sessionId: input.sessionId });
  }

  cancelRun(runId: RunId): Promise<void> {
    const run = this.runs.get(runId);
    if (!run || run.cancelled) return Promise.resolve();
    this.emit({ type: 'run.cancel_requested', runId, sessionId: run.sessionId });
    this.abortRun(run, true);
    return Promise.resolve();
  }

  /** Clears timers and optionally announces the cancellation. */
  private abortRun(run: ActiveRun, notify: boolean): void {
    run.cancelled = true;
    for (const timer of run.timers) this.clock.clearTimeout(timer);
    run.timers.clear();
    this.runs.delete(run.runId);
    if (notify) {
      this.emit({
        type: 'run.cancelled',
        runId: run.runId,
        sessionId: run.sessionId,
      });
    }
  }

  /** Queues work on the run's timer set so cancellation can clear it. */
  private schedule(run: ActiveRun, delayMs: number, action: () => void): void {
    if (run.cancelled) return;
    const handle = this.clock.setTimeout(() => {
      run.timers.delete(handle);
      if (run.cancelled) return;
      action();
    }, delayMs);
    run.timers.add(handle);
  }

  private failRun(run: ActiveRun, kind: RuntimeErrorKind, message: string): void {
    this.runs.delete(run.runId);
    this.emit({
      type: 'run.failed',
      runId: run.runId,
      sessionId: run.sessionId,
      error: { kind, message },
    });
  }

  // -- scenario execution --------------------------------------------------

  private driveScenario(run: ActiveRun, input: SendMessageInput): void {
    const immediate = IMMEDIATE_FAILURES[this.scenario];
    if (immediate) {
      this.failRun(run, immediate, this.messageForKind(immediate));
      return;
    }

    if (this.scenario === 'runtime-crash') {
      this.health = {
        status: 'crashed',
        kind: 'mock',
        version: 'mock-1.0.0',
        detail: 'The demo runtime stopped unexpectedly.',
      };
      this.emit({ type: 'runtime.health_changed', health: this.health });
      this.failRun(run, 'runtime-crashed', 'The runtime stopped unexpectedly.');
      return;
    }

    if (this.scenario === 'timeout') {
      this.schedule(run, this.tickMs, () => {
        this.failRun(run, 'timeout', 'The run exceeded its time budget.');
      });
      return;
    }

    if (this.scenario === 'invalid-event') {
      this.emitRawForTesting({ type: 'message.delta', delta: 12 });
      this.completeRun(run, 'Dropped one malformed event.');
      return;
    }

    if (this.isPlanScenario()) {
      this.drivePlan(run, input);
      return;
    }

    if (this.isApprovalScenario()) {
      this.driveApproval(run);
      return;
    }

    if (this.isToolScenario()) {
      this.driveTools(run);
      return;
    }

    if (this.scenario === 'multi-agent') {
      this.driveAgents(run);
      return;
    }

    this.streamReply(run, input);
  }

  private messageForKind(kind: RuntimeErrorKind): string {
    switch (kind) {
      case 'runtime-unavailable':
        return 'The runtime is not running.';
      case 'provider-unavailable':
        return 'The selected provider is unavailable.';
      case 'authentication-required':
        return 'This provider needs to be connected first.';
      case 'rate-limited':
        return 'Too many requests. Try again shortly.';
      case 'context-limit':
        return 'The conversation exceeds the model context window.';
      case 'permission-denied':
        return 'The workspace denied this operation.';
      default:
        return 'The run could not be completed.';
    }
  }

  private isPlanScenario(): boolean {
    return (
      this.scenario === 'plan-awaiting-approval' ||
      this.scenario === 'plan-rejected' ||
      this.scenario === 'plan-edited'
    );
  }

  private isApprovalScenario(): boolean {
    return (
      this.scenario === 'file-edit-approval' ||
      this.scenario === 'shell-approval' ||
      this.scenario === 'package-install-approval'
    );
  }

  private isToolScenario(): boolean {
    return (
      this.scenario === 'running-tests' ||
      this.scenario === 'tests-passed' ||
      this.scenario === 'tests-failed' ||
      this.scenario === 'multi-file-changes' ||
      this.scenario === 'large-diff' ||
      this.scenario === 'cancel-during-tool'
    );
  }

  private streamReply(run: ActiveRun, input: SendMessageInput): void {
    const messageId = asMessageId(this.nextId('msg'));
    const chunks = replyFor(this.scenario);

    this.emit({
      type: 'message.started',
      runId: run.runId,
      sessionId: run.sessionId,
      messageId,
      role: 'assistant',
    });

    chunks.forEach((delta, index) => {
      this.schedule(run, this.tickMs * (index + 1), () => {
        this.emit({
          type: 'message.delta',
          runId: run.runId,
          sessionId: run.sessionId,
          messageId,
          delta,
        });
      });
    });

    this.schedule(run, this.tickMs * (chunks.length + 1), () => {
      const tokens = chunks.join('').split(/\s+/).length;
      this.emit({
        type: 'message.completed',
        runId: run.runId,
        sessionId: run.sessionId,
        messageId,
        tokens,
      });
      this.emit({
        type: 'context.updated',
        sessionId: input.sessionId,
        usedTokens: tokens * 12,
        maxTokens: 128_000,
      });
      this.completeRun(run, undefined, tokens);
    });
  }

  private drivePlan(run: ActiveRun, input: SendMessageInput): void {
    const planId = asPlanId(this.nextId('plan'));
    const steps = [
      {
        id: asTaskId(this.nextId('task')),
        title: 'Read the affected modules',
        detail: 'Inspect the shell and runtime seams before editing.',
        status: 'pending' as const,
      },
      {
        id: asTaskId(this.nextId('task')),
        title: 'Apply the refactor',
        detail: 'Introduce the provider-neutral bridge.',
        status: 'pending' as const,
      },
      {
        id: asTaskId(this.nextId('task')),
        title: 'Run the test suite',
        detail: 'Verify nothing regressed.',
        status: 'pending' as const,
      },
    ];

    this.emit({
      type: 'plan.created',
      plan: {
        id: planId,
        runId: run.runId,
        sessionId: run.sessionId,
        title: 'Proposed approach',
        status: 'awaiting-approval',
        steps,
      },
    });

    for (const step of steps) {
      this.emit({
        type: 'task.created',
        task: {
          id: step.id,
          runId: run.runId,
          title: step.title,
          status: 'pending',
        },
      });
    }

    if (this.scenario === 'plan-rejected') {
      this.schedule(run, this.tickMs, () => {
        this.emit({
          type: 'plan.updated',
          plan: {
            id: planId,
            runId: run.runId,
            sessionId: run.sessionId,
            title: 'Proposed approach',
            status: 'rejected',
            steps,
          },
        });
        this.completeRun(run, 'Plan rejected. No changes were made.');
      });
      return;
    }

    // plan-awaiting-approval and plan-edited stop here: the UI drives the
    // next transition through respondToApproval.
    const approval: ApprovalRequest = {
      id: asApprovalId(this.nextId('appr')),
      runId: run.runId,
      sessionId: run.sessionId,
      kind: 'file-modification',
      title: 'Approve the proposed plan',
      detail: 'The agent will edit three files in this workspace.',
      risk: 'medium',
      requestedAt: this.clock.now(),
    };
    run.pendingApproval = approval;
    run.resumeAfterApproval = (decision) => {
      if (decision.decision === 'reject') {
        this.emit({
          type: 'plan.updated',
          plan: {
            id: planId,
            runId: run.runId,
            sessionId: run.sessionId,
            title: 'Proposed approach',
            status: 'rejected',
            steps,
          },
        });
        this.completeRun(run, 'Plan rejected. No changes were made.');
        return;
      }
      this.emit({
        type: 'plan.updated',
        plan: {
          id: planId,
          runId: run.runId,
          sessionId: run.sessionId,
          title: 'Proposed approach',
          status: 'approved',
          steps: steps.map((s) => ({ ...s, status: 'completed' as const })),
        },
      });
      this.streamReply(run, input);
    };
    this.emit({ type: 'approval.requested', approval });
  }

  private driveApproval(run: ActiveRun): void {
    const kind =
      this.scenario === 'shell-approval'
        ? ('shell-command' as const)
        : this.scenario === 'package-install-approval'
          ? ('package-install' as const)
          : ('file-modification' as const);

    const approval: ApprovalRequest = {
      id: asApprovalId(this.nextId('appr')),
      runId: run.runId,
      sessionId: run.sessionId,
      kind,
      title:
        kind === 'shell-command'
          ? 'Run a shell command'
          : kind === 'package-install'
            ? 'Install a dependency'
            : 'Modify src/services/runtime/index.ts',
      detail:
        kind === 'shell-command'
          ? 'The agent wants to run the project test suite.'
          : kind === 'package-install'
            ? 'The agent wants to add a new runtime dependency.'
            : 'The agent wants to apply a 24-line change.',
      risk: kind === 'file-modification' ? 'low' : 'high',
      ...(kind === 'shell-command' ? { command: 'npm test -- --run' } : {}),
      ...(kind === 'package-install' ? { command: 'npm install left-pad' } : {}),
      requestedAt: this.clock.now(),
    };

    run.pendingApproval = approval;
    run.resumeAfterApproval = (decision) => {
      if (decision.decision === 'reject') {
        this.completeRun(run, 'Operation declined. Nothing was changed.');
        return;
      }
      const call = {
        id: asToolCallId(this.nextId('tool')),
        runId: run.runId,
        kind: kind === 'file-modification' ? ('edit-file' as const) : ('run-command' as const),
        title: decision.editedCommand ?? approval.title,
        status: 'running' as const,
        startedAt: this.clock.now(),
      };
      this.emit({ type: 'tool.started', call });
      this.schedule(run, this.tickMs, () => {
        this.emit({
          type: 'tool.completed',
          call: { ...call, status: 'completed', durationMs: this.tickMs, output: 'Done.' },
        });
        this.completeRun(run, 'Operation approved and applied.');
      });
    };

    this.emit({ type: 'approval.requested', approval });
  }

  private driveTools(run: ActiveRun): void {
    const call = {
      id: asToolCallId(this.nextId('tool')),
      runId: run.runId,
      kind: 'run-tests' as const,
      title: 'npm test',
      status: 'running' as const,
      input: 'npm test -- --run',
      startedAt: this.clock.now(),
    };
    this.emit({ type: 'tool.started', call });

    // running-tests and cancel-during-tool intentionally never settle: they
    // represent work still in flight.
    if (this.scenario === 'running-tests' || this.scenario === 'cancel-during-tool') {
      this.schedule(run, this.tickMs, () => {
        this.emit({
          type: 'tool.output',
          callId: call.id,
          runId: run.runId,
          chunk: 'Running 141 tests…\n',
        });
      });
      return;
    }

    if (this.scenario === 'tests-failed') {
      this.schedule(run, this.tickMs, () => {
        this.emit({
          type: 'tool.failed',
          call: {
            ...call,
            status: 'failed',
            durationMs: this.tickMs,
            error: '2 tests failed in src/services/runtime.',
          },
        });
        this.failRun(run, 'run-failed', 'The test run failed.');
      });
      return;
    }

    this.schedule(run, this.tickMs, () => {
      this.emit({
        type: 'tool.completed',
        call: {
          ...call,
          status: 'completed',
          durationMs: this.tickMs,
          output: '141 passed',
        },
      });
      for (const change of this.changesForScenario()) {
        this.emit({ type: 'file.changed', runId: run.runId, change });
      }
      this.completeRun(run, 'All tests passed.');
    });
  }

  private changesForScenario(): {
    path: string;
    kind: 'added' | 'modified' | 'deleted' | 'renamed';
    additions: number;
    deletions: number;
    previousPath?: string;
  }[] {
    if (this.scenario === 'multi-file-changes') {
      return [
        { path: 'src/services/runtime/types.ts', kind: 'added', additions: 120, deletions: 0 },
        { path: 'src/stores/chat.ts', kind: 'modified', additions: 18, deletions: 24 },
        { path: 'src/mocks/models.ts', kind: 'deleted', additions: 0, deletions: 32 },
        {
          path: 'src/services/runtime/index.ts',
          previousPath: 'src/services/bridge.ts',
          kind: 'renamed',
          additions: 4,
          deletions: 2,
        },
      ];
    }
    if (this.scenario === 'large-diff') {
      return Array.from({ length: 40 }, (_, i) => ({
        path: `src/generated/module-${String(i + 1).padStart(2, '0')}.ts`,
        kind: 'modified' as const,
        additions: 30 + i,
        deletions: 12 + (i % 7),
      }));
    }
    return [];
  }

  private driveAgents(run: ActiveRun): void {
    const agents = [
      { name: 'Primary Agent', role: 'Coordinates the run' },
      { name: 'Frontend Agent', role: 'Implements UI changes' },
      { name: 'Test Agent', role: 'Writes and runs tests' },
      { name: 'Reviewer Agent', role: 'Reviews the diff' },
    ];

    agents.forEach((agent, index) => {
      const state = {
        id: asAgentId(this.nextId('agent')),
        name: agent.name,
        role: agent.role,
        status: 'working' as const,
        currentTask: `Working on step ${String(index + 1)}`,
        completedTasks: index,
        startedAt: this.clock.now(),
      };
      this.emit({ type: 'agent.started', agent: state });
      this.schedule(run, this.tickMs * (index + 1), () => {
        this.emit({
          type: 'agent.completed',
          agent: { ...state, status: 'done', completedTasks: index + 1 },
        });
      });
    });

    this.schedule(run, this.tickMs * (agents.length + 1), () => {
      this.completeRun(run, 'All agents finished their tasks.');
    });
  }

  private completeRun(run: ActiveRun, summary?: string, tokens?: number): void {
    this.runs.delete(run.runId);
    this.emit({
      type: 'run.completed',
      runId: run.runId,
      sessionId: run.sessionId,
      ...(summary !== undefined ? { summary } : {}),
      ...(tokens !== undefined ? { tokens } : {}),
    });
  }

  // -- approvals -----------------------------------------------------------

  respondToApproval(
    approvalId: ApprovalId,
    decision: ApprovalDecision,
  ): Promise<void> {
    const run = [...this.runs.values()].find(
      (candidate) => candidate.pendingApproval?.id === approvalId,
    );
    if (!run) {
      // Stale or already-resolved approval: reject so the UI can explain it
      // rather than silently double-resolving.
      return Promise.reject(
        new RuntimeError('unknown', `Approval ${approvalId} is no longer pending.`),
      );
    }

    const resume = run.resumeAfterApproval;
    delete run.pendingApproval;
    delete run.resumeAfterApproval;

    this.emit({
      type: 'approval.resolved',
      approvalId,
      runId: run.runId,
      decision: decision.decision,
    });

    resume?.(decision);
    return Promise.resolve();
  }

  // -- lifecycle -----------------------------------------------------------

  dispose(): void {
    for (const run of [...this.runs.values()]) this.abortRun(run, false);
    this.listeners.clear();
    this.disposed = true;
  }
}

/** Convenience factory matching the default product configuration. */
export function createMockRuntime(
  options: MockRuntimeOptions = {},
): MockStudioRuntime {
  return new MockStudioRuntime(options);
}

export const MOCK_DEFAULTS = {
  providerId: DEFAULT_PROVIDER_ID,
  modelId: DEFAULT_MODEL_ID,
} as const;

export type { ChatMode };
