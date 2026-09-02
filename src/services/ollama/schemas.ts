import { z } from 'zod';

/**
 * Runtime contract for everything crossing the Tauri IPC boundary.
 *
 * These schemas mirror the Rust types in `src-tauri/src/ollama/types.rs`.
 * Nothing from the backend is trusted until it has been parsed here.
 */

export const ollamaErrorKindSchema = z.enum([
  'unavailable',
  'no-models',
  'model-not-found',
  'timeout',
  'cancelled',
  'backend',
  'protocol',
]);

export const ollamaErrorSchema = z.object({
  kind: ollamaErrorKindSchema,
  message: z.string(),
});

export const healthStatusSchema = z.object({
  reachable: z.boolean(),
  endpoint: z.string(),
  version: z.string().optional(),
  error: ollamaErrorSchema.optional(),
});

export const ollamaModelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  family: z.string(),
  parameterSize: z.string(),
  quantization: z.string(),
  sizeBytes: z.number().nonnegative(),
  modifiedAt: z.string().optional(),
});

export const ollamaModelsSchema = z.array(ollamaModelSchema);

const streamId = z.string().min(1);

export const ollamaEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('connecting'), streamId }),
  z.object({ type: z.literal('chunk'), streamId, delta: z.string() }),
  z.object({
    type: z.literal('done'),
    streamId,
    evalCount: z.number().optional(),
    promptEvalCount: z.number().optional(),
    totalDurationMs: z.number().optional(),
  }),
  z.object({ type: z.literal('cancelled'), streamId }),
  z.object({ type: z.literal('error'), streamId, error: ollamaErrorSchema }),
]);

export type OllamaErrorKind = z.infer<typeof ollamaErrorKindSchema>;
export type OllamaErrorPayload = z.infer<typeof ollamaErrorSchema>;
export type HealthStatus = z.infer<typeof healthStatusSchema>;
export type OllamaModel = z.infer<typeof ollamaModelSchema>;
export type OllamaEvent = z.infer<typeof ollamaEventSchema>;

/** i18n key for an error kind coming from the backend. */
export function ollamaErrorKey(kind: OllamaErrorKind): string {
  switch (kind) {
    case 'unavailable':
      return 'ollama.errors.unavailable';
    case 'no-models':
      return 'ollama.errors.noModels';
    case 'model-not-found':
      return 'ollama.errors.modelNotFound';
    case 'timeout':
      return 'ollama.errors.timeout';
    case 'cancelled':
      return 'ollama.errors.cancelled';
    case 'protocol':
      return 'ollama.errors.protocol';
    case 'backend':
    default:
      return 'ollama.errors.backend';
  }
}

/**
 * Parses an untrusted IPC payload, returning null instead of throwing so a
 * single malformed event cannot tear down a stream.
 */
export function safeParseEvent(input: unknown): OllamaEvent | null {
  const result = ollamaEventSchema.safeParse(input);
  return result.success ? result.data : null;
}
