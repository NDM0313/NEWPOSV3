import { Capacitor } from '@capacitor/core';

const NETWORK_FETCH_RE = /Failed to fetch|NetworkError|Load failed|fetch failed/i;

export function isNetworkFetchError(message: string | null | undefined): boolean {
  return Boolean(message && NETWORK_FETCH_RE.test(message));
}

/** Map low-level fetch failures to a user-facing message (parity with auth sign-in errors). */
export function formatNetworkFetchError(msg: string): string {
  if (!isNetworkFetchError(msg)) return msg;
  const base = 'Cannot reach the server. Check network or contact admin.';
  if (Capacitor.isNativePlatform()) {
    return `${base} If https://erp.dincouture.pk/m/ works, install the latest APK build.`;
  }
  return base;
}
