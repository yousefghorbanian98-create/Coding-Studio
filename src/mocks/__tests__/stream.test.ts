import { describe, expect, it } from 'vitest';
import { estimateTokens, pickReply, runMockStream, toChunks } from '../stream';
import { findModel, MOCK_MODELS } from '../models';

describe('mock stream', () => {
  it('splits text into word-ish chunks', () => {
    const chunks = toChunks('hello brave new world');
    expect(chunks).toHaveLength(4);
    expect(chunks.join('')).toBe('hello brave new world');
  });

  it('picks a deterministic reply for the same prompt', () => {
    expect(pickReply('same prompt')).toBe(pickReply('same prompt'));
    expect(pickReply('x', 0)).not.toBe(pickReply('x', 1));
  });

  it('estimates tokens from length', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('a'.repeat(400))).toBe(100);
  });

  it('streams chunks until completion', async () => {
    const received: string[] = [];
    const result = await runMockStream({
      prompt: 'test',
      modelId: 'studio-haiku',
      signal: new AbortController().signal,
      onChunk: (chunk) => received.push(chunk),
      delayMs: 0,
      seed: 0,
    });

    expect(result.aborted).toBe(false);
    expect(received.length).toBeGreaterThan(5);
    expect(received.join('')).toBe(result.text);
  });

  it('reports aborted when the signal fires mid-stream', async () => {
    const controller = new AbortController();
    const promise = runMockStream({
      prompt: 'test',
      modelId: 'studio-sonnet',
      signal: controller.signal,
      onChunk: () => {},
      delayMs: 5,
      seed: 0,
    });
    setTimeout(() => controller.abort(), 15);
    const result = await promise;
    expect(result.aborted).toBe(true);
  });
});

describe('mock models', () => {
  it('exposes a non-empty catalogue with unique ids', () => {
    const ids = MOCK_MODELS.map((model) => model.id);
    expect(ids.length).toBeGreaterThan(2);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('finds a model by id', () => {
    expect(findModel('studio-opus')?.name).toBe('Studio Opus');
    expect(findModel('nope')).toBeUndefined();
  });
});
