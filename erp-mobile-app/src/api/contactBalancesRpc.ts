/**
 * Balances — aligned with web `contactService.getContactBalancesSummary`:
 * primary path uses `get_contact_party_gl_balances` (1100 / 2000 / worker WP/WA net),
 * same branch rules as web; falls back to operational `get_contact_balances_summary`
 * if the GL RPC fails (migrations / permissions).
 *
 * Do not reimplement totals with raw `sales`/`payments` SELECTs: RLS hides rows.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { canonContactId, normalizeCompanyId, parseRpcMoney } from './contactBalancesUtils';

const BRANCH_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Mirrors web `contactService.getContactBalancesSummary` branch → `p_branch_id`. */
export function safeRpcBranchId(branchId: string | null | undefined): string | null {
  if (branchId == null || branchId === '' || branchId === 'all' || branchId === 'default') {
    return null;
  }
  const t = String(branchId).trim();
  return BRANCH_UUID_RE.test(t) ? t : null;
}

export type ContactBalancesRow = { receivables: number; payables: number };

/** Per-contact GL slice — same RPC columns as web `getContactPartyGlBalancesMap`. */
export type ContactPartyGlSlice = {
  glArReceivable: number;
  glApPayable: number;
  glWorkerPayable: number;
};

export async function fetchContactPartyGlBalancesMap(
  companyId: string,
  branchId?: string | null
): Promise<{ map: Map<string, ContactPartyGlSlice>; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { map: new Map(), error: 'App not configured.' };
  }
  const company = normalizeCompanyId(companyId);
  if (!company) {
    return { map: new Map(), error: 'Missing company.' };
  }

  const { data, error } = await supabase.rpc('get_contact_party_gl_balances', {
    p_company_id: company,
    p_branch_id: safeRpcBranchId(branchId),
  });

  if (error) {
    console.warn('[ERP Mobile] get_contact_party_gl_balances:', error.message);
    return { map: new Map(), error: error.message || 'Party GL RPC failed' };
  }

  const map = new Map<string, ContactPartyGlSlice>();
  for (const row of data ?? []) {
    const r = row as Record<string, unknown>;
    const id = canonContactId(r.contact_id);
    if (!id) continue;
    map.set(id, {
      glArReceivable: Number(r.gl_ar_receivable ?? 0) || 0,
      glApPayable: Number(r.gl_ap_payable ?? 0) || 0,
      glWorkerPayable: Number(r.gl_worker_payable ?? 0) || 0,
    });
  }

  return { map, error: null };
}

/** Due amount for a party-ledger list row — matches web GL columns for that role. */
export function partyGlDueForListRole(
  slice: ContactPartyGlSlice | undefined,
  listRole: 'customer' | 'supplier' | 'worker'
): number {
  if (!slice) return 0;
  if (listRole === 'customer') return Math.max(0, slice.glArReceivable);
  if (listRole === 'supplier') return Math.max(0, slice.glApPayable);
  return Math.max(0, slice.glWorkerPayable);
}

export function partyGlSliceFromMap(
  map: Map<string, ContactPartyGlSlice>,
  contactId: string
): ContactPartyGlSlice | undefined {
  const cid = canonContactId(contactId);
  const raw = String(contactId).trim();
  return map.get(cid) ?? map.get(raw);
}

/** Operational-only fallback when party GL RPC is unavailable. */
export async function fetchOperationalContactBalancesSummary(
  companyId: string,
  branchId?: string | null
): Promise<{ map: Map<string, ContactBalancesRow>; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { map: new Map(), error: 'App not configured.' };
  }

  const company = normalizeCompanyId(companyId);
  if (!company) {
    return { map: new Map(), error: 'Missing company.' };
  }

  const p_branch_id = safeRpcBranchId(branchId);

  const { data, error } = await supabase.rpc('get_contact_balances_summary', {
    p_company_id: company,
    p_branch_id,
  });

  if (error) {
    console.warn(
      '[ERP Mobile] get_contact_balances_summary failed:',
      error.code,
      error.message,
      '| Apply migrations/20260366_grant_execute_get_contact_balances_summary.sql if permission denied.',
    );
    return { map: new Map(), error: error.message || 'Balance RPC failed' };
  }

  const map = new Map<string, ContactBalancesRow>();
  for (const row of data ?? []) {
    const r = row as Record<string, unknown>;
    const id = canonContactId(r.contact_id);
    if (!id) continue;
    const rec = parseRpcMoney(r.receivables ?? r.Receivables);
    const pay = parseRpcMoney(r.payables ?? r.Payables);
    const prev = map.get(id) || { receivables: 0, payables: 0 };
    map.set(id, { receivables: prev.receivables + rec, payables: prev.payables + pay });
  }

  return { map, error: null };
}

/**
 * Web-aligned summary map: party GL when available; else operational RPC.
 * `receivables` ≈ GL AR; `payables` ≈ GL AP + GL worker (same combined field as web).
 */
export async function fetchContactBalancesSummary(
  companyId: string,
  branchId?: string | null
): Promise<{ map: Map<string, ContactBalancesRow>; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { map: new Map(), error: 'App not configured.' };
  }

  const company = normalizeCompanyId(companyId);
  if (!company) {
    return { map: new Map(), error: 'Missing company.' };
  }

  const gl = await fetchContactPartyGlBalancesMap(company, branchId);
  if (!gl.error) {
    const map = new Map<string, ContactBalancesRow>();
    gl.map.forEach((slice, id) => {
      map.set(id, {
        receivables: Math.max(0, slice.glArReceivable),
        payables: Math.max(0, slice.glApPayable + slice.glWorkerPayable),
      });
    });
    return { map, error: null };
  }

  return fetchOperationalContactBalancesSummary(company, branchId);
}

/** Operational receivable for one contact id (customer / both). */
export function receivableFromBalanceMap(
  map: Map<string, ContactBalancesRow>,
  contactId: string
): number {
  const cid = canonContactId(contactId);
  const raw = String(contactId).trim();
  const row = map.get(cid) ?? map.get(raw);
  return Math.max(0, row?.receivables ?? 0);
}

export function balanceRowFromMap(
  map: Map<string, ContactBalancesRow>,
  contactId: string
): ContactBalancesRow | undefined {
  const cid = canonContactId(contactId);
  const raw = String(contactId).trim();
  return map.get(cid) ?? map.get(raw);
}
