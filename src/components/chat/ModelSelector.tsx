import { useTranslation } from 'react-i18next';
import { Select } from '@base-ui-components/react/select';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/Icon';
import { useChatStore } from '@/stores/chat';
import { useRuntimeStore } from '@/stores/runtime';

export function ModelSelector(): React.ReactElement {
  const { t } = useTranslation();
  const isStreaming = useChatStore((s) => s.isStreaming);
  const setModel = useChatStore((s) => s.setModel);

  const status = useRuntimeStore((s) => s.status);
  const models = useRuntimeStore((s) => s.models);
  const modelId = useRuntimeStore((s) => s.modelId);
  const selectModel = useRuntimeStore((s) => s.selectModel);
  const refresh = useRuntimeStore((s) => s.refresh);

  const current = models.find((model) => model.id === modelId);
  const blocked =
    status === 'unavailable' || status === 'no-models' || status === 'error';

  // Nothing to choose from — offer the recovery action instead of an empty menu.
  if (blocked || models.length === 0) {
    return (
      <button
        type="button"
        onClick={() => void refresh()}
        data-testid="model-selector-unavailable"
        className={cn(
          'inline-flex h-8 items-center gap-2 rounded-md border px-2.5 text-xs',
          'border-[var(--color-line)] bg-[var(--color-surface-2)]',
          'text-[var(--color-ink-soft)] transition-colors',
          'hover:border-[var(--color-brand)] hover:text-[var(--color-ink)]',
        )}
      >
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            status === 'connecting'
              ? 'animate-pulse bg-[var(--color-warn)]'
              : 'bg-[var(--color-danger)]',
          )}
        />
        {status === 'connecting'
          ? t('runtime.status.connecting')
          : status === 'no-models'
            ? t('runtime.status.noModels')
            : t('runtime.status.unavailable')}
        <span className="text-[10px] underline">{t('runtime.retry')}</span>
      </button>
    );
  }

  return (
    <Select.Root
      value={modelId}
      onValueChange={(value) => {
        const id = String(value);
        selectModel(id);
        setModel(id);
      }}
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
        <span className="font-medium">{current?.name ?? t('model.select')}</span>
        {current ? (
          <span className="text-[10px] text-[var(--color-ink-soft)]">
            {current.contextK}K
          </span>
        ) : null}
        <Select.Icon className="ms-1 rotate-90 text-[var(--color-ink-soft)]">
          <Icon name="chevron" size={12} />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Positioner sideOffset={6} alignItemWithTrigger={false}>
          <Select.Popup
            data-testid="model-selector-popup"
            className={cn(
              'z-50 max-h-80 w-80 overflow-y-auto rounded-lg border',
              'border-[var(--color-line)] bg-[var(--color-surface)] p-1 shadow-2xl',
            )}
          >
            {models.map((model) => (
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
