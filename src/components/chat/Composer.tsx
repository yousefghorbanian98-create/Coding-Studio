import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/Icon';
import { useChatStore } from '@/stores/chat';
import { useUiStore } from '@/stores/ui';
import { ModelSelector } from './ModelSelector';
import { ModeSelector } from './ModeSelector';
import { ContextMeter } from './ContextMeter';
import { FileMention } from './FileMention';

const DRAFT_KEY = 'coding-studio:draft';

function readDraft(): string {
  try {
    return globalThis.localStorage?.getItem(DRAFT_KEY) ?? '';
  } catch {
    return '';
  }
}

export function Composer(): React.ReactElement {
  const { t } = useTranslation();
  const [value, setValue] = useState(readDraft);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const stopStreaming = useChatStore((s) => s.stopStreaming);
  const focusToken = useUiStore((s) => s.composerFocusToken);
  const [mentionOpen, setMentionOpen] = useState(false);

  const insertMention = (path: string): void => {
    setMentionOpen(false);
    setValue((current) => current.replace(/@[^\s@]*$/, `@${path} `));
    textareaRef.current?.focus();
  };

  useEffect(() => {
    if (focusToken > 0) textareaRef.current?.focus();
  }, [focusToken]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  // Keep an unsent draft across reloads so a long prompt is never lost.
  useEffect(() => {
    try {
      globalThis.localStorage?.setItem(DRAFT_KEY, value);
    } catch {
      // Storage unavailable; the draft simply stays in memory.
    }
  }, [value]);

  // A message typed while the agent is busy is queued rather than dropped,
  // then sent automatically once the run finishes.
  const [queued, setQueued] = useState<string | null>(null);

  useEffect(() => {
    if (isStreaming || queued === null) return;
    setQueued(null);
    void sendMessage(queued);
  }, [isStreaming, queued, sendMessage]);

  const submit = (): void => {
    const text = value.trim();
    if (!text) return;
    setValue('');
    if (isStreaming) {
      setQueued(text);
      return;
    }
    void sendMessage(text);
  };

  return (
    <form
      data-testid="composer"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className={cn(
        'rounded-panel border border-[var(--color-line)] bg-[var(--color-surface)]',
        'p-2 shadow-sm focus-within:border-[var(--color-brand)]',
      )}
    >
      <label className="sr-only" htmlFor="composer-input">
        {t('chat.placeholder')}
      </label>
      <textarea
        id="composer-input"
        ref={textareaRef}
        rows={1}
        value={value}
        data-testid="composer-input"
        placeholder={t('chat.placeholder')}
        onChange={(event) => {
          setValue(event.target.value);
          // Open the picker while the caret sits in an unfinished @mention.
          setMentionOpen(/@[^\s@]*$/.test(event.target.value));
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && mentionOpen) {
            event.preventDefault();
            setMentionOpen(false);
            return;
          }
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
        className={cn(
          'max-h-52 w-full resize-none bg-transparent px-2 py-1.5 text-sm',
          'text-[var(--color-ink)] placeholder:text-[var(--color-ink-soft)]',
          'focus:outline-none',
        )}
      />

      {mentionOpen ? <FileMention onSelect={insertMention} /> : null}

      {queued !== null ? (
        <div
          data-testid="composer-queued"
          className="mx-2 mb-1 flex items-center gap-2 rounded bg-[var(--color-surface-2)] px-2 py-1 text-[10px] text-[var(--color-ink-soft)]"
        >
          <Icon name="clock" size={11} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate" title={queued}>
            {t('chat.queued', { text: queued })}
          </span>
          <button
            type="button"
            data-testid="composer-queued-cancel"
            onClick={() => setQueued(null)}
            className="shrink-0 rounded p-0.5 hover:text-[var(--color-danger)]"
            aria-label={t('chat.queuedCancel')}
          >
            <Icon name="close" size={10} />
          </button>
        </div>
      ) : null}

      <div className="mt-1 flex items-center gap-2">
        <ModeSelector />
        <ModelSelector />
        <ContextMeter />
        <span className="hidden text-[10px] text-[var(--color-ink-soft)] lg:inline">
          {t('chat.hint')}
        </span>

        <div className="ms-auto">
          {isStreaming ? (
            <button
              type="button"
              onClick={stopStreaming}
              data-testid="stop-button"
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium',
                'border border-[var(--color-line)] bg-[var(--color-surface-2)]',
                'text-[var(--color-ink)] transition hover:border-[var(--color-danger)]',
                'hover:text-[var(--color-danger)]',
              )}
            >
              <Icon name="stop" size={13} />
              {t('chat.stop')}
            </button>
          ) : (
            <button
              type="submit"
              disabled={value.trim().length === 0}
              data-testid="send-button"
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium',
                'bg-[var(--color-brand)] text-white transition',
                'hover:opacity-90 disabled:pointer-events-none disabled:opacity-40',
              )}
            >
              <Icon name="send" size={13} className="rtl:-scale-x-100" />
              {t('chat.send')}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
