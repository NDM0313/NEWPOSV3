/**
 * Secure local storage: IndexedDB + AES-GCM encryption.
 * PIN hash and encrypted payload (refresh_token, userId, branchId, etc.) stored here.
 * Never store raw tokens in localStorage.
 *
 * Fallback: When crypto.subtle is unavailable (e.g. http on mobile), uses crypto-js
 * for SHA-256 and AES-CBC. Stored payloads include algo: 'cbc' for fallback format.
 */

import CryptoJS from 'crypto-js';
import { getDevicePinMaxAgeMs } from './counterSessionPolicy';

const DB_NAME = 'erp_mobile_secure';
const DB_VERSION = 1;
const STORE_NAME = 'vault';
const PIN_SALT = 'erp_mobile_pin_salt_v1';
const KEY_SALT = 'erp_mobile_aes_salt_v1';
const MAX_PIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
/** Default device PIN max age when policy unset (7 days). Prefer `getDevicePinMaxAgeMs()`. */
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface SecurePayload {
  refreshToken: string;
  userId: string;
  companyId: string | null;
  branchId: string | null;
  email: string;
  savedAt: number;
}

let dbInstance: IDBDatabase | null = null;

function getDb(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
    req.onsuccess = () => {
      dbInstance = req.result;
      resolve(dbInstance);
    };
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

function isIdbPermissionError(err: unknown): boolean {
  const msg = String(
    err && typeof err === 'object' && 'message' in err
      ? (err as { message?: string }).message
      : err ?? '',
  ).toLowerCase();
  return msg.includes('denied permission') || msg.includes('user denied');
}

function hasWebCrypto(): boolean {
  return typeof crypto !== 'undefined' && typeof (crypto as Crypto).subtle !== 'undefined';
}

type KeyOrHex = CryptoKey | string;

/** Exported for counter-user PIN vault (same salt as device PIN). */
export async function hashPin(pin: string): Promise<string> {
  if (hasWebCrypto()) {
    const data = new TextEncoder().encode(PIN_SALT + pin);
    const buf = await (crypto as Crypto).subtle!.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return CryptoJS.SHA256(PIN_SALT + pin).toString(CryptoJS.enc.Hex);
}

export async function deriveKey(pin: string): Promise<KeyOrHex> {
  if (hasWebCrypto()) {
    const enc = new TextEncoder().encode(KEY_SALT + pin);
    const hash = await (crypto as Crypto).subtle!.digest('SHA-256', enc);
    return (crypto as Crypto).subtle!.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }
  return CryptoJS.SHA256(KEY_SALT + pin).toString(CryptoJS.enc.Hex);
}

export async function encryptPayload(
  plaintext: string,
  key: KeyOrHex
): Promise<{ iv: string; ciphertext: string; algo?: 'cbc' }> {
  if (hasWebCrypto() && typeof key !== 'string') {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const cipher = await (crypto as Crypto).subtle!.encrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      key,
      encoded
    );
    return {
      iv: btoa(String.fromCharCode(...iv)),
      ciphertext: btoa(String.fromCharCode(...new Uint8Array(cipher))),
    };
  }
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const keyWA = CryptoJS.enc.Hex.parse(key as string);
  const ivWA = CryptoJS.lib.WordArray.create(Array.from(iv));
  const encrypted = CryptoJS.AES.encrypt(plaintext, keyWA, {
    iv: ivWA,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return {
    iv: btoa(String.fromCharCode(...iv)),
    ciphertext: encrypted.toString(),
    algo: 'cbc',
  };
}

export async function decryptPayload(
  ivB64: string,
  ciphertextB64: string,
  key: KeyOrHex,
  algo?: 'cbc'
): Promise<string> {
  if (hasWebCrypto() && typeof key !== 'string' && algo !== 'cbc') {
    const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
    const cipher = Uint8Array.from(atob(ciphertextB64), (c) => c.charCodeAt(0));
    const dec = await (crypto as Crypto).subtle!.decrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      key,
      cipher
    );
    return new TextDecoder().decode(dec);
  }
  const ivBytes = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  const keyWA = CryptoJS.enc.Hex.parse(key as string);
  const ivWA = CryptoJS.lib.WordArray.create(Array.from(ivBytes));
  const cipherParams = CryptoJS.lib.CipherParams.create({
    ciphertext: CryptoJS.enc.Base64.parse(ciphertextB64),
  });
  const decrypted = CryptoJS.AES.decrypt(cipherParams, keyWA, {
    iv: ivWA,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  const str = decrypted.toString(CryptoJS.enc.Utf8);
  if (!str) throw new Error('Decryption failed');
  return str;
}

const ID_PIN = 'pin';
const ID_PAYLOAD = 'payload';
const ID_META = 'meta';

export async function hasSecurePayload(): Promise<boolean> {
  try {
    const db = await getDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(ID_PAYLOAD);
      req.onsuccess = () => resolve(!!req.result);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

export async function getLockedUntil(): Promise<number> {
  try {
    const db = await getDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(ID_META);
      req.onsuccess = () => resolve((req.result?.pinLockedUntil as number) || 0);
      req.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}

export async function saveSecurePayload(pin: string, payload: SecurePayload): Promise<void> {
  let db: IDBDatabase;
  try {
    db = await getDb();
  } catch (err) {
    if (isIdbPermissionError(err)) {
      console.warn('[ERP Mobile] Secure vault unavailable (storage permission denied). PIN not saved.');
      return;
    }
    throw err;
  }
  const pinHash = await hashPin(pin);
  const key = await deriveKey(pin);
  const json = JSON.stringify(payload);
  const encResult = await encryptPayload(json, key);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ id: ID_PIN, pinHash });
    store.put({ id: ID_PAYLOAD, iv: encResult.iv, ciphertext: encResult.ciphertext, algo: encResult.algo });
    store.put({ id: ID_META, pinAttempts: 0, pinLockedUntil: 0 });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export type VerifyResult =
  | { success: true; payload: SecurePayload }
  | { success: false; locked: false; message?: string; expired?: boolean }
  | { success: false; locked: true; lockedUntil: number };

export async function verifyPinAndUnlock(pin: string): Promise<VerifyResult> {
  let db: IDBDatabase;
  try {
    db = await getDb();
  } catch (err) {
    if (isIdbPermissionError(err)) {
      return { success: false, locked: false, message: 'Browser blocked local vault storage. Allow cookies/storage or use a normal window.' };
    }
    return { success: false, locked: false, message: 'Could not open local vault.' };
  }

  const meta: { pinAttempts?: number; pinLockedUntil?: number } = await new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(ID_META);
    req.onsuccess = () => resolve(req.result || {});
    req.onerror = () => resolve({});
  });

  const now = Date.now();
  if (meta.pinLockedUntil && now < meta.pinLockedUntil) {
    return { success: false, locked: true, lockedUntil: meta.pinLockedUntil };
  }

  const stored: { pinHash?: string } = await new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(ID_PIN);
    req.onsuccess = () => resolve(req.result || {});
    req.onerror = () => resolve({});
  });

  const pinHash = await hashPin(pin);
  if (stored.pinHash !== pinHash) {
    const attempts = (meta.pinAttempts || 0) + 1;
    const pinLockedUntil = attempts >= MAX_PIN_ATTEMPTS ? now + LOCK_DURATION_MS : 0;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ id: ID_META, pinAttempts: attempts, pinLockedUntil });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    if (attempts >= MAX_PIN_ATTEMPTS) {
      return { success: false, locked: true, lockedUntil: pinLockedUntil };
    }
    const left = MAX_PIN_ATTEMPTS - attempts;
    return { success: false, locked: false, message: `Wrong PIN. ${left} attempt(s) left.` };
  }

  const row: { iv?: string; ciphertext?: string; algo?: 'cbc' } = await new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(ID_PAYLOAD);
    req.onsuccess = () => resolve(req.result || {});
    req.onerror = () => resolve({});
  });

  if (!row.iv || !row.ciphertext) {
    return { success: false, locked: false, message: 'No saved session.' };
  }

  try {
    const key = await deriveKey(pin);
    const json = await decryptPayload(row.iv, row.ciphertext, key, row.algo);
    const payload = JSON.parse(json) as SecurePayload;
    const now = Date.now();
    if (payload.savedAt && now - payload.savedAt > getDevicePinMaxAgeMs()) {
      await clearSecure();
      return { success: false, locked: false, message: 'Session expired. Please sign in again.', expired: true };
    }
    payload.savedAt = now;
    const encResult = await encryptPayload(JSON.stringify(payload), key);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ id: ID_META, pinAttempts: 0, pinLockedUntil: 0 });
      store.put({ id: ID_PAYLOAD, iv: encResult.iv, ciphertext: encResult.ciphertext, algo: encResult.algo });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return { success: true, payload };
  } catch {
    return { success: false, locked: false, message: 'Could not restore session.' };
  }
}

export async function clearSecure(): Promise<void> {
  let db: IDBDatabase;
  try {
    db = await getDb();
  } catch {
    dbInstance = null;
    return;
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
