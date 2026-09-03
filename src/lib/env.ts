/** Runtime environment helpers shared between the browser and the Tauri shell. */

export function isTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
  );
}

export function isBrowserPreview(): boolean {
  return !isTauri();
}
