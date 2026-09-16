/**
 * Numbering sequence sync repair action (Phase F1).
 */

import { computeDryRunHash } from '@/app/lib/developerRepairHash';
import { SAFE_SEQUENCE_SYNC_CONFIRM_PHRASE } from '@/app/lib/repairQueueDryRun';
import type { ApplyResult, DeveloperRepairAction, DeveloperRepairContext, DryRunResult } from '@/app/lib/developerRepairTypes';
import { numberingMaintenanceService } from '@/app/services/numberingMaintenanceService';

async function dryRunSequenceSync(
  params: Record<string, unknown>,
  ctx: DeveloperRepairContext
): Promise<DryRunResult> {
  const documentType = String(params.documentType || '').trim().toUpperCase();
  if (!documentType) {
    return {
      ok: false,
      dryRunHash: '',
      before: {},
      afterPreview: {},
      blockedReason: 'documentType is required',
    };
  }

  const { rows } = await numberingMaintenanceService.analyze(ctx.companyId);
  const row = rows.find((r) => r.document_type.toUpperCase() === documentType);
  if (!row) {
    return {
      ok: false,
      dryRunHash: '',
      before: {},
      afterPreview: {},
      blockedReason: `Unknown document type: ${documentType}`,
    };
  }

  const before = {
    documentType: row.document_type,
    label: row.label,
    sequenceLast: row.sequence_last,
    databaseMax: row.database_max,
    effectiveMax: row.effective_max,
    status: row.status,
  };

  const afterPreview =
    row.status === 'out_of_sync'
      ? {
          ...before,
          sequenceLast: row.effective_max,
          status: 'ok',
          previewAction: `Would sync erp_document_sequences.last_number → ${row.effective_max} (never decreases)`,
        }
      : {
          ...before,
          previewAction: 'No sequence sync needed — already in sync',
        };

  const ok = row.status === 'out_of_sync';
  const dryRunHash = computeDryRunHash('numbering.sync_sequence_to_effective_max', params, before);

  return {
    ok,
    dryRunHash,
    before,
    afterPreview,
    blockedReason: ok ? undefined : 'Sequence already in sync',
    targetTable: 'erp_document_sequences',
    targetId: row.document_type,
    title: `Sync ${row.label} sequence`,
    impactSummary: ok
      ? `Updates sequence counter to ${row.effective_max} without decreasing`
      : 'No change',
  };
}

async function applySequenceSync(
  params: Record<string, unknown>,
  ctx: DeveloperRepairContext,
  dryRunHash: string
): Promise<ApplyResult> {
  const fresh = await dryRunSequenceSync(params, ctx);
  if (fresh.dryRunHash !== dryRunHash) {
    return { ok: false, error: 'Dry-run hash mismatch — re-run dry-run before apply' };
  }
  if (!fresh.ok) {
    return { ok: false, error: fresh.blockedReason || 'Repair not eligible' };
  }

  const documentType = String(params.documentType || '');
  const res = await numberingMaintenanceService.syncToEffectiveMax(ctx.companyId, documentType);
  if (!res.success) {
    return { ok: false, error: res.error || res.message || 'Sequence sync failed' };
  }

  const afterDry = await dryRunSequenceSync(params, ctx);
  return {
    ok: true,
    message: res.message,
    after: afterDry.afterPreview,
  };
}

export const numberingSyncSequenceAction: DeveloperRepairAction = {
  id: 'numbering.sync_sequence_to_effective_max',
  title: 'Sync document sequence to effective max',
  description:
    'Updates erp_document_sequences.last_number to match DB max when out of sync. Never decreases counters.',
  riskLevel: 'low',
  requiredRole: 'super-admin',
  confirmPhrase: SAFE_SEQUENCE_SYNC_CONFIRM_PHRASE,
  whatItChanges: ['erp_document_sequences.last_number for one document type'],
  whatItNeverChanges: [
    'Sales, purchases, payments, or journal entries',
    'GL lines or amounts',
    'Document reference numbers on existing rows',
  ],
  dryRun: dryRunSequenceSync,
  apply: applySequenceSync,
  auditPayload: (before, after) => ({ before, after, repair: 'sequence_sync' }),
  rollbackNote:
    'Restore erp_document_sequences.last_number from before_json.sequenceLast if a mistaken sync occurred.',
};
