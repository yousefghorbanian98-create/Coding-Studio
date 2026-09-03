import { describe, expect, it } from 'vitest';
import { cn } from '../cn';
import { formatNumber, formatRelativeTime } from '../format';

describe('cn', () => {
  it('joins truthy class values', () => {
    expect(cn('a', false, undefined, 'b')).toBe('a b');
    expect(cn(['a', ['b']], { c: true, d: false })).toBe('a b c');
    expect(cn()).toBe('');
  });
});

describe('format', () => {
  it('formats relative time', () => {
    const now = Date.parse('2026-09-02T12:00:00Z');
    expect(formatRelativeTime(now - 30_000, 'en', now)).toContain('second');
    expect(formatRelativeTime(now - 3 * 3600_000, 'en', now)).toContain('hour');
  });

  it('formats numbers per locale', () => {
    expect(formatNumber(1234, 'en')).toBe('1,234');
    expect(formatNumber(1234, 'fa')).not.toBe('1234');
  });
});
