export interface MarkdownBlock {
  type: 'code' | 'text';
  content: string;
  lang?: string;
}

/** Minimal, dependency-free markdown-ish parser for the mock transcript. */
export function parseBlocks(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const pattern = /```(\w+)?\n([\s\S]*?)(?:```|$)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(markdown)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({ type: 'text', content: markdown.slice(lastIndex, match.index) });
    }
    blocks.push({
      type: 'code',
      content: match[2] ?? '',
      ...(match[1] ? { lang: match[1] } : {}),
    });
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < markdown.length) {
    blocks.push({ type: 'text', content: markdown.slice(lastIndex) });
  }
  return blocks.filter((block) => block.content.trim().length > 0);
}

/** Splits a line into bold / inline-code / plain segments. */
export type InlineSegment =
  | { kind: 'text'; value: string }
  | { kind: 'bold'; value: string }
  | { kind: 'code'; value: string };

export function parseInline(text: string): InlineSegment[] {
  return text
    .split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
    .filter(Boolean)
    .map((part): InlineSegment => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return { kind: 'bold', value: part.slice(2, -2) };
      }
      if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
        return { kind: 'code', value: part.slice(1, -1) };
      }
      return { kind: 'text', value: part };
    });
}
