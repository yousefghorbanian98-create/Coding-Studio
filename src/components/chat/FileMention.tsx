import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/Icon';
import { FIXTURE_TREE, type FileNode } from '@/services/runtime/workspace';

/** Flattens the fixture tree down to file paths the user can mention. */
function collectFiles(node: FileNode, prefix = ''): string[] {
  const path = prefix === '' ? node.name : `${prefix}/${node.name}`;
  if (node.kind === 'file') return [path];
  return (node.children ?? []).flatMap((child) => collectFiles(child, path));
}

const MAX_RESULTS = 6;

/**
 * The `@` file-mention picker. Reads the mock workspace only — mentioning a
 * file adds text to the prompt, it does not read anything from disk.
 */
export function FileMention({
  onSelect,
}: {
  onSelect: (path: string) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const files = useMemo(() => collectFiles(FIXTURE_TREE).slice(0, MAX_RESULTS), []);

  return (
    <div
      data-testid="file-mention"
      role="listbox"
      aria-label={t('chat.mention.title')}
      className={cn(
        'mx-2 mb-1 overflow-hidden rounded-md border border-[var(--color-line)]',
        'bg-[var(--color-surface-2)]',
      )}
    >
      <p className="px-2 py-1 text-[10px] text-[var(--color-ink-soft)]">
        {t('chat.mention.title')}
      </p>
      {files.map((path) => (
        <button
          key={path}
          type="button"
          role="option"
          aria-selected="false"
          data-testid={`file-mention-${path}`}
          onClick={() => onSelect(path)}
          className={cn(
            'flex w-full items-center gap-1.5 px-2 py-1 text-start text-[11px]',
            'text-[var(--color-ink)] hover:bg-[var(--color-surface)]',
          )}
        >
          <Icon
            name="files"
            size={11}
            className="shrink-0 text-[var(--color-ink-soft)]"
          />
          <span className="min-w-0 flex-1 truncate" dir="ltr" title={path}>
            {path}
          </span>
        </button>
      ))}
    </div>
  );
}
