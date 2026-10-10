/**
 * Developer Center controlled repair orchestrator (Phase F).
 */

import { canApplyDeveloperRepair } from '@/app/lib/developerAccountingAccess';
import {
  getDeveloperRepairAction,
  resolveConfirmPhrase,
  type ApplyResult,
  type DeveloperRepairContext,
  type DryRunResult,
} from '@/app/lib/developerRepairActions';
import { isValidRepairConfirmPhrase } from '@/app/lib/repairQueueDryRun';
import { supabase } from '@/lib/supabase';

export type { DeveloperRepairContext, DryRunResult, ApplyResult };

async function writeRepairAudit(params: {
  companyId: string;
  userId: string | null;
  actionId: string;
  riskLevel: string;
  targetTable?: string;
  targetId?: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  dryRunHash: string;
  confirmPhrase: string;
  status: 'success' | 'failed';
  errorMessage?: string;
}): Promise<string | undefined> {
  const { data, error } = await supabase
    .from('developer_repair_audit')
    .insert({
      company_id: params.companyId,
      user_id: params.userId,
      action_id: params.actionId,
      risk_level: params.riskLevel,
      target_table: params.targetTable ?? null,
      target_id: params.targetId ?? null,
      before_json: params.before,
      after_json: params.after,
      dry_run_hash: params.dryRunHash,
      confirm_phrase: params.confirmPhrase,
      status: params.status,
      error_message: params.errorMessage ?? null,
    })
    .select('id')
    .single();

  if (error) {
    if (import.meta.env?.DEV) {
      console.warn('[developerRepairService] audit insert failed:', error.message);
    }
    return undefined;
  }
  return (data as { id?: string } | null)?.id;
}

export async function runDeveloperRepairDryRun(
  actionId: string,
  params: Record<string, unknown>,
  ctx: DeveloperRepairContext
): Promise<DryRunResult> {
  const action = getDeveloperRepairAction(actionId);
  if (!action) {
    return {
      ok: false,
      dryRunHash: '',
      before: {},
      afterPreview: {},
      blockedReason: `Unknown repair action: ${actionId}`,
    };
  }
  return action.dryRun(params, ctx);
}

export async function applyDeveloperRepair(
  actionId: string,
  params: Record<string, unknown>,
  dryRunHash: string,
  confirmPhrase: string,
  ctx: DeveloperRepairContext
): Promise<ApplyResult> {
  const action = getDeveloperRepairAction(actionId);
  if (!action) {
    return { ok: false, error: `Unknown repair action: ${actionId}` };
  }

  if (!canApplyDeveloperRepair(ctx.userRole)) {
    return { ok: false, error: 'Apply requires super-admin or developer role' };
  }

  const expectedPhrase = resolveConfirmPhrase(action, params);
  if (!isValidRepairConfirmPhrase(confirmPhrase, expectedPhrase)) {
    return { ok: false, error: `Confirm phrase must match exactly: ${expectedPhrase}` };
  }

  const dryRun = await action.dryRun(params, ctx);
  if (!dryRun.ok) {
    await writeRepairAudit({
      companyId: ctx.companyId,
      userId: ctx.userId,
      actionId: action.id,
      riskLevel: action.riskLevel,
      targetTable: dryRun.targetTable,
      targetId: dryRun.targetId,
      before: dryRun.before,
      after: dryRun.afterPreview,
      dryRunHash,
      confirmPhrase,
      status: 'failed',
      errorMessage: dryRun.blockedReason || 'Dry-run not eligible',
    });
    return { ok: false, error: dryRun.blockedReason || 'Dry-run not eligible' };
  }

  if (dryRun.dryRunHash !== dryRunHash) {
    await writeRepairAudit({
      companyId: ctx.companyId,
      userId: ctx.userId,
      actionId: action.id,
      riskLevel: action.riskLevel,
      targetTable: dryRun.targetTable,
      targetId: dryRun.targetId,
      before: dryRun.before,
      after: dryRun.afterPreview,
      dryRunHash,
      confirmPhrase,
      status: 'failed',
      errorMessage: 'Dry-run hash mismatch — re-run dry-run',
    });
    return { ok: false, error: 'Dry-run hash mismatch — re-run dry-run before apply' };
  }

  let applyResult: ApplyResult;
  try {
    applyResult = await action.apply({ ...params, confirmPhrase }, ctx, dryRunHash);
  } catch (e) {
    applyResult = { ok: false, error: e instanceof Error ? e.message : 'Apply failed' };
  }

  const after = applyResult.after || dryRun.afterPreview;
  const auditBefore = dryRun.before;
  const auditAfter = applyResult.ok ? after : { ...dryRun.afterPreview, error: applyResult.error };

  let auditId = applyResult.auditId;
  if (actionId !== 'gl.create_correction_draft') {
    auditId = await writeRepairAudit({
      companyId: ctx.companyId,
      userId: ctx.userId,
      actionId: action.id,
      riskLevel: action.riskLevel,
      targetTable: dryRun.targetTable,
      targetId: dryRun.targetId,
      before: auditBefore,
      after: auditAfter,
      dryRunHash,
      confirmPhrase,
      status: applyResult.ok ? 'success' : 'failed',
      errorMessage: applyResult.error,
    });
  } else if (!auditId && !applyResult.ok) {
    auditId = await writeRepairAudit({
      companyId: ctx.companyId,
      userId: ctx.userId,
      actionId: action.id,
      riskLevel: action.riskLevel,
      targetTable: dryRun.targetTable,
      targetId: dryRun.targetId,
      before: auditBefore,
      after: auditAfter,
      dryRunHash,
      confirmPhrase,
      status: 'failed',
      errorMessage: applyResult.error,
    });
  }

  return { ...applyResult, auditId };
}

/** Thin wrapper for legacy sequence sync call sites. */
export async function applySafeSequenceSyncViaRegistry(
  companyId: string,
  documentType: string,
  confirmPhrase: string,
  ctx: Omit<DeveloperRepairContext, 'companyId'>
): Promise<ApplyResult> {
  const params = { documentType };
  const dryRun = await runDeveloperRepairDryRun(
    'numbering.sync_sequence_to_effective_max',
    params,
    { companyId, ...ctx }
  );
  if (!dryRun.ok) {
    return { ok: false, error: dryRun.blockedReason || 'Not eligible for sync' };
  }
  return applyDeveloperRepair(
    'numbering.sync_sequence_to_effective_max',
    params,
    dryRun.dryRunHash,
    confirmPhrase,
    { companyId, ...ctx }
  );
}
