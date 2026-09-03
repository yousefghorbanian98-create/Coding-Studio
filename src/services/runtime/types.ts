/**
 * Provider-neutral runtime contract.
 *
 * The UI talks only to a `StudioRuntimeBridge`. Today the only implementation is
 * an in-process mock; the future Jcode supervisor will implement the same
 * surface over Tauri IPC without any UI change.
 */

/** Schema version of the event contract, surfaced in diagnostics. */
export const RUNTIME_EVENT_SCHEMA_VERSION = '1.0.0';

// ---------------------------------------------------------------------------
// Identifiers — distinct branded types so IDs cannot be crossed accidentally.
// ---------------------------------------------------------------------------

declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

export type SessionId = Brand<string, 'SessionId'>;
export type RunId = Brand<string, 'RunId'>;
export type MessageId = Brand<string, 'MessageId'>;
export type TaskId = Brand<string, 'TaskId'>;
export type ToolCallId = Brand<string, 'ToolCallId'>;
export type ApprovalId = Brand<string, 'ApprovalId'>;
export type AgentId = Brand<string, 'AgentId'>;
export type PlanId = Brand<string, 'PlanId'>;

export const asSessionId = (value: string): SessionId => value as SessionId;
export const asRunId = (value: string): RunId => value as RunId;
export const asMessageId = (value: string): MessageId => value as MessageId;
export const asTaskId = (value: string): TaskId => value as TaskId;
export const asToolCallId = (value: string): ToolCallId => value as ToolCallId;
export const asApprovalId = (value: string): ApprovalId => value as ApprovalId;
export const asAgentId = (value: string): AgentId => value as AgentId;
export const asPlanId = (value: string): PlanId => value as PlanId;

// ---------------------------------------------------------------------------
// Runtime health and capabilities
// ---------------------------------------------------------------------------

export type RuntimeKind = 'mock' | 'jcode';

export type RuntimeStatus =
  | 'starting'
  | 'ready'
  | 'degraded'
  | 'unavailable'
  | 'crashed';

export interface RuntimeHealth {
  status: RuntimeStatus;
  kind: RuntimeKind;
  /** Human-readable runtime version, e.g. "mock-1.0.0". */
  version: string;
  /** Present when the runtime is not usable. */
  detail?: string;
}

export interface RuntimeCapabilities {
  streaming: boolean;
  cancellation: boolean;
  plans: boolean;
  tools: boolean;
  approvals: boolean;
  multiAgent: boolean;
  fileSystem: boolean;
  terminal: boolean;
  eventSchemaVersion: string;
}

// ---------------------------------------------------------------------------
// Providers and models
// ---------------------------------------------------------------------------

export type ProviderAuthState =
  | 'not-configured'
  | 'configured'
  | 'unavailable'
  | 'demo';

export interface ProviderDescriptor {
  id: string;
  name: string;
  /** Short vendor line shown under the name. */
  vendor: string;
  authState: ProviderAuthState;
  /** True when the provider cannot be selected in this build. */
  disabled: boolean;
  /** Why it is disabled, as an i18n key. */
  disabledReasonKey?: string;
}

export interface ModelDescriptor {
  id: string;
  providerId: string;
  name: string;
  /** Context window in thousands of tokens. */
  contextK: number;
  description: string;
  badge?: 'fast' | 'balanced' | 'reasoning';
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export type ChatMode = 'ask' | 'plan' | 'agent';

export interface SessionSummary {
  id: SessionId;
  title: string;
  createdAt: number;
  updatedAt: number;
  providerId: string;
  modelId: string;
  mode: ChatMode;
  pinned: boolean;
  archived: boolean;
  messageCount: number;
}

export interface CreateSessionInput {
  title?: string;
  providerId: string;
  modelId: string;
  mode: ChatMode;
}

export interface StudioSession extends SessionSummary {
  messages: RuntimeMessage[];
}

export type MessageRole = 'user' | 'assistant' | 'system';

export interface RuntimeMessage {
  id: MessageId;
  role: MessageRole;
  content: string;
  createdAt: number;
  modelId?: string;
  tokens?: number;
  streaming?: boolean;
  cancelled?: boolean;
}

export interface SendMessageInput {
  sessionId: SessionId;
  content: string;
  mode: ChatMode;
  providerId: string;
  modelId: string;
  /** Workspace-relative paths attached as context. */
  attachments?: string[];
}

export interface RunHandle {
  runId: RunId;
  sessionId: SessionId;
}

// ---------------------------------------------------------------------------
// Plans, tasks, tools, agents, approvals
// ---------------------------------------------------------------------------

export type PlanStepStatus =
  | 'pending'
  | 'running'
  | 'blocked'
  | 'completed'
  | 'failed'
  | 'skipped';

export interface PlanStep {
  id: TaskId;
  title: string;
  detail: string;
  status: PlanStepStatus;
}

export type PlanStatus =
  | 'draft'
  | 'awaiting-approval'
  | 'approved'
  | 'rejected'
  | 'running'
  | 'completed'
  | 'failed';

export interface RuntimePlan {
  id: PlanId;
  runId: RunId;
  sessionId: SessionId;
  title: string;
  status: PlanStatus;
  steps: PlanStep[];
}

export type TaskStatus = PlanStepStatus;

export interface RuntimeTask {
  id: TaskId;
  runId: RunId;
  title: string;
  status: TaskStatus;
  agentId?: AgentId;
  /** Why the task cannot proceed, when blocked. */
  blockedReason?: string;
  startedAt?: number;
  completedAt?: number;
}

export type ToolKind =
  | 'thinking'
  | 'read-file'
  | 'search'
  | 'edit-file'
  | 'run-command'
  | 'run-tests';

export type ToolStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export interface ToolCall {
  id: ToolCallId;
  runId: RunId;
  kind: ToolKind;
  title: string;
  status: ToolStatus;
  /** Short summary of the input, safe to display. */
  input?: string;
  output?: string;
  error?: string;
  startedAt: number;
  durationMs?: number;
}

export type AgentStatus = 'idle' | 'working' | 'blocked' | 'done' | 'failed';

export interface AgentState {
  id: AgentId;
  name: string;
  role: string;
  status: AgentStatus;
  currentTask?: string;
  completedTasks: number;
  startedAt?: number;
}

export type ApprovalKind =
  | 'file-modification'
  | 'shell-command'
  | 'package-install'
  | 'network-access'
  | 'git-operation'
  | 'delete'
  | 'external-path';

export type ApprovalRisk = 'low' | 'medium' | 'high';

export interface ApprovalRequest {
  id: ApprovalId;
  runId: RunId;
  sessionId: SessionId;
  kind: ApprovalKind;
  title: string;
  detail: string;
  risk: ApprovalRisk;
  /** Editable payload, for shell approvals. */
  command?: string;
  requestedAt: number;
}

export type ApprovalDecisionKind =
  | 'approve-once'
  | 'approve-session'
  | 'reject';

export interface ApprovalDecision {
  decision: ApprovalDecisionKind;
  /** Replacement command supplied by the user, for shell approvals. */
  editedCommand?: string;
}

export type FileChangeKind = 'added' | 'modified' | 'deleted' | 'renamed';

export interface FileChange {
  path: string;
  previousPath?: string;
  kind: FileChangeKind;
  additions: number;
  deletions: number;
  /** Which mock agent produced the change. */
  agentId?: AgentId;
  binary?: boolean;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type RuntimeErrorKind =
  | 'runtime-unavailable'
  | 'runtime-crashed'
  | 'authentication-required'
  | 'provider-unavailable'
  | 'rate-limited'
  | 'context-limit'
  | 'permission-denied'
  | 'run-failed'
  | 'timeout'
  | 'cancelled'
  | 'protocol'
  | 'unknown';

export interface RuntimeErrorPayload {
  kind: RuntimeErrorKind;
  message: string;
}

export type NotificationLevel = 'info' | 'success' | 'warning' | 'error';

// ---------------------------------------------------------------------------
// Events — a discriminated union on `type`.
// ---------------------------------------------------------------------------

export type StudioRuntimeEvent =
  | { type: 'runtime.health_changed'; health: RuntimeHealth }
  | { type: 'session.created'; session: SessionSummary }
  | { type: 'session.updated'; session: SessionSummary }
  | { type: 'session.archived'; sessionId: SessionId }
  | { type: 'run.started'; runId: RunId; sessionId: SessionId; mode: ChatMode }
  | { type: 'run.cancel_requested'; runId: RunId; sessionId: SessionId }
  | { type: 'run.cancelled'; runId: RunId; sessionId: SessionId }
  | {
      type: 'run.failed';
      runId: RunId;
      sessionId: SessionId;
      error: RuntimeErrorPayload;
    }
  | {
      type: 'run.completed';
      runId: RunId;
      sessionId: SessionId;
      summary?: string;
      tokens?: number;
      durationMs?: number;
    }
  | {
      type: 'message.started';
      runId: RunId;
      sessionId: SessionId;
      messageId: MessageId;
      role: MessageRole;
    }
  | {
      type: 'message.delta';
      runId: RunId;
      sessionId: SessionId;
      messageId: MessageId;
      delta: string;
    }
  | {
      type: 'message.completed';
      runId: RunId;
      sessionId: SessionId;
      messageId: MessageId;
      tokens?: number;
    }
  | { type: 'plan.created'; plan: RuntimePlan }
  | { type: 'plan.updated'; plan: RuntimePlan }
  | { type: 'task.created'; task: RuntimeTask }
  | { type: 'task.updated'; task: RuntimeTask }
  | { type: 'tool.started'; call: ToolCall }
  | { type: 'tool.output'; callId: ToolCallId; runId: RunId; chunk: string }
  | { type: 'tool.completed'; call: ToolCall }
  | { type: 'tool.failed'; call: ToolCall }
  | { type: 'file.changed'; runId: RunId; change: FileChange }
  | { type: 'approval.requested'; approval: ApprovalRequest }
  | {
      type: 'approval.resolved';
      approvalId: ApprovalId;
      runId: RunId;
      decision: ApprovalDecisionKind;
    }
  | { type: 'agent.started'; agent: AgentState }
  | { type: 'agent.updated'; agent: AgentState }
  | { type: 'agent.completed'; agent: AgentState }
  | {
      type: 'context.updated';
      sessionId: SessionId;
      usedTokens: number;
      maxTokens: number;
    }
  | {
      type: 'notification.created';
      id: string;
      level: NotificationLevel;
      title: string;
      detail?: string;
    };

export type StudioRuntimeEventType = StudioRuntimeEvent['type'];

/** Every event name in the contract, used by diagnostics and tests. */
export const RUNTIME_EVENT_TYPES = [
  'runtime.health_changed',
  'session.created',
  'session.updated',
  'session.archived',
  'run.started',
  'run.cancel_requested',
  'run.cancelled',
  'run.failed',
  'run.completed',
  'message.started',
  'message.delta',
  'message.completed',
  'plan.created',
  'plan.updated',
  'task.created',
  'task.updated',
  'tool.started',
  'tool.output',
  'tool.completed',
  'tool.failed',
  'file.changed',
  'approval.requested',
  'approval.resolved',
  'agent.started',
  'agent.updated',
  'agent.completed',
  'context.updated',
  'notification.created',
] as const satisfies readonly StudioRuntimeEventType[];

// ---------------------------------------------------------------------------
// Bridge
// ---------------------------------------------------------------------------

export type RuntimeUnsubscribe = () => void;

export interface StudioRuntimeBridge {
  getHealth(): Promise<RuntimeHealth>;
  getCapabilities(): Promise<RuntimeCapabilities>;

  listProviders(): Promise<ProviderDescriptor[]>;
  listModels(providerId: string): Promise<ModelDescriptor[]>;

  listSessions(): Promise<SessionSummary[]>;
  createSession(input: CreateSessionInput): Promise<StudioSession>;
  resumeSession(sessionId: SessionId): Promise<StudioSession>;
  renameSession(sessionId: SessionId, title: string): Promise<void>;
  archiveSession(sessionId: SessionId): Promise<void>;
  deleteSession(sessionId: SessionId): Promise<void>;

  sendMessage(input: SendMessageInput): Promise<RunHandle>;
  cancelRun(runId: RunId): Promise<void>;

  respondToApproval(
    approvalId: ApprovalId,
    decision: ApprovalDecision,
  ): Promise<void>;

  subscribe(listener: (event: StudioRuntimeEvent) => void): RuntimeUnsubscribe;

  /** Releases timers and listeners. Safe to call more than once. */
  dispose(): void;
}

/** Error thrown across the bridge, carrying a typed kind for the UI. */
export class RuntimeError extends Error {
  readonly kind: RuntimeErrorKind;

  constructor(kind: RuntimeErrorKind, message: string) {
    super(message);
    this.name = 'RuntimeError';
    this.kind = kind;
  }
}

/** Maps an error kind onto its i18n key. */
export function runtimeErrorKey(kind: RuntimeErrorKind): string {
  return `runtime.errors.${kind}`;
}
