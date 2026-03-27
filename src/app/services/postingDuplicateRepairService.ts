/**
 * Global duplicate / stacked posting detection and controlled repair.
 * Canonical rule: one active primary journal per payments.id (journal_entries.payment_id, non-void, not payment_adjustment).
 * PF-14 adjustments are separate rows (reference_type = payment_adjustment, reference_id = payment id).
 */

import { supabase } from '@/lib/supabase';
import { syncPaymentAccountAdjustmentsForCompany } from '@/app/services/paymentAdjustmentService';

export type DuplicatePrimaryPaymentGroup = {
  paymentId: string;
  referenceType: string | null;
  amount: number | null;
  /** Oldest primary kept by repair */
  keepJournalEntryId: string;
  /** Same payment_id, later created_at — void candidates */
  duplicateJournalEntryIds: string[];
};

export type PostingDuplicationPreview = {
  companyId: string;
  duplicatePrimaryGroups: DuplicatePrimaryPaymentGroup[];
  duplicateCount: number;
};

/**
 * List payments that have more than one active primary-linked journal entry.
 */
export async function previewDuplicatePrimaryPaymentJournals(companyId: string): Promise<PostingDuplicationPreview> {
  const { data: payments } = await supabase
    .from('payments')
    .select('id, reference_type, amount')
    .eq('company_id', companyId);

  const paymentIds = (payments || []).map((p: any) => p.id);
  if (!paymentIds.length) {
    return { companyId, duplicatePrimaryGroups: [], duplicateCount: 0 };
  }

  const { data: jes } = await supabase
    .from('journal_entries')
    .select('id, payment_id, created_at, reference_type, is_void')
    .eq('company_id', companyId)
    .in('payment_id', paymentIds)
    .or('is_void.is.null,is_void.eq.false')
    .neq('reference_type', 'payment_adjustment');

  const byPay = new Map<string, any[]>();
  for (const je of jes || []) {
    const row = je as any;
    const pid = row.payment_id;
    if (!pid) continue;
    if (!byPay.has(pid)) byPay.set(pid, []);
    byPay.get(pid)!.push(row);
  }

  const duplicatePrimaryGroups: DuplicatePrimaryPaymentGroup[] = [];
  const payMap = new Map((payments || []).map((p: any) => [p.id, p]));

  for (const [paymentId, list] of byPay) {
    if (list.length <= 1) continue;
    const sorted = [...list].sort((a, b) => {
      const ta = new Date(a.created_at || 0).getTime();
      const tb = new Date(b.created_at || 0).getTime();
      if (ta !== tb) return ta - tb;
      return String(a.id).localeCompare(String(b.id));
    });
    const keep = sorted[0];
    const dups = sorted.slice(1).map((x) => x.id);
    const p = payMap.get(paymentId) as any;
    duplicatePrimaryGroups.push({
      paymentId,
      referenceType: p?.reference_type ?? null,
      amount: p?.amount != null ? Number(p.amount) : null,
      keepJournalEntryId: keep.id,
      duplicateJournalEntryIds: dups,
    });
  }

  return {
    companyId,
    duplicatePrimaryGroups,
    duplicateCount: duplicatePrimaryGroups.reduce((s, g) => s + g.duplicateJournalEntryIds.length, 0),
  };
}

export type VoidDuplicateResult = {
  voidedJournalEntryIds: string[];
  error?: string;
};

/**
 * Void duplicate primary payment journals (keep earliest created_at per payment_id). Idempotent.
 */
export async function voidDuplicatePrimaryPaymentJournals(
  companyId: string,
  options?: { dryRun?: boolean }
): Promise<VoidDuplicateResult> {
  const preview = await previewDuplicatePrimaryPaymentJournals(companyId);
  const ids = preview.duplicatePrimaryGroups.flatMap((g) => g.duplicateJournalEntryIds);
  if (options?.dryRun || ids.length === 0) {
    return { voidedJournalEntryIds: options?.dryRun ? ids : [] };
  }

  const { error } = await supabase
    .from('journal_entries')
    .update({ is_void: true })
    .eq('company_id', companyId)
    .in('id', ids);

  if (error) {
    return { voidedJournalEntryIds: [], error: error.message };
  }
  return { voidedJournalEntryIds: ids };
}

export type FullPostingRepairSummary = {
  preview: PostingDuplicationPreview;
  voidedJournalEntryIds: string[];
  sync: Awaited<ReturnType<typeof syncPaymentAccountAdjustmentsForCompany>>;
  dryRun: boolean;
  errors: string[];
};

/**
 * End-to-end: preview duplicates → optionally void extras → run safe payment_account sync (fixed purchase logic).
 */
export async function runFullPostingRepair(
  companyId: string,
  options?: { voidDuplicates?: boolean; dryRun?: boolean }
): Promise<FullPostingRepairSummary> {
  const dryRun = options?.dryRun === true;
  const errors: string[] = [];
  const preview = await previewDuplicatePrimaryPaymentJournals(companyId);
  let voidedJournalEntryIds: string[] = [];

  if (options?.voidDuplicates && preview.duplicateCount > 0) {
    const v = await voidDuplicatePrimaryPaymentJournals(companyId, { dryRun });
    if (v.error) errors.push(v.error);
    voidedJournalEntryIds = v.voidedJournalEntryIds;
  }

  let sync = { synced: 0, errors: 0, skippedDuplicates: 0, skippedAmbiguous: 0 };
  if (!dryRun) {
    try {
      sync = await syncPaymentAccountAdjustmentsForCompany(companyId);
    } catch (e: unknown) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  return { preview, voidedJournalEntryIds, sync, dryRun, errors };
}
