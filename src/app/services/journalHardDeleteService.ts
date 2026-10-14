/**
 * Hard-delete journal entry (Complete Delete) or full payment cascade (Receive/Pay).
 * Fail-closed when non-line FKs still reference chain JEs.
 */

import { supabase } from '@/lib/supabase';
import {
  isManualJournalHardDeleteEligible,
  isPaymentHardDeleteTarget,
  manualJournalHardDeleteBlockedReason,
  type ManualJournalHardDeleteRow,
} from '@/app/lib/manualJournalHardDeletePolicy';

const FK_PROBE_TABLES = [
  'rental_payments',
  'bespoke_work_orders',
  'fx_currency_purchases',
  'import_fx_case_advances',
  'import_fx_case_usd_acquisitions',
  'integrity_lab_issues',
  'je_payment_linkage_repair_audit',
  'journal_party_contact_mapping',
  'studio_production_stages',
] as const;

async function countFkRefs(journalEntryId: string): Promise<{ table: string; count: number }[]> {
  const results: { table: string; count: number }[] = [];
  for (const table of FK_PROBE_TABLES) {
    const { count, error } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('journal_entry_id', journalEntryId);
    if (error) {
      const msg = String(error.message || '');
      if (/does not exist|relation|Could not find/i.test(msg)) continue;
      throw new Error(`${table}: ${error.message}`);
    }
    if ((count ?? 0) > 0) results.push({ table, count: count ?? 0 });
  }
  return results;
}

async function countFkRefsForMany(
  journalEntryIds: string[]
): Promise<{ table: string; count: number; journalEntryId: string }[]> {
  const all: { table: string; count: number; journalEntryId: string }[] = [];
  for (const id of journalEntryIds) {
    const blockers = await countFkRefs(id);
    for (const b of blockers) {
      all.push({ ...b, journalEntryId: id });
    }
  }
  return all;
}

async function deleteJournalHeadersAndLines(
  companyId: string,
  journalEntryIds: string[]
): Promise<{ success: boolean; error?: string }> {
  if (journalEntryIds.length === 0) return { success: true };

  const { error: linesErr } = await supabase
    .from('journal_entry_lines')
    .delete()
    .in('journal_entry_id', journalEntryIds);

  if (linesErr) return { success: false, error: `Could not delete lines: ${linesErr.message}` };

  const { error: headErr } = await supabase
    .from('journal_entries')
    .delete()
    .in('id', journalEntryIds)
    .eq('company_id', companyId);

  if (headErr) return { success: false, error: `Could not delete journal: ${headErr.message}` };

  return { success: true };
}

/** Resolve payment id from a JE row (primary payment_id or payment_adjustment reference_id). */
export function resolvePaymentIdFromJournalRow(row: {
  payment_id?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
}): string | null {
  const pid = String(row.payment_id || '').trim();
  if (pid) return pid;
  const rt = String(row.reference_type || '').toLowerCase().trim();
  if (rt === 'payment_adjustment' || rt === 'payment') {
    const rid = String(row.reference_id || '').trim();
    if (rid) return rid;
  }
  return null;
}

/**
 * Collect all JE ids in a payment chain:
 * - primary JEs (payment_id = paymentId)
 * - payment_adjustment (reference_id = paymentId)
 * - correction_reversal pointing at any of the above
 */
async function collectPaymentChainJournalIds(
  companyId: string,
  paymentId: string
): Promise<{ ids: string[]; error?: string }> {
  const idSet = new Set<string>();

  const { data: primary, error: e1 } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('company_id', companyId)
    .eq('payment_id', paymentId);
  if (e1) return { ids: [], error: e1.message };
  for (const r of primary || []) {
    if (r?.id) idSet.add(String(r.id));
  }

  const { data: adjustments, error: e2 } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('company_id', companyId)
    .eq('reference_type', 'payment_adjustment')
    .eq('reference_id', paymentId);
  if (e2) return { ids: [], error: e2.message };
  for (const r of adjustments || []) {
    if (r?.id) idSet.add(String(r.id));
  }

  const baseIds = Array.from(idSet);
  if (baseIds.length > 0) {
    const { data: reversals, error: e3 } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('company_id', companyId)
      .eq('reference_type', 'correction_reversal')
      .in('reference_id', baseIds);
    if (e3) return { ids: [], error: e3.message };
    for (const r of reversals || []) {
      if (r?.id) idSet.add(String(r.id));
    }
  }

  return { ids: Array.from(idSet) };
}

/**
 * Clear rental_payments rows linked to this payment or its chain JEs.
 * Prefer delete; if blocked, null journal_entry_id then retry delete by payment_id when column exists.
 */
async function clearRentalPaymentLinks(
  companyId: string,
  paymentId: string,
  journalEntryIds: string[]
): Promise<{ success: boolean; error?: string }> {
  // By payment_id (if column exists on rental_payments)
  {
    const { error } = await supabase
      .from('rental_payments')
      .delete()
      .eq('company_id', companyId)
      .eq('payment_id', paymentId);
    if (error) {
      const msg = String(error.message || '');
      if (!/does not exist|column|Could not find|schema cache/i.test(msg)) {
        return { success: false, error: `rental_payments (payment_id): ${error.message}` };
      }
    }
  }

  if (journalEntryIds.length > 0) {
    const { error: nullErr } = await supabase
      .from('rental_payments')
      .update({ journal_entry_id: null })
      .in('journal_entry_id', journalEntryIds);
    if (nullErr) {
      const msg = String(nullErr.message || '');
      if (!/does not exist|column|Could not find|schema cache/i.test(msg)) {
        // Try delete by journal_entry_id instead
        const { error: delErr } = await supabase
          .from('rental_payments')
          .delete()
          .in('journal_entry_id', journalEntryIds);
        if (delErr) {
          const dmsg = String(delErr.message || '');
          if (!/does not exist|relation|Could not find/i.test(dmsg)) {
            return { success: false, error: `rental_payments: ${delErr.message}` };
          }
        }
      }
    }
  }

  return { success: true };
}

/**
 * Permanently delete a payment + allocations + full JE chain.
 */
export async function hardDeletePaymentTransaction(
  companyId: string,
  paymentId: string
): Promise<{ success: boolean; error?: string }> {
  if (!companyId || !paymentId) {
    return { success: false, error: 'Company and payment id are required.' };
  }

  const { data: payment, error: payLoadErr } = await supabase
    .from('payments')
    .select('id, company_id')
    .eq('id', paymentId)
    .eq('company_id', companyId)
    .maybeSingle();

  if (payLoadErr) return { success: false, error: payLoadErr.message };
  if (!payment) {
    // Payment already gone — still try to clean orphan chain JEs with this payment_id
  }

  const chain = await collectPaymentChainJournalIds(companyId, paymentId);
  if (chain.error) return { success: false, error: chain.error };
  const jeIds = chain.ids;

  // 1) Allocations first (paid_amount recalc triggers)
  const { error: allocErr } = await supabase.from('payment_allocations').delete().eq('payment_id', paymentId);
  if (allocErr) {
    const msg = String(allocErr.message || '');
    if (!/does not exist|relation|Could not find/i.test(msg)) {
      return { success: false, error: `Could not delete allocations: ${allocErr.message}` };
    }
  }

  // 2) Clear rental_payments links before JE delete
  const rentalClear = await clearRentalPaymentLinks(companyId, paymentId, jeIds);
  if (!rentalClear.success) return rentalClear;

  // 3) FK probe remaining tables (after rental clear)
  if (jeIds.length > 0) {
    try {
      const blockers = await countFkRefsForMany(jeIds);
      if (blockers.length > 0) {
        const detail = blockers
          .map((b) => `${b.table} (${b.count}) on ${b.journalEntryId.slice(0, 8)}…`)
          .join(', ');
        return {
          success: false,
          error: `Cannot hard-delete: other records still reference chain journals (${detail}).`,
        };
      }
    } catch (e: unknown) {
      return { success: false, error: e instanceof Error ? e.message : 'FK probe failed.' };
    }

    const delJe = await deleteJournalHeadersAndLines(companyId, jeIds);
    if (!delJe.success) return delJe;
  }

  // 4) Delete payment row
  const { error: payDelErr } = await supabase
    .from('payments')
    .delete()
    .eq('id', paymentId)
    .eq('company_id', companyId);

  if (payDelErr) return { success: false, error: `Could not delete payment: ${payDelErr.message}` };

  return { success: true };
}

/**
 * Complete Delete entry point from a journal entry id.
 * Delegates to payment cascade when the JE is payment-linked.
 */
export async function hardDeleteJournalEntry(
  companyId: string,
  journalEntryId: string
): Promise<{ success: boolean; error?: string }> {
  if (!companyId || !journalEntryId) {
    return { success: false, error: 'Company and journal entry id are required.' };
  }

  const { data: row, error: loadErr } = await supabase
    .from('journal_entries')
    .select('id, company_id, entry_no, reference_type, reference_id, payment_id, is_void, description')
    .eq('id', journalEntryId)
    .eq('company_id', companyId)
    .maybeSingle();

  if (loadErr) return { success: false, error: loadErr.message };
  if (!row) return { success: false, error: 'Journal entry not found.' };

  const policyRow: ManualJournalHardDeleteRow = {
    reference_type: row.reference_type,
    reference_id: row.reference_id,
    payment_id: row.payment_id,
    is_void: row.is_void,
    description: row.description,
  };

  if (!isManualJournalHardDeleteEligible(policyRow)) {
    return {
      success: false,
      error: manualJournalHardDeleteBlockedReason(policyRow) || 'Hard delete not allowed for this journal.',
    };
  }

  const paymentId = resolvePaymentIdFromJournalRow(row);
  if (paymentId && isPaymentHardDeleteTarget(policyRow)) {
    return hardDeletePaymentTransaction(companyId, paymentId);
  }

  try {
    const blockers = await countFkRefs(journalEntryId);
    if (blockers.length > 0) {
      const detail = blockers.map((b) => `${b.table} (${b.count})`).join(', ');
      return {
        success: false,
        error: `Cannot hard-delete: other records still reference this journal (${detail}).`,
      };
    }
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : 'FK probe failed.' };
  }

  return deleteJournalHeadersAndLines(companyId, [journalEntryId]);
}
