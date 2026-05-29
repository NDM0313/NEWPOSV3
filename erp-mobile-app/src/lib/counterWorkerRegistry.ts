/**
 * Local counter worker registry — PIN hash + profile metadata only.
 * No Supabase refresh tokens. Phase 8 Enterprise POS State Architecture.
 */

import { hashPin } from './secureStorage';

const DB_NAME = 'erp_mobile_counter_workers';
const DB_VERSION = 1;
const STORE = 'workers';
const META_STORE = 'meta';
const META_MIGRATED_KEY = 'legacy_vault_migrated';

const LEGACY_VAULT_DB = 'erp_mobile_counter_vault';
const LEGACY_VAULT_STORE = 'records';

export interface CounterWorkerProfile {
  userId: string;
  profileId?: string;
  name: string;
  email: string;
  role: string;
  branchId?: string | null;
  branchLocked?: boolean;
  companyId: string;
}

export interface EnrolledCounterWorker {
  pinHash: string;
  userId: string;
  displayName: string;
  email: string;
  role: string;
  companyId: string;
  profileId?: string;
  branchId?: string | null;
}

export interface CounterWorkerSaveInput {
  userId: string;
  displayName: string;
  email: string;
  role: string;
  companyId: string;
  profileId?: string;
  branchId?: string | null;
}

interface StoredWorkerRow extends EnrolledCounterWorker {
  pinHash: string;
  enrolledAt: number;
}

interface LegacyVaultRow {
  pinHash: string;
  displayName?: string;
  userId?: string;
  email?: string;
  role?: string;
  companyId?: string;
}

let db: IDBDatabase | null = null;
let migrationPromise: Promise<number> | null = null;

function isFourDigitPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

function openRegistryDb(): Promise<IDBDatabase> {
  if (db && db.version === DB_VERSION) return Promise.resolve(db);
  db = null;
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
        database.createObjectStore(STORE, { keyPath: 'pinHash' });
      }
      if (!database.objectStoreNames.contains(META_STORE)) {
        database.createObjectStore(META_STORE, { keyPath: 'id' });
      }
    };
  });
}

function rowToEnrolled(row: StoredWorkerRow, index: number): EnrolledCounterWorker {
  return {
    pinHash: row.pinHash,
    userId: row.userId,
    displayName: row.displayName?.trim() || `User ${index + 1}`,
    email: row.email?.trim() || '',
    role: row.role?.trim() || '',
    companyId: row.companyId?.trim() || '',
    profileId: row.profileId,
    branchId: row.branchId ?? null,
  };
}

function rowToProfile(row: StoredWorkerRow): CounterWorkerProfile {
  return {
    userId: row.userId,
    profileId: row.profileId,
    name: row.displayName?.trim() || row.email?.trim() || 'User',
    email: row.email?.trim() || '',
    role: row.role?.trim() || '',
    branchId: row.branchId ?? null,
    companyId: row.companyId?.trim() || '',
  };
}

function matchesCompanyFilter(row: StoredWorkerRow, companyId: string | null | undefined): boolean {
  if (!companyId) return true;
  const rowCompany = row.companyId?.trim();
  if (!rowCompany) return false;
  return rowCompany === companyId;
}

async function readAllWorkers(): Promise<StoredWorkerRow[]> {
  try {
    const database = await openRegistryDb();
    return await new Promise((resolve, reject) => {
      const tx = database.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result as StoredWorkerRow[]) || []);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('[ERP Mobile] counterWorkerRegistry read failed:', e);
    return [];
  }
}

async function isLegacyMigrationDone(): Promise<boolean> {
  try {
    const database = await openRegistryDb();
    return await new Promise((resolve, reject) => {
      const tx = database.transaction(META_STORE, 'readonly');
      const req = tx.objectStore(META_STORE).get(META_MIGRATED_KEY);
      req.onsuccess = () => resolve(Boolean(req.result?.done));
      req.onerror = () => reject(req.error);
    });
  } catch {
    return false;
  }
}

async function markLegacyMigrationDone(count: number): Promise<void> {
  const database = await openRegistryDb();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(META_STORE, 'readwrite');
    tx.objectStore(META_STORE).put({ id: META_MIGRATED_KEY, done: true, count, at: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function readLegacyVaultRows(): Promise<LegacyVaultRow[]> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(LEGACY_VAULT_DB);
      req.onerror = () => resolve([]);
      req.onsuccess = () => {
        const legacyDb = req.result;
        if (!legacyDb.objectStoreNames.contains(LEGACY_VAULT_STORE)) {
          legacyDb.close();
          resolve([]);
          return;
        }
        const tx = legacyDb.transaction(LEGACY_VAULT_STORE, 'readonly');
        const getAll = tx.objectStore(LEGACY_VAULT_STORE).getAll();
        getAll.onsuccess = () => {
          legacyDb.close();
          resolve((getAll.result as LegacyVaultRow[]) || []);
        };
        getAll.onerror = () => {
          legacyDb.close();
          resolve([]);
        };
      };
    } catch {
      resolve([]);
    }
  });
}

/** One-time copy of plaintext metadata from legacy counter vault (no tokens). */
export async function migrateLegacyVaultOnce(): Promise<number> {
  if (migrationPromise) return migrationPromise;
  migrationPromise = (async () => {
    if (await isLegacyMigrationDone()) return 0;
    const legacyRows = await readLegacyVaultRows();
    if (legacyRows.length === 0) {
      await markLegacyMigrationDone(0);
      return 0;
    }
    const existing = await readAllWorkers();
    const existingHashes = new Set(existing.map((r) => r.pinHash));
    let migrated = 0;
    const database = await openRegistryDb();
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      for (const legacy of legacyRows) {
        if (!legacy.pinHash || !legacy.userId) continue;
        if (existingHashes.has(legacy.pinHash)) continue;
        const row: StoredWorkerRow = {
          pinHash: legacy.pinHash,
          userId: legacy.userId,
          displayName: legacy.displayName?.trim() || legacy.email?.trim() || 'User',
          email: legacy.email?.trim() || '',
          role: legacy.role?.trim() || '',
          companyId: legacy.companyId?.trim() || '',
          branchId: null,
          enrolledAt: Date.now(),
        };
        store.put(row);
        existingHashes.add(legacy.pinHash);
        migrated += 1;
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    await markLegacyMigrationDone(migrated);
    if (migrated > 0) {
      console.info(`[ERP Mobile] Migrated ${migrated} counter worker(s) from legacy vault.`);
    }
    return migrated;
  })();
  return migrationPromise;
}

async function ensureMigrated(): Promise<void> {
  await migrateLegacyVaultOnce();
}

export async function listEnrolledWorkers(
  companyId?: string | null,
): Promise<EnrolledCounterWorker[]> {
  await ensureMigrated();
  const rows = await readAllWorkers();
  return rows
    .filter((r) => r.pinHash && r.userId && matchesCompanyFilter(r, companyId))
    .map((r, i) => rowToEnrolled(r, i));
}

export async function countWorkers(companyId?: string | null): Promise<number> {
  await ensureMigrated();
  if (!companyId) {
    const rows = await readAllWorkers();
    return rows.filter((r) => r.pinHash && r.userId).length;
  }
  const workers = await listEnrolledWorkers(companyId);
  return workers.length;
}

async function deleteWorkerRows(rows: StoredWorkerRow[]): Promise<void> {
  if (rows.length === 0) return;
  const database = await openRegistryDb();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const row of rows) {
      store.delete(row.pinHash);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function removeDuplicateUserEntries(
  userId: string,
  keepPinHash: string,
  companyId?: string | null,
): Promise<void> {
  const rows = await readAllWorkers();
  const duplicates = rows.filter(
    (r) =>
      r.userId === userId &&
      r.pinHash !== keepPinHash &&
      (!companyId || !r.companyId?.trim() || r.companyId.trim() === companyId),
  );
  await deleteWorkerRows(duplicates);
}

function workerMatchesIdentity(
  row: StoredWorkerRow,
  authUserId: string,
  profileId?: string | null,
  companyId?: string | null,
): boolean {
  if (!matchesCompanyFilter(row, companyId)) return false;
  if (row.userId === authUserId) return true;
  if (profileId && row.profileId === profileId) return true;
  if (profileId && row.userId === profileId) return true;
  return false;
}

export async function findEnrolledWorkerByIdentity(
  authUserId: string,
  profileId?: string | null,
  companyId?: string | null,
): Promise<EnrolledCounterWorker | null> {
  await ensureMigrated();
  const rows = await readAllWorkers();
  const match = rows.find((r) => r.pinHash && r.userId && workerMatchesIdentity(r, authUserId, profileId, companyId));
  return match ? rowToEnrolled(match, 0) : null;
}

export async function saveCounterWorkerWithPinHash(
  pinHash: string,
  worker: CounterWorkerSaveInput,
): Promise<void> {
  if (!pinHash?.trim()) throw new Error('pinHash is required.');
  if (!worker.userId?.trim()) throw new Error('userId is required.');
  if (!worker.companyId?.trim()) throw new Error('companyId is required.');
  await ensureMigrated();
  await removeDuplicateUserEntries(worker.userId.trim(), pinHash.trim(), worker.companyId);
  const row: StoredWorkerRow = {
    pinHash: pinHash.trim(),
    userId: worker.userId.trim(),
    displayName: worker.displayName?.trim() || worker.email?.trim() || 'User',
    email: worker.email?.trim() || '',
    role: worker.role?.trim() || '',
    companyId: worker.companyId.trim(),
    profileId: worker.profileId,
    branchId: worker.branchId ?? null,
    enrolledAt: Date.now(),
  };
  const database = await openRegistryDb();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(row);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getWorkerUserIdForPin(pin: string): Promise<string | undefined> {
  if (!isFourDigitPin(pin)) return undefined;
  await ensureMigrated();
  const pinHash = await hashPin(pin);
  const database = await openRegistryDb();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(pinHash);
    req.onsuccess = () => {
      const row = req.result as StoredWorkerRow | undefined;
      resolve(row?.userId?.trim() || undefined);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveCounterWorker(pin: string, worker: CounterWorkerSaveInput): Promise<void> {
  if (!isFourDigitPin(pin)) throw new Error('PIN must be exactly 4 digits.');
  if (!worker.userId?.trim()) throw new Error('userId is required.');
  if (!worker.companyId?.trim()) throw new Error('companyId is required.');
  await ensureMigrated();
  const pinHash = await hashPin(pin);
  await removeDuplicateUserEntries(worker.userId.trim(), pinHash, worker.companyId);
  const row: StoredWorkerRow = {
    pinHash,
    userId: worker.userId.trim(),
    displayName: worker.displayName?.trim() || worker.email?.trim() || 'User',
    email: worker.email?.trim() || '',
    role: worker.role?.trim() || '',
    companyId: worker.companyId.trim(),
    profileId: worker.profileId,
    branchId: worker.branchId ?? null,
    enrolledAt: Date.now(),
  };
  const database = await openRegistryDb();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(row);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function removeCounterWorker(userId: string, companyId?: string | null): Promise<void> {
  if (!userId?.trim()) return;
  await ensureMigrated();
  const rows = await readAllWorkers();
  const toDelete = rows.filter(
    (r) =>
      r.userId === userId &&
      (!companyId || !r.companyId?.trim() || r.companyId.trim() === companyId),
  );
  await deleteWorkerRows(toDelete);
}

export const COUNTER_WRONG_USER_MESSAGE = 'PIN does not match this user.';
export const COUNTER_WRONG_PIN_MESSAGE = 'Wrong PIN. Try again.';

export async function verifyWorkerPin(
  pin: string,
  expectedUserId?: string | null,
  companyId?: string | null,
): Promise<CounterWorkerProfile | null> {
  if (!isFourDigitPin(pin)) return null;
  await ensureMigrated();
  const pinHash = await hashPin(pin);
  const database = await openRegistryDb();
  const row = await new Promise<StoredWorkerRow | undefined>((resolve, reject) => {
    const tx = database.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(pinHash);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  if (!row?.userId) return null;
  if (expectedUserId && row.userId !== expectedUserId) return null;
  if (companyId && row.companyId?.trim() && row.companyId.trim() !== companyId) return null;
  return rowToProfile(row);
}
