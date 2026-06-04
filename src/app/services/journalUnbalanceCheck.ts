/**
 * Journal debit/credit balance checks (no imports from integrity lab or posting engine).
 * Shared by documentPostingEngine and accountingIntegrityLabService to avoid chunk cycles.
 */

import { supabase } from '@/lib/supabase';

export interface JournalBalanceRow {
  journal_entry_id: string;
  entry_no: string | null;
  reference_type: string | null;
  reference_id: string | null;
  total_debit: number;
  total_credit: number;
  diff: number;
}

/** Per-entry debit/credit sums; unbalanced entries have diff !== 0 */
export async function findUnbalancedJournalEntries(
  companyId: string,
  branchId?: string | null
): Promise<JournalBalanceRow[]> {
  let jeQuery = supabase
    .from('journal_entries')
    .select('id, entry_no, reference_type, reference_id, company_id, branch_id, is_void')
    .eq('company_id', companyId);
  if (branchId && branchId !== 'all') {
    jeQuery = jeQuery.or(`branch_id.eq.${branchId},branch_id.is.null`);
  }
  const { data: entries, error } = await jeQuery;
  if (error || !entries?.length) return [];

  const ids = entries.filter((e: any) => !e.is_void).map((e: any) => e.id);
  if (!ids.length) return [];

  const { data: lines } = await supabase
    .from('journal_entry_lines')
    .select('journal_entry_id, debit, credit')
    .in('journal_entry_id', ids);

  const sums = new Map<string, { d: number; c: number }>();
  ids.forEach((id) => sums.set(id, { d: 0, c: 0 }));
  (lines || []).forEach((l: any) => {
    const s = sums.get(l.journal_entry_id);
    if (!s) return;
    s.d += Number(l.debit) || 0;
    s.c += Number(l.credit) || 0;
  });

  const byId = new Map(entries.map((e: any) => [e.id, e]));
  const out: JournalBalanceRow[] = [];
  sums.forEach((s, jeId) => {
    const diff = Math.round((s.d - s.c) * 100) / 100;
    if (Math.abs(diff) > 0.01) {
      const e = byId.get(jeId) as any;
      out.push({
        journal_entry_id: jeId,
        entry_no: e?.entry_no ?? null,
        reference_type: e?.reference_type ?? null,
        reference_id: e?.reference_id ?? null,
        total_debit: s.d,
        total_credit: s.c,
        diff,
      });
    }
  });
  return out;
}

function matchesBranchFilter(
  rowBranchId: string | null | undefined,
  branchId: string | null | undefined
): boolean {
  if (!branchId || branchId === 'all') return true;
  if (rowBranchId == null || rowBranchId === '') return true;
  return rowBranchId === branchId;
}

/**
 * Unbalanced JEs that touch only the selected sale/purchase: document + reversal refs,
 * plus any journal_entries linked via payments for that document. Does not load company-wide JE rows.
 */
export async function findUnbalancedJournalEntriesForDocument(
  companyId: string,
  branchId: string | null | undefined,
  opts: { saleId?: string; purchaseId?: string }
): Promise<JournalBalanceRow[]> {
  const jeIds = new Set<string>();

  const considerRow = (e: { id: string; branch_id?: string | null; is_void?: boolean | null }) => {
    if (e.is_void) return;
    if (!matchesBranchFilter(e.branch_id, branchId)) return;
    jeIds.add(e.id);
  };

  const addByRef = async (rt: string, rid: string) => {
    const { data } = await supabase
      .from('journal_entries')
      .select('id, branch_id, is_void')
      .eq('company_id', companyId)
      .eq('reference_type', rt)
      .eq('reference_id', rid);
    (data || []).forEach(considerRow);
  };

  if (opts.saleId) {
    await addByRef('sale', opts.saleId);
    await addByRef('sale_reversal', opts.saleId);
    const { data: pays } = await supabase
      .from('payments')
      .select('id')
      .eq('reference_type', 'sale')
      .eq('reference_id', opts.saleId);
    for (const p of pays || []) {
      const { data: jes } = await supabase
        .from('journal_entries')
        .select('id, branch_id, is_void')
        .eq('company_id', companyId)
        .eq('payment_id', (p as { id: string }).id);
      (jes || []).forEach(considerRow);
    }
  }

  if (opts.purchaseId) {
    await addByRef('purchase', opts.purchaseId);
    const { data: pays } = await supabase
      .from('payments')
      .select('id')
      .eq('reference_type', 'purchase')
      .eq('reference_id', opts.purchaseId);
    for (const p of pays || []) {
      const { data: jes } = await supabase
        .from('journal_entries')
        .select('id, branch_id, is_void')
        .eq('company_id', companyId)
        .eq('payment_id', (p as { id: string }).id);
      (jes || []).forEach(considerRow);
    }
  }

  const ids = [...jeIds];
  if (!ids.length) return [];

  const { data: entries, error } = await supabase
    .from('journal_entries')
    .select('id, entry_no, reference_type, reference_id, company_id, branch_id, is_void')
    .eq('company_id', companyId)
    .in('id', ids);
  if (error || !entries?.length) return [];

  const activeIds = entries.filter((e: any) => !e.is_void).map((e: any) => e.id);
  if (!activeIds.length) return [];

  const { data: lines } = await supabase
    .from('journal_entry_lines')
    .select('journal_entry_id, debit, credit')
    .in('journal_entry_id', activeIds);

  const sums = new Map<string, { d: number; c: number }>();
  activeIds.forEach((id) => sums.set(id, { d: 0, c: 0 }));
  (lines || []).forEach((l: any) => {
    const s = sums.get(l.journal_entry_id);
    if (!s) return;
    s.d += Number(l.debit) || 0;
    s.c += Number(l.credit) || 0;
  });

  const byId = new Map(entries.map((e: any) => [e.id, e]));
  const out: JournalBalanceRow[] = [];
  sums.forEach((s, jeId) => {
    const diff = Math.round((s.d - s.c) * 100) / 100;
    if (Math.abs(diff) > 0.01) {
      const e = byId.get(jeId) as any;
      out.push({
        journal_entry_id: jeId,
        entry_no: e?.entry_no ?? null,
        reference_type: e?.reference_type ?? null,
        reference_id: e?.reference_id ?? null,
        total_debit: s.d,
        total_credit: s.c,
        diff,
      });
    }
  });
  return out;
}
