import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/Icon';
import { selectActiveSession, useChatStore } from '@/stores/chat';
import { Composer } from './Composer';
import { ErrorBanner } from './ErrorBanner';
import { RuntimeBanner } from '@/components/runtime/RuntimeBanner';
import { PlanCard } from '@/components/agent/PlanCard';
import { ToolTimeline } from '@/components/agent/ToolTimeline';
import { ApprovalCard } from '@/components/agent/ApprovalCard';
import { AgentRoster } from '@/components/agent/AgentRoster';
import { MessageItem } from './MessageItem';

/** How close to the bottom still counts as "following along". */
const NEAR_BOTTOM_PX = 64;

export function ChatArea(): React.ReactElement {
  const { t } = useTranslation();
  const session = useChatStore(selectActiveSession);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageCount = session?.messages.length ?? 0;
  const lastContent =
    session?.messages[messageCount - 1]?.content.length ?? 0;

  const [atBottom, setAtBottom] = useState(true);

  // Autoscroll only while the user is already near the bottom. If they have
  // scrolled up to read, their position is theirs to keep.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !atBottom) return;
    el.scrollTop = el.scrollHeight;
  }, [messageCount, lastContent, atBottom]);

  const onScroll = (): void => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAtBottom(distance <= NEAR_BOTTOM_PX);
  };

  const jumpToLatest = (): void => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setAtBottom(true);
  };

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
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 p-4">
          {messageCount === 0 ? (
            <div
              data-testid="chat-empty"
              className="flex flex-col items-center gap-3 py-16 text-center"
            >
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

          <PlanCard />
          <AgentRoster />
          <ToolTimeline />
          <ApprovalCard />
        </div>
      </div>

      <div className="relative border-t border-[var(--color-line)] bg-[var(--color-canvas)] p-3">
        {!atBottom && messageCount > 0 ? (
          <button
            type="button"
            onClick={jumpToLatest}
            data-testid="jump-to-latest"
            className={cn(
              'absolute -top-11 left-1/2 -translate-x-1/2 rounded-full',
              'border border-[var(--color-line)] bg-[var(--color-surface)]',
              'px-3 py-1.5 text-[11px] text-[var(--color-ink)] shadow-sm',
            )}
          >
            {t('chat.jumpToLatest')}
          </button>
        ) : null}
        <div className="mx-auto w-full max-w-3xl">
          <RuntimeBanner />
          <ErrorBanner />
          <Composer />
        </div>
      </div>
    </main>
  );
}
