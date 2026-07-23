/**
 * Offline-first queue: IndexedDB `pending` store with explicit sync lifecycle.
 * status: PENDING → SYNCING → SYNCED | ERROR (legacy rows use is_synced + sync_error).
 */

const DB_NAME = 'erp_mobile_offline';
const DB_VERSION = 2;
const STORE_NAME = 'pending';

export type PendingType = 'sale' | 'payment' | 'expense' | 'journal_entry' | 'purchase';

export type SyncQueueStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'ERROR';

/** Stored under type `purchase`; discriminated by `action`. */
export type PurchasePendingPayload =
  | { action: 'create'; input: Record<string, unknown> }
  | {
      action: 'cancel';
      companyId: string;
      purchaseId: string;
      userId?: string | null;
      reason?: string | null;
    };

export interface PendingRecord {
  id: string;
  type: PendingType;
  payload: Record<string, unknown>;
  company_id: string;
  branch_id: string;
  created_at: number;
  /** Legacy mirror of status === SYNCED; kept for indexes / backward compat. */
  is_synced: boolean;
  status?: SyncQueueStatus;
  server_id?: string;
  sync_error?: string;
}

let db: IDBDatabase | null = null;

function migrateRecord(r: PendingRecord): PendingRecord {
  if (r.status) return r;
  if (r.is_synced) return { ...r, status: 'SYNCED', sync_error: undefined };
  if (r.sync_error) return { ...r, status: 'ERROR', is_synced: false };
  return { ...r, status: 'PENDING', is_synced: false };
}

export function normalizeQueueStatus(r: PendingRecord): SyncQueueStatus {
  return migrateRecord(r).status ?? 'PENDING';
}

function needsSync(status: SyncQueueStatus): boolean {
  return status === 'PENDING' || status === 'ERROR';
}

async function recoverStaleSyncing(database: IDBDatabase): Promise<void> {
  const all = await new Promise<PendingRecord[]>((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  const stuck = all.filter((r) => normalizeQueueStatus(r) === 'SYNCING');
  if (stuck.length === 0) return;
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const r of stuck) {
      store.put({
        ...migrateRecord(r),
        status: 'PENDING' as SyncQueueStatus,
        is_synced: false,
      });
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Cursor migration for v1 → v2 (status field). */
function upgradeV1ToV2(tx: IDBTransaction): void {
  const store = tx.objectStore(STORE_NAME);
  if (!store.indexNames.contains('status')) {
    try {
      store.createIndex('status', 'status', { unique: false });
    } catch {
      /* ignore */
    }
  }
  const req = store.openCursor();
  req.onsuccess = () => {
    const cursor = req.result as IDBCursorWithValue | null;
    if (!cursor) return;
    const raw = cursor.value as PendingRecord;
    const next = migrateRecord(raw);
    if (next.status !== raw.status || next.is_synced !== raw.is_synced) {
      cursor.update(next);
    }
    cursor.continue();
  };
}

function getDb(): Promise<IDBDatabase> {
  if (db) return Promise.resolve(db);
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
    req.onsuccess = () => {
      const database = req.result;
      void recoverStaleSyncing(database)
        .catch(() => undefined)
        .then(() => {
          db = database;
          resolve(database);
        });
    };
    req.onupgradeneeded = (e) => {
      const database = (e.target as IDBOpenDBRequest).result;
      const oldVersion = e.oldVersion;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('is_synced', 'is_synced', { unique: false });
        store.createIndex('created_at', 'created_at', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        return;
      }
      const tx = (e.target as IDBOpenDBRequest).transaction;
      if (oldVersion < 2 && tx) {
        upgradeV1ToV2(tx);
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
    status: 'PENDING',
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
  try {
    const database = await getDb();
    const all = await new Promise<PendingRecord[]>((resolve, reject) => {
      const tx = database.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    return all.map(migrateRecord).filter((r) => needsSync(normalizeQueueStatus(r)));
  } catch (err) {
    console.warn('[ERP Mobile] offline queue unavailable:', err);
    return [];
  }
}

/** Atomically move PENDING/ERROR → SYNCING. Returns false if row missing or not eligible. */
export async function tryMarkSyncing(id: string): Promise<boolean> {
  const database = await getDb();
  const record = await new Promise<PendingRecord | undefined>((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result ? migrateRecord(req.result) : undefined);
    req.onerror = () => reject(req.error);
  });
  if (!record) return false;
  const st = normalizeQueueStatus(record);
  if (!needsSync(st)) return false;
  record.status = 'SYNCING';
  record.is_synced = false;
  record.sync_error = undefined;
  return new Promise<boolean>((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function markSynced(id: string, serverId: string): Promise<void> {
  const database = await getDb();
  const record = await new Promise<PendingRecord | undefined>((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result ? migrateRecord(req.result) : undefined);
    req.onerror = () => reject(req.error);
  });
  if (!record) return;
  record.is_synced = true;
  record.status = 'SYNCED';
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
    req.onsuccess = () => resolve(req.result ? migrateRecord(req.result) : undefined);
    req.onerror = () => reject(req.error);
  });
  if (!record) return;
  record.sync_error = error;
  record.status = 'ERROR';
  record.is_synced = false;
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
  try {
    const database = await getDb();
    const all = await new Promise<PendingRecord[]>((resolve, reject) => {
      const tx = database.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    return all.some((r) => normalizeQueueStatus(migrateRecord(r)) === 'ERROR');
  } catch {
    return false;
  }
}

export async function getOfflineQueueMetrics(): Promise<{
  pending: number;
  error: number;
  syncing: number;
}> {
  try {
    const database = await getDb();
    const all = await new Promise<PendingRecord[]>((resolve, reject) => {
      const tx = database.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    let pending = 0;
    let error = 0;
    let syncing = 0;
    for (const raw of all) {
      const r = migrateRecord(raw);
      const s = normalizeQueueStatus(r);
      if (s === 'PENDING') pending++;
      else if (s === 'ERROR') error++;
      else if (s === 'SYNCING') syncing++;
    }
    return { pending, error, syncing };
  } catch {
    return { pending: 0, error: 0, syncing: 0 };
  }
}

/** Clear all pending records (synced + unsynced). Use with caution – unsynced data will be lost. */
export async function clearAllPending(): Promise<number> {
  try {
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
  } catch {
    return 0;
  }
}
