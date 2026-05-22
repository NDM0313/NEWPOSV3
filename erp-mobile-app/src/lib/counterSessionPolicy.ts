/**
 * Tablet counter PIN session freshness policy (localSettings only).
 * Controls device PIN max age and when to show advisory warnings—not server auth TTL.
 */

export type CounterSessionPolicyId = '24h' | '7d' | '30d' | 'unlimited';

const STORAGE_KEY = 'erp_mobile_counter_session_policy';
const DEFAULT_POLICY: CounterSessionPolicyId = '7d';

/** One year — practical "unlimited" for device quick-PIN vault max age. */
const DEVICE_PIN_UNLIMITED_MS = 365 * 24 * 60 * 60 * 1000;

export const COUNTER_SESSION_POLICY_OPTIONS: { id: CounterSessionPolicyId; label: string }[] = [
  { id: '24h', label: '24 hours' },
  { id: '7d', label: '7 days (recommended)' },
  { id: '30d', label: '30 days' },
  { id: 'unlimited', label: 'Unlimited' },
];

export function getCounterSessionPolicy(): CounterSessionPolicyId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === '24h' || raw === '7d' || raw === '30d' || raw === 'unlimited') return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_POLICY;
}

export function setCounterSessionPolicy(id: CounterSessionPolicyId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

/** Milliseconds for staleness advisory; null = never show stale advisory. */
export function getCounterSessionPolicyMs(): number | null {
  switch (getCounterSessionPolicy()) {
    case '24h':
      return 24 * 60 * 60 * 1000;
    case '7d':
      return 7 * 24 * 60 * 60 * 1000;
    case '30d':
      return 30 * 24 * 60 * 60 * 1000;
    case 'unlimited':
      return null;
    default:
      return 7 * 24 * 60 * 60 * 1000;
  }
}

/** Device quick-PIN vault max age aligned with counter session policy. */
export function getDevicePinMaxAgeMs(): number {
  const ms = getCounterSessionPolicyMs();
  return ms ?? DEVICE_PIN_UNLIMITED_MS;
}

export function isCounterTokenSyncStale(lastTokenSyncAt: number | undefined | null): boolean {
  const max = getCounterSessionPolicyMs();
  if (max === null) return false;
  if (!lastTokenSyncAt || !Number.isFinite(lastTokenSyncAt)) return true;
  return Date.now() - lastTokenSyncAt > max;
}

/** Advisory copy when token sync is older than policy (does not block PIN). */
export function getCounterSyncStaleWarning(lastTokenSyncAt?: number | null): string | null {
  if (!isCounterTokenSyncStale(lastTokenSyncAt)) return null;
  const policy = getCounterSessionPolicy();
  const windowLabel =
    policy === '24h' ? '24 hours' : policy === '30d' ? '30 days' : 'several days';
  return `Tablet session not refreshed in the last ${windowLabel}—ask a supervisor to sign in with email once on this tablet.`;
}

export function formatLastTokenSyncLabel(lastTokenSyncAt?: number | null): string | null {
  if (!lastTokenSyncAt || !Number.isFinite(lastTokenSyncAt)) return 'Never refreshed on this tablet';
  const d = new Date(lastTokenSyncAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
