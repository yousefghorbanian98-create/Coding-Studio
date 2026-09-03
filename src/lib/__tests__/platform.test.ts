import { describe, expect, it } from 'vitest';
import { renderKey } from '../platform';

describe('renderKey', () => {
  it('maps the Mod token to a concrete modifier', () => {
    expect(['Ctrl', '\u2318']).toContain(renderKey('Mod'));
  });

  it('maps Shift to a concrete label', () => {
    expect(['Shift', '\u21e7']).toContain(renderKey('Shift'));
  });

  it('passes through literal keys unchanged', () => {
    expect(renderKey('K')).toBe('K');
    expect(renderKey('Esc')).toBe('Esc');
  });
});
