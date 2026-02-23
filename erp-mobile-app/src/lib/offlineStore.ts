/**
 * Offline-first queue: store records when offline, sync when online.
 * Each record: temp_local_id, type, payload, company_id, branch_id, created_at, is_synced.
 */

const DB_NAME = 'erp_mobile_offline';
const DB_VERSION = 1;
const STORE_NAME = 'pending';

export type PendingType = 'sale' | 'payment' | 'expense' | 'journal_entry';

export interface PendingRecord {
  id: string;
  type: PendingType;
  payload: Record<string, unknown>;
  company_id: string;
  branch_id: string;
  created_at: number;
  is_synced: boolean;
  server_id?: string;
  sync_error?: string;
}

let db: IDBDatabase | null = null;

function getDb(): Promise<IDBDatabase> {
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
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('is_synced', 'is_synced', { unique: false });
        store.createIndex('created_at', 'created_at', { unique: false });
      }
    };
  });
}

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function addPending(
  type: PendingType,
  payload: Record<string, unknown>,
  companyId: string,
  branchId: string
): Promise<string> {
  const id = uuid();
  const record: PendingRecord = {
    id,
    type,
    payload,
    company_id: companyId,
    branch_id: branchId,
    created_at: Date.now(),
    is_synced: false,
  };
  const database = await getDb();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getUnsynced(): Promise<PendingRecord[]> {
  const database = await getDb();
  const all = await new Promise<PendingRecord[]>((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  return all.filter((r) => !r.is_synced);
}

export async function markSynced(id: string, serverId: string): Promise<void> {
  const database = await getDb();
  const record = await new Promise<PendingRecord | undefined>((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  if (!record) return;
  record.is_synced = true;
  record.server_id = serverId;
  record.sync_error = undefined;
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function markSyncError(id: string, error: string): Promise<void> {
  const database = await getDb();
  const record = await new Promise<PendingRecord | undefined>((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  if (!record) return;
  record.sync_error = error;
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getUnsyncedCount(): Promise<number> {
  const list = await getUnsynced();
  return list.length;
}

export async function hasSyncErrors(): Promise<boolean> {
  const list = await getUnsynced();
  return list.some((r) => r.sync_error);
}

/** Clear all pending records (synced + unsynced). Use with caution – unsynced data will be lost. */
export async function clearAllPending(): Promise<number> {
  const database = await getDb();
  const all = await new Promise<PendingRecord[]>((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  const count = all.length;
  if (count === 0) return 0;
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return count;
}
