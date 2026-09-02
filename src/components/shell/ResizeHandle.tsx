import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import {
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  usePreferences,
} from '@/stores/preferences';

const STEP = 16;

/** Draggable + keyboard-accessible separator that resizes the sidebar. */
export function ResizeHandle(): React.ReactElement {
  const { t } = useTranslation();
  const width = usePreferences((s) => s.sidebarWidth);
  const setSidebarWidth = usePreferences((s) => s.setSidebarWidth);
  const setSidebarCollapsed = usePreferences((s) => s.setSidebarCollapsed);
  const dragging = useRef(false);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragging.current = true;
      const rtl = document.documentElement.dir === 'rtl';
      const startX = event.clientX;
      const startWidth = width;
      event.currentTarget.setPointerCapture(event.pointerId);

      const onMove = (moveEvent: PointerEvent): void => {
        if (!dragging.current) return;
        const delta = (moveEvent.clientX - startX) * (rtl ? -1 : 1);
        setSidebarWidth(startWidth + delta);
      };
      const onUp = (): void => {
        dragging.current = false;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        document.body.style.cursor = '';
      };

      document.body.style.cursor = 'col-resize';
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [width, setSidebarWidth],
  );

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const rtl = document.documentElement.dir === 'rtl';
    const grow = rtl ? 'ArrowLeft' : 'ArrowRight';
    const shrink = rtl ? 'ArrowRight' : 'ArrowLeft';
    if (event.key === grow) {
      event.preventDefault();
      setSidebarWidth(width + STEP);
    } else if (event.key === shrink) {
      event.preventDefault();
      setSidebarWidth(width - STEP);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setSidebarCollapsed(true);
    }
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={t('sidebar.resize')}
      aria-valuenow={width}
      aria-valuemin={SIDEBAR_MIN_WIDTH}
      aria-valuemax={SIDEBAR_MAX_WIDTH}
      tabIndex={0}
      data-testid="sidebar-resize-handle"
      onPointerDown={onPointerDown}
      onDoubleClick={() => setSidebarCollapsed(true)}
      onKeyDown={onKeyDown}
      className={cn(
        'group relative -ms-1 w-1.5 shrink-0 cursor-col-resize',
        'bg-transparent transition-colors hover:bg-[var(--color-brand)]/40',
        'focus-visible:bg-[var(--color-brand)]',
      )}
    />
  );
}
