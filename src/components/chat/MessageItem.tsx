import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/Icon';
import { MessageContent } from './MessageContent';
import { IconButton } from '@/components/ui/IconButton';
import { formatTime } from '@/lib/format';
import { findModel } from '@/services/runtime/fixtures';
import type { ChatMessage } from '@/types/chat';
import { useChatStore } from '@/stores/chat';
import { usePreferences } from '@/stores/preferences';
import { useCopyFeedback } from '@/hooks/useCopyFeedback';

export const MessageItem = memo(function MessageItem({
  message,
}: {
  message: ChatMessage;
}) {
  const { t } = useTranslation();
  const language = usePreferences((s) => s.language);
  const selectMessage = useChatStore((s) => s.selectMessage);
  const selected = useChatStore((s) => s.selectedMessageId === message.id);
  const { copied, copy } = useCopyFeedback();

  const roleLabel =
    message.role === 'user'
      ? t('chat.you')
      : message.role === 'assistant'
        ? t('chat.assistant')
        : t('chat.system');

  const onCopy = (): void => {
    copy(message.content);
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      data-testid={`message-${message.role}`}
      data-message-id={message.id}
      onClick={() => selectMessage(message.id)}
      className={cn(
        'group rounded-panel border p-3 transition-colors',
        selected
          ? 'border-[var(--color-brand)] bg-[var(--color-surface)]'
          : 'border-transparent hover:border-[var(--color-line)] hover:bg-[var(--color-surface)]/60',
        message.role === 'system' && 'opacity-70',
      )}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span
          className={cn(
            'grid h-6 w-6 shrink-0 place-items-center rounded-md text-[10px] font-bold',
            message.role === 'user'
              ? 'bg-[var(--color-surface-2)] text-[var(--color-ink)]'
              : message.role === 'assistant'
                ? 'bg-[var(--color-brand)] text-white'
                : 'bg-[var(--color-surface-2)] text-[var(--color-ink-soft)]',
          )}
          aria-hidden="true"
        >
          {message.role === 'assistant' ? (
            <Icon name="sparkle" size={13} />
          ) : (
            roleLabel.slice(0, 1).toUpperCase()
          )}
        </span>
        <span className="text-xs font-semibold">{roleLabel}</span>
        {message.modelId ? (
          <span className="text-[10px] text-[var(--color-ink-soft)]">
            {findModel(message.modelId)?.name ?? message.modelId}
          </span>
        ) : null}
        <time
          className="text-[10px] text-[var(--color-ink-soft)]"
          dateTime={new Date(message.createdAt).toISOString()}
        >
          {formatTime(message.createdAt, language)}
        </time>

        <span className="ms-auto opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
          <IconButton
            label={copied ? t('chat.copied') : t('chat.copy')}
            onClick={onCopy}
            className="h-6 w-6"
          >
            <Icon name={copied ? 'check' : 'copy'} size={12} />
          </IconButton>
        </span>
      </div>

      <div className="ps-8">
        {message.content.length === 0 && message.streaming ? (
          <p className="text-xs italic text-[var(--color-ink-soft)]">
            {t('chat.thinking')}
          </p>
        ) : (
          <MessageBody content={message.content} streaming={message.streaming} />
        )}
        {message.stopped ? (
          <p
            data-testid={
              message.interrupted === true
                ? `message-interrupted-${message.id}`
                : undefined
            }
            className="mt-1 text-[10px] text-[var(--color-warn)]"
          >
            {message.interrupted === true
              ? t('sessions.interrupted')
              : t('chat.stop')}
          </p>
        ) : null}
      </div>
    </motion.article>
  );
});

function MessageBody({
  content,
  streaming,
}: {
  content: string;
  streaming?: boolean | undefined;
}): React.ReactElement {
  return (
    <MessageContent content={content} {...(streaming === true ? { streaming: true } : {})} />
  );
}
