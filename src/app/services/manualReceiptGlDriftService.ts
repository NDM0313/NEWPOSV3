/**
 * Detect / repair manual_receipt drift: payments.amount vs primary JE lines (net after payment_adjustment).
 */

import { supabase } from '@/lib/supabase';
import { accountingService } from '@/app/services/accountingService';
import { postPaymentAmountAdjustment } from '@/app/services/paymentAdjustmentService';
import { resolveReceivablePostingAccountId } from '@/app/services/partySubledgerAccountService';

export type ManualReceiptGlDriftSummary = {
  paymentId: string;
  paymentAmount: number;
  primaryJeAmount: number;
  netEffectiveAmount: number | null;
  adjustmentJeCount: number;
  /** True when payments.amount matches net GL (primary + adjustments). */
  netAligned: boolean;
  /** True when payments.amount matches primary JE only (no drift, or UI-only if net differs). */
  primaryAligned: boolean;
  driftVsPrimary: number;
  driftVsNet: number | null;
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function lineMaxAmount(lines: { debit?: number; credit?: number }[]): number {
  if (!lines.length) return 0;
  return roundMoney(Math.max(...lines.map((l) => Math.max(Number(l.debit) || 0, Number(l.credit) || 0))));
}

/**
 * Compare Roznamcha payment amount to primary JE and merged effective lines.
 */
export async function getManualReceiptGlDriftSummary(
  companyId: string,
  paymentId: string,
  primaryJournalLines: { debit?: number; credit?: number }[],
  currentPaymentAccountId?: string | null,
): Promise<ManualReceiptGlDriftSummary | null> {
  const { data: p, error } = await supabase
    .from('payments')
    .select('id, amount, reference_type, payment_account_id')
    .eq('id', paymentId)
    .maybeSingle();
  if (error || !p || String((p as { reference_type?: string }).reference_type || '').toLowerCase() !== 'manual_receipt') {
    return null;
  }

  const paymentAmount = roundMoney(Number((p as { amount?: number }).amount) || 0);
  const primaryJeAmount = lineMaxAmount(primaryJournalLines);

  const { count: adjCount } = await supabase
    .from('journal_entries')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('reference_type', 'payment_adjustment')
    .eq('reference_id', paymentId)
    .eq('is_void', false);

  const effectiveLines = await accountingService.getEffectiveJournalLinesForPayment(
    paymentId,
    companyId,
    currentPaymentAccountId ?? (p as { payment_account_id?: string | null }).payment_account_id ?? null,
  );
  const netEffectiveAmount = effectiveLines.length > 0 ? lineMaxAmount(effectiveLines) : null;

  const driftVsPrimary = roundMoney(paymentAmount - primaryJeAmount);
  const driftVsNet = netEffectiveAmount != null ? roundMoney(paymentAmount - netEffectiveAmount) : null;

  return {
    paymentId,
    paymentAmount,
    primaryJeAmount,
    netEffectiveAmount,
    adjustmentJeCount: adjCount ?? 0,
    netAligned: driftVsNet != null ? Math.abs(driftVsNet) <= 0.01 : Math.abs(driftVsPrimary) <= 0.01,
    primaryAligned: Math.abs(driftVsPrimary) <= 0.01,
    driftVsPrimary,
    driftVsNet,
  };
}

/**
 * Post missing payment_adjustment so net GL matches payments.amount.
 * Uses primary JE line max as oldAmount when payment was already patched down without adjustment.
 */
export async function repairManualReceiptGlDrift(params: {
  companyId: string;
  branchId: string | null;
  paymentId: string;
  customerId: string;
  primaryJeAmount: number;
  paymentAmount: number;
  paymentAccountId: string;
  paymentDate: string;
  referenceNumber?: string | null;
  createdBy?: string | null;
}): Promise<void> {
  const {
    companyId,
    branchId,
    paymentId,
    customerId,
    primaryJeAmount,
    paymentAmount,
    paymentAccountId,
    paymentDate,
    referenceNumber,
    createdBy,
  } = params;

  if (Math.abs(primaryJeAmount - paymentAmount) <= 0.01) return;

  const arId = await resolveReceivablePostingAccountId(companyId, customerId);
  await postPaymentAmountAdjustment({
    context: 'sale',
    companyId,
    branchId,
    paymentId,
    referenceId: paymentId,
    oldAmount: primaryJeAmount,
    newAmount: paymentAmount,
    paymentAccountId,
    invoiceNoOrRef: referenceNumber || 'Customer receipt GL repair',
    entryDate: paymentDate,
    createdBy: createdBy ?? null,
    receivableAccountId: arId || undefined,
  });
}
