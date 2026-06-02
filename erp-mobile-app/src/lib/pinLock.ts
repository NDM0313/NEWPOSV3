/**
 * PIN lock-on-resume helpers.
 * Re-prompt after app background or idle timeout (configurable in Settings).
 */

import { getDevicePinMaxAgeMs } from './counterSessionPolicy';

const SETTINGS_KEY = 'erp_mobile_pin_lock_settings';
const LAST_UNLOCK_KEY = 'erp_mobile_pin_last_unlock';
const LAST_BACKGROUND_KEY = 'erp_mobile_pin_last_background';
const LAST_ACTIVITY_KEY = 'erp_mobile_pin_last_activity';

export type PinIdleTimeoutId = 'off' | '1m' | '2m';

export interface PinLockSettings {
  /** Require PIN after returning from background. */
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
  lockOnBackground: true,
  idleTimeout: 'off',
  sessionMaxAgeMs: defaultSessionMaxAgeMs(),
};

function idleTimeoutMs(id: PinIdleTimeoutId): number | null {
  if (id === '1m') return 60_000;
  if (id === '2m') return 120_000;
  return null;
}

/** Migrate legacy settings shape (enabled + timeoutMs only). */
export function getPinLockSettings(): PinLockSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return {
        lockOnBackground: true,
        idleTimeout: 'off',
        sessionMaxAgeMs: defaultSessionMaxAgeMs(),
      };
    }
    const parsed = JSON.parse(raw) as Partial<
      PinLockSettings & { enabled?: boolean; timeoutMs?: number }
    >;
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
  } catch {
    return { ...DEFAULTS, sessionMaxAgeMs: defaultSessionMaxAgeMs() };
  }
}

export function setPinLockSettings(next: Partial<PinLockSettings>): void {
  const merged = { ...getPinLockSettings(), ...next };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  } catch {
    /* ignore */
  }
}

/** Call after a successful PIN unlock OR email/password login. */
export function markUnlocked(): void {
  const now = String(Date.now());
  try {
    sessionStorage.setItem(LAST_UNLOCK_KEY, now);
    sessionStorage.setItem(LAST_ACTIVITY_KEY, now);
    sessionStorage.removeItem(LAST_BACKGROUND_KEY);
  } catch {
    /* ignore */
  }
}

export function clearUnlockMark(): void {
  try {
    sessionStorage.removeItem(LAST_UNLOCK_KEY);
    sessionStorage.removeItem(LAST_BACKGROUND_KEY);
    sessionStorage.removeItem(LAST_ACTIVITY_KEY);
  } catch {
    /* ignore */
  }
}

/** Call when app goes to background (home button, task switch). */
export function markBackgrounded(): void {
  try {
    sessionStorage.setItem(LAST_BACKGROUND_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/** Call on user interaction while app is unlocked (extends idle timer). */
export function touchPinActivity(): void {
  try {
    sessionStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

function getLastUnlock(): number {
  try {
    const raw = sessionStorage.getItem(LAST_UNLOCK_KEY);
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function wasBackgroundedSinceUnlock(): boolean {
  try {
    return sessionStorage.getItem(LAST_BACKGROUND_KEY) != null;
  } catch {
    return false;
  }
}

function idleExceeded(idle: PinIdleTimeoutId): boolean {
  const ms = idleTimeoutMs(idle);
  if (ms == null) return false;
  try {
    const raw = sessionStorage.getItem(LAST_ACTIVITY_KEY);
    if (!raw) return true;
    const n = Number(raw);
    if (!Number.isFinite(n)) return true;
    return Date.now() - n > ms;
  } catch {
    return false;
  }
}

/**
 * Returns true when PIN / counter lock should be shown again.
 */
export function shouldRelock(): boolean {
  const s = getPinLockSettings();
  const last = getLastUnlock();
  if (last === 0) return true;

  if (s.lockOnBackground && wasBackgroundedSinceUnlock()) {
    return true;
  }

  if (idleExceeded(s.idleTimeout)) {
    return true;
  }

  return Date.now() - last > s.sessionMaxAgeMs;
}

/** @deprecated Use lockOnBackground — kept for SetPinModal migration */
export function getLegacyPinLockEnabled(): boolean {
  return getPinLockSettings().lockOnBackground;
}
