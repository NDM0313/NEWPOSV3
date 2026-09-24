/**
 * Hard-delete a journal entry header + lines (Complete Delete).
 * Fail-closed when non-line FKs still reference the JE.
 */

import { supabase } from '@/lib/supabase';
import {
  isManualJournalHardDeleteEligible,
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
      // Table may be missing in some envs — ignore undefined_table; fail on other errors.
      const msg = String(error.message || '');
      if (/does not exist|relation|Could not find/i.test(msg)) continue;
      throw new Error(`${table}: ${error.message}`);
    }
    if ((count ?? 0) > 0) results.push({ table, count: count ?? 0 });
  }
  return results;
}

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

  const { error: linesErr } = await supabase
    .from('journal_entry_lines')
    .delete()
    .eq('journal_entry_id', journalEntryId);

  if (linesErr) return { success: false, error: `Could not delete lines: ${linesErr.message}` };

  const { error: headErr } = await supabase
    .from('journal_entries')
    .delete()
    .eq('id', journalEntryId)
    .eq('company_id', companyId);

  if (headErr) return { success: false, error: `Could not delete journal: ${headErr.message}` };

  return { success: true };
}
