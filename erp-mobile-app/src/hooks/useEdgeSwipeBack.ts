import { useCallback, useEffect, useRef } from 'react';

const EDGE_PX = 28;
const SWIPE_THRESHOLD = 72;

export interface UseEdgeSwipeBackOptions {
  onBack: () => void;
  disabled?: boolean;
}

/**
 * Left-edge swipe right + right-edge swipe left → onBack (iOS-style back from both sides).
 */
export function useEdgeSwipeBack({ onBack, disabled = false }: UseEdgeSwipeBackOptions) {
  const ref = useRef<HTMLDivElement>(null);
  const startRef = useRef({ x: 0, y: 0, edge: 'none' as 'left' | 'right' | 'none' });

  const handleBack = useCallback(() => {
    if (disabled) return;
    onBack();
  }, [disabled, onBack]);

  useEffect(() => {
    const el = ref.current;
    if (!el || disabled) return;

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      const w = window.innerWidth;
      const edge: 'left' | 'right' | 'none' =
        t.clientX <= EDGE_PX ? 'left' : t.clientX >= w - EDGE_PX ? 'right' : 'none';
      startRef.current = { x: t.clientX, y: t.clientY, edge };
    };

    const onEnd = (e: TouchEvent) => {
      const { x, y, edge } = startRef.current;
      if (edge === 'none') return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - x;
      const dy = t.clientY - y;
      if (Math.abs(dy) > Math.abs(dx)) return;
      if (edge === 'left' && dx >= SWIPE_THRESHOLD) handleBack();
      if (edge === 'right' && dx <= -SWIPE_THRESHOLD) handleBack();
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchend', onEnd);
    };
  }, [disabled, handleBack]);

  return ref;
}
