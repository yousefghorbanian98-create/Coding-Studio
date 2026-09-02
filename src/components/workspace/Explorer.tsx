import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/Icon';
import { FIXTURE_TREE, type FileNode } from '@/services/runtime/workspace';

const STATUS_MARK: Record<string, { char: string; className: string }> = {
  added: { char: 'A', className: 'text-[var(--color-ok)]' },
  modified: { char: 'M', className: 'text-[var(--color-warn)]' },
  deleted: { char: 'D', className: 'text-[var(--color-danger)]' },
  renamed: { char: 'R', className: 'text-[var(--color-brand)]' },
};

/** Flattens the visible tree so arrow keys can move linearly through it. */
interface Row {
  node: FileNode;
  depth: number;
}

function flatten(node: FileNode, expanded: Set<string>, depth = 0): Row[] {
  const rows: Row[] = [];
  for (const child of node.children ?? []) {
    rows.push({ node: child, depth });
    if (child.kind === 'directory' && expanded.has(child.path)) {
      rows.push(...flatten(child, expanded, depth + 1));
    }
  }
  return rows;
}

export function Explorer(): React.ReactElement {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(['src', 'src/components', 'src/services']),
  );
  const [active, setActive] = useState<string | null>(null);

  const rows = useMemo(() => flatten(FIXTURE_TREE, expanded), [expanded]);

  const toggle = (path: string): void => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const activate = (row: Row): void => {
    setActive(row.node.path);
    if (row.node.kind === 'directory') toggle(row.node.path);
  };

  const onKeyDown = (event: React.KeyboardEvent, index: number): void => {
    const row = rows[index];
    if (!row) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      const next = rows[index + delta];
      if (next) {
        setActive(next.node.path);
        document
          .querySelector<HTMLElement>(`[data-tree-path="${next.node.path}"]`)
          ?.focus();
      }
      return;
    }
    if (event.key === 'ArrowRight' && row.node.kind === 'directory') {
      event.preventDefault();
      if (!expanded.has(row.node.path)) toggle(row.node.path);
      return;
    }
    if (event.key === 'ArrowLeft' && row.node.kind === 'directory') {
      event.preventDefault();
      if (expanded.has(row.node.path)) toggle(row.node.path);
    }
  };

  return (
    <div className="flex min-h-0 flex-col" data-testid="explorer">
      <div className="flex items-center gap-1 px-2 py-1.5">
        <h2 className="flex-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
          {t('explorer.title')}
        </h2>
        <button
          type="button"
          onClick={() => setExpanded(new Set())}
          data-testid="explorer-collapse"
          title={t('explorer.collapseAll')}
          aria-label={t('explorer.collapseAll')}
          className="rounded p-1 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
        >
          <Icon name="chevron" size={12} className="-rotate-90" />
        </button>
      </div>

      <ul
        role="tree"
        aria-label={t('explorer.title')}
        className="min-h-0 flex-1 overflow-y-auto px-1 pb-2"
      >
        {rows.map((row, index) => {
          const isDir = row.node.kind === 'directory';
          const open = expanded.has(row.node.path);
          const mark = row.node.status
            ? STATUS_MARK[row.node.status]
            : undefined;

          return (
            <li
              key={row.node.path}
              role="treeitem"
              aria-expanded={isDir ? open : undefined}
              aria-selected={active === row.node.path}
            >
              <button
                type="button"
                data-tree-path={row.node.path}
                data-testid={`tree-${row.node.path}`}
                tabIndex={
                  active === row.node.path || (active === null && index === 0)
                    ? 0
                    : -1
                }
                onClick={() => activate(row)}
                onKeyDown={(event) => onKeyDown(event, index)}
                style={{ paddingInlineStart: `${row.depth * 12 + 6}px` }}
                className={cn(
                  'flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-start text-xs',
                  'transition-colors hover:bg-[var(--color-surface-2)]',
                  active === row.node.path
                    ? 'bg-[var(--color-surface-2)] text-[var(--color-ink)]'
                    : 'text-[var(--color-ink-soft)]',
                  row.node.status === 'deleted' && 'line-through',
                )}
              >
                {isDir ? (
                  <Icon
                    name="chevron"
                    size={11}
                    className={cn('shrink-0', open && 'rotate-90')}
                  />
                ) : (
                  <span className="w-[11px] shrink-0" />
                )}
                <Icon
                  name={isDir ? 'sessions' : 'files'}
                  size={12}
                  className="shrink-0"
                />
                <span className="min-w-0 flex-1 truncate">{row.node.name}</span>
                {mark ? (
                  <span
                    aria-label={t(`explorer.status.${row.node.status ?? ''}`)}
                    className={cn('shrink-0 text-[10px] font-bold', mark.className)}
                  >
                    {mark.char}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
