import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useCopyFeedback } from '@/hooks/useCopyFeedback';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/Icon';
import { parseBlocks, parseInline, parseLines } from '@/lib/markdown';

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
        if (segment.kind === 'italic') {
          return (
            <em key={index} className="italic">
              {segment.value}
            </em>
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
        if (segment.kind === 'link') {
          return (
            <a
              key={index}
              href={segment.href}
              target="_blank"
              // noopener/noreferrer keeps the opened page from reaching back
              // into this window via window.opener.
              rel="noopener noreferrer"
              className="text-[var(--color-brand)] underline underline-offset-2"
            >
              {segment.value}
            </a>
          );
        }
        return <span key={index}>{segment.value}</span>;
      })}
    </>
  );
}

const HEADING_CLASS: Record<1 | 2 | 3, string> = {
  1: 'mt-1 text-base font-semibold',
  2: 'mt-1 text-sm font-semibold',
  3: 'mt-1 text-xs font-semibold uppercase tracking-wide',
};

function TextBlock({ content }: { content: string }): React.ReactElement {
  const lines = parseLines(content);

  return (
    <div className="flex flex-col gap-1.5">
      {lines.map((line, index) => {
        if (line.kind === 'heading') {
          const Tag = (['h3', 'h4', 'h5'] as const)[line.level - 1] ?? 'h5';
          return (
            <Tag key={index} className={HEADING_CLASS[line.level]}>
              <InlineText text={line.text} />
            </Tag>
          );
        }

        if (line.kind === 'bullet' || line.kind === 'ordered') {
          return (
            <div key={index} className="flex gap-2 ps-1">
              <span
                aria-hidden="true"
                className="shrink-0 text-[var(--color-ink-soft)]"
              >
                {line.kind === 'bullet' ? '•' : `${line.marker}.`}
              </span>
              <span className="min-w-0 flex-1 break-words">
                <InlineText text={line.text} />
              </span>
            </div>
          );
        }

        if (line.kind === 'quote') {
          return (
            <blockquote
              key={index}
              className="border-s-2 border-[var(--color-line)] ps-2 text-[var(--color-ink-soft)]"
            >
              <InlineText text={line.text} />
            </blockquote>
          );
        }

        return (
          <p key={index} className="whitespace-pre-wrap break-words">
            <InlineText text={line.text} />
          </p>
        );
      })}
    </div>
  );
}

function CodeBlock({
  content,
  lang,
}: {
  content: string;
  lang?: string;
}): React.ReactElement {
  const { t } = useTranslation();
  const { copied, copy } = useCopyFeedback();

  return (
    <div className="group relative">
      {lang !== undefined ? (
        <span className="absolute start-2 top-1 text-[9px] uppercase text-[var(--color-ink-soft)]">
          {lang}
        </span>
      ) : null}
      <button
        type="button"
        onClick={() => {
          copy(content);
        }}
        data-testid="code-copy"
        aria-label={copied ? t('chat.copied') : t('chat.copyCode')}
        className={cn(
          'absolute end-1.5 top-1.5 rounded p-1 text-[var(--color-ink-soft)]',
          'opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100',
          'hover:text-[var(--color-ink)]',
        )}
      >
        <Icon name={copied ? 'check' : 'copy'} size={12} />
      </button>
      <pre
        dir="ltr"
        className={cn(
          'overflow-x-auto rounded-lg border border-[var(--color-line)]',
          'bg-[var(--color-surface-2)] p-3 font-mono text-xs leading-relaxed',
          lang !== undefined && 'pt-4',
        )}
      >
        <code>{content.replace(/\n$/, '')}</code>
      </pre>
    </div>
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
          <CodeBlock
            key={index}
            content={block.content}
            {...(block.lang !== undefined ? { lang: block.lang } : {})}
          />
        ) : (
          <TextBlock key={index} content={block.content} />
        ),
      )}
      {streaming ? (
        <span className="cs-caret" aria-hidden="true" data-testid="stream-caret" />
      ) : null}
    </div>
  );
});
