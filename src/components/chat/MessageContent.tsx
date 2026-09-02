import { memo } from 'react';
import { cn } from '@/lib/cn';

interface Block {
  type: 'code' | 'text';
  content: string;
  lang?: string;
}

/** Minimal, dependency-free markdown-ish renderer for the mock transcript. */
export function parseBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
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

export function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.filter(Boolean).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={index}
          dir="ltr"
          className="rounded bg-[var(--color-surface-2)] px-1 py-0.5 font-mono text-[0.85em]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

export const MessageContent = memo(function MessageContent({
  content,
  streaming,
}: {
  content: string;
  streaming?: boolean;
}) {
  const blocks = parseBlocks(content);

  return (
    <div
      className="flex flex-col gap-2 text-sm leading-relaxed"
      data-testid="message-content"
    >
      {blocks.map((block, index) =>
        block.type === 'code' ? (
          <pre
            key={index}
            dir="ltr"
            className={cn(
              'overflow-x-auto rounded-lg border border-[var(--color-line)]',
              'bg-[var(--color-surface-2)] p-3 font-mono text-xs leading-relaxed',
            )}
          >
            <code>{block.content.replace(/\n$/, '')}</code>
          </pre>
        ) : (
          <div key={index} className="flex flex-col gap-1.5">
            {block.content
              .split('\n')
              .filter((line) => line.trim().length > 0)
              .map((line, lineIndex) => (
                <p key={lineIndex} className="whitespace-pre-wrap">
                  {renderInline(line)}
                </p>
              ))}
          </div>
        ),
      )}
      {streaming ? (
        <span className="cs-caret" aria-hidden="true" data-testid="stream-caret" />
      ) : null}
    </div>
  );
});
