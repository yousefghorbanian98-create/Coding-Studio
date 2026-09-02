import { memo } from 'react';
import { cn } from '@/lib/cn';
import { parseBlocks, parseInline } from '@/lib/markdown';

function InlineText({ text }: { text: string }): React.ReactElement {
  return (
    <>
      {parseInline(text).map((segment, index) => {
        if (segment.kind === 'bold') {
          return (
            <strong key={index} className="font-semibold">
              {segment.value}
            </strong>
          );
        }
        if (segment.kind === 'code') {
          return (
            <code
              key={index}
              dir="ltr"
              className="rounded bg-[var(--color-surface-2)] px-1 py-0.5 font-mono text-[0.85em]"
            >
              {segment.value}
            </code>
          );
        }
        return <span key={index}>{segment.value}</span>;
      })}
    </>
  );
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
                  <InlineText text={line} />
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
