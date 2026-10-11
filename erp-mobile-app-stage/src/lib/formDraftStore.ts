/**
 * Per-worker in-progress form drafts (IndexedDB). Survives PIN lock overlay and short app kills.
 */

const DB_NAME = 'erp_mobile_form_drafts';
const DB_VERSION = 1;
const STORE_NAME = 'drafts';
const TTL_MS = 24 * 60 * 60 * 1000;

export interface FormDraftRecord {
  key: string;
  companyId: string;
  ownerUserId: string;
  draftId: string;
  payload: unknown;
  updatedAt: number;
}

let db: IDBDatabase | null = null;

function buildKey(companyId: string, ownerUserId: string, draftId: string): string {
  return `${companyId}:${ownerUserId}:${draftId}`;
}

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
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
  });
}

export async function saveFormDraft(
  companyId: string,
  ownerUserId: string,
  draftId: string,
  payload: unknown,
): Promise<void> {
  if (!companyId || !ownerUserId || !draftId) return;
  const database = await openDb();
  const record: FormDraftRecord = {
    key: buildKey(companyId, ownerUserId, draftId),
    companyId,
    ownerUserId,
    draftId,
    payload,
    updatedAt: Date.now(),
  };
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadFormDraft(
  companyId: string,
  ownerUserId: string,
  draftId: string,
): Promise<unknown | null> {
  if (!companyId || !ownerUserId || !draftId) return null;
  const database = await openDb();
  const record = await new Promise<FormDraftRecord | undefined>((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(buildKey(companyId, ownerUserId, draftId));
    req.onsuccess = () => resolve(req.result as FormDraftRecord | undefined);
    req.onerror = () => reject(req.error);
  });
  if (!record) return null;
  if (Date.now() - record.updatedAt > TTL_MS) {
    await clearFormDraft(companyId, ownerUserId, draftId);
    return null;
  }
  return record.payload;
}

export async function clearFormDraft(
  companyId: string,
  ownerUserId: string,
  draftId: string,
): Promise<void> {
  if (!companyId || !ownerUserId || !draftId) return;
  const database = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(buildKey(companyId, ownerUserId, draftId));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Remove all drafts for a company except the given owner (different worker login). */
export async function clearFormDraftsExcept(
  companyId: string,
  keepOwnerUserId: string,
): Promise<void> {
  if (!companyId || !keepOwnerUserId) return;
  const database = await openDb();
  const all = await new Promise<FormDraftRecord[]>((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve((req.result as FormDraftRecord[]) || []);
    req.onerror = () => reject(req.error);
  });
  const toDelete = all.filter(
    (r) => r.companyId === companyId && r.ownerUserId !== keepOwnerUserId,
  );
  if (toDelete.length === 0) return;
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const r of toDelete) store.delete(r.key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
