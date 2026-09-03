import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/Icon';
import { FIXTURE_DIFFS, type FileDiff } from '@/services/runtime/workspace';

const LINE_STYLE = {
  added: 'bg-[var(--color-ok)]/10 text-[var(--color-ink)]',
  removed: 'bg-[var(--color-danger)]/10 text-[var(--color-ink)]',
  context: 'text-[var(--color-ink-soft)]',
} as const;

const SIGN = { added: '+', removed: '-', context: ' ' } as const;

function DiffBody({ diff }: { diff: FileDiff }): React.ReactElement {
  const { t } = useTranslation();

  if (diff.binary) {
    return (
      <p
        data-testid="diff-binary"
        className="px-3 py-4 text-center text-[11px] text-[var(--color-ink-soft)]"
      >
        {t('changes.binary')}
      </p>
    );
  }

  if (diff.lines.length === 0) {
    return (
      <p
        data-testid="diff-empty"
        className="px-3 py-4 text-center text-[11px] text-[var(--color-ink-soft)]"
      >
        {t('changes.emptyDiff')}
      </p>
    );
  }

  return (
    <table
      className="w-full border-collapse font-mono text-[11px]"
      data-testid="diff-table"
    >
      <caption className="sr-only">
        {t('changes.diffFor', { path: diff.path })}
      </caption>
      <tbody>
        {diff.lines.map((line, index) => (
          <tr
            key={`${diff.path}-${index}`}
            data-kind={line.kind}
            className={LINE_STYLE[line.kind]}
          >
            <td className="w-10 select-none px-1.5 text-end align-top tabular-nums opacity-50">
              {line.oldLine ?? ''}
            </td>
            <td className="w-10 select-none px-1.5 text-end align-top tabular-nums opacity-50">
              {line.newLine ?? ''}
            </td>
            <td className="w-4 select-none text-center align-top opacity-70">
              {/*
                The +/- sign carries the meaning for anyone who cannot see the
                row tint; the sr-only word carries it for screen readers.
              */}
              <span aria-hidden="true">{SIGN[line.kind]}</span>
              {line.kind === 'context' ? null : (
                <span className="sr-only">
                  {t(`changes.line.${line.kind}`)}
                </span>
              )}
            </td>
            <td
              dir="ltr"
              className="whitespace-pre-wrap break-all px-1.5 align-top"
            >
              {line.text}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Reviews the change set produced by a run. */
export function DiffViewer(): React.ReactElement {
  const { t } = useTranslation();
  const diffs = FIXTURE_DIFFS;
  const [activePath, setActivePath] = useState(diffs[0]?.path ?? '');
  const active = diffs.find((diff) => diff.path === activePath) ?? diffs[0];

  const totals = diffs.reduce(
    (acc, diff) => ({
      additions: acc.additions + diff.additions,
      deletions: acc.deletions + diff.deletions,
    }),
    { additions: 0, deletions: 0 },
  );

  return (
    <section
      className="flex min-h-0 flex-col"
      data-testid="diff-viewer"
      aria-label={t('changes.title')}
    >
      <header className="flex items-center gap-2 border-b border-[var(--color-line)] px-2 py-1.5">
        <h2 className="flex-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
          {t('changes.title')}
        </h2>
        <button
          type="button"
          data-testid="diff-copy-patch"
          onClick={() => {
            const active = diffs.find((diff) => diff.path === activePath);
            if (!active) return;
            const patch = [
              `--- a/${active.previousPath ?? active.path}`,
              `+++ b/${active.path}`,
              ...active.lines.map((line) =>
                `${line.kind === 'added' ? '+' : line.kind === 'removed' ? '-' : ' '}${line.text}`,
              ),
            ].join('\n');
            void navigator.clipboard?.writeText(patch).catch(() => {
              // Clipboard can be denied; silence beats a crash.
            });
          }}
          aria-label={t('changes.copyPatch')}
          title={t('changes.copyPatch')}
          className="rounded p-1 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
        >
          <Icon name="copy" size={12} />
        </button>
        <span data-testid="changes-total" className="text-[10px]">
          <span className="text-[var(--color-ok)]">+{totals.additions}</span>{' '}
          <span className="text-[var(--color-danger)]">−{totals.deletions}</span>
        </span>
      </header>

      <div className="flex shrink-0 items-center gap-1 border-b border-[var(--color-line)] px-2 py-1">
        {/* Applying or reverting a change needs a real workspace, so these
            state that plainly instead of being dead controls. */}
        {(['accept', 'revert', 'acceptAll'] as const).map((action) => (
          <button
            key={action}
            type="button"
            aria-disabled="true"
            data-testid={`diff-${action}`}
            title={t('changes.needsRuntime')}
            className="cursor-not-allowed rounded px-1.5 py-0.5 text-[10px] text-[var(--color-ink-soft)]"
          >
            {t(`changes.${action}`)}
          </button>
        ))}
      </div>

      <ul className="flex shrink-0 flex-col border-b border-[var(--color-line)]">
        {diffs.map((diff) => (
          <li key={diff.path}>
            <button
              type="button"
              onClick={() => setActivePath(diff.path)}
              data-testid={`change-${diff.path}`}
              aria-current={diff.path === activePath}
              className={cn(
                'flex w-full items-center gap-2 px-2 py-1 text-start text-[11px]',
                'transition-colors hover:bg-[var(--color-surface-2)]',
                diff.path === activePath
                  ? 'bg-[var(--color-surface-2)] text-[var(--color-ink)]'
                  : 'text-[var(--color-ink-soft)]',
              )}
            >
              <Icon name="files" size={11} className="shrink-0" />
              <span
                title={diff.path}
                className="min-w-0 flex-1 truncate"
                dir="ltr"
              >
                {diff.path}
              </span>
              <span className="shrink-0 text-[10px]">
                {t(`changes.kind.${diff.kind}`)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="min-h-0 flex-1 overflow-auto">
        {active ? <DiffBody diff={active} /> : null}
      </div>
    </section>
  );
}
