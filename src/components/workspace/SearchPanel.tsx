import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/Icon';
import { searchWorkspace, type SearchMatch } from '@/services/runtime/workspace';

/** Splits a line so the matched span can be highlighted without dangerouslySet. */
function highlight(match: SearchMatch): React.ReactNode {
  const before = match.text.slice(0, match.column);
  const hit = match.text.slice(match.column, match.column + match.length);
  const after = match.text.slice(match.column + match.length);
  return (
    <>
      {before}
      <mark className="rounded-sm bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
        {hit}
      </mark>
      {after}
    </>
  );
}

export function SearchPanel(): React.ReactElement {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const results = useMemo(() => searchWorkspace(query), [query]);
  const total = results.reduce((sum, file) => sum + file.matches.length, 0);
  const searched = query.trim().length > 0;

  return (
    <div className="flex min-h-0 flex-col" data-testid="search-panel">
      <div className="px-2 py-1.5">
        <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
          {t('search.title')}
        </h2>
        <label className="sr-only" htmlFor="workspace-search">
          {t('search.placeholder')}
        </label>
        <input
          id="workspace-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('search.placeholder')}
          data-testid="search-input"
          className={cn(
            'w-full rounded-md border border-[var(--color-line)]',
            'bg-[var(--color-surface-2)] px-2 py-1.5 text-xs',
            'text-[var(--color-ink)] outline-none',
            'placeholder:text-[var(--color-ink-soft)]',
            'focus-visible:border-[var(--color-brand)]',
          )}
        />
        {searched ? (
          <p
            data-testid="search-summary"
            aria-live="polite"
            className="mt-1.5 text-[10px] text-[var(--color-ink-soft)]"
          >
            {t('search.summary', { matches: total, files: results.length })}
          </p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
        {!searched ? (
          <p className="px-2 py-6 text-center text-[11px] text-[var(--color-ink-soft)]">
            {t('search.idle')}
          </p>
        ) : results.length === 0 ? (
          <p
            data-testid="search-empty"
            className="px-2 py-6 text-center text-[11px] text-[var(--color-ink-soft)]"
          >
            {t('search.noResults')}
          </p>
        ) : (
          results.map((file) => (
            <section key={file.path} className="mb-2">
              <h3 className="flex items-center gap-1.5 px-1.5 py-1 text-[11px] font-medium text-[var(--color-ink)]">
                <Icon name="files" size={12} className="shrink-0" />
                <span
                  title={file.path}
                  className="min-w-0 flex-1 truncate"
                  dir="ltr"
                >
                  {file.path}
                </span>
                <span className="shrink-0 text-[10px] text-[var(--color-ink-soft)]">
                  {file.matches.length}
                </span>
              </h3>
              <ul>
                {file.matches.map((match) => (
                  <li
                    key={`${file.path}:${match.line}`}
                    data-testid={`search-result-${file.path}-${match.line}`}
                    className={cn(
                      'flex items-start gap-2 rounded px-1.5 py-1',
                      'font-mono text-[10px] text-[var(--color-ink-soft)]',
                    )}
                  >
                    <span className="shrink-0 tabular-nums">{match.line}</span>
                    <span className="min-w-0 flex-1 truncate" dir="ltr">
                      {highlight(match)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
