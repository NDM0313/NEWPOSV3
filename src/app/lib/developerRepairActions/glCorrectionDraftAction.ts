/**
 * GL correction draft repair action — dry-run preview; apply via create_gl_correction_journal RPC.
 */

import type { ApplyResult, DeveloperRepairAction, DeveloperRepairContext, DryRunResult } from '@/app/lib/developerRepairTypes';
import {
  buildGlCorrectionDraftDryRun,
  GL_CORRECTION_CONFIRM_PHRASE,
  isRental1100LeakageDefectId,
  knownOrphanDefectById,
} from '@/app/lib/glCorrectionDraftRepair';
import { fetchRentalLeakageDraftPreviewFromServer } from '@/app/lib/arControlOrphanRepair';
import { applyGlCorrectionJournalRpc } from '@/app/services/glCorrectionApplyService';

async function resolveDefectForDryRun(
  defectId: string,
  ctx: DeveloperRepairContext
): Promise<{ preview: ReturnType<typeof buildGlCorrectionDraftDryRun> | null; blockedReason?: string }> {
  const known = knownOrphanDefectById(defectId);
  if (known) {
    return { preview: buildGlCorrectionDraftDryRun(known) };
  }
  if (isRental1100LeakageDefectId(defectId)) {
    const preview = await fetchRentalLeakageDraftPreviewFromServer(ctx.companyId, defectId);
    if (!preview) {
      return {
        preview: null,
        blockedReason: `Rental leakage defect not found or already corrected: ${defectId}`,
      };
    }
    return { preview };
  }
  return { preview: null, blockedReason: `Unknown defect id: ${defectId || '(missing)'}` };
}

async function dryRunGlCorrectionDraft(
  params: Record<string, unknown>,
  ctx: DeveloperRepairContext
): Promise<DryRunResult> {
  const defectId = String(params.defectId || '');
  const { preview, blockedReason } = await resolveDefectForDryRun(defectId, ctx);
  if (!preview) {
    return {
      ok: false,
      dryRunHash: '',
      before: {},
      afterPreview: {},
      blockedReason: blockedReason || `Unknown defect id: ${defectId || '(missing)'}`,
    };
  }

  return {
    ok: preview.ok,
    dryRunHash: preview.dryRunHash,
    before: preview.before,
    afterPreview: preview.afterPreview,
    blockedReason: preview.ok ? undefined : preview.blockedApplyReason,
    targetTable: 'journal_entries',
    title: preview.title,
    impactSummary: preview.newCorrectionJePreview.description,
  };
}

async function applyGlCorrectionDraft(
  params: Record<string, unknown>,
  ctx: DeveloperRepairContext,
  dryRunHash: string
): Promise<ApplyResult> {
  const defectId = String(params.defectId || '');
  const confirmPhrase = String(params.confirmPhrase || '');
  const result = await applyGlCorrectionJournalRpc({
    companyId: ctx.companyId,
    repairTarget: defectId,
    dryRunHash,
    confirmPhrase,
    userId: ctx.userId,
  });

  if (!result.ok) {
    return { ok: false, error: result.error || 'GL correction apply failed' };
  }

  return {
    ok: true,
    auditId: result.auditId,
    after: result.after,
    message: `Created correction ${result.entryNo || result.journalEntryId || 'JE'} — existing JEs unchanged`,
  };
}

export const glCreateCorrectionDraftAction: DeveloperRepairAction = {
  id: 'gl.create_correction_draft',
  title: 'Create GL correction draft (additive JE)',
  description:
    'Previews a new balanced correction JE for orphan party AR defects and rental 1100 leakage. Does not edit existing JEs.',
  riskLevel: 'high',
  requiredRole: 'super-admin',
  confirmPhrase: GL_CORRECTION_CONFIRM_PHRASE,
  whatItChanges: ['New additive correction journal entry (when RPC approved)', 'developer_repair_audit row'],
  whatItNeverChanges: [
    'Existing posted journal entry lines',
    'Hard-delete of posted records',
    'Broad AR/AP reverse/repost',
  ],
  dryRun: dryRunGlCorrectionDraft,
  apply: applyGlCorrectionDraft,
  auditPayload: (b, a) => ({ before: b, after: a }),
  rollbackNote: 'Void the new correction JE via manual journal cancel policy — never delete posted rows',
};

export const GL_CORRECTION_REPAIR_ACTIONS = [glCreateCorrectionDraftAction];

export { resolveDefectForDryRun };
