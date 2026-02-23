/**
 * Secure local storage: IndexedDB + AES-GCM encryption.
 * PIN hash and encrypted payload (refresh_token, userId, branchId, etc.) stored here.
 * Never store raw tokens in localStorage.
 */

const DB_NAME = 'erp_mobile_secure';
const DB_VERSION = 1;
const STORE_NAME = 'vault';
const PIN_SALT = 'erp_mobile_pin_salt_v1';
const KEY_SALT = 'erp_mobile_aes_salt_v1';
const MAX_PIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

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
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
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

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(PIN_SALT + pin);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function deriveKey(pin: string): Promise<CryptoKey> {
  const enc = new TextEncoder().encode(KEY_SALT + pin);
  const hash = await crypto.subtle.digest('SHA-256', enc);
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encrypt(plaintext: string, key: CryptoKey): Promise<{ iv: string; ciphertext: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    key,
    encoded
  );
  return {
    iv: btoa(String.fromCharCode(...iv)),
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(cipher))),
  };
}

async function decrypt(ivB64: string, ciphertextB64: string, key: CryptoKey): Promise<string> {
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  const cipher = Uint8Array.from(atob(ciphertextB64), (c) => c.charCodeAt(0));
  const dec = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    key,
    cipher
  );
  return new TextDecoder().decode(dec);
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
  const db = await getDb();
  const pinHash = await hashPin(pin);
  const key = await deriveKey(pin);
  const json = JSON.stringify(payload);
  const { iv, ciphertext } = await encrypt(json, key);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ id: ID_PIN, pinHash });
    store.put({ id: ID_PAYLOAD, iv, ciphertext });
    store.put({ id: ID_META, pinAttempts: 0, pinLockedUntil: 0 });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export type VerifyResult =
  | { success: true; payload: SecurePayload }
  | { success: false; locked: false; message?: string }
  | { success: false; locked: true; lockedUntil: number };

export async function verifyPinAndUnlock(pin: string): Promise<VerifyResult> {
  const db = await getDb();

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

  const row: { iv?: string; ciphertext?: string } = await new Promise((resolve) => {
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
    const json = await decrypt(row.iv, row.ciphertext, key);
    const payload = JSON.parse(json) as SecurePayload;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ id: ID_META, pinAttempts: 0, pinLockedUntil: 0 });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return { success: true, payload };
  } catch {
    return { success: false, locked: false, message: 'Could not restore session.' };
  }
}

export async function clearSecure(): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
