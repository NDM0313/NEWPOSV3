import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

function getScrollTop(): number {
  const se = document.scrollingElement;
  if (se && typeof se.scrollTop === 'number') return se.scrollTop;
  return window.scrollY ?? 0;
}

export interface PullToRefreshProps {
  children: ReactNode;
  /** Called when user releases past threshold; may return a Promise. */
  onRefresh: () => void | Promise<void>;
  disabled?: boolean;
  /** Pull distance (px) to trigger refresh. */
  threshold?: number;
  /** Maximum rubber-band offset (px). */
  maxPull?: number;
  className?: string;
  /** Tailwind classes for spinner top border accent (e.g. `border-t-[#EF4444]`). */
  spinnerAccentClass?: string;
}

/**
 * Vertical pull-to-refresh using touch events (no extra gesture libs).
 * Assumes page/body scroll; only activates when `document.scrollingElement` is at top.
 */
export function PullToRefresh({
  children,
  onRefresh,
  disabled = false,
  threshold = 56,
  maxPull = 88,
  className = '',
  spinnerAccentClass = 'border-t-[#8B5CF6]',
}: PullToRefreshProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const refreshingRef = useRef(false);
  const pullRef = useRef(0);
  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const [pullPx, setPullPx] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const endPullVisual = useCallback(() => {
    pullRef.current = 0;
    setPullPx(0);
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || disabled) return;

    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current) return;
      if (getScrollTop() > 2) return;
      startYRef.current = e.touches[0].clientY;
      startXRef.current = e.touches[0].clientX;
    };

    const onMove = (e: TouchEvent) => {
      if (refreshingRef.current) return;
      if (getScrollTop() > 2) {
        pullRef.current = 0;
        setPullPx(0);
        return;
      }
      const y = e.touches[0].clientY;
      const x = e.touches[0].clientX;
      const dy = y - startYRef.current;
      const dx = Math.abs(x - startXRef.current);
      if (dy <= 0) return;
      if (dx > dy * 1.25 && dy < 24) return;
      e.preventDefault();
      const damped = Math.min(maxPull, dy * 0.42);
      pullRef.current = damped;
      setPullPx(damped);
    };

    const runEnd = async () => {
      const px = pullRef.current;
      if (refreshingRef.current) {
        endPullVisual();
        return;
      }
      if (px < threshold) {
        endPullVisual();
        return;
      }
      refreshingRef.current = true;
      setRefreshing(true);
      endPullVisual();
      try {
        await Promise.resolve(onRefresh());
      } finally {
        refreshingRef.current = false;
        setRefreshing(false);
      }
    };

    const onEnd = () => {
      void runEnd();
    };

    const onCancel = () => {
      endPullVisual();
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onCancel);

    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onCancel);
    };
  }, [disabled, maxPull, threshold, onRefresh, endPullVisual]);

  const dragOpacity = Math.min(1, pullPx / threshold);

  return (
    <div ref={rootRef} className={`relative min-h-0 ${className}`} aria-busy={refreshing}>
      {(pullPx > 4 || refreshing) && (
        <div
          className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex justify-center"
          style={{
            height: refreshing ? threshold : pullPx,
            opacity: refreshing ? 1 : dragOpacity,
            transition: pullPx === 0 ? 'opacity 0.15s ease' : undefined,
          }}
          aria-hidden
        >
          <div
            className={`mt-2 h-8 w-8 shrink-0 rounded-full border-4 border-[#374151] ${spinnerAccentClass} ${
              refreshing || pullPx >= threshold ? 'animate-spin' : ''
            }`}
          />
        </div>
      )}
      <div
        style={{
          transform: `translateY(${pullPx}px)`,
          transition: pullPx === 0 ? 'transform 0.2s ease-out' : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
