/**
 * Factory reset for browser / dev: Supabase session, localStorage, sessionStorage,
 * IndexedDB (PIN vault, counter workers, offline queue, list cache), and PWA caches.
 */

import * as authApi from '../api/auth';

const KNOWN_IDB_NAMES = [
  'erp_mobile_secure',
  'erp_mobile_offline',
  'erp_mobile_list_cache',
  'erp_mobile_counter_workers',
  'erp_mobile_counter_vault',
] as const;

function deleteIndexedDb(name: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function deleteAllIndexedDbs(): Promise<void> {
  const names = new Set<string>(KNOWN_IDB_NAMES);
  try {
    if (typeof indexedDB.databases === 'function') {
      const dbs = await indexedDB.databases();
      for (const db of dbs) {
        if (db.name) names.add(db.name);
      }
    }
  } catch {
    /* ignore */
  }
  await Promise.all([...names].map((n) => deleteIndexedDb(n)));
}

async function clearServiceWorkerCaches(): Promise<void> {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* ignore */
  }
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    /* ignore */
  }
}

/** Wipe all client-side app data and reload (login screen fresh state). */
export async function fullDeviceReset(): Promise<void> {
  try {
    await authApi.signOutGlobal();
  } catch {
    /* ignore */
  }
  try {
    await authApi.clearPin();
  } catch {
    /* ignore */
  }
  await deleteAllIndexedDbs();
  await clearServiceWorkerCaches();
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
  const url = new URL(window.location.href);
  url.searchParams.set('_fresh', String(Date.now()));
  window.location.replace(url.toString());
}
