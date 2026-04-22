/**
 * PIN lock-on-resume helpers.
 * Tracks the last time the user unlocked the app, stores a user-tunable
 * timeout (in milliseconds), and tells callers whether the app should
 * re-prompt for PIN after a period of inactivity / backgrounding.
 */

const SETTINGS_KEY = 'erp_mobile_pin_lock_settings';
const LAST_UNLOCK_KEY = 'erp_mobile_pin_last_unlock';

export interface PinLockSettings {
  /** Require PIN after the app has been backgrounded / inactive for `timeoutMs`. */
  enabled: boolean;
  /** How many ms the app can stay inactive before re-locking. */
  timeoutMs: number;
}

const DEFAULTS: PinLockSettings = {
  enabled: true,
  timeoutMs: 60_000,
};

export function getPinLockSettings(): PinLockSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<PinLockSettings>;
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULTS.enabled,
      timeoutMs: typeof parsed.timeoutMs === 'number' && parsed.timeoutMs > 0 ? parsed.timeoutMs : DEFAULTS.timeoutMs,
    };
  } catch {
    return { ...DEFAULTS };
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
  try {
    sessionStorage.setItem(LAST_UNLOCK_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function clearUnlockMark(): void {
  try {
    sessionStorage.removeItem(LAST_UNLOCK_KEY);
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

/**
 * Returns true if enough time has elapsed since the last unlock to
 * require a fresh PIN check. Called on `visibilitychange` (visible) and
 * on Capacitor `App.resume`.
 */
export function shouldRelock(): boolean {
  const s = getPinLockSettings();
  if (!s.enabled) return false;
  const last = getLastUnlock();
  if (last === 0) return true;
  return Date.now() - last > s.timeoutMs;
}
