import { describe, expect, it } from 'vitest';
import { isSafeHref, parseBlocks, parseInline, parseLines } from '../markdown';

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

describe('parseLines', () => {
  it('classifies headings by level', () => {
    expect(parseLines('# One\n## Two\n### Three')).toEqual([
      { kind: 'heading', level: 1, text: 'One' },
      { kind: 'heading', level: 2, text: 'Two' },
      { kind: 'heading', level: 3, text: 'Three' },
    ]);
  });

  it('recognises bullet and ordered list items', () => {
    const lines = parseLines('- first\n* second\n1. third\n2) fourth');
    expect(lines.map((l) => l.kind)).toEqual([
      'bullet',
      'bullet',
      'ordered',
      'ordered',
    ]);
    expect(lines[2]).toEqual({ kind: 'ordered', marker: '1', text: 'third' });
  });

  it('recognises block quotes and plain paragraphs', () => {
    expect(parseLines('> quoted\nplain')).toEqual([
      { kind: 'quote', text: 'quoted' },
      { kind: 'paragraph', text: 'plain' },
    ]);
  });

  it('drops blank lines', () => {
    expect(parseLines('a\n\n\nb')).toHaveLength(2);
  });

  it('does not treat a bare hash or dash as structure', () => {
    expect(parseLines('#nospace')[0]?.kind).toBe('paragraph');
    expect(parseLines('3-4 items')[0]?.kind).toBe('paragraph');
  });
});

describe('link safety', () => {
  it('accepts http, https, mailto, anchors and relative paths', () => {
    for (const href of [
      'https://example.com',
      'http://example.com',
      'mailto:a@b.co',
      '#section',
      '/docs',
    ]) {
      expect(isSafeHref(href)).toBe(true);
    }
  });

  it('rejects script-bearing schemes', () => {
    for (const href of [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      'data:text/html,<script>',
      'vbscript:msgbox',
      'java\nscript:alert(1)',
    ]) {
      expect(isSafeHref(href)).toBe(false);
    }
  });

  it('renders an unsafe link as literal text, never as a link', () => {
    const segments = parseInline('[click](javascript:alert(1))');
    expect(segments.every((s) => s.kind !== 'link')).toBe(true);
  });

  it('parses a safe link into label and href', () => {
    expect(parseInline('see [docs](https://example.com/a)')).toContainEqual({
      kind: 'link',
      value: 'docs',
      href: 'https://example.com/a',
    });
  });
});

describe('parseInline emphasis', () => {
  it('handles bold, italic and code', () => {
    const kinds = parseInline('**b** *i* `c`').map((s) => s.kind);
    expect(kinds).toContain('bold');
    expect(kinds).toContain('italic');
    expect(kinds).toContain('code');
  });
});
