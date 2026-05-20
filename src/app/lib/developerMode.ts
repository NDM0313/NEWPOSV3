/**
 * Hidden Developer Mode (client-only). Unlock by tapping App Version 7 times in Settings.
 */

import {
  getBrowserStorage,
  safeLocalStorageGetItem,
  safeLocalStorageKeys,
  safeLocalStorageRemoveItem,
  safeLocalStorageSetItem,
} from '@/app/lib/safeBrowserStorage';

export const DEVELOPER_MODE_STORAGE_KEY = 'erp_developer_mode_unlocked';
export const DEVELOPER_VERBOSE_API_ERRORS_KEY = 'erp_developer_verbose_api_errors';
export const DEVELOPER_MODE_TAP_TARGET = 7;
export const DEVELOPER_MODE_TAP_RESET_MS = 4000;

export const APP_VERSION =
  (import.meta.env?.VITE_APP_VERSION as string | undefined) || '0.0.1';

const CHANGE_EVENT = 'erp-developer-mode-changed';

const AUTH_TOKEN_KEY_RE = /^sb-.+-auth-token$/;

function isPreservedKey(key: string): boolean {
  if (key === DEVELOPER_MODE_STORAGE_KEY || key === DEVELOPER_VERBOSE_API_ERRORS_KEY) {
    return true;
  }
  return AUTH_TOKEN_KEY_RE.test(key);
}

export function isDeveloperModeUnlocked(): boolean {
  try {
    return localStorage.getItem(DEVELOPER_MODE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setDeveloperModeUnlocked(unlocked: boolean): void {
  try {
    if (unlocked) {
      localStorage.setItem(DEVELOPER_MODE_STORAGE_KEY, '1');
    } else {
      localStorage.removeItem(DEVELOPER_MODE_STORAGE_KEY);
      localStorage.removeItem(DEVELOPER_VERBOSE_API_ERRORS_KEY);
    }
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { unlocked } }));
  } catch {
    /* ignore */
  }
}

export function isVerboseApiErrorsEnabled(): boolean {
  if (!isDeveloperModeUnlocked()) return false;
  try {
    return localStorage.getItem(DEVELOPER_VERBOSE_API_ERRORS_KEY) === '1';
  } catch {
    return false;
  }
}

export function setVerboseApiErrorsEnabled(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(DEVELOPER_VERBOSE_API_ERRORS_KEY, '1');
    } else {
      localStorage.removeItem(DEVELOPER_VERBOSE_API_ERRORS_KEY);
    }
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { verbose: enabled } }));
  } catch {
    /* ignore */
  }
}

export function subscribeDeveloperMode(listener: () => void): () => void {
  const handler = () => listener();
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

let tapCount = 0;
let tapTimer: ReturnType<typeof setTimeout> | null = null;

export interface VersionTapResult {
  unlocked: boolean;
  justUnlocked: boolean;
  tapsRemaining: number;
}

/** Call on each click/tap of the App Version label. */
export function registerAppVersionTap(): VersionTapResult {
  if (isDeveloperModeUnlocked()) {
    return { unlocked: true, justUnlocked: false, tapsRemaining: 0 };
  }

  if (tapTimer) clearTimeout(tapTimer);
  tapCount += 1;

  if (tapCount >= DEVELOPER_MODE_TAP_TARGET) {
    tapCount = 0;
    setDeveloperModeUnlocked(true);
    return { unlocked: true, justUnlocked: true, tapsRemaining: 0 };
  }

  tapTimer = setTimeout(() => {
    tapCount = 0;
    tapTimer = null;
  }, DEVELOPER_MODE_TAP_RESET_MS);

  return {
    unlocked: false,
    justUnlocked: false,
    tapsRemaining: DEVELOPER_MODE_TAP_TARGET - tapCount,
  };
}

/** Reset in-memory tap counter (e.g. for tests). */
export function resetAppVersionTapStateForTests(): void {
  tapCount = 0;
  if (tapTimer) clearTimeout(tapTimer);
  tapTimer = null;
}

/**
 * Clear client-side caches. Does not sign out: Supabase auth keys are preserved.
 * Developer-mode keys are preserved.
 */
export function clearClientCaches(): { removedKeys: number } {
  let removedKeys = 0;
  safeLocalStorageKeys((k) => !isPreservedKey(k)).forEach((k) => {
    safeLocalStorageRemoveItem(k);
    removedKeys += 1;
  });
  try {
    getBrowserStorage('session')?.clear();
  } catch {
    /* ignore */
  }
  return { removedKeys };
}
