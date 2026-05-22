import { useEffect, useState } from 'react';
import { useNetworkStatus } from './useNetworkStatus';
import { getUnsyncedCount } from '../lib/syncEngine';

/** Connectivity + pending sync count for OfflineBanner. */
export function useOfflineListMeta() {
  const { online } = useNetworkStatus();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      getUnsyncedCount().then((n) => {
        if (!cancelled) setPendingCount(n);
      });
    };
    refresh();
    const onSync = () => refresh();
    window.addEventListener('erp-mobile:autosync-complete', onSync);
    const id = window.setInterval(refresh, 8000);
    return () => {
      cancelled = true;
      window.removeEventListener('erp-mobile:autosync-complete', onSync);
      window.clearInterval(id);
    };
  }, []);

  return { online, pendingCount };
}
