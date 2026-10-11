/**
 * PIN lock-on-resume helpers.
 * Re-prompt after idle timeout (configurable in Settings) or session max age.
 */

import { getDevicePinMaxAgeMs } from './counterSessionPolicy';
import {
  safeLocalStorageGetItem,
  safeLocalStorageSetItem,
  safeSessionStorageGetItem,
  safeSessionStorageRemoveItem,
  safeSessionStorageSetItem,
} from './safeBrowserStorage';

const SETTINGS_KEY = 'erp_mobile_pin_lock_settings';
const LAST_UNLOCK_KEY = 'erp_mobile_pin_last_unlock';
const LAST_BACKGROUND_KEY = 'erp_mobile_pin_last_background';
const LAST_ACTIVITY_KEY = 'erp_mobile_pin_last_activity';

export type PinIdleTimeoutId = 'off' | '1m' | '2m';

export interface PinLockSettings {
  /** Legacy preference; re-lock timing is governed by idleTimeout (no immediate background lock). */
  lockOnBackground: boolean;
  /** Idle lock: off, 1 min, or 2 min without interaction. */
  idleTimeout: PinIdleTimeoutId;
  /** Max in-app age before re-lock (aligned with counter session policy). */
  sessionMaxAgeMs: number;
}

function defaultSessionMaxAgeMs(): number {
  return getDevicePinMaxAgeMs();
}

const DEFAULTS: PinLockSettings = {
  lockOnBackground: false,
  idleTimeout: '1m',
  sessionMaxAgeMs: defaultSessionMaxAgeMs(),
};

function idleTimeoutMs(id: PinIdleTimeoutId): number | null {
  if (id === '1m') return 60_000;
  if (id === '2m') return 120_000;
  return null;
}

/** Configured idle duration; null when idle lock is off. */
export function getEffectiveIdleTimeoutMs(idle: PinIdleTimeoutId): number | null {
  return idleTimeoutMs(idle);
}

function isLegacyImmediateBackgroundSettings(
  parsed: Partial<PinLockSettings & { enabled?: boolean }>,
): boolean {
  const lockOnBg =
    typeof parsed.lockOnBackground === 'boolean'
      ? parsed.lockOnBackground
      : typeof parsed.enabled === 'boolean'
        ? parsed.enabled
        : true;
  const idle =
    parsed.idleTimeout === '1m' || parsed.idleTimeout === '2m' || parsed.idleTimeout === 'off'
      ? parsed.idleTimeout
      : 'off';
  return lockOnBg === true && idle === 'off';
}

function parseStoredSettings(
  parsed: Partial<PinLockSettings & { enabled?: boolean; timeoutMs?: number }>,
): PinLockSettings {
  const legacyEnabled = typeof parsed.enabled === 'boolean' ? parsed.enabled : true;
  return {
    lockOnBackground:
      typeof parsed.lockOnBackground === 'boolean'
        ? parsed.lockOnBackground
        : legacyEnabled,
    idleTimeout:
      parsed.idleTimeout === '1m' || parsed.idleTimeout === '2m' || parsed.idleTimeout === 'off'
        ? parsed.idleTimeout
        : 'off',
    sessionMaxAgeMs:
      typeof parsed.sessionMaxAgeMs === 'number' && parsed.sessionMaxAgeMs > 0
        ? parsed.sessionMaxAgeMs
        : typeof parsed.timeoutMs === 'number' && parsed.timeoutMs > 0
          ? parsed.timeoutMs
          : defaultSessionMaxAgeMs(),
  };
}

/** Migrate legacy settings shape (enabled + timeoutMs only). */
export function getPinLockSettings(): PinLockSettings {
  try {
    const raw = safeLocalStorageGetItem(SETTINGS_KEY);
    if (!raw) {
      return {
        lockOnBackground: false,
        idleTimeout: '1m',
        sessionMaxAgeMs: defaultSessionMaxAgeMs(),
      };
    }
    const parsed = JSON.parse(raw) as Partial<
      PinLockSettings & { enabled?: boolean; timeoutMs?: number }
    >;
    const settings = parseStoredSettings(parsed);
    if (isLegacyImmediateBackgroundSettings(parsed)) {
      const migrated: PinLockSettings = {
        ...settings,
        lockOnBackground: false,
        idleTimeout: '1m',
      };
      safeLocalStorageSetItem(SETTINGS_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return settings;
  } catch {
    return { ...DEFAULTS, sessionMaxAgeMs: defaultSessionMaxAgeMs() };
  }
}

export function setPinLockSettings(next: Partial<PinLockSettings>): void {
  const merged = { ...getPinLockSettings(), ...next };
  safeLocalStorageSetItem(SETTINGS_KEY, JSON.stringify(merged));
}

/** Call after a successful PIN unlock OR email/password login. */
export function markUnlocked(): void {
  const now = String(Date.now());
  safeSessionStorageSetItem(LAST_UNLOCK_KEY, now);
  safeSessionStorageSetItem(LAST_ACTIVITY_KEY, now);
  safeSessionStorageRemoveItem(LAST_BACKGROUND_KEY);
}

export function clearUnlockMark(): void {
  safeSessionStorageRemoveItem(LAST_UNLOCK_KEY);
  safeSessionStorageRemoveItem(LAST_BACKGROUND_KEY);
  safeSessionStorageRemoveItem(LAST_ACTIVITY_KEY);
}

/** Call when app goes to background (home button, task switch). */
export function markBackgrounded(): void {
  safeSessionStorageSetItem(LAST_BACKGROUND_KEY, String(Date.now()));
}

/** Call on user interaction while app is unlocked (extends idle timer). */
export function touchPinActivity(): void {
  safeSessionStorageSetItem(LAST_ACTIVITY_KEY, String(Date.now()));
}

function getLastUnlock(): number {
  const raw = safeSessionStorageGetItem(LAST_UNLOCK_KEY);
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function idleExceeded(idle: PinIdleTimeoutId): boolean {
  const ms = getEffectiveIdleTimeoutMs(idle);
  if (ms == null) return false;
  const raw = safeSessionStorageGetItem(LAST_ACTIVITY_KEY);
  if (!raw) return true;
  const n = Number(raw);
  if (!Number.isFinite(n)) return true;
  return Date.now() - n > ms;
}

/**
 * Returns true when PIN / counter lock should be shown again.
 */
export function shouldRelock(): boolean {
  const s = getPinLockSettings();
  const last = getLastUnlock();
  if (last === 0) return true;

  if (Date.now() - last > s.sessionMaxAgeMs) return true;

  if (idleExceeded(s.idleTimeout)) return true;

  return false;
}

/** @deprecated Use lockOnBackground — kept for SetPinModal migration */
export function getLegacyPinLockEnabled(): boolean {
  return getPinLockSettings().lockOnBackground;
}
