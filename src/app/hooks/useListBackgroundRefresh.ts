import { useCallback, useRef, useState } from 'react';

/**
 * List pages: first successful load may use a full-table skeleton; later refetches
 * should only toggle `isBackgroundRefreshing` so the table stays visible and interactive.
 *
 * Call `markInitialComplete()` when the first load finishes (even with 0 rows).
 * `reset()` when switching company / store key so the next load is "initial" again.
 */
export function useListBackgroundRefresh() {
  const initialCompleteRef = useRef(false);
  const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false);

  const reset = useCallback(() => {
    initialCompleteRef.current = false;
    setIsBackgroundRefreshing(false);
  }, []);

  const beginFetch = useCallback(() => {
    if (!initialCompleteRef.current) {
      return { mode: 'initial' as const };
    }
    setIsBackgroundRefreshing(true);
    return { mode: 'background' as const };
  }, []);

  const markInitialComplete = useCallback(() => {
    initialCompleteRef.current = true;
    setIsBackgroundRefreshing(false);
  }, []);

  return {
    beginFetch,
    markInitialComplete,
    reset,
    isBackgroundRefreshing,
  };
}
