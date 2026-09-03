/**
 * Small subsequence matcher for the command palette.
 *
 * Every query character must appear in order, which lets "tsb" find
 * "Toggle sidebar". Consecutive hits and matches at word starts score higher,
 * so the most literal match still sorts first. Written by hand rather than
 * pulled in as a dependency: the corpus is a few dozen short labels.
 */

export interface FuzzyResult {
  score: number;
  /** Indices in the haystack that matched, for highlighting. */
  indices: number[];
}

const WORD_BOUNDARY = /[\s\-_/.:]/;

export function fuzzyMatch(
  haystack: string,
  needle: string,
): FuzzyResult | null {
  const query = needle.trim().toLowerCase();
  if (query.length === 0) return { score: 0, indices: [] };

  const target = haystack.toLowerCase();
  const indices: number[] = [];

  let score = 0;
  let cursor = 0;
  let previousIndex = -1;

  for (const char of query) {
    const found = target.indexOf(char, cursor);
    if (found === -1) return null;

    // Adjacent characters read as a real word, so weight them heavily.
    if (found === previousIndex + 1) score += 8;

    // A match at the start of a word is what people usually mean.
    const before = found === 0 ? undefined : target[found - 1];
    if (found === 0 || (before !== undefined && WORD_BOUNDARY.test(before))) {
      score += 6;
    }

    // Prefer matches nearer the front of the label.
    score += Math.max(0, 4 - Math.floor(found / 4));

    indices.push(found);
    previousIndex = found;
    cursor = found + 1;
  }

  // A short label that is mostly query is a better hit than a long one.
  score += Math.max(0, 12 - (target.length - query.length) / 2);

  return { score, indices };
}

export interface Scored<T> {
  item: T;
  score: number;
  indices: number[];
}

/**
 * Ranks items by fuzzy match against the text `toText` returns.
 *
 * Ties keep the original ordering so an empty query leaves the authored
 * command order untouched.
 */
export function fuzzyRank<T>(
  items: readonly T[],
  query: string,
  toText: (item: T) => string,
): Scored<T>[] {
  const scored: (Scored<T> & { order: number })[] = [];

  items.forEach((item, order) => {
    const result = fuzzyMatch(toText(item), query);
    if (result === null) return;
    scored.push({ item, score: result.score, indices: result.indices, order });
  });

  scored.sort((a, b) => (b.score - a.score) || (a.order - b.order));
  return scored.map(({ item, score, indices }) => ({ item, score, indices }));
}
