/** True on macOS-like platforms, where the Meta key replaces Ctrl. */
export function isAppleLike(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);
}

/** Maps an abstract shortcut token to its platform-specific glyph. */
export function renderKey(key: string): string {
  if (key === 'Mod') return isAppleLike() ? '\u2318' : 'Ctrl';
  if (key === 'Shift') return isAppleLike() ? '\u21e7' : 'Shift';
  return key;
}
