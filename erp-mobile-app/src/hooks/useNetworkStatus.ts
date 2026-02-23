import { useState, useEffect } from 'react';

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

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      setStatus('online');
    };
    const handleOffline = () => {
      setOnline(false);
      setStatus('offline');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { online, status, setStatus };
}
