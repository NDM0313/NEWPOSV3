/**
 * Safe access to window.localStorage / sessionStorage when the getter throws SecurityError
 * (strict privacy, blocked cookies, iframe). Never read window.localStorage uncaught.
 */

export type BrowserStorageKind = 'local' | 'session';

export function getBrowserStorage(kind: BrowserStorageKind): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function probeStorage(storage: Storage): boolean {
  try {
    const probe = '__sb_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/** Prefer localStorage, then sessionStorage, for non-auth app prefs. */
export function getWritableBrowserStorage(): Storage | null {
  const ls = getBrowserStorage('local');
  if (ls && probeStorage(ls)) return ls;
  const ss = getBrowserStorage('session');
  if (ss && probeStorage(ss)) return ss;
  return null;
}

export function safeLocalStorageGetItem(key: string): string | null {
  const storage = getBrowserStorage('local');
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function safeLocalStorageSetItem(key: string, value: string): void {
  const storage = getWritableBrowserStorage();
  if (!storage) return;
  try {
    storage.setItem(key, value);
  } catch {
    /* quota / denied */
  }
}

export function safeLocalStorageRemoveItem(key: string): void {
  const storage = getBrowserStorage('local');
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function safeSessionStorageGetItem(key: string): string | null {
  const storage = getBrowserStorage('session');
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSessionStorageSetItem(key: string, value: string): void {
  const storage = getBrowserStorage('session');
  if (!storage) return;
  try {
    storage.setItem(key, value);
  } catch {
    /* quota / denied */
  }
}

export function safeSessionStorageRemoveItem(key: string): void {
  const storage = getBrowserStorage('session');
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function safeSessionStorageClear(): void {
  const storage = getBrowserStorage('session');
  if (!storage) return;
  try {
    storage.clear();
  } catch {
    /* ignore */
  }
}

/** Keys from localStorage matching a predicate; empty if storage unavailable. */
export function safeLocalStorageKeys(match: (key: string) => boolean): string[] {
  const storage = getBrowserStorage('local');
  if (!storage) return [];
  try {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && match(k)) keys.push(k);
    }
    return keys;
  } catch {
    return [];
  }
}
