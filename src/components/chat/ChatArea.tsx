import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/Icon';
import { selectActiveSession, useChatStore } from '@/stores/chat';
import { Composer } from './Composer';
import { MessageItem } from './MessageItem';

export function ChatArea(): React.ReactElement {
  const { t } = useTranslation();
  const session = useChatStore(selectActiveSession);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageCount = session?.messages.length ?? 0;
  const lastContent =
    session?.messages[messageCount - 1]?.content.length ?? 0;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messageCount, lastContent]);

  const suggestions = [
    t('chat.suggestions.one'),
    t('chat.suggestions.two'),
    t('chat.suggestions.three'),
  ];

  return (
    <main
      data-testid="chat-area"
      className="flex min-w-0 flex-1 flex-col bg-[var(--color-canvas)]"
    >
      <div
        ref={scrollRef}
        data-testid="message-scroll"
        className="min-h-0 flex-1 overflow-y-auto"
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 p-4">
          {messageCount === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
                <Icon name="sparkle" size={22} />
              </span>
              <h2 className="text-base font-semibold">{t('chat.empty')}</h2>
              <p className="max-w-sm text-xs text-[var(--color-ink-soft)]">
                {t('chat.emptyHint')}
              </p>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    disabled={isStreaming}
                    onClick={() => void sendMessage(suggestion)}
                    className={cn(
                      'rounded-full border border-[var(--color-line)] px-3 py-1.5',
                      'text-xs text-[var(--color-ink-soft)] transition',
                      'hover:border-[var(--color-brand)] hover:text-[var(--color-ink)]',
                      'disabled:opacity-50',
                    )}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            session?.messages.map((message) => (
              <MessageItem key={message.id} message={message} />
            ))
          )}
        </div>
      </div>

      <div className="border-t border-[var(--color-line)] bg-[var(--color-canvas)] p-3">
        <div className="mx-auto w-full max-w-3xl">
          <Composer />
        </div>
      </div>
    </main>
  );
}
