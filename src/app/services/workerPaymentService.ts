/**
 * Canonical worker payment: `record_payment_with_accounting` (WPY-*, GL mirrors voucher)
 * then worker_ledger + stage settlement (Pay Now) — same spine as mobile.
 */

import { supabase } from '@/lib/supabase';
import { studioProductionService } from '@/app/services/studioProductionService';
import {
  recordPaymentWithAccounting,
  resolveBranchIdForPaymentRpc,
} from '@/app/services/recordPaymentWithAccountingRpc';
import { dispatchContactBalancesRefresh } from '@/app/lib/contactBalancesRefresh';

export interface CreateWorkerPaymentParams {
  companyId: string;
  branchId: string | null;
  workerId: string;
  workerName: string;
  amount: number;
  paymentMethod: string;
  paymentAccountId: string;
  /** Pay Now: stage being paid; when amount >= stageAmount we call markStageLedgerPaid (job row stays without PAY ref). */
  stageId?: string | null;
  stageAmount?: number | null;
  notes?: string | null;
}

export interface CreateWorkerPaymentResult {
  paymentId: string;
  journalEntryId: string;
  referenceNumber: string;
}

/**
 * Record worker payment: single RPC (payments + journal + lines). Roznamcha via payments.
 */
export async function createWorkerPayment(params: CreateWorkerPaymentParams): Promise<CreateWorkerPaymentResult> {
  const {
    companyId,
    branchId,
    workerId,
    workerName,
    amount,
    paymentMethod,
    paymentAccountId,
    stageId,
    stageAmount,
    notes,
  } = params;

  if (!companyId || !workerId || amount <= 0 || !paymentAccountId) {
    throw new Error('companyId, workerId, amount, and paymentAccountId are required');
  }

  const validBranchId = branchId && branchId !== 'all' ? branchId : null;
  const paymentDate = new Date().toISOString().split('T')[0];
  const { data: { user: authUser } } = await supabase.auth.getUser();
  const authUserId = authUser?.id ?? null;

  const branchResolved = await resolveBranchIdForPaymentRpc(companyId, validBranchId);
  const noteText = (notes?.trim() || `Payment to worker ${workerName}`).slice(0, 2000);

  const result = await recordPaymentWithAccounting({
    companyId,
    branchId: branchResolved,
    paymentType: 'paid',
    referenceType: 'worker_payment',
    referenceId: workerId,
    amount,
    paymentMethod,
    paymentDate,
    paymentAccountId,
    notes: noteText,
    createdBy: authUserId,
    workerStageId: stageId ?? null,
  });

  const isPayNowFull = stageId != null && stageAmount != null && amount >= Number(stageAmount);
  if (!isPayNowFull) {
    await studioProductionService.recordAccountingPaymentToLedger({
      companyId,
      workerId,
      amount,
      paymentReference: result.referenceNumber,
      notes: noteText,
      journalEntryId: result.journalEntryId,
    });
  }

  if (isPayNowFull && stageId) {
    await studioProductionService.markStageLedgerPaid(stageId, null);
  }

  dispatchContactBalancesRefresh(companyId);
  return {
    paymentId: result.paymentId,
    journalEntryId: result.journalEntryId,
    referenceNumber: result.referenceNumber,
  };
}
