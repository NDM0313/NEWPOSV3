/**
 * Secondary encrypted vault for counter-tablet PIN switching (per-user refresh tokens).
 * PIN row key: SHA-256(pin) — same salt as device PIN hashing ([`secureStorage.hashPin`]).
 * Refresh tokens are also encrypted with a device-bound secret so they can be updated after
 * email login without re-entering the counter PIN (see `syncCounterRefreshTokenForUserId`).
 */

import type { SecurePayload } from './secureStorage';
import { hashPin, deriveKey, encryptPayload, decryptPayload } from './secureStorage';

const DB_NAME = 'erp_mobile_counter_vault';
const DB_VERSION = 2;
const STORE = 'records';
const META_STORE = 'meta';
const META_DEVICE_ROW_ID = 'device';
/** Input to deriveKey — must not collide with user PINs. */
const DEVICE_DERIVE_PREFIX = 'erp_mobile_counter_device_v1|';

export interface CounterVaultPayload extends SecurePayload {
  displayName?: string;
  publicUsersId?: string;
  /** Stored in ciphertext; duplicated in row metadata for lock-screen list only. */
  role?: string;
}

interface StoredRow {
  pinHash: string;
  iv: string;
  ciphertext: string;
  algo?: 'cbc';
  /** Device-key encrypted refresh token (preferred over legacy ciphertext token). */
  tokenIv?: string;
  tokenCiphertext?: string;
  tokenAlgo?: 'cbc';
  /** Plaintext for lock-screen picker (no secrets, no tokens). */
  displayName?: string;
  userId?: string;
  email?: string;
  role?: string;
  companyId?: string;
  /** When device-bound refresh token was last synced (ms epoch). */
  lastTokenSyncAt?: number;
}

interface MetaDeviceRow {
  id: string;
  secretHex: string;
}

/** Public profile for lock screen — never includes refresh tokens or ciphertext. */
export interface EnrolledCounterProfile {
  pinHash: string;
  userId: string;
  displayName: string;
  email: string;
  role: string;
  companyId: string;
  lastTokenSyncAt?: number;
}

export const COUNTER_WRONG_COMPANY_MESSAGE =
  'This PIN belongs to a different company. Use a counter PIN for this company only.';

/** @deprecated Use EnrolledCounterProfile */
export interface CounterUserSlot {
  pinHash: string;
  displayName: string;
  userId: string;
}

let db: IDBDatabase | null = null;

function openCounterDb(): Promise<IDBDatabase> {
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

async function getOrCreateDeviceSecretHex(): Promise<string> {
  const database = await openCounterDb();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(META_STORE, 'readwrite');
    const store = tx.objectStore(META_STORE);
    const getReq = store.get(META_DEVICE_ROW_ID);
    getReq.onsuccess = () => {
      const row = getReq.result as MetaDeviceRow | undefined;
      if (row?.secretHex && /^[0-9a-f]{64}$/i.test(row.secretHex)) {
        resolve(row.secretHex.toLowerCase());
        return;
      }
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      const secretHex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      const putReq = store.put({ id: META_DEVICE_ROW_ID, secretHex });
      putReq.onsuccess = () => resolve(secretHex);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
    tx.onerror = () => reject(tx.error);
  });
}

async function deviceCipherKey(): Promise<Awaited<ReturnType<typeof deriveKey>>> {
  const hex = await getOrCreateDeviceSecretHex();
  return deriveKey(DEVICE_DERIVE_PREFIX + hex);
}

function isFourDigitPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

function rowToProfile(row: StoredRow, index: number): EnrolledCounterProfile {
  return {
    pinHash: row.pinHash,
    displayName: row.displayName?.trim() || `User ${index + 1}`,
    userId: row.userId || '',
    email: row.email?.trim() || '',
    role: row.role?.trim() || '',
    companyId: row.companyId?.trim() || '',
    lastTokenSyncAt: row.lastTokenSyncAt,
  };
}

function matchesCompanyFilter(row: StoredRow, companyId: string | null | undefined): boolean {
  if (!companyId) return true;
  const rowCompany = row.companyId?.trim();
  if (!rowCompany) return false;
  return rowCompany === companyId;
}

async function lookupCompanyIdForAuthUser(userId: string): Promise<string | null> {
  if (!userId) return null;
  try {
    const { supabase } = await import('./supabase');
    const { data: row } = await supabase
      .from('users')
      .select('company_id')
      .or(`id.eq.${userId},auth_user_id.eq.${userId}`)
      .limit(1)
      .maybeSingle();
    return (row as { company_id?: string } | null)?.company_id?.trim() || null;
  } catch {
    return null;
  }
}

async function hasActiveAuthSession(): Promise<boolean> {
  try {
    const { supabase } = await import('./supabase');
    const { data } = await supabase.auth.getSession();
    return Boolean(data.session?.user?.id);
  } catch {
    return false;
  }
}

async function backfillMissingCompanyIds(rows: StoredRow[]): Promise<StoredRow[]> {
  try {
    const missing = rows.filter((r) => r.pinHash && r.userId && !r.companyId?.trim());
    if (missing.length === 0) return rows;

    // Skip network lookup on cold boot / logged-out — avoids blocking vault reads.
    if (!(await hasActiveAuthSession())) return rows;

    const patches = new Map<string, string>();
    await Promise.all(
      missing.map(async (row) => {
        const cid = await lookupCompanyIdForAuthUser(row.userId!);
        if (cid) patches.set(row.pinHash, cid);
      })
    );
    if (patches.size === 0) return rows;

    const database = await openCounterDb();
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      for (const row of missing) {
        const cid = patches.get(row.pinHash);
        if (cid) store.put({ ...row, companyId: cid });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    return rows.map((row) => {
      const cid = patches.get(row.pinHash);
      return cid ? { ...row, companyId: cid } : row;
    });
  } catch (e) {
    console.warn('[ERP Mobile] counter vault company backfill skipped:', e);
    return rows;
  }
}

async function readAllStoredRows(): Promise<StoredRow[]> {
  try {
    const database = await openCounterDb();
    return await new Promise((resolve, reject) => {
      const tx = database.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result as StoredRow[]) || []);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('[ERP Mobile] counter vault read failed:', e);
    return [];
  }
}

async function encryptRefreshTokenDeviceBound(refreshToken: string): Promise<{
  tokenIv: string;
  tokenCiphertext: string;
  tokenAlgo?: 'cbc';
}> {
  const key = await deviceCipherKey();
  const enc = await encryptPayload(refreshToken, key);
  return { tokenIv: enc.iv, tokenCiphertext: enc.ciphertext, tokenAlgo: enc.algo };
}

async function decryptRefreshTokenDeviceBound(row: StoredRow): Promise<string | null> {
  if (!row.tokenIv || !row.tokenCiphertext) return null;
  try {
    const key = await deviceCipherKey();
    return await decryptPayload(row.tokenIv, row.tokenCiphertext, key, row.tokenAlgo);
  } catch {
    return null;
  }
}

/**
 * Auth userId already stored for this 4-digit PIN slot (IndexedDB key is pinHash).
 * Used to avoid overwriting another user's row when two people pick the same PIN.
 */
export async function getCounterVaultUserIdForPin(pin: string): Promise<string | undefined> {
  if (!isFourDigitPin(pin)) return undefined;
  const pinHash = await hashPin(pin);
  const database = await openCounterDb();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(pinHash);
    req.onsuccess = () => {
      const row = req.result as StoredRow | undefined;
      const uid = row?.userId?.trim();
      resolve(uid || undefined);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveCounterUserForPin(pin: string, payload: CounterVaultPayload): Promise<void> {
  if (!isFourDigitPin(pin)) throw new Error('PIN must be exactly 4 digits.');
  const pinHash = await hashPin(pin);
  const key = await deriveKey(pin);
  const json = JSON.stringify(payload);
  const enc = await encryptPayload(json, key);
  const displayName = payload.displayName?.trim() || payload.email?.trim() || 'User';
  const tokenEnc = await encryptRefreshTokenDeviceBound(payload.refreshToken);
  const now = Date.now();
  const row: StoredRow = {
    pinHash,
    iv: enc.iv,
    ciphertext: enc.ciphertext,
    algo: enc.algo,
    displayName,
    userId: payload.userId,
    email: payload.email?.trim() || '',
    role: payload.role?.trim() || '',
    companyId: payload.companyId?.trim() || '',
    tokenIv: tokenEnc.tokenIv,
    tokenCiphertext: tokenEnc.tokenCiphertext,
    tokenAlgo: tokenEnc.tokenAlgo,
    lastTokenSyncAt: now,
  };
  const database = await openCounterDb();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(row);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Update device-bound refresh token for every vault row tied to this auth user.
 * Safe to call after email login or TOKEN_REFRESHED — no counter PIN required.
 */
export async function syncCounterRefreshTokenForUserId(
  userId: string,
  refreshToken: string
): Promise<void> {
  if (!userId || !refreshToken) return;
  const database = await openCounterDb();
  const tokenEnc = await encryptRefreshTokenDeviceBound(refreshToken);
  const rows = await new Promise<StoredRow[]>((resolve, reject) => {
    const tx = database.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as StoredRow[]) || []);
    req.onerror = () => reject(req.error);
  });
  const toUpdate = rows.filter((r) => r.pinHash && r.userId === userId);
  if (toUpdate.length === 0) return;
  const syncedAt = Date.now();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const row of toUpdate) {
      store.put({
        ...row,
        tokenIv: tokenEnc.tokenIv,
        tokenCiphertext: tokenEnc.tokenCiphertext,
        tokenAlgo: tokenEnc.tokenAlgo,
        lastTokenSyncAt: syncedAt,
      });
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Update plaintext list labels for vault rows (same auth user). No PIN required. */
export async function syncCounterVaultDisplayMetadataForUserId(
  userId: string,
  meta: { displayName: string; email?: string; role?: string; companyId?: string | null }
): Promise<void> {
  const trimmed = meta.displayName?.trim();
  if (!userId || !trimmed) return;
  const database = await openCounterDb();
  const rows = await new Promise<StoredRow[]>((resolve, reject) => {
    const tx = database.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as StoredRow[]) || []);
    req.onerror = () => reject(req.error);
  });
  const toUpdate = rows.filter((r) => r.pinHash && r.userId === userId);
  if (toUpdate.length === 0) return;
  const emailNext = meta.email?.trim();
  const roleNext = meta.role?.trim();
  const companyNext = meta.companyId?.trim();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const row of toUpdate) {
      store.put({
        ...row,
        displayName: trimmed,
        email: emailNext || row.email || '',
        role: roleNext || row.role || '',
        companyId: companyNext || row.companyId || '',
      });
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCounterUserForPin(pin: string): Promise<CounterVaultPayload | null> {
  if (!isFourDigitPin(pin)) return null;
  const pinHash = await hashPin(pin);
  const database = await openCounterDb();
  const row = await new Promise<StoredRow | undefined>((resolve, reject) => {
    const tx = database.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(pinHash);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  if (!row?.iv || !row.ciphertext) return null;
  try {
    const key = await deriveKey(pin);
    const json = await decryptPayload(row.iv, row.ciphertext, key, row.algo);
    const payload = JSON.parse(json) as CounterVaultPayload;
    const deviceRt = await decryptRefreshTokenDeviceBound(row);
    if (deviceRt) {
      return { ...payload, refreshToken: deviceRt };
    }
    return payload;
  } catch {
    return null;
  }
}

/** User-facing copy when server rejects a stale vault refresh token. */
export const COUNTER_STALE_REFRESH_TOKEN_HINT =
  "This device's saved session expired. Sign in once with email/password (same account), then try your counter PIN again.";

export function formatCounterPinAuthError(message: string | undefined): string {
  if (!message) return COUNTER_STALE_REFRESH_TOKEN_HINT;
  const m = message.toLowerCase();
  if (m.includes('aborted') || m.includes('abort')) {
    return 'Sign-in was interrupted. Tap Unlock again.';
  }
  if (
    m.includes('refresh token not found') ||
    m.includes('invalid refresh token') ||
    m.includes('already used') ||
    m.includes('revoked')
  ) {
    return COUNTER_STALE_REFRESH_TOKEN_HINT;
  }
  return message;
}

/** Enrolled users for lock screen / counter login (no tokens). */
export async function listEnrolledCounterProfiles(
  companyId?: string | null
): Promise<EnrolledCounterProfile[]> {
  try {
    let rows = await readAllStoredRows();
    rows = await backfillMissingCompanyIds(rows);
    return rows
      .filter((r) => r.pinHash && matchesCompanyFilter(r, companyId))
      .map((r, i) => rowToProfile(r, i));
  } catch (e) {
    console.warn('[ERP Mobile] listEnrolledCounterProfiles failed:', e);
    return [];
  }
}

/** @deprecated Use listEnrolledCounterProfiles */
export async function listCounterUserSlots(companyId?: string | null): Promise<CounterUserSlot[]> {
  const profiles = await listEnrolledCounterProfiles(companyId);
  return profiles.map(({ pinHash, displayName, userId }) => ({ pinHash, displayName, userId }));
}

export async function countCounterUsers(companyId?: string | null): Promise<number> {
  try {
    if (!companyId) {
      const database = await openCounterDb();
      return await new Promise((resolve, reject) => {
        const tx = database.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).count();
        req.onsuccess = () => resolve(req.result ?? 0);
        req.onerror = () => reject(req.error);
      });
    }
    const profiles = await listEnrolledCounterProfiles(companyId);
    return profiles.length;
  } catch (e) {
    console.warn('[ERP Mobile] countCounterUsers failed:', e);
    return 0;
  }
}
