/**
 * Resolve user-visible reasons why Apply is disabled in RepairActionPanel.
 */

import { isValidRepairConfirmPhrase } from '@/app/lib/repairQueueDryRun';
import type { DryRunResult } from '@/app/lib/developerRepairTypes';

export type RepairApplyBlockReasonCode =
  | 'dry_run_not_completed'
  | 'dry_run_not_eligible'
  | 'confirm_phrase_mismatch'
  | 'confirm_phrase_required'
  | 'role_cannot_apply'
  | 'applying_in_progress'
  | 'migration_missing'
  | 'gl_correction_apply_disabled'
  | 'unknown_action';

export interface RepairApplyBlockReason {
  code: RepairApplyBlockReasonCode;
  message: string;
}

export interface ResolveRepairApplyBlockInput {
  canApply: boolean;
  dryRun: DryRunResult | null;
  confirmPhrase: string;
  expectedPhrase: string;
  applying: boolean;
  actionKnown?: boolean;
  actionRequiresRelinkRpc?: boolean;
  relinkRpcAvailable?: boolean;
  actionRequiresGlCorrectionRpc?: boolean;
  glCorrectionRpcAvailable?: boolean;
}

const PAYMENT_RELINK_ACTION_ID = 'payment.relink_payment_to_journal';
const GL_CORRECTION_ACTION_ID = 'gl.create_correction_draft';

export function actionRequiresRelinkRpc(actionId: string): boolean {
  return actionId === PAYMENT_RELINK_ACTION_ID;
}

export function actionRequiresGlCorrectionRpc(actionId: string): boolean {
  return actionId === GL_CORRECTION_ACTION_ID;
}

export function resolveRepairApplyBlockReasons(
  input: ResolveRepairApplyBlockInput
): { blocked: boolean; reasons: RepairApplyBlockReason[] } {
  const reasons: RepairApplyBlockReason[] = [];

  if (input.actionKnown === false) {
    reasons.push({
      code: 'unknown_action',
      message: 'Unknown repair action — cannot apply',
    });
  }

  if (input.actionRequiresRelinkRpc && input.relinkRpcAvailable === false) {
    reasons.push({
      code: 'migration_missing',
      message:
        'Payment relink RPC missing — apply migration migrations/20260606130000_developer_repair_relink_payment_je.sql',
    });
  }

  if (input.actionRequiresGlCorrectionRpc && input.glCorrectionRpcAvailable === false) {
    reasons.push({
      code: 'gl_correction_apply_disabled',
      message:
        'GL correction apply disabled — requires migration RPC create_gl_correction_journal. Dry-run preview is available.',
    });
  }

  if (input.applying) {
    reasons.push({
      code: 'applying_in_progress',
      message: 'Apply in progress…',
    });
  }

  if (!input.canApply) {
    reasons.push({
      code: 'role_cannot_apply',
      message: 'Apply requires super-admin or developer role (dry-run only for your role)',
    });
  }

  if (!input.dryRun) {
    reasons.push({
      code: 'dry_run_not_completed',
      message: 'Run dry-run first to load before/after preview',
    });
  } else if (!input.dryRun.ok) {
    reasons.push({
      code: 'dry_run_not_eligible',
      message: input.dryRun.blockedReason || 'Action not eligible anymore — re-run dry-run or remove from queue',
    });
  } else {
    const phrase = input.confirmPhrase.trim();
    if (!phrase) {
      reasons.push({
        code: 'confirm_phrase_required',
        message: 'Enter the exact confirm phrase shown above',
      });
    } else if (!isValidRepairConfirmPhrase(phrase, input.expectedPhrase)) {
      reasons.push({
        code: 'confirm_phrase_mismatch',
        message: 'Confirm phrase does not match — copy exactly from the placeholder',
      });
    }
  }

  return { blocked: reasons.length > 0, reasons };
}
