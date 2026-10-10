/**
 * GL correction resolve status — shared by Financial Trace, variance panel, and post-apply invalidation.
 */

import { dispatchContactBalancesRefresh } from '@/app/lib/contactBalancesRefresh';
import { notifyAccountingEntriesChanged } from '@/app/lib/accountingInvalidate';
import { supabase } from '@/lib/supabase';

const HQ_SL_FINGERPRINT = 'developer_repair:gl_correction:hq-sl-0003-orphan-ar';

/** Trace case id → whitelisted defect id (when repairable via create_gl_correction_journal). */
export const TRACE_CASE_DEFECT_IDS: Record<string, string> = {
  'hq-sl-0003-orphan-ar': 'hq-sl-0003-orphan-ar',
};

export function defectIdToFingerprint(defectId: string): string {
  if (defectId === 'hq-sl-0003-orphan-ar') return HQ_SL_FINGERPRINT;
  return `developer_repair:gl_correction:${defectId}`;
}

export function traceCaseHasGlCorrectionDefect(traceCaseId: string): boolean {
  return traceCaseId in TRACE_CASE_DEFECT_IDS;
}

/** Refresh Contacts + accounting surfaces after a GL correction apply. */
export function notifyGlCorrectionApplied(companyId: string | null | undefined): void {
  if (!companyId) return;
  dispatchContactBalancesRefresh(companyId);
  notifyAccountingEntriesChanged({ companyId, reason: 'gl-correction-applied' });
}

/** Manual gl_correction JE matching HQ-SL pattern (no action_fingerprint). */
export async function isHqSlEquivalentCorrectionApplied(companyId: string): Promise<boolean> {
  const { data } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('company_id', companyId)
    .eq('is_void', false)
    .eq('reference_type', 'gl_correction')
    .ilike('description', '%HQ-SL-0003%')
    .ilike('description', '%1100%')
    .limit(1);
  return Boolean((data as { id?: string }[] | null)?.length);
}

export async function isGlCorrectionDefectResolved(
  companyId: string,
  defectId: string
): Promise<boolean> {
  const fingerprint = defectIdToFingerprint(defectId);
  const { data } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('company_id', companyId)
    .eq('action_fingerprint', fingerprint)
    .eq('is_void', false)
    .maybeSingle();
  if ((data as { id?: string } | null)?.id) return true;
  if (defectId === 'hq-sl-0003-orphan-ar') {
    return isHqSlEquivalentCorrectionApplied(companyId);
  }
  return false;
}

export async function fetchGlCorrectionEntryNo(
  companyId: string,
  defectId: string
): Promise<string | null> {
  const fingerprint = defectIdToFingerprint(defectId);
  const { data } = await supabase
    .from('journal_entries')
    .select('entry_no')
    .eq('company_id', companyId)
    .eq('action_fingerprint', fingerprint)
    .eq('is_void', false)
    .maybeSingle();
  const entryNo = (data as { entry_no?: string } | null)?.entry_no;
  if (entryNo) return entryNo;

  if (defectId === 'hq-sl-0003-orphan-ar') {
    const { data: manual } = await supabase
      .from('journal_entries')
      .select('entry_no')
      .eq('company_id', companyId)
      .eq('is_void', false)
      .eq('reference_type', 'gl_correction')
      .ilike('description', '%HQ-SL-0003%')
      .order('entry_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    return (manual as { entry_no?: string } | null)?.entry_no ?? null;
  }
  return null;
}

export type GlCorrectionResolveSnapshot = {
  hqSlApplied: boolean;
  hqSlEntryNo: string | null;
  pendingRentalLeakageCount: number;
  openGlCorrectionCount: number;
};

/** Lightweight snapshot for variance / reconciled banners. */
export async function fetchGlCorrectionResolveSnapshot(
  companyId: string,
  branchId?: string | null
): Promise<GlCorrectionResolveSnapshot> {
  const [hqSlApplied, hqSlEntryNo, rentalRpc] = await Promise.all([
    isGlCorrectionDefectResolved(companyId, 'hq-sl-0003-orphan-ar'),
    fetchGlCorrectionEntryNo(companyId, 'hq-sl-0003-orphan-ar'),
    supabase.rpc('list_rental_1100_leakage_defects', {
      p_company_id: companyId,
      p_branch_id: branchId && branchId !== 'all' ? branchId : null,
    }),
  ]);

  const rentalRows = rentalRpc.error ? [] : (rentalRpc.data as unknown[]) || [];
  const pendingRental = rentalRows.length;
  let openGlCorrectionCount = pendingRental;
  if (!hqSlApplied) openGlCorrectionCount += 1;

  return {
    hqSlApplied,
    hqSlEntryNo,
    pendingRentalLeakageCount: pendingRental,
    openGlCorrectionCount,
  };
}
