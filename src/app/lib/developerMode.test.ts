import assert from 'node:assert/strict';
import { test, beforeEach, afterEach } from 'node:test';
import {
  DEVELOPER_MODE_STORAGE_KEY,
  DEVELOPER_VERBOSE_API_ERRORS_KEY,
  DEVELOPER_MODE_TAP_TARGET,
  registerAppVersionTap,
  resetAppVersionTapStateForTests,
  setDeveloperModeUnlocked,
  isDeveloperModeUnlocked,
} from './developerMode';

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  resetAppVersionTapStateForTests();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).window = {
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
  };
});

afterEach(() => {
  resetAppVersionTapStateForTests();
});

test('registerAppVersionTap unlocks after 7 taps', () => {
  assert.equal(isDeveloperModeUnlocked(), false);
  for (let i = 0; i < DEVELOPER_MODE_TAP_TARGET - 1; i++) {
    const r = registerAppVersionTap();
    assert.equal(r.justUnlocked, false);
    assert.equal(r.unlocked, false);
  }
  const last = registerAppVersionTap();
  assert.equal(last.justUnlocked, true);
  assert.equal(last.unlocked, true);
  assert.equal(isDeveloperModeUnlocked(), true);
  assert.equal(store.get(DEVELOPER_MODE_STORAGE_KEY), '1');
});

test('setDeveloperModeUnlocked(false) clears verbose flag key', () => {
  store.set(DEVELOPER_MODE_STORAGE_KEY, '1');
  store.set(DEVELOPER_VERBOSE_API_ERRORS_KEY, '1');
  setDeveloperModeUnlocked(false);
  assert.equal(store.has(DEVELOPER_MODE_STORAGE_KEY), false);
  assert.equal(store.has(DEVELOPER_VERBOSE_API_ERRORS_KEY), false);
});
