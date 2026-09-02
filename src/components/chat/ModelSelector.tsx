import { useTranslation } from 'react-i18next';
import { Select } from '@base-ui-components/react/select';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/Icon';
import { MOCK_MODELS, findModel } from '@/mocks/models';
import { useChatStore } from '@/stores/chat';

export function ModelSelector(): React.ReactElement {
  const { t } = useTranslation();
  const modelId = useChatStore((s) => s.modelId);
  const setModel = useChatStore((s) => s.setModel);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const current = findModel(modelId);

  return (
    <Select.Root
      value={modelId}
      onValueChange={(value) => setModel(String(value))}
    >
      <Select.Trigger
        disabled={isStreaming}
        aria-label={t('model.select')}
        data-testid="model-selector"
        className={cn(
          'inline-flex h-8 items-center gap-2 rounded-md border border-[var(--color-line)]',
          'bg-[var(--color-surface-2)] px-2.5 text-xs text-[var(--color-ink)]',
          'transition-colors hover:border-[var(--color-brand)]',
          'disabled:pointer-events-none disabled:opacity-50',
        )}
      >
        <Icon name="sparkle" size={13} className="text-[var(--color-brand)]" />
        <span className="font-medium">{current?.name ?? modelId}</span>
        <span className="text-[10px] text-[var(--color-ink-soft)]">
          {t('model.context', { tokens: current?.contextK ?? 0 })}
        </span>
        <Select.Icon className="ms-1 rotate-90 text-[var(--color-ink-soft)]">
          <Icon name="chevron" size={12} />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Positioner sideOffset={6} alignItemWithTrigger={false}>
          <Select.Popup
            data-testid="model-selector-popup"
            className={cn(
              'z-50 max-h-80 w-72 overflow-y-auto rounded-lg border',
              'border-[var(--color-line)] bg-[var(--color-surface)] p-1 shadow-2xl',
            )}
          >
            {MOCK_MODELS.map((model) => (
              <Select.Item
                key={model.id}
                value={model.id}
                data-testid={`model-option-${model.id}`}
                className={cn(
                  'flex cursor-default select-none items-start gap-2 rounded-md px-2 py-2',
                  'text-xs outline-none',
                  'data-[highlighted]:bg-[var(--color-surface-2)]',
                  'data-[selected]:text-[var(--color-brand)]',
                )}
              >
                <Select.ItemIndicator className="mt-0.5">
                  <Icon name="check" size={13} />
                </Select.ItemIndicator>
                <span className="min-w-0 flex-1 ps-0.5">
                  <Select.ItemText className="block font-medium">
                    {model.name}
                  </Select.ItemText>
                  <span className="mt-0.5 block text-[10px] text-[var(--color-ink-soft)]">
                    {model.vendor} ·{' '}
                    {t('model.context', { tokens: model.contextK })}
                  </span>
                  <span className="mt-1 block text-[10px] leading-snug text-[var(--color-ink-soft)]">
                    {model.description}
                  </span>
                </span>
              </Select.Item>
            ))}
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
