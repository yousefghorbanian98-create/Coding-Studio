import { describe, expect, it } from 'vitest';
import { parseBlocks, parseInline } from '../markdown';

describe('parseBlocks', () => {
  it('separates code fences from prose', () => {
    const blocks = parseBlocks('Intro\n\n```ts\nconst a = 1;\n```\n\nOutro');
    expect(blocks.map((b) => b.type)).toEqual(['text', 'code', 'text']);
    expect(blocks[1]?.lang).toBe('ts');
    expect(blocks[1]?.content.trim()).toBe('const a = 1;');
  });

  it('handles an unterminated fence while streaming', () => {
    const blocks = parseBlocks('Here:\n```ts\nconst a =');
    expect(blocks).toHaveLength(2);
    expect(blocks[1]?.type).toBe('code');
  });

  it('drops whitespace-only blocks', () => {
    expect(parseBlocks('   \n\n  ')).toHaveLength(0);
  });

  it('treats plain prose as a single text block', () => {
    expect(parseBlocks('just words')).toEqual([
      { type: 'text', content: 'just words' },
    ]);
  });
});

describe('parseInline', () => {
  it('detects bold and inline code segments', () => {
    expect(parseInline('a **b** and `c`')).toEqual([
      { kind: 'text', value: 'a ' },
      { kind: 'bold', value: 'b' },
      { kind: 'text', value: ' and ' },
      { kind: 'code', value: 'c' },
    ]);
  });

  it('leaves plain text untouched', () => {
    expect(parseInline('nothing special')).toEqual([
      { kind: 'text', value: 'nothing special' },
    ]);
  });
});
