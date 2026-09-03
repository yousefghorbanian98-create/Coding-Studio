import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * "Copied!" confirmation that cleans up after itself.
 *
 * The obvious inline version — `setCopied(true); setTimeout(…, 1500)` — leaves
 * a live timer behind when the row unmounts, which then sets state on a dead
 * component. Switching sessions unmounts every message at once, so this was a
 * real leak rather than a theoretical one.
 */
export function useCopyFeedback(resetAfterMs = 1500): {
  copied: boolean;
  copy: (text: string) => void;
} {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const copy = useCallback(
    (text: string): void => {
      void navigator.clipboard?.writeText(text).then(
        () => {
          setCopied(true);
          if (timer.current !== null) clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            setCopied(false);
            timer.current = null;
          }, resetAfterMs);
        },
        () => {
          // Clipboard can be denied; failing silently beats a crash.
        },
      );
    },
    [resetAfterMs],
  );

  return { copied, copy };
}
