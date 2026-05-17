/**
 * Read-through cache for reference lists (payment accounts, branches, products, contacts).
 * Populated on successful online API calls; served when navigator.onLine is false.
 */

const DB_NAME = 'erp_mobile_list_cache';
const DB_VERSION = 1;
const STORE = 'kv';

export function isBrowserOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

interface CacheEntry {
  key: string;
  updated_at: number;
  json: string;
}

let db: IDBDatabase | null = null;

function openDb(): Promise<IDBDatabase> {
  if (db) return Promise.resolve(db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      db = req.result;
      resolve(db);
    };
    req.onupgradeneeded = (e) => {
      const database = (e.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE, { keyPath: 'key' });
      }
    };
  });
}

export const listCacheKeys = {
  paymentAccounts: (companyId: string) => `pa:${companyId}`,
  branches: (companyId: string) => `br:${companyId}`,
  products: (companyId: string) => `pr:${companyId}`,
  contacts: (companyId: string, type: string, branchId: string) => `ct:${companyId}:${type}:${branchId}`,
};

export async function listCacheGet<T>(key: string): Promise<T | null> {
  try {
    const database = await openDb();
    const row = await new Promise<CacheEntry | undefined>((resolve, reject) => {
      const tx = database.transaction(STORE, 'readonly');
      const r = tx.objectStore(STORE).get(key);
      r.onsuccess = () => resolve(r.result as CacheEntry | undefined);
      r.onerror = () => reject(r.error);
    });
    if (!row?.json) return null;
    return JSON.parse(row.json) as T;
  } catch {
    return null;
  }
}

export async function listCacheSet(key: string, value: unknown): Promise<void> {
  try {
    const database = await openDb();
    const entry: CacheEntry = {
      key,
      updated_at: Date.now(),
      json: JSON.stringify(value),
    };
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore quota / private mode */
  }
}
