/**
 * Shared parsing for `get_contact_balances_summary` and related fallbacks.
 * PostgREST often returns NUMERIC as strings; UUIDs must match between RPC rows and contact rows.
 */

const UUID_LOOSE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Trim + lowercase UUID for consistent RPC / .eq('company_id', ...) filters. */
export function normalizeCompanyId(id: string | null | undefined): string | null {
  if (id == null) return null;
  const t = String(id).trim();
  if (!t) return null;
  return UUID_LOOSE.test(t) ? t.toLowerCase() : t;
}

export function parseRpcMoney(v: unknown): number {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'bigint') return Number(v);
  const s = String(v).trim().replace(/,/g, '');
  if (!s) return 0;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** Canonical UUID string for Map keys (handles casing / optional dashes). */
export function canonContactId(id: unknown): string {
  const raw = String(id ?? '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  const hex = lower.replace(/-/g, '');
  if (/^[0-9a-f]{32}$/.test(hex)) {
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return lower;
}

