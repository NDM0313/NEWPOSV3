import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';

/** Subscribe to connectivity changes (Capacitor on native; window online/offline on web). */
export function subscribeNetworkConnectivity(callback: (connected: boolean) => void): () => void {
  if (Capacitor.isNativePlatform()) {
    const sub = Network.addListener('networkStatusChange', (status) => {
      callback(status.connected);
    });
    return () => {
      void sub.then((handle) => handle.remove());
    };
  }
  const onOnline = () => callback(true);
  const onOffline = () => callback(false);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}

export async function getInitialNetworkConnected(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      const s = await Network.getStatus();
      return s.connected;
    } catch {
      return typeof navigator !== 'undefined' ? navigator.onLine : true;
    }
  }
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}
