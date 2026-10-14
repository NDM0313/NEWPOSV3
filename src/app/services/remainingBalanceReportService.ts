/**
 * Operational remaining balance — effective_party open-document due per contact.
 * Uses get_contact_balances_summary RPC (not journal GL).
 */

import { supabase } from '@/lib/supabase';

export type RemainingBalanceRow = {
  contactId: string;
  contactCode: string | null;
  name: string;
  contactType: string;
  receivableDue: number;
  payableDue: number;
  netFollowUp: number;
};

export type RemainingBalanceFilters = {
  branchId?: string | null;
  search?: string;
  typeFilter?: 'all' | 'customers' | 'suppliers';
  hideZero?: boolean;
};

function safeBranchUuid(branchId: string | null | undefined): string | null {
  if (!branchId || branchId === 'all') return null;
  const u = String(branchId).trim();
  return /^[0-9a-f-]{36}$/i.test(u) ? u : null;
}

export async function loadRemainingBalanceReport(
  companyId: string,
  filters: RemainingBalanceFilters = {}
): Promise<{ rows: RemainingBalanceRow[]; error: string | null }> {
  const branchId = safeBranchUuid(filters.branchId);

  const { data: contacts, error: contactErr } = await supabase
    .from('contacts')
    .select('id, name, code, type')
    .eq('company_id', companyId)
    .order('name');

  if (contactErr) {
    return { rows: [], error: contactErr.message };
  }

  const { data: balanceRows, error: rpcErr } = await supabase.rpc('get_contact_balances_summary', {
    p_company_id: companyId,
    p_branch_id: branchId,
  });

  if (rpcErr) {
    return { rows: [], error: rpcErr.message };
  }

  const balanceMap = new Map<string, { receivables: number; payables: number }>();
  for (const row of balanceRows || []) {
    const id = String((row as { contact_id: string }).contact_id);
    balanceMap.set(id, {
      receivables: Number((row as { receivables?: number }).receivables) || 0,
      payables: Number((row as { payables?: number }).payables) || 0,
    });
  }

  const search = (filters.search || '').trim().toLowerCase();
  const hideZero = filters.hideZero !== false;
  const typeFilter = filters.typeFilter || 'all';

  let rows: RemainingBalanceRow[] = (contacts || []).map((c) => {
    const id = String((c as { id: string }).id);
    const bal = balanceMap.get(id) || { receivables: 0, payables: 0 };
    const receivableDue = Math.max(0, bal.receivables);
    const payableDue = Math.max(0, bal.payables);
    const contactType = String((c as { type?: string }).type || '');
    return {
      contactId: id,
      contactCode: (c as { code?: string | null }).code ?? null,
      name: String((c as { name?: string }).name || id),
      contactType,
      receivableDue,
      payableDue,
      netFollowUp: receivableDue - payableDue,
    };
  });

  if (typeFilter === 'customers') {
    rows = rows.filter((r) => r.contactType === 'customer' || r.contactType === 'both');
  } else if (typeFilter === 'suppliers') {
    rows = rows.filter((r) => r.contactType === 'supplier' || r.contactType === 'both' || r.contactType === 'worker');
  }

  if (hideZero) {
    rows = rows.filter((r) => r.receivableDue > 0.009 || r.payableDue > 0.009);
  }

  if (search) {
    rows = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(search) ||
        (r.contactCode || '').toLowerCase().includes(search)
    );
  }

  rows.sort((a, b) => {
    const aMax = Math.max(a.receivableDue, a.payableDue);
    const bMax = Math.max(b.receivableDue, b.payableDue);
    return bMax - aMax;
  });

  return { rows, error: null };
}

export function remainingBalanceToCsv(rows: RemainingBalanceRow[]): string {
  const header = ['Contact', 'Code', 'Type', 'Receivable Due', 'Payable Due', 'Net Follow-up'];
  const lines = rows.map((r) =>
    [
      r.name,
      r.contactCode || '',
      r.contactType,
      r.receivableDue.toFixed(2),
      r.payableDue.toFixed(2),
      r.netFollowUp.toFixed(2),
    ].join(',')
  );
  return [header.join(','), ...lines].join('\n');
}
