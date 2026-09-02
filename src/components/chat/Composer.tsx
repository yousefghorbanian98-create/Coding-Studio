import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/Icon';
import { useChatStore } from '@/stores/chat';
import { useUiStore } from '@/stores/ui';
import { ModelSelector } from './ModelSelector';

export function Composer(): React.ReactElement {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const stopStreaming = useChatStore((s) => s.stopStreaming);
  const focusToken = useUiStore((s) => s.composerFocusToken);

  useEffect(() => {
    if (focusToken > 0) textareaRef.current?.focus();
  }, [focusToken]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const submit = (): void => {
    const text = value.trim();
    if (!text || isStreaming) return;
    setValue('');
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
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
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

      <div className="mt-1 flex items-center gap-2">
        <ModelSelector />
        <span className="hidden text-[10px] text-[var(--color-ink-soft)] md:inline">
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
