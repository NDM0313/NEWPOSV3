/**
 * GL correction draft repair action — dry-run preview; apply blocked until RPC migration.
 */

import type { ApplyResult, DeveloperRepairAction, DeveloperRepairContext, DryRunResult } from '@/app/lib/developerRepairTypes';
import {
  buildGlCorrectionDraftDryRun,
  GL_CORRECTION_CONFIRM_PHRASE,
  knownOrphanDefectById,
} from '@/app/lib/glCorrectionDraftRepair';

async function dryRunGlCorrectionDraft(
  params: Record<string, unknown>,
  _ctx: DeveloperRepairContext
): Promise<DryRunResult> {
  const defectId = String(params.defectId || '');
  const defect = knownOrphanDefectById(defectId);
  if (!defect) {
    return {
      ok: false,
      dryRunHash: '',
      before: {},
      afterPreview: {},
      blockedReason: `Unknown defect id: ${defectId || '(missing)'}`,
    };
  }

  const preview = buildGlCorrectionDraftDryRun(defect);
  return {
    ok: preview.ok,
    dryRunHash: preview.dryRunHash,
    before: preview.before,
    afterPreview: preview.afterPreview,
    blockedReason: preview.blockedApplyReason,
    targetTable: 'journal_entries',
    title: preview.title,
    impactSummary: preview.blockedApplyReason,
  };
}

async function applyGlCorrectionDraft(
  _params: Record<string, unknown>,
  _ctx: DeveloperRepairContext,
  _dryRunHash: string
): Promise<ApplyResult> {
  return {
    ok: false,
    error:
      'GL correction apply blocked — requires migration RPC create_gl_correction_journal. Dry-run preview only.',
  };
}

export const glCreateCorrectionDraftAction: DeveloperRepairAction = {
  id: 'gl.create_correction_draft',
  title: 'Create GL correction draft (additive JE)',
  description:
    'Previews a new balanced correction JE for orphan party AR defects (JE-0161 class). Does not edit existing JEs.',
  riskLevel: 'high',
  requiredRole: 'super-admin',
  confirmPhrase: GL_CORRECTION_CONFIRM_PHRASE,
  whatItChanges: ['New additive correction journal entry (when RPC approved)', 'developer_repair_audit row'],
  whatItNeverChanges: [
    'Existing JE-0160 / JE-0161 / JE-0168 rows',
    'Hard-delete of posted records',
    'Broad AR/AP reverse/repost',
  ],
  dryRun: dryRunGlCorrectionDraft,
  apply: applyGlCorrectionDraft,
  auditPayload: (b, a) => ({ before: b, after: a }),
  rollbackNote: 'Void the new correction JE via manual journal cancel policy — never delete posted rows',
};

export const GL_CORRECTION_REPAIR_ACTIONS = [glCreateCorrectionDraftAction];
