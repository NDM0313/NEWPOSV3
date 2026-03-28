/**
 * Single source for operational AR/AP per contact — must match web
 * `src/app/services/contactService.ts` → `getContactBalancesSummary`:
 * same RPC (`get_contact_balances_summary`), same `p_branch_id` rules.
 *
 * Web Contacts (ContactsPage.tsx) calls:
 *   getContactBalancesSummary(companyId, branchId === 'all' ? null : branchId)
 *
 * Do not reimplement totals with raw `sales`/`payments` SELECTs here: RLS hides rows
 * and produces false low balances (e.g. Rs. 13k vs Rs. 134k).
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
