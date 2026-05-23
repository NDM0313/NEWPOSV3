/**
 * PIN lock-on-resume helpers.
 * Re-prompts after the app was backgrounded (home / other app), not on in-app focus changes.
 */

import { getDevicePinMaxAgeMs } from './counterSessionPolicy';

const SETTINGS_KEY = 'erp_mobile_pin_lock_settings';
const LAST_UNLOCK_KEY = 'erp_mobile_pin_last_unlock';
const LAST_BACKGROUND_KEY = 'erp_mobile_pin_last_background';

export interface PinLockSettings {
  /** Require PIN after returning from background. */
  enabled: boolean;
  /** Max in-app age before re-lock even without background (aligned with counter session policy). */
  timeoutMs: number;
}

function defaultTimeoutMs(): number {
  return getDevicePinMaxAgeMs();
}

const DEFAULTS: PinLockSettings = {
  enabled: true,
  timeoutMs: defaultTimeoutMs(),
};

export function getPinLockSettings(): PinLockSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { enabled: DEFAULTS.enabled, timeoutMs: defaultTimeoutMs() };
    const parsed = JSON.parse(raw) as Partial<PinLockSettings>;
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULTS.enabled,
      timeoutMs:
        typeof parsed.timeoutMs === 'number' && parsed.timeoutMs > 0
          ? parsed.timeoutMs
          : defaultTimeoutMs(),
    };
  } catch {
    return { enabled: DEFAULTS.enabled, timeoutMs: defaultTimeoutMs() };
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
    sessionStorage.removeItem(LAST_BACKGROUND_KEY);
  } catch {
    /* ignore */
  }
}

export function clearUnlockMark(): void {
  try {
    sessionStorage.removeItem(LAST_UNLOCK_KEY);
    sessionStorage.removeItem(LAST_BACKGROUND_KEY);
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

function getLastBackground(): number {
  try {
    const raw = sessionStorage.getItem(LAST_BACKGROUND_KEY);
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function wasBackgroundedSinceUnlock(): boolean {
  const bg = getLastBackground();
  const unlock = getLastUnlock();
  if (bg === 0) return false;
  if (unlock === 0) return true;
  return bg > unlock;
}

/**
 * Returns true when PIN should be shown again: after true background resume,
 * or when in-app session exceeded the counter session policy window.
 */
export function shouldRelock(): boolean {
  const s = getPinLockSettings();
  if (!s.enabled) return false;
  const last = getLastUnlock();
  if (last === 0) return true;
  if (wasBackgroundedSinceUnlock()) return true;
  return Date.now() - last > s.timeoutMs;
}
