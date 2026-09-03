import { describe, expect, it } from 'vitest';
import { fuzzyMatch, fuzzyRank } from '../fuzzy';

describe('fuzzyMatch', () => {
  it('treats an empty query as a match with no highlights', () => {
    expect(fuzzyMatch('Toggle sidebar', '')).toEqual({ score: 0, indices: [] });
    expect(fuzzyMatch('Toggle sidebar', '   ')).toEqual({
      score: 0,
      indices: [],
    });
  });

  it('matches a contiguous substring', () => {
    const result = fuzzyMatch('Toggle sidebar', 'side');
    expect(result).not.toBeNull();
    expect(result?.indices).toEqual([7, 8, 9, 10]);
  });

  it('matches an out-of-order-free subsequence across words', () => {
    expect(fuzzyMatch('Toggle sidebar', 'tsb')).not.toBeNull();
  });

  it('is case-insensitive', () => {
    expect(fuzzyMatch('Toggle Sidebar', 'SIDEBAR')).not.toBeNull();
  });

  it('rejects characters that appear out of order', () => {
    expect(fuzzyMatch('Toggle sidebar', 'rabedis')).toBeNull();
  });

  it('rejects a character that is absent', () => {
    expect(fuzzyMatch('Toggle sidebar', 'sidez')).toBeNull();
  });

  it('scores a contiguous match above a scattered one', () => {
    const tight = fuzzyMatch('Toggle sidebar', 'sidebar');
    const loose = fuzzyMatch('Switch to Agent mode', 'sidebar');
    expect(tight).not.toBeNull();
    if (loose !== null) {
      expect(tight!.score).toBeGreaterThan(loose.score);
    }
  });

  it('rewards a match at a word boundary', () => {
    const boundary = fuzzyMatch('New session', 's');
    const middle = fuzzyMatch('Close panel', 's');
    expect(boundary!.score).toBeGreaterThan(middle!.score);
  });
});

describe('fuzzyRank', () => {
  const items = [
    'Toggle sidebar',
    'Toggle inspector',
    'Toggle bottom panel',
    'New session',
  ];

  it('keeps the authored order for an empty query', () => {
    expect(fuzzyRank(items, '', (s) => s).map((r) => r.item)).toEqual(items);
  });

  it('drops items that cannot match', () => {
    const ranked = fuzzyRank(items, 'session', (s) => s);
    expect(ranked.map((r) => r.item)).toEqual(['New session']);
  });

  it('puts the most literal match first', () => {
    const ranked = fuzzyRank(items, 'sidebar', (s) => s);
    expect(ranked[0]?.item).toBe('Toggle sidebar');
  });

  it('returns highlight indices alongside each hit', () => {
    const ranked = fuzzyRank(items, 'new', (s) => s);
    expect(ranked[0]?.indices).toEqual([0, 1, 2]);
  });

  it('breaks score ties using the original order', () => {
    const ranked = fuzzyRank(['Alpha one', 'Alpha two'], 'alpha', (s) => s);
    expect(ranked.map((r) => r.item)).toEqual(['Alpha one', 'Alpha two']);
  });
});
