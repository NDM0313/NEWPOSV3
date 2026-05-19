/**
 * Secondary encrypted vault for counter-tablet PIN switching (per-user refresh tokens).
 * Keys: SHA-256(pin) — same salt as device PIN hashing ([`secureStorage.hashPin`]).
 */

import type { SecurePayload } from './secureStorage';
import { hashPin, deriveKey, encryptPayload, decryptPayload } from './secureStorage';

const DB_NAME = 'erp_mobile_counter_vault';
const DB_VERSION = 1;
const STORE = 'records';

export interface CounterVaultPayload extends SecurePayload {
  displayName?: string;
  publicUsersId?: string;
}

interface StoredRow {
  pinHash: string;
  iv: string;
  ciphertext: string;
  algo?: 'cbc';
}

let db: IDBDatabase | null = null;

function openCounterDb(): Promise<IDBDatabase> {
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
        database.createObjectStore(STORE, { keyPath: 'pinHash' });
      }
    };
  });
}

function isFourDigitPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

export async function saveCounterUserForPin(pin: string, payload: CounterVaultPayload): Promise<void> {
  if (!isFourDigitPin(pin)) throw new Error('PIN must be exactly 4 digits.');
  const pinHash = await hashPin(pin);
  const key = await deriveKey(pin);
  const json = JSON.stringify(payload);
  const enc = await encryptPayload(json, key);
  const row: StoredRow = { pinHash, iv: enc.iv, ciphertext: enc.ciphertext, algo: enc.algo };
  const database = await openCounterDb();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(row);
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
    return JSON.parse(json) as CounterVaultPayload;
  } catch {
    return null;
  }
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
