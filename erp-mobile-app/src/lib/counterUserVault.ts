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
}

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
  const row: StoredRow = {
    pinHash,
    iv: enc.iv,
    ciphertext: enc.ciphertext,
    algo: enc.algo,
    displayName,
    userId: payload.userId,
    email: payload.email?.trim() || '',
    role: payload.role?.trim() || '',
    tokenIv: tokenEnc.tokenIv,
    tokenCiphertext: tokenEnc.tokenCiphertext,
    tokenAlgo: tokenEnc.tokenAlgo,
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
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const row of toUpdate) {
      store.put({
        ...row,
        tokenIv: tokenEnc.tokenIv,
        tokenCiphertext: tokenEnc.tokenCiphertext,
        tokenAlgo: tokenEnc.tokenAlgo,
      });
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Update plaintext list labels for vault rows (same auth user). No PIN required. */
export async function syncCounterVaultDisplayMetadataForUserId(
  userId: string,
  meta: { displayName: string; email?: string; role?: string }
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
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const row of toUpdate) {
      store.put({
        ...row,
        displayName: trimmed,
        email: emailNext || row.email || '',
        role: roleNext || row.role || '',
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
export async function listEnrolledCounterProfiles(): Promise<EnrolledCounterProfile[]> {
  const database = await openCounterDb();
  const rows = await new Promise<StoredRow[]>((resolve, reject) => {
    const tx = database.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as StoredRow[]) || []);
    req.onerror = () => reject(req.error);
  });
  return rows
    .filter((r) => r.pinHash)
    .map((r, i) => ({
      pinHash: r.pinHash,
      displayName: r.displayName?.trim() || `User ${i + 1}`,
      userId: r.userId || '',
      email: r.email?.trim() || '',
      role: r.role?.trim() || '',
    }));
}

/** @deprecated Use listEnrolledCounterProfiles */
export async function listCounterUserSlots(): Promise<CounterUserSlot[]> {
  const profiles = await listEnrolledCounterProfiles();
  return profiles.map(({ pinHash, displayName, userId }) => ({ pinHash, displayName, userId }));
}

export async function countCounterUsers(): Promise<number> {
  const database = await openCounterDb();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).count();
    req.onsuccess = () => resolve(req.result ?? 0);
    req.onerror = () => reject(req.error);
  });
}
