import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { selectActiveSession, totalTokens, useChatStore } from '@/stores/chat';
import { useRuntimeStore } from '@/stores/runtime';
import { findModel } from '@/services/runtime/fixtures';

const WARN_AT = 0.75;
const DANGER_AT = 0.9;

/** Shows how much of the selected model's context window is in use. */
export function ContextMeter(): React.ReactElement | null {
  const { t } = useTranslation();
  const session = useChatStore(selectActiveSession);
  const modelId = useRuntimeStore((state) => state.modelId);

  const model = findModel(modelId);
  if (!model) return null;

  const used = totalTokens(session);
  const limit = model.contextK * 1000;
  const ratio = Math.min(used / limit, 1);
  const percent = Math.round(ratio * 100);

  return (
    <span
      data-testid="context-meter"
      data-level={
        ratio >= DANGER_AT ? 'danger' : ratio >= WARN_AT ? 'warn' : 'ok'
      }
      // Percentage is spoken; the bar alone would be colour-only information.
      title={t('chat.context.tooltip', {
        used,
        limit,
        percent,
      })}
      className="hidden items-center gap-1.5 text-[10px] text-[var(--color-ink-soft)] md:inline-flex"
    >
      <span
        aria-hidden="true"
        className="h-1 w-10 overflow-hidden rounded-full bg-[var(--color-surface-2)]"
      >
        <span
          className={cn(
            'block h-full rounded-full',
            ratio >= DANGER_AT
              ? 'bg-[var(--color-danger)]'
              : ratio >= WARN_AT
                ? 'bg-[var(--color-warn)]'
                : 'bg-[var(--color-brand)]',
          )}
          style={{ width: `${String(Math.max(percent, 2))}%` }}
        />
      </span>
      {t('chat.context.label', { percent })}
    </span>
  );
}
