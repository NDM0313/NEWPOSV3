/**
 * AR control orphan detection — safe scope only (not blanket 1100 vs AR-CUS* reconcile).
 */

import {
  buildGlCorrectionDraftDryRun,
  buildRental1100LeakageDryRun,
  KNOWN_ORPHAN_AR_DEFECTS,
  type GlCorrectionDraftDryRun,
  type OrphanArReversalDefectInput,
} from '@/app/lib/glCorrectionDraftRepair';
import { supabase } from '@/lib/supabase';

export type ArControlDiagnosticSnapshot = {
  controlAccountCode: string;
  glAccountBalance: number | null;
  partyAttributedGlSum: number | null;
  unmappedGlResidual: number | null;
  unmappedNote?: string;
  unmappedByReference: Array<{ referenceType: string; amount: number }>;
};

export type Rental1100LeakageDefect = {
  defectId: string;
  journalEntryLineId: string;
  journalEntryId: string;
  entryNo: string;
  entryDate: string;
  contactId: string;
  customerName: string;
  partyArAccountId: string;
  partyArAccountCode: string;
  amount: number;
  direction: 'debit_on_control' | 'credit_on_control';
  referenceType: string;
  sourceLabel: string;
  fingerprint: string;
};

const HQ_SL_0003_FINGERPRINT = 'developer_repair:gl_correction:hq-sl-0003-orphan-ar';

/** Known whitelisted orphan defects (HQ-SL-0003 class). */
export function listKnownOrphanArDefects(): OrphanArReversalDefectInput[] {
  return [...KNOWN_ORPHAN_AR_DEFECTS];
}

export function orphanDefectToHybridId(defectId: string): string {
  return `orphan-ar:${defectId}`;
}

export function hybridIdToOrphanDefectId(hybridId: string): string | null {
  const prefix = 'orphan-ar:';
  if (!hybridId.startsWith(prefix)) return null;
  return hybridId.slice(prefix.length) || null;
}

export { isRental1100LeakageDefectId } from '@/app/lib/glCorrectionDraftRepair';

export async function isGlCorrectionFingerprintApplied(
  companyId: string,
  fingerprint: string
): Promise<boolean> {
  const { data } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('company_id', companyId)
    .eq('action_fingerprint', fingerprint)
    .eq('is_void', false)
    .maybeSingle();
  return !!(data as { id?: string } | null)?.id;
}

export async function isOrphanDefectAlreadyApplied(
  companyId: string,
  defectId: string
): Promise<boolean> {
  const fingerprint =
    defectId === 'hq-sl-0003-orphan-ar'
      ? HQ_SL_0003_FINGERPRINT
      : `developer_repair:gl_correction:${defectId}`;
  return isGlCorrectionFingerprintApplied(companyId, fingerprint);
}

export async function detectRental1100LeakageDefects(
  companyId: string,
  branchId?: string | null
): Promise<Rental1100LeakageDefect[]> {
  const { data, error } = await supabase.rpc('list_rental_1100_leakage_defects', {
    p_company_id: companyId,
    p_branch_id: branchId && branchId !== 'all' ? branchId : null,
  });
  if (error) {
    console.warn('[arControlOrphanRepair] list_rental_1100_leakage_defects:', error.message);
    return [];
  }
  return (data || []).map((row: Record<string, unknown>) => ({
    defectId: String(row.defect_id || ''),
    journalEntryLineId: String(row.journal_entry_line_id || ''),
    journalEntryId: String(row.journal_entry_id || ''),
    entryNo: String(row.entry_no || ''),
    entryDate: String(row.entry_date || ''),
    contactId: String(row.contact_id || ''),
    customerName: String(row.customer_name || 'Customer'),
    partyArAccountId: String(row.party_ar_account_id || ''),
    partyArAccountCode: String(row.party_ar_account_code || ''),
    amount: Number(row.amount) || 0,
    direction: (row.direction === 'credit_on_control' ? 'credit_on_control' : 'debit_on_control') as
      | 'debit_on_control'
      | 'credit_on_control',
    referenceType: String(row.reference_type || ''),
    sourceLabel: String(row.source_label || ''),
    fingerprint: String(row.fingerprint || ''),
  }));
}

export function rentalLeakageToOrphanInput(defect: Rental1100LeakageDefect): OrphanArReversalDefectInput {
  return {
    defectId: defect.defectId,
    saleInvoiceNo: defect.sourceLabel,
    saleJeNo: defect.entryNo,
    reversalJeNo: defect.entryNo,
    partyArAccountCode: defect.partyArAccountCode,
    wrongCreditAccountCode: '1100',
    orphanAmount: defect.amount,
    direction: defect.direction,
    sourceLineId: defect.journalEntryLineId,
    sourceEntryNo: defect.entryNo,
    sourceJeId: defect.journalEntryId,
    customerName: defect.customerName,
    contactId: defect.contactId,
  };
}

export { knownOrphanDefectById } from '@/app/lib/glCorrectionDraftRepair';

export function buildOrphanArDraftPreview(defectId: string): GlCorrectionDraftDryRun | null {
  const defect = knownOrphanDefectById(defectId);
  if (!defect) return null;
  return buildGlCorrectionDraftDryRun(defect);
}

export function buildRentalLeakageDraftPreview(defect: Rental1100LeakageDefect): GlCorrectionDraftDryRun {
  return buildRental1100LeakageDryRun(rentalLeakageToOrphanInput(defect));
}

export type RentalLeakageServerDryRun = {
  ok: boolean;
  defectId?: string;
  before?: Record<string, unknown>;
  dryRunHash?: string;
  error?: string;
};

/** Server-authoritative dry-run — hash matches create_gl_correction_journal apply verify. */
export async function fetchRentalLeakageDryRunFromServer(
  companyId: string,
  defectId: string
): Promise<RentalLeakageServerDryRun> {
  const { data, error } = await supabase.rpc('get_rental_leakage_gl_correction_dry_run', {
    p_company_id: companyId,
    p_defect_id: defectId,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  const row = data as Record<string, unknown> | null;
  if (!row?.ok) {
    return { ok: false, error: String(row?.error || 'Server dry-run failed') };
  }
  return {
    ok: true,
    defectId: String(row.defectId || defectId),
    before: row.before as Record<string, unknown>,
    dryRunHash: String(row.dryRunHash || ''),
  };
}

export function mapServerRentalDryRunToPreview(server: RentalLeakageServerDryRun): GlCorrectionDraftDryRun | null {
  if (!server.ok || !server.before || !server.dryRunHash) return null;

  const before = server.before;
  const defectId = String(before.defectId || server.defectId || '');
  const correctionLines = (before.correctionLines as GlCorrectionDraftDryRun['expectedCorrectionLines']) || [];
  const originalWrongRows = (before.originalWrongRows as GlCorrectionDraftDryRun['originalWrongRows']) || [];
  const party = String(before.partyArAccountCode || '');
  const sourceLabel = String(before.sourceLabel || '');
  const sourceEntryNo = String(before.sourceEntryNo || '');
  const amt = Number(before.orphanAmount) || 0;
  const totalDebit = correctionLines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const totalCredit = correctionLines.reduce((s, l) => s + Number(l.credit || 0), 0);

  const afterPreview: Record<string, unknown> = {
    ...before,
    newCorrectionJe: { referenceType: 'gl_correction', lines: correctionLines, totalDebit, totalCredit },
    note: `Additive correction for rental 1100 leakage — source line ${before.sourceLineId || ''} unchanged`,
  };

  return {
    ok: true,
    defectId,
    title: `GL correction — rental 1100 leakage ${sourceLabel} → ${party}`,
    riskLevel: 'high',
    blockedApplyReason:
      'Requires create_gl_correction_journal RPC on database. Run dry-run, then apply with confirm phrase when RPC is deployed.',
    originalWrongRows,
    expectedCorrectionLines: correctionLines,
    newCorrectionJePreview: {
      referenceType: 'gl_correction',
      description: `Correction: rental 1100 leakage — ${sourceEntryNo} → ${party}`,
      lines: correctionLines,
      totalDebit,
      totalCredit,
      balanced: Math.abs(totalDebit - totalCredit) < 0.01,
    },
    balances: {
      rawGlPartyBefore: amt,
      rawGlPartyAfter: amt,
      normalStatementBefore: 0,
      normalStatementAfter: 0,
      auditImpact: 'New correction JE re-routes AR from 1100 control to party sub-ledger; source JE unchanged',
    },
    dryRunHash: server.dryRunHash,
    before,
    afterPreview,
  };
}

export async function fetchRentalLeakageDraftPreviewFromServer(
  companyId: string,
  defectId: string
): Promise<GlCorrectionDraftDryRun | null> {
  const server = await fetchRentalLeakageDryRunFromServer(companyId, defectId);
  return mapServerRentalDryRunToPreview(server);
}

export function formatControlDiagnosticTitle(snapshot: ArControlDiagnosticSnapshot): string {
  const residual = snapshot.unmappedGlResidual;
  if (residual == null) return `COA diagnostic: control 1100 header vs party subtree — unavailable`;
  return `COA diagnostic: control 1100 vs party subtree — ${residual >= 0 ? 'Dr' : 'Cr'} ${Math.abs(residual).toLocaleString()} (not a repair target)`;
}

export function isControlDiagnosticOnly(unmappedGlResidual: number | null): boolean {
  if (unmappedGlResidual == null) return true;
  return Math.abs(unmappedGlResidual) < 0.01;
}
