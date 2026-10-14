/**
 * Roznamcha report-only repair action (Phase F4) — no DB write on apply.
 */

import { computeDryRunHash } from '@/app/lib/developerRepairHash';
import type { ApplyResult, DeveloperRepairAction, DeveloperRepairContext, DryRunResult } from '@/app/lib/developerRepairTypes';

async function dryRunReportDuplicate(
  params: Record<string, unknown>,
  _ctx: DeveloperRepairContext
): Promise<DryRunResult> {
  const rowId = String(params.rowId || '');
  const winnerRef = String(params.winnerRef || '');
  const reason = String(params.reason || 'Report-level dedupe duplicate');
  if (!rowId) {
    return { ok: false, dryRunHash: '', before: {}, afterPreview: {}, blockedReason: 'rowId required' };
  }

  const before = { rowId, winnerRef, reason, reportOnly: true };
  const afterPreview = {
    ...before,
    recommendation: 'Fix dedupe at code level or confirm DB duplicate link before any data repair',
    applyAvailable: false,
  };

  return {
    ok: true,
    dryRunHash: computeDryRunHash('roznamcha.report_duplicate_source', params, before),
    before,
    afterPreview,
    targetTable: 'roznamcha_report',
    targetId: rowId,
    title: 'Report duplicate source (info only)',
    impactSummary: 'No database write — diagnostic only',
  };
}

async function applyReportDuplicate(
  params: Record<string, unknown>,
  ctx: DeveloperRepairContext,
  dryRunHash: string
): Promise<ApplyResult> {
  const fresh = await dryRunReportDuplicate(params, ctx);
  if (fresh.dryRunHash !== dryRunHash) return { ok: false, error: 'Dry-run hash mismatch' };
  return {
    ok: true,
    message: 'Duplicate reported — no data repair applied',
    after: fresh.afterPreview,
  };
}

export const roznamchaReportDuplicateAction: DeveloperRepairAction = {
  id: 'roznamcha.report_duplicate_source',
  title: 'Report duplicate Roznamcha source',
  description: 'Documents dedupe/report duplicate — no DB write unless confirmed DB link repair exists.',
  riskLevel: 'low',
  requiredRole: 'super-admin',
  confirmPhrase: (p) => `REPORT-DUP-${String(p.rowId || '').slice(0, 8)}`,
  whatItChanges: ['Audit log entry only when explicitly applied as review'],
  whatItNeverChanges: ['Payments rows', 'Rental payments', 'Journal entries', 'Cash movement'],
  dryRun: dryRunReportDuplicate,
  apply: applyReportDuplicate,
  auditPayload: (b, a) => ({ before: b, after: a, reportOnly: true }),
  rollbackNote: 'N/A — informational.',
};

export const ROZNAMCHA_REPAIR_ACTIONS = [roznamchaReportDuplicateAction];
