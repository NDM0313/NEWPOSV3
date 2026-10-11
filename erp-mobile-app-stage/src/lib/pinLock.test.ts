import assert from 'node:assert/strict';
import test from 'node:test';

const store = new Map<string, string>();

function installStoragePolyfill(): void {
  const makeStorage = () => ({
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  });

  (globalThis as unknown as { window: Window }).window = {
    localStorage: makeStorage() as Storage,
    sessionStorage: makeStorage() as Storage,
  } as Window;
}

function resetStores(): void {
  store.clear();
}

test('getPinLockSettings defaults to idle 1m and no immediate background lock', async () => {
  installStoragePolyfill();
  resetStores();
  const { getPinLockSettings } = await import('./pinLock.ts');
  const s = getPinLockSettings();
  assert.equal(s.lockOnBackground, false);
  assert.equal(s.idleTimeout, '1m');
});

test('getPinLockSettings migrates legacy immediate background lock', async () => {
  installStoragePolyfill();
  resetStores();
  store.set(
    'erp_mobile_pin_lock_settings',
    JSON.stringify({ lockOnBackground: true, idleTimeout: 'off', sessionMaxAgeMs: 604_800_000 }),
  );
  const { getPinLockSettings } = await import('./pinLock.ts');
  const s = getPinLockSettings();
  assert.equal(s.lockOnBackground, false);
  assert.equal(s.idleTimeout, '1m');
  const persisted = JSON.parse(store.get('erp_mobile_pin_lock_settings')!);
  assert.equal(persisted.idleTimeout, '1m');
});

test('shouldRelock stays false after background when activity is recent', async () => {
  installStoragePolyfill();
  resetStores();
  const { markUnlocked, markBackgrounded, shouldRelock, touchPinActivity } = await import('./pinLock.ts');
  markUnlocked();
  touchPinActivity();
  markBackgrounded();
  assert.equal(shouldRelock(), false);
});

test('shouldRelock true when idle exceeds 1 minute', async () => {
  installStoragePolyfill();
  resetStores();
  const { markUnlocked, shouldRelock } = await import('./pinLock.ts');
  const now = Date.now();
  markUnlocked();
  store.set('erp_mobile_pin_last_activity', String(now - 61_000));
  assert.equal(shouldRelock(), true);
});

test('shouldRelock false when idle lock is off and session not expired', async () => {
  installStoragePolyfill();
  resetStores();
  store.set(
    'erp_mobile_pin_lock_settings',
    JSON.stringify({ lockOnBackground: false, idleTimeout: 'off', sessionMaxAgeMs: 604_800_000 }),
  );
  const { markUnlocked, shouldRelock } = await import('./pinLock.ts');
  markUnlocked();
  store.set('erp_mobile_pin_last_activity', String(Date.now() - 120_000));
  assert.equal(shouldRelock(), false);
});

test('shouldRelock true when session max age exceeded', async () => {
  installStoragePolyfill();
  resetStores();
  store.set(
    'erp_mobile_pin_lock_settings',
    JSON.stringify({ lockOnBackground: false, idleTimeout: 'off', sessionMaxAgeMs: 1_000 }),
  );
  const { markUnlocked, shouldRelock } = await import('./pinLock.ts');
  markUnlocked();
  store.set('erp_mobile_pin_last_unlock', String(Date.now() - 2_000));
  store.set('erp_mobile_pin_last_activity', String(Date.now()));
  assert.equal(shouldRelock(), true);
});

test('getEffectiveIdleTimeoutMs maps idle options', async () => {
  installStoragePolyfill();
  resetStores();
  const { getEffectiveIdleTimeoutMs } = await import('./pinLock.ts');
  assert.equal(getEffectiveIdleTimeoutMs('1m'), 60_000);
  assert.equal(getEffectiveIdleTimeoutMs('2m'), 120_000);
  assert.equal(getEffectiveIdleTimeoutMs('off'), null);
});
