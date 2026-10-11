import { useState, useEffect, useRef } from 'react';
import { subscribeNetworkConnectivity, getInitialNetworkConnected } from '../lib/networkBridge';

export type NetworkStatus = 'online' | 'offline' | 'syncing' | 'sync_error';

export function useNetworkStatus(): {
  online: boolean;
  status: NetworkStatus;
  setStatus: (s: NetworkStatus) => void;
} {
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [status, setStatus] = useState<NetworkStatus>(online ? 'online' : 'offline');
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    void getInitialNetworkConnected().then((connected) => {
      if (!mounted.current) return;
      setOnline(connected);
      setStatus((prev) => {
        if (!connected) return 'offline';
        if (prev === 'syncing' || prev === 'sync_error') return prev;
        return 'online';
      });
    });
    const unsub = subscribeNetworkConnectivity((connected) => {
      if (!mounted.current) return;
      setOnline(connected);
      if (!connected) {
        setStatus('offline');
        return;
      }
      setStatus((prev) => {
        if (prev === 'syncing' || prev === 'sync_error') return prev;
        return 'online';
      });
    });
    return () => {
      mounted.current = false;
      unsub();
    };
  }, []);

  return { online, status, setStatus };
}
