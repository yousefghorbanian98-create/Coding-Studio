import { describe, expect, it } from 'vitest';
import {
  healthStatusSchema,
  ollamaErrorKey,
  ollamaEventSchema,
  ollamaModelsSchema,
  safeParseEvent,
} from '../schemas';

describe('IPC contract validation', () => {
  it('accepts every event variant emitted by Rust', () => {
    const events = [
      { type: 'connecting', streamId: 's1' },
      { type: 'chunk', streamId: 's1', delta: 'hi' },
      { type: 'done', streamId: 's1', evalCount: 4, totalDurationMs: 120 },
      { type: 'done', streamId: 's1' },
      { type: 'cancelled', streamId: 's1' },
      {
        type: 'error',
        streamId: 's1',
        error: { kind: 'model-not-found', message: 'nope' },
      },
    ];
    for (const event of events) {
      expect(ollamaEventSchema.safeParse(event).success).toBe(true);
    }
  });

  it('rejects an unknown event type', () => {
    expect(safeParseEvent({ type: 'exploded', streamId: 's1' })).toBeNull();
  });

  it('rejects an event missing its streamId', () => {
    expect(safeParseEvent({ type: 'chunk', delta: 'x' })).toBeNull();
  });

  it('rejects a chunk whose delta is not a string', () => {
    expect(safeParseEvent({ type: 'chunk', streamId: 's', delta: 42 })).toBeNull();
  });

  it('rejects an unknown error kind', () => {
    expect(
      safeParseEvent({
        type: 'error',
        streamId: 's',
        error: { kind: 'meltdown', message: 'x' },
      }),
    ).toBeNull();
  });

  it('rejects non-object payloads without throwing', () => {
    for (const input of [null, undefined, 'string', 7, []]) {
      expect(safeParseEvent(input)).toBeNull();
    }
  });

  it('validates a health payload', () => {
    expect(
      healthStatusSchema.safeParse({
        reachable: true,
        endpoint: 'http://127.0.0.1:11434',
        version: '0.5.1',
      }).success,
    ).toBe(true);

    expect(
      healthStatusSchema.safeParse({ reachable: 'yes', endpoint: 'x' }).success,
    ).toBe(false);
  });

  it('validates the model list and rejects malformed entries', () => {
    expect(
      ollamaModelsSchema.safeParse([
        {
          id: 'llama3.2:3b',
          name: 'llama3.2:3b',
          family: 'llama',
          parameterSize: '3.2B',
          quantization: 'Q4_K_M',
          sizeBytes: 100,
        },
      ]).success,
    ).toBe(true);

    expect(ollamaModelsSchema.safeParse([{ id: '' }]).success).toBe(false);
    expect(
      ollamaModelsSchema.safeParse([{ id: 'a', name: 'a', sizeBytes: -1 }]).success,
    ).toBe(false);
  });

  it('maps every error kind to a distinct translation key', () => {
    const kinds = [
      'unavailable',
      'no-models',
      'model-not-found',
      'timeout',
      'cancelled',
      'backend',
      'protocol',
    ] as const;
    const keys = kinds.map(ollamaErrorKey);
    expect(new Set(keys).size).toBe(kinds.length);
    for (const key of keys) expect(key.startsWith('ollama.errors.')).toBe(true);
  });
});
