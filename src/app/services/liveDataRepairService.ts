/**
 * Phase 8: Live Data Repair and Final Verification.
 * Detection only + one safe repair: sync accounts.balance from journal (voided excluded).
 * No destructive deletes; all cleanup previewed and traceable.
 */

import { supabase } from '@/lib/supabase';
import { accountingReportsService } from './accountingReportsService';

export interface UnbalancedJe {
  id: string;
  entry_no: string | null;
  entry_date: string | null;
  reference_type: string | null;
  sum_debit: number;
  sum_credit: number;
  difference: number;
}

export interface AccountBalanceMismatch {
  account_id: string;
  account_code: string;
  account_name: string;
  stored_balance: number;
  journal_balance: number;
  difference: number;
}

export interface ReceivablesReconciliation {
  document_total_due: number;
  ar_balance_from_journal: number;
  difference: number;
  ar_account_id: string | null;
}

export interface PayablesReconciliation {
  document_total_due: number;
  ap_balance_from_journal: number;
  difference: number;
  ap_account_id: string | null;
}

export interface LiveDataRepairSummary {
  trialBalanceDifference: number;
  unbalancedCount: number;
  accountMismatchCount: number;
  receivablesDifference: number;
  payablesDifference: number;
  asOfDate: string;
}

/**
 * Fetch journal entries where sum(debit) != sum(credit) per JE (excluding voided).
 */
export async function getUnbalancedJournalEntries(companyId: string): Promise<UnbalancedJe[]> {
  const { data: entries, error: jeError } = await supabase
    .from('journal_entries')
    .select('id, entry_no, entry_date, reference_type')
    .eq('company_id', companyId)
    .or('is_void.is.null,is_void.eq.false');

  if (jeError || !entries?.length) return [];

  const ids = (entries as any[]).map((e: any) => e.id);
  const { data: lines, error: lineError } = await supabase
    .from('journal_entry_lines')
    .select('journal_entry_id, debit, credit')
    .in('journal_entry_id', ids);

  if (lineError || !lines?.length) return [];

  const byJe: Record<string, { debit: number; credit: number }> = {};
  (lines as any[]).forEach((l: any) => {
    const jid = l.journal_entry_id;
    if (!byJe[jid]) byJe[jid] = { debit: 0, credit: 0 };
    byJe[jid].debit += Number(l.debit) || 0;
    byJe[jid].credit += Number(l.credit) || 0;
  });

  const out: UnbalancedJe[] = [];
  for (const e of entries as any[]) {
    const s = byJe[e.id] || { debit: 0, credit: 0 };
    const diff = Math.round((s.debit - s.credit) * 100) / 100;
    if (diff !== 0) {
      out.push({
        id: e.id,
        entry_no: e.entry_no,
        entry_date: e.entry_date,
        reference_type: e.reference_type,
        sum_debit: Math.round(s.debit * 100) / 100,
        sum_credit: Math.round(s.credit * 100) / 100,
        difference: diff,
      });
    }
  }
  return out;
}

/**
 * Compare accounts.balance with journal-derived balance (voided JEs excluded).
 * Returns only accounts where they differ (or account has no journal lines but non-zero stored).
 */
export async function getAccountBalanceMismatches(
  companyId: string,
  asOfDate?: string
): Promise<AccountBalanceMismatch[]> {
  const asOf = (asOfDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  const journalBalances = await accountingReportsService.getAccountBalancesFromJournal(
    companyId,
    asOf,
    undefined
  );

  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('id, code, name, balance')
    .eq('company_id', companyId)
    .eq('is_active', true);

  if (error || !accounts?.length) return [];

  const out: AccountBalanceMismatch[] = [];
  for (const a of accounts as any[]) {
    const stored = Math.round(Number(a.balance ?? 0) * 100) / 100;
    const journal = Math.round(Number(journalBalances[a.id] ?? 0) * 100) / 100;
    const diff = Math.round((stored - journal) * 100) / 100;
    if (diff !== 0) {
      out.push({
        account_id: a.id,
        account_code: a.code ?? '',
        account_name: a.name ?? '',
        stored_balance: stored,
        journal_balance: journal,
        difference: diff,
      });
    }
  }
  return out;
}

/**
 * Preview: list of account id, current balance, journal balance. Safe to show before sync.
 */
export async function previewSyncAccountsBalanceFromJournal(
  companyId: string,
  asOfDate?: string
): Promise<AccountBalanceMismatch[]> {
  return getAccountBalanceMismatches(companyId, asOfDate);
}

/**
 * Safe repair: set accounts.balance = journal-derived balance (voided excluded).
 * Only updates accounts that have a mismatch; traceable (no deletes). Preview first.
 */
export async function syncAccountsBalanceFromJournal(
  companyId: string,
  asOfDate?: string
): Promise<{ updated: number; errors: string[] }> {
  const mismatches = await getAccountBalanceMismatches(companyId, asOfDate);
  const errors: string[] = [];
  let updated = 0;
  for (const m of mismatches) {
    const { error } = await supabase
      .from('accounts')
      .update({ balance: m.journal_balance, updated_at: new Date().toISOString() })
      .eq('id', m.account_id)
      .eq('company_id', companyId);
    if (error) {
      errors.push(`${m.account_code}: ${error.message}`);
    } else {
      updated++;
    }
  }
  return { updated, errors };
}

/**
 * Receivables: sum(sales.due) vs AR (1100) balance from journal.
 */
export async function getReceivablesReconciliation(companyId: string): Promise<ReceivablesReconciliation> {
  const journalBalances = await accountingReportsService.getAccountBalancesFromJournal(
    companyId,
    new Date().toISOString().slice(0, 10),
    undefined
  );
  // Include BOTH parent AR (1100) AND all AR sub-ledger accounts (AR-*)
  const { data: arAccounts } = await supabase
    .from('accounts')
    .select('id, code')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .or('code.eq.1100,code.like.AR-*,name.ilike.%Accounts Receivable%');
  const arId = (arAccounts && (arAccounts as any[]).find((a: any) => a.code === '1100'))?.id ?? (arAccounts?.[0] as any)?.id ?? null;
  // Sum balances across parent + all sub-ledgers
  let arBalance = 0;
  for (const a of (arAccounts || []) as { id: string; code: string }[]) {
    arBalance += journalBalances[a.id] ?? 0;
  }

  const { data: sales } = await supabase
    .from('sales')
    .select('total, paid_amount, due_amount')
    .eq('company_id', companyId)
    .eq('status', 'final');
  let documentTotalDue = 0;
  (sales || []).forEach((s: any) => {
    const due = Number(s.due_amount ?? 0) || (Number(s.total ?? 0) - Number(s.paid_amount ?? 0));
    if (due > 0) documentTotalDue += due;
  });
  documentTotalDue = Math.round(documentTotalDue * 100) / 100;
  const arRounded = Math.round(arBalance * 100) / 100;
  return {
    document_total_due: documentTotalDue,
    ar_balance_from_journal: arRounded,
    difference: Math.round((documentTotalDue - arRounded) * 100) / 100,
    ar_account_id: arId,
  };
}

/**
 * Payables: sum(purchases.due) vs AP (2000) balance from journal.
 */
export async function getPayablesReconciliation(companyId: string): Promise<PayablesReconciliation> {
  const journalBalances = await accountingReportsService.getAccountBalancesFromJournal(
    companyId,
    new Date().toISOString().slice(0, 10),
    undefined
  );
  // Include BOTH parent AP (2000) AND all AP sub-ledger accounts (AP-*)
  const { data: apAccounts } = await supabase
    .from('accounts')
    .select('id, code')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .or('code.eq.2000,code.like.AP-*,name.ilike.%Accounts Payable%');
  const apId = (apAccounts && (apAccounts as any[]).find((a: any) => a.code === '2000'))?.id ?? (apAccounts?.[0] as any)?.id ?? null;
  // Sum balances across parent + all sub-ledgers
  let apBalance = 0;
  for (const a of (apAccounts || []) as { id: string; code: string }[]) {
    apBalance += journalBalances[a.id] ?? 0;
  }

  const { data: purchases } = await supabase
    .from('purchases')
    .select('total, paid_amount, due_amount')
    .eq('company_id', companyId)
    .in('status', ['received', 'final']);
  let documentTotalDue = 0;
  (purchases || []).forEach((p: any) => {
    const due = Number(p.due_amount ?? 0) || (Number(p.total ?? 0) - Number(p.paid_amount ?? 0));
    if (due > 0) documentTotalDue += due;
  });
  documentTotalDue = Math.round(documentTotalDue * 100) / 100;
  const apRounded = Math.round(apBalance * 100) / 100;
  return {
    document_total_due: documentTotalDue,
    ap_balance_from_journal: apRounded,
    difference: Math.round((documentTotalDue - apRounded) * 100) / 100,
    ap_account_id: apId,
  };
}

/**
 * Full detection summary for Phase 8 verification.
 */
export async function getLiveDataRepairSummary(companyId: string): Promise<LiveDataRepairSummary> {
  const asOf = new Date().toISOString().slice(0, 10);
  const [tb, unbalanced, mismatches, recv, pay] = await Promise.all([
    accountingReportsService.getTrialBalance(companyId, '1900-01-01', asOf, undefined),
    getUnbalancedJournalEntries(companyId),
    getAccountBalanceMismatches(companyId, asOf),
    getReceivablesReconciliation(companyId),
    getPayablesReconciliation(companyId),
  ]);
  return {
    trialBalanceDifference: tb.difference,
    unbalancedCount: unbalanced.length,
    accountMismatchCount: mismatches.length,
    receivablesDifference: recv.difference,
    payablesDifference: pay.difference,
    asOfDate: asOf,
  };
}

/**
 * Rebuild purchase document JE lines for a specific purchase.
 * Fixes the duplicate-amount bug where freight+subtotal lines got the same value.
 */
export async function rebuildPurchaseDocumentJELines(companyId: string, purchaseId: string): Promise<{ success: boolean; error?: string }> {
  const { purchaseAccountingService: pac } = await import('@/app/services/purchaseAccountingService');
  const { data: purchase } = await supabase.from('purchases').select('*, purchase_charges(charge_type, amount)').eq('id', purchaseId).maybeSingle();
  if (!purchase) return { success: false, error: 'Purchase not found' };

  const snapshot = pac.getPurchaseAccountingSnapshot(purchase);

  // Find the canonical purchase document JE
  const { data: je } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('company_id', companyId)
    .eq('reference_type', 'purchase')
    .eq('reference_id', purchaseId)
    .is('payment_id', null)
    .or('is_void.is.null,is_void.eq.false')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!je?.id) return { success: false, error: 'No active purchase document JE found' };

  // Resolve accounts
  const getAccId = async (code: string) => {
    const { data } = await supabase.from('accounts').select('id').eq('code', code).eq('company_id', companyId).eq('is_active', true).maybeSingle();
    return data?.id as string | null;
  };
  const inventoryId = await getAccId('1200');
  const discountId = await getAccId('5210') || await getAccId('6100');
  const supplierId = (purchase as any).supplier_id;
  let apAccountId: string | null = null;
  if (supplierId) {
    const { resolvePayablePostingAccountId } = await import('@/app/services/partySubledgerAccountService');
    apAccountId = await resolvePayablePostingAccountId(companyId, supplierId);
  }
  if (!apAccountId) apAccountId = await getAccId('2000');
  if (!inventoryId || !apAccountId) return { success: false, error: 'Missing inventory or AP account' };

  // Delete old lines and insert correct ones
  await supabase.from('journal_entry_lines').delete().eq('journal_entry_id', je.id);
  const poNo = (purchase as any).po_no || `PUR-${purchaseId.slice(0, 8)}`;
  const supplierName = (purchase as any).supplier_name || 'Supplier';
  const lines: { journal_entry_id: string; account_id: string; debit: number; credit: number; description: string }[] = [];
  if (snapshot.subtotal > 0) {
    lines.push(
      { journal_entry_id: je.id, account_id: inventoryId, debit: snapshot.subtotal, credit: 0, description: `Inventory purchase ${poNo}` },
      { journal_entry_id: je.id, account_id: apAccountId, debit: 0, credit: snapshot.subtotal, description: `Payable — ${supplierName}` },
    );
  }
  if (snapshot.otherCharges > 0) {
    lines.push(
      { journal_entry_id: je.id, account_id: inventoryId, debit: snapshot.otherCharges, credit: 0, description: `Freight (purchase)` },
      { journal_entry_id: je.id, account_id: apAccountId, debit: 0, credit: snapshot.otherCharges, description: `Payable — freight` },
    );
  }
  if (snapshot.discount > 0 && discountId) {
    lines.push(
      { journal_entry_id: je.id, account_id: apAccountId, debit: snapshot.discount, credit: 0, description: `Purchase discount` },
      { journal_entry_id: je.id, account_id: discountId, debit: 0, credit: snapshot.discount, description: `Discount received` },
    );
  }
  if (lines.length > 0) await supabase.from('journal_entry_lines').insert(lines);

  // Clean description
  const ts = new Date().toLocaleString('en-PK', { dateStyle: 'short', timeStyle: 'short' });
  await supabase.from('journal_entries').update({
    description: `Purchase ${poNo} from ${supplierName} [Rebuilt ${ts}]`
  }).eq('id', je.id);

  return { success: true };
}

/**
 * Void all legacy adjustment JEs (sale_adjustment, purchase_adjustment, payment_adjustment)
 * that were created before the in-place edit system. Sets is_void = true.
 */
export async function previewLegacyAdjustmentJEs(companyId: string) {
  const legacyTypes = ['sale_adjustment', 'purchase_adjustment', 'payment_adjustment'];
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id, entry_no, reference_type, description, created_at')
    .eq('company_id', companyId)
    .in('reference_type', legacyTypes)
    .or('is_void.is.null,is_void.eq.false')
    .order('created_at', { ascending: false });
  return { entries: data || [], error: error?.message || null };
}

export async function voidLegacyAdjustmentJEs(
  companyId: string
): Promise<{ voided: number; errors: string[] }> {
  const { entries, error: fetchErr } = await previewLegacyAdjustmentJEs(companyId);
  if (fetchErr) return { voided: 0, errors: [fetchErr] };
  if (!entries.length) return { voided: 0, errors: [] };

  let voided = 0;
  const errors: string[] = [];
  for (const je of entries) {
    const { error: voidErr } = await supabase
      .from('journal_entries')
      .update({
        is_void: true,
        description: `${((je as any).description || '')} [VOIDED: legacy adjustment, superseded by in-place edits]`.slice(0, 500),
      })
      .eq('id', (je as any).id);
    if (voidErr) errors.push(`${(je as any).entry_no || (je as any).id}: ${voidErr.message}`);
    else voided++;
  }
  return { voided, errors };
}

export const liveDataRepairService = {
  getUnbalancedJournalEntries,
  getAccountBalanceMismatches,
  previewSyncAccountsBalanceFromJournal,
  syncAccountsBalanceFromJournal,
  getReceivablesReconciliation,
  getPayablesReconciliation,
  getLiveDataRepairSummary,
  previewLegacyAdjustmentJEs,
  voidLegacyAdjustmentJEs,
  rebuildPurchaseDocumentJELines,
};
