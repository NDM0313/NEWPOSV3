import { useCallback, useEffect } from 'react';
import { useNavigation } from '@/app/context/NavigationContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { clearStuckModalLocks, shouldClearStuckModalLocks } from '@/app/lib/clearStuckModalLocks';

/**
 * Clears orphaned Radix scroll-lock classes after login / navigation when no modal is open.
 */
export function useClearStuckModalLocks() {
  const { user } = useSupabase();
  const { activeDrawer, mobileNavOpen } = useNavigation();

  const runCleanup = useCallback(() => {
    const intentionalModalOpen = activeDrawer !== 'none' || mobileNavOpen;
    if (intentionalModalOpen) return;
    if (shouldClearStuckModalLocks()) {
      clearStuckModalLocks();
    }
  }, [activeDrawer, mobileNavOpen]);

  useEffect(() => {
    runCleanup();
    const t = window.setTimeout(runCleanup, 0);
    const t2 = window.setTimeout(runCleanup, 350);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
  }, [user?.id, runCleanup]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') runCleanup();
    };
    const onEscape = () => runCleanup();

    document.addEventListener('visibilitychange', onVisible);
    document.addEventListener('global-escape', onEscape);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      document.removeEventListener('global-escape', onEscape);
    };
  }, [runCleanup]);
}
