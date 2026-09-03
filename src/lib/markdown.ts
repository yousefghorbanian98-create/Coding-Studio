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

// ---------------------------------------------------------------------------
// Line-level structure
// ---------------------------------------------------------------------------

export type MarkdownLine =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'ordered'; text: string; marker: string }
  | { kind: 'quote'; text: string }
  | { kind: 'paragraph'; text: string };

/**
 * Classifies each line of a text block. Deliberately line-based: the mock
 * transcript never needs nesting, and a real parser would be a heavy
 * dependency for content we generate ourselves.
 */
export function parseLines(text: string): MarkdownLine[] {
  return text
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line): MarkdownLine => {
      const heading = /^(#{1,3})\s+(.*)$/.exec(line);
      if (heading) {
        return {
          kind: 'heading',
          level: heading[1]!.length as 1 | 2 | 3,
          text: heading[2] ?? '',
        };
      }

      const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
      if (bullet) return { kind: 'bullet', text: bullet[1] ?? '' };

      const ordered = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
      if (ordered) {
        return {
          kind: 'ordered',
          marker: ordered[1] ?? '',
          text: ordered[2] ?? '',
        };
      }

      const quote = /^\s*>\s?(.*)$/.exec(line);
      if (quote) return { kind: 'quote', text: quote[1] ?? '' };

      return { kind: 'paragraph', text: line };
    });
}

// ---------------------------------------------------------------------------
// Inline segments
// ---------------------------------------------------------------------------

export type InlineSegment =
  | { kind: 'text'; value: string }
  | { kind: 'bold'; value: string }
  | { kind: 'italic'; value: string }
  | { kind: 'code'; value: string }
  | { kind: 'link'; value: string; href: string };

/**
 * Only http(s) and mailto links are rendered as links. Anything else --
 * `javascript:`, `data:`, `vbscript:` -- is rendered as plain text, so a
 * malicious transcript cannot produce a dangerous href.
 */
export function isSafeHref(href: string): boolean {
  const trimmed = href.trim();
  // Reject control characters used to smuggle a scheme past a naive check
  // (e.g. "java\nscript:alert(1)"). Matching them here is the whole point.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f]/.test(trimmed)) return false;
  if (/^(https?:|mailto:)/i.test(trimmed)) return true;
  // Relative and anchor links stay in-app, so they are safe.
  return /^[#/]/.test(trimmed);
}

/** Splits a line into bold / italic / inline-code / link / plain segments. */
export function parseInline(text: string): InlineSegment[] {
  const pattern = /(\*\*[^*]+\*\*|(?<![*\w])\*[^*\n]+\*|`[^`]+`|\[[^\]]*\]\([^)\s]*\))/g;

  return text
    .split(pattern)
    .filter(Boolean)
    .map((part): InlineSegment => {
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return { kind: 'bold', value: part.slice(2, -2) };
      }
      if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
        return { kind: 'code', value: part.slice(1, -1) };
      }

      const link = /^\[([^\]]*)\]\(([^)\s]*)\)$/.exec(part);
      if (link) {
        const label = link[1] ?? '';
        const href = link[2] ?? '';
        if (isSafeHref(href)) {
          return { kind: 'link', value: label || href, href: href.trim() };
        }
        // Unsafe scheme: show the original text, never a clickable link.
        return { kind: 'text', value: part };
      }

      if (
        part.startsWith('*') &&
        part.endsWith('*') &&
        part.length > 2 &&
        !part.startsWith('**')
      ) {
        return { kind: 'italic', value: part.slice(1, -1) };
      }

      return { kind: 'text', value: part };
    });
}
