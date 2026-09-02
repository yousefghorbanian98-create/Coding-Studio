import { useCallback, useEffect, useState } from 'react';
import { isTauri } from '@/lib/env';

export interface WindowControls {
  available: boolean;
  isMaximized: boolean;
  minimize: () => void;
  toggleMaximize: () => void;
  close: () => void;
  startDragging: () => void;
}

type TauriWindow = {
  isMaximized: () => Promise<boolean>;
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  close: () => Promise<void>;
  startDragging: () => Promise<void>;
  onResized: (cb: () => void) => Promise<() => void>;
};

async function getWindow(): Promise<TauriWindow | null> {
  if (!isTauri()) return null;
  try {
    const mod = (await import('@tauri-apps/api/window')) as unknown as {
      getCurrentWindow: () => TauriWindow;
    };
    return mod.getCurrentWindow();
  } catch {
    return null;
  }
}

/**
 * Bridges the custom title bar to the native Tauri window.
 * Degrades to a no-op (with `available: false`) in the browser preview.
 */
export function useWindowControls(): WindowControls {
  const [isMaximized, setIsMaximized] = useState(false);
  const available = isTauri();

  useEffect(() => {
    if (!available) return;
    let dispose: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      const win = await getWindow();
      if (!win || cancelled) return;
      setIsMaximized(await win.isMaximized());
      dispose = await win.onResized(() => {
        void win.isMaximized().then(setIsMaximized);
      });
    })();

    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [available]);

  const run = useCallback(
    (action: (win: TauriWindow) => Promise<unknown>) => () => {
      void getWindow().then((win) => {
        if (win) void action(win);
      });
    },
    [],
  );

  return {
    available,
    isMaximized,
    minimize: run((w) => w.minimize()),
    toggleMaximize: run((w) => w.toggleMaximize()),
    close: run((w) => w.close()),
    startDragging: run((w) => w.startDragging()),
  };
}
