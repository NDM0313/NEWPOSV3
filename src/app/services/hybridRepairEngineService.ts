/**
 * Hybrid AR/AP repair engine — orchestrates safe repair candidates for Reconciliation Center.
 */

import { GL_CORRECTION_CONFIRM_PHRASE } from '@/app/lib/glCorrectionDraftRepair';
import {
  buildOrphanArDraftPreview,
  fetchRentalLeakageDraftPreviewFromServer,
  detectRental1100LeakageDefects,
  formatControlDiagnosticTitle,
  hybridIdToOrphanDefectId,
  isOrphanDefectAlreadyApplied,
  listKnownOrphanArDefects,
  orphanDefectToHybridId,
  type ArControlDiagnosticSnapshot,
} from '@/app/lib/arControlOrphanRepair';
import { resolveConfirmPhrase, getDeveloperRepairAction } from '@/app/lib/developerRepairActions';
import {
  applyDeveloperRepair,
  runDeveloperRepairDryRun,
  type DeveloperRepairContext,
} from '@/app/services/developerRepairService';
import { fetchControlAccountBreakdown } from '@/app/services/controlAccountBreakdownService';
import {
  dryRunExpensePaymentAmountRepair,
  listExpensePaymentRepairCandidates,
} from '@/app/services/expensePaymentSyncService';
import { supabase } from '@/lib/supabase';

import {
  filterAutoApplyCandidates,
  getHybridAutoFixEnabled,
  setHybridAutoFixEnabled,
  type HybridRepairBatchResult,
  type HybridRepairCandidate,
  type HybridRepairCategory,
  type HybridRepairRiskLevel,
} from '@/app/lib/hybridRepairEngineLogic';

export type {
  HybridRepairBatchResult,
  HybridRepairCandidate,
  HybridRepairCategory,
  HybridRepairRiskLevel,
} from '@/app/lib/hybridRepairEngineLogic';
export {
  filterAutoApplyCandidates,
  getHybridAutoFixEnabled,
  setHybridAutoFixEnabled,
} from '@/app/lib/hybridRepairEngineLogic';

async function loadArControlDiagnostic(
  companyId: string,
  branchId: string | null | undefined
): Promise<ArControlDiagnosticSnapshot | null> {
  const { data: acct } = await supabase
    .from('accounts')
    .select('id, code, name')
    .eq('company_id', companyId)
    .eq('code', '1100')
    .maybeSingle();

  if (!acct) return null;

  const breakdown = await fetchControlAccountBreakdown({
    companyId,
    branchId,
    accountId: String((acct as { id: string }).id),
    accountCode: '1100',
    accountName: String((acct as { name?: string }).name || 'Accounts Receivable'),
    controlKind: 'ar',
  });

  return {
    controlAccountCode: '1100',
    glAccountBalance: breakdown.glAccountBalance,
    partyAttributedGlSum: breakdown.partyAttributedGlSum,
    unmappedGlResidual: breakdown.unmappedGlResidual,
    unmappedNote: breakdown.unmappedNote,
    unmappedByReference: (breakdown.unmappedGlByReference || []).map((r) => ({
      referenceType: r.referenceType,
      amount: r.amount,
    })),
  };
}

export async function listHybridRepairCandidates(
  companyId: string,
  branchId: string | null | undefined,
  _asOfDate?: string
): Promise<HybridRepairCandidate[]> {
  const rows: HybridRepairCandidate[] = [];

  const diagnostic = await loadArControlDiagnostic(companyId, branchId);
  if (diagnostic && diagnostic.unmappedGlResidual != null && Math.abs(diagnostic.unmappedGlResidual) >= 0.01) {
    rows.push({
      id: 'control-unmapped:1100',
      category: 'control_unmapped_diagnostic',
      title: formatControlDiagnosticTitle(diagnostic),
      description:
        diagnostic.unmappedNote ||
        'Control 1100 account id (header) vs Σ party-attributed AR on full 1100 subtree. Structural COA display — not the same as receivables variance. Fix per-line rental rows below.',
      amount: Math.abs(diagnostic.unmappedGlResidual),
      riskLevel: 'medium',
      canAutoApply: false,
      canManualApply: false,
      diagnosticOnly: true,
      params: { diagnostic },
    });
    for (const bucket of diagnostic.unmappedByReference) {
      if (Math.abs(bucket.amount) < 0.01) continue;
      rows.push({
        id: `control-bucket:1100:${bucket.referenceType}`,
        category: 'control_unmapped_diagnostic',
        title: `1100 unmapped bucket: ${bucket.referenceType}`,
        description: `Net Dr−Cr on control 1100 for reference_type=${bucket.referenceType}. Review before any GL correction.`,
        amount: Math.abs(bucket.amount),
        riskLevel: 'medium',
        canAutoApply: false,
        canManualApply: false,
        diagnosticOnly: true,
        params: { referenceType: bucket.referenceType, amount: bucket.amount },
      });
    }
  }

  for (const defect of listKnownOrphanArDefects()) {
    const alreadyApplied = await isOrphanDefectAlreadyApplied(companyId, defect.defectId);
    if (alreadyApplied) continue;

    const preview = buildOrphanArDraftPreview(defect.defectId);
    const blocked = preview?.ok ? undefined : preview?.blockedApplyReason || 'Dry-run failed';
    rows.push({
      id: orphanDefectToHybridId(defect.defectId),
      category: 'orphan_ar_gl_correction',
      title: preview?.title || `Orphan AR — ${defect.saleInvoiceNo}`,
      description: `Additive JV: Dr ${defect.wrongCreditAccountCode} / Cr ${defect.partyArAccountCode} Rs ${defect.orphanAmount}`,
      amount: defect.orphanAmount,
      riskLevel: 'high',
      canAutoApply: preview?.ok === true,
      canManualApply: preview?.ok === true,
      blockedReason: blocked,
      repairActionId: 'gl.create_correction_draft',
      confirmPhrase: GL_CORRECTION_CONFIRM_PHRASE,
      params: { defectId: defect.defectId },
    });
  }

  const rentalDefects = await detectRental1100LeakageDefects(companyId, branchId);
  for (const defect of rentalDefects) {
    const alreadyApplied = await isOrphanDefectAlreadyApplied(companyId, defect.defectId);
    if (alreadyApplied) continue;

    const preview = await fetchRentalLeakageDraftPreviewFromServer(companyId, defect.defectId);
    const dirLabel = defect.direction === 'debit_on_control' ? 'Dr' : 'Cr';
    rows.push({
      id: orphanDefectToHybridId(defect.defectId),
      category: 'orphan_ar_gl_correction',
      title: `Rental 1100 leakage — ${defect.sourceLabel} (${defect.customerName})`,
      description: `${dirLabel} 1100 Rs ${defect.amount.toLocaleString()} → re-route to ${defect.partyArAccountCode} (${defect.entryNo})`,
      amount: defect.amount,
      riskLevel: 'high',
      canAutoApply: preview?.ok === true,
      canManualApply: preview?.ok === true,
      blockedReason: preview?.ok
        ? undefined
        : preview?.blockedApplyReason || 'Server dry-run unavailable — apply migration 20260618160000',
      repairActionId: 'gl.create_correction_draft',
      confirmPhrase: GL_CORRECTION_CONFIRM_PHRASE,
      params: {
        defectId: defect.defectId,
        journalEntryId: defect.journalEntryId,
        entryNo: defect.entryNo,
        journalEntryLineId: defect.journalEntryLineId,
        contactId: defect.contactId,
        customerName: defect.customerName,
      },
    });
  }

  const expenseRows = await listExpensePaymentRepairCandidates(companyId);
  for (const exp of expenseRows) {
    const mismatchAmt = Math.abs(exp.expenseAmount - (exp.paymentAmount ?? 0));
    rows.push({
      id: `expense-sync:${exp.expenseId}`,
      category: 'expense_payment_sync',
      title: `Expense/payment mismatch — ${exp.expenseNo}`,
      description: exp.paymentRef
        ? `${exp.paymentRef}: payment Rs ${(exp.paymentAmount ?? 0).toLocaleString()} vs expense/JE Rs ${exp.jeLiquidityAmount.toLocaleString()}`
        : `Stale payments.amount — Roznamcha reads payment row`,
      amount: mismatchAmt,
      riskLevel: 'low',
      canAutoApply: exp.canApplyRepair,
      canManualApply: exp.canApplyRepair,
      blockedReason: exp.canApplyRepair ? undefined : exp.blockReason,
      repairActionId: 'expense.sync_linked_payment_amount',
      params: { expenseId: exp.expenseId, expenseNo: exp.expenseNo },
    });
  }

  return rows.sort((a, b) => {
    const order: Record<HybridRepairCategory, number> = {
      orphan_ar_gl_correction: 0,
      expense_payment_sync: 1,
      control_unmapped_diagnostic: 2,
    };
    return order[a.category] - order[b.category] || Math.abs(b.amount) - Math.abs(a.amount);
  });
}

export async function dryRunHybridRepairCandidate(
  candidate: HybridRepairCandidate,
  ctx: DeveloperRepairContext
): Promise<{ ok: boolean; dryRunHash?: string; before?: Record<string, unknown>; afterPreview?: Record<string, unknown>; blockedReason?: string }> {
  if (candidate.diagnosticOnly) {
    return { ok: false, blockedReason: 'Diagnostic only — no apply path' };
  }
  if (!candidate.repairActionId) {
    return { ok: false, blockedReason: 'No repair action configured' };
  }

  if (candidate.category === 'expense_payment_sync') {
    const expenseId = String(candidate.params.expenseId || candidate.params.expenseNo || '');
    const dry = await dryRunExpensePaymentAmountRepair(ctx.companyId, expenseId);
    return {
      ok: dry.ok,
      dryRunHash: dry.dryRunHash,
      before: dry.snapshot
        ? {
            expenseNo: dry.snapshot.expenseNo,
            paymentAmount: dry.mismatch?.paymentAmount,
            jeLiquidityAmount: dry.mismatch?.jeLiquidityAmount,
          }
        : {},
      afterPreview: dry.mismatch ? { paymentAmount: dry.mismatch.proposedAfterAmount } : {},
      blockedReason: dry.ok ? undefined : dry.mismatch?.blockReason,
    };
  }

  const dry = await runDeveloperRepairDryRun(candidate.repairActionId, candidate.params, ctx);
  return {
    ok: dry.ok,
    dryRunHash: dry.dryRunHash,
    before: dry.before,
    afterPreview: dry.afterPreview,
    blockedReason: dry.blockedReason,
  };
}

export async function applyHybridRepairCandidate(
  candidate: HybridRepairCandidate,
  ctx: DeveloperRepairContext,
  options: { dryRunHash: string; confirmPhrase?: string }
): Promise<{ ok: boolean; message?: string; error?: string }> {
  if (candidate.diagnosticOnly) {
    return { ok: false, error: 'Diagnostic only' };
  }
  if (!candidate.canManualApply) {
    return { ok: false, error: candidate.blockedReason || 'Apply not allowed' };
  }

  if (candidate.category === 'expense_payment_sync') {
    const expenseId = String(candidate.params.expenseId || candidate.params.expenseNo || '');
    const action = getDeveloperRepairAction('expense.sync_linked_payment_amount');
    const phrase = action
      ? resolveConfirmPhrase(action, candidate.params)
      : `SYNC-EXPENSE-PAY-${expenseId.slice(0, 8)}`;
    const result = await applyDeveloperRepair(
      'expense.sync_linked_payment_amount',
      candidate.params,
      options.dryRunHash,
      options.confirmPhrase ?? phrase,
      ctx
    );
    return result.ok
      ? { ok: true, message: result.message || 'Payment amount synced' }
      : { ok: false, error: result.error };
  }

  if (candidate.category === 'orphan_ar_gl_correction') {
    const phrase = options.confirmPhrase?.trim() || GL_CORRECTION_CONFIRM_PHRASE;
    const result = await applyDeveloperRepair(
      'gl.create_correction_draft',
      candidate.params,
      options.dryRunHash,
      phrase,
      ctx
    );
    return result.ok
      ? { ok: true, message: result.message || 'GL correction posted' }
      : { ok: false, error: result.error };
  }

  return { ok: false, error: 'Unknown repair category' };
}

export type HybridRepairBatchProgress = {
  done: number;
  total: number;
  candidateId: string;
  title: string;
};

export async function runBatchHybridRepair(
  candidates: HybridRepairCandidate[],
  ctx: DeveloperRepairContext,
  options?: { onProgress?: (progress: HybridRepairBatchProgress) => void }
): Promise<HybridRepairBatchResult> {
  const result: HybridRepairBatchResult = { applied: [], skipped: [], errors: [] };
  const eligible = filterAutoApplyCandidates(candidates);
  const total = eligible.length;
  let done = 0;

  for (const candidate of eligible) {
    options?.onProgress?.({ done, total, candidateId: candidate.id, title: candidate.title });

    const dry = await dryRunHybridRepairCandidate(candidate, ctx);
    if (!dry.ok || !dry.dryRunHash) {
      result.skipped.push({
        id: candidate.id,
        reason: dry.blockedReason || 'Dry-run not eligible',
      });
      done += 1;
      continue;
    }

    const confirmPhrase =
      candidate.category === 'orphan_ar_gl_correction' ? GL_CORRECTION_CONFIRM_PHRASE : undefined;

    const applied = await applyHybridRepairCandidate(candidate, ctx, {
      dryRunHash: dry.dryRunHash,
      confirmPhrase,
    });

    if (applied.ok) {
      result.applied.push({ id: candidate.id, message: applied.message });
    } else {
      result.errors.push({ id: candidate.id, error: applied.error || 'Apply failed' });
    }
    done += 1;
    options?.onProgress?.({ done, total, candidateId: candidate.id, title: candidate.title });
  }

  for (const c of candidates) {
    if (c.diagnosticOnly) {
      result.skipped.push({ id: c.id, reason: 'Diagnostic only' });
    } else if (!eligible.find((e) => e.id === c.id)) {
      if (!result.skipped.find((s) => s.id === c.id) && !result.errors.find((e) => e.id === c.id)) {
        result.skipped.push({ id: c.id, reason: c.blockedReason || 'Not eligible for auto-fix' });
      }
    }
  }

  return result;
}

export { hybridIdToOrphanDefectId, orphanDefectToHybridId };
