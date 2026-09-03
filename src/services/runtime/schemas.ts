import { z } from 'zod';
import type { StudioRuntimeEvent } from './types';

/**
 * Runtime validation for everything crossing the bridge.
 *
 * A malformed event must never crash the app: `safeParseRuntimeEvent` returns a
 * typed failure that callers surface as a diagnostic instead of throwing.
 */

const sessionId = z.string().min(1);
const runId = z.string().min(1);
const messageId = z.string().min(1);
const taskId = z.string().min(1);
const toolCallId = z.string().min(1);
const approvalId = z.string().min(1);
const agentId = z.string().min(1);
const planId = z.string().min(1);

export const runtimeStatusSchema = z.enum([
  'starting',
  'ready',
  'degraded',
  'unavailable',
  'crashed',
]);

export const runtimeHealthSchema = z.object({
  status: runtimeStatusSchema,
  kind: z.enum(['mock', 'jcode']),
  version: z.string().min(1),
  detail: z.string().optional(),
});

export const chatModeSchema = z.enum(['ask', 'plan', 'agent']);

export const runtimeErrorKindSchema = z.enum([
  'runtime-unavailable',
  'runtime-crashed',
  'authentication-required',
  'provider-unavailable',
  'rate-limited',
  'context-limit',
  'permission-denied',
  'run-failed',
  'timeout',
  'cancelled',
  'protocol',
  'unknown',
]);

export const runtimeErrorPayloadSchema = z.object({
  kind: runtimeErrorKindSchema,
  message: z.string(),
});

export const sessionSummarySchema = z.object({
  id: sessionId,
  title: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  providerId: z.string().min(1),
  modelId: z.string().min(1),
  mode: chatModeSchema,
  pinned: z.boolean(),
  archived: z.boolean(),
  messageCount: z.number().int().nonnegative(),
});

const planStepStatusSchema = z.enum([
  'pending',
  'running',
  'blocked',
  'completed',
  'failed',
  'skipped',
]);

export const planSchema = z.object({
  id: planId,
  runId,
  sessionId,
  title: z.string(),
  status: z.enum([
    'draft',
    'awaiting-approval',
    'approved',
    'rejected',
    'running',
    'completed',
    'failed',
  ]),
  steps: z.array(
    z.object({
      id: taskId,
      title: z.string(),
      detail: z.string(),
      status: planStepStatusSchema,
    }),
  ),
});

export const taskSchema = z.object({
  id: taskId,
  runId,
  title: z.string(),
  status: planStepStatusSchema,
  agentId: agentId.optional(),
  blockedReason: z.string().optional(),
  startedAt: z.number().optional(),
  completedAt: z.number().optional(),
});

export const toolCallSchema = z.object({
  id: toolCallId,
  runId,
  kind: z.enum([
    'thinking',
    'read-file',
    'search',
    'edit-file',
    'run-command',
    'run-tests',
  ]),
  title: z.string(),
  status: z.enum(['running', 'completed', 'failed', 'cancelled']),
  input: z.string().optional(),
  output: z.string().optional(),
  error: z.string().optional(),
  startedAt: z.number(),
  durationMs: z.number().optional(),
});

export const agentStateSchema = z.object({
  id: agentId,
  name: z.string(),
  role: z.string(),
  status: z.enum(['idle', 'working', 'blocked', 'done', 'failed']),
  currentTask: z.string().optional(),
  completedTasks: z.number().int().nonnegative(),
  startedAt: z.number().optional(),
});

export const approvalRequestSchema = z.object({
  id: approvalId,
  runId,
  sessionId,
  kind: z.enum([
    'file-modification',
    'shell-command',
    'package-install',
    'network-access',
    'git-operation',
    'delete',
    'external-path',
  ]),
  title: z.string(),
  detail: z.string(),
  risk: z.enum(['low', 'medium', 'high']),
  command: z.string().optional(),
  requestedAt: z.number(),
});

export const fileChangeSchema = z.object({
  path: z.string().min(1),
  previousPath: z.string().optional(),
  kind: z.enum(['added', 'modified', 'deleted', 'renamed']),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  agentId: agentId.optional(),
  binary: z.boolean().optional(),
});

export const runtimeEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('runtime.health_changed'), health: runtimeHealthSchema }),
  z.object({ type: z.literal('session.created'), session: sessionSummarySchema }),
  z.object({ type: z.literal('session.updated'), session: sessionSummarySchema }),
  z.object({ type: z.literal('session.archived'), sessionId }),
  z.object({ type: z.literal('run.started'), runId, sessionId, mode: chatModeSchema }),
  z.object({ type: z.literal('run.cancel_requested'), runId, sessionId }),
  z.object({ type: z.literal('run.cancelled'), runId, sessionId }),
  z.object({
    type: z.literal('run.failed'),
    runId,
    sessionId,
    error: runtimeErrorPayloadSchema,
  }),
  z.object({
    type: z.literal('run.completed'),
    runId,
    sessionId,
    summary: z.string().optional(),
    tokens: z.number().optional(),
    durationMs: z.number().optional(),
  }),
  z.object({
    type: z.literal('message.started'),
    runId,
    sessionId,
    messageId,
    role: z.enum(['user', 'assistant', 'system']),
  }),
  z.object({
    type: z.literal('message.delta'),
    runId,
    sessionId,
    messageId,
    delta: z.string(),
  }),
  z.object({
    type: z.literal('message.completed'),
    runId,
    sessionId,
    messageId,
    tokens: z.number().optional(),
  }),
  z.object({ type: z.literal('plan.created'), plan: planSchema }),
  z.object({ type: z.literal('plan.updated'), plan: planSchema }),
  z.object({ type: z.literal('task.created'), task: taskSchema }),
  z.object({ type: z.literal('task.updated'), task: taskSchema }),
  z.object({ type: z.literal('tool.started'), call: toolCallSchema }),
  z.object({ type: z.literal('tool.output'), callId: toolCallId, runId, chunk: z.string() }),
  z.object({ type: z.literal('tool.completed'), call: toolCallSchema }),
  z.object({ type: z.literal('tool.failed'), call: toolCallSchema }),
  z.object({ type: z.literal('file.changed'), runId, change: fileChangeSchema }),
  z.object({ type: z.literal('approval.requested'), approval: approvalRequestSchema }),
  z.object({
    type: z.literal('approval.resolved'),
    approvalId,
    runId,
    decision: z.enum(['approve-once', 'approve-session', 'reject']),
  }),
  z.object({ type: z.literal('agent.started'), agent: agentStateSchema }),
  z.object({ type: z.literal('agent.updated'), agent: agentStateSchema }),
  z.object({ type: z.literal('agent.completed'), agent: agentStateSchema }),
  z.object({
    type: z.literal('context.updated'),
    sessionId,
    usedTokens: z.number().int().nonnegative(),
    maxTokens: z.number().int().positive(),
  }),
  z.object({
    type: z.literal('notification.created'),
    id: z.string().min(1),
    level: z.enum(['info', 'success', 'warning', 'error']),
    title: z.string(),
    detail: z.string().optional(),
  }),
]);

export interface RuntimeEventParseSuccess {
  ok: true;
  event: StudioRuntimeEvent;
}

export interface RuntimeEventParseFailure {
  ok: false;
  /** Short, log-safe description of why the payload was rejected. */
  reason: string;
  /** The event type if it could be read at all, for diagnostics grouping. */
  eventType: string | null;
}

export type RuntimeEventParseResult =
  | RuntimeEventParseSuccess
  | RuntimeEventParseFailure;

/** Reads a `type` field defensively, for diagnostics on invalid payloads. */
function readEventType(input: unknown): string | null {
  if (typeof input !== 'object' || input === null) return null;
  const value = (input as { type?: unknown }).type;
  return typeof value === 'string' ? value : null;
}

/**
 * Validates an inbound event. Never throws — invalid payloads become a typed
 * failure so the caller can log a diagnostic and drop the event.
 */
export function safeParseRuntimeEvent(input: unknown): RuntimeEventParseResult {
  const parsed = runtimeEventSchema.safeParse(input);
  if (parsed.success) {
    return { ok: true, event: parsed.data as StudioRuntimeEvent };
  }

  const first = parsed.error.issues[0];
  const path = first?.path.join('.') ?? '';
  const reason = first
    ? `${path ? `${path}: ` : ''}${first.message}`
    : 'Unrecognised runtime event';

  return { ok: false, reason, eventType: readEventType(input) };
}
