/**
 * When the resolved Supabase API host changes (e.g. VPS → Mini PC), purge local
 * auth tokens so the device cannot reuse a session issued by the old host.
 */

import { clearSecure } from './secureStorage';
import { getResolvedSupabaseUrl, supabase } from './supabase';
import { clearStorageDisplayUrlCache } from '../utils/storageDisplayUrl';

export const API_HOST_MARKER_KEY = 'erp_mobile_resolved_api_base';

const AUTH_TOKEN_KEY_RE = /^sb-.+-auth-token$/;

function readMarker(): string | null {
  try {
    return localStorage.getItem(API_HOST_MARKER_KEY);
  } catch {
    return null;
  }
}

function writeMarker(host: string): void {
  try {
    localStorage.setItem(API_HOST_MARKER_KEY, host);
  } catch {
    /* ignore */
  }
}

function clearSupabaseAuthTokenKeys(): number {
  let removed = 0;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && AUTH_TOKEN_KEY_RE.test(k)) keys.push(k);
    }
    for (const k of keys) {
      localStorage.removeItem(k);
      removed += 1;
    }
  } catch {
    /* ignore */
  }
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && AUTH_TOKEN_KEY_RE.test(k)) keys.push(k);
    }
    for (const k of keys) {
      sessionStorage.removeItem(k);
      removed += 1;
    }
  } catch {
    /* ignore */
  }
  return removed;
}

/** Clear session + auth storage for the current API host (no full factory wipe). */
export async function purgeApiHostSession(reason = 'manual'): Promise<{ purged: boolean; host: string }> {
  const host = getResolvedSupabaseUrl().replace(/\/$/, '');
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    /* ignore */
  }
  clearSupabaseAuthTokenKeys();
  clearStorageDisplayUrlCache();
  try {
    await clearSecure();
  } catch {
    /* ignore */
  }
  writeMarker(host);
  console.info(`[apiHostSessionGuard] purged session (${reason}) for`, host);
  return { purged: true, host };
}

/**
 * On boot: if stored API host ≠ current resolved URL, purge auth and update marker.
 * Returns whether a purge ran.
 */
export async function ensureApiHostSessionAligned(): Promise<{
  purged: boolean;
  host: string;
  previous: string | null;
}> {
  const host = getResolvedSupabaseUrl().replace(/\/$/, '');
  const previous = readMarker();
  if (previous === host) {
    return { purged: false, host, previous };
  }
  await purgeApiHostSession(previous ? `host-changed:${previous}->${host}` : 'first-marker');
  return { purged: true, host, previous };
}

/** Purge session then hard reload (Settings action). */
export async function purgeApiHostSessionAndReload(): Promise<void> {
  await purgeApiHostSession('settings-clear');
  const url = new URL(window.location.href);
  url.searchParams.set('_api_fresh', String(Date.now()));
  window.location.replace(url.toString());
}
