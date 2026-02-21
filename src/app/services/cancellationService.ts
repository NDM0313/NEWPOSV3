/**
 * Centralized Cancellation Service
 * Safe alternative to hard delete for final documents.
 * - Draft: Use delete (hard delete allowed)
 * - Final: Use cancel (status=cancelled, reverse stock/ledger/journal, audit trail)
 */

import { supabase } from '@/lib/supabase';
import { activityLogService } from './activityLogService';
import { saleService } from './saleService';
import { purchaseService } from './purchaseService';

export interface CancelOptions {
  reason: string;
  performedBy?: string;
  /** When sale has payments: 'refund' = return money, 'advance' = keep for future */
  refundOption?: 'refund' | 'advance';
  refundAmount?: number;
  refundMethod?: string;
  refundAccountId?: string;
}

/**
 * Cancel a final sale. Reverses stock, ledger, journal; sets status=cancelled.
 * Throws if sale is draft or has returns.
 */
export async function cancelSale(saleId: string, options: CancelOptions): Promise<void> {
  const { data: sale, error: fetchErr } = await supabase
    .from('sales')
    .select('id, status, invoice_no, company_id, customer_id')
    .eq('id', saleId)
    .single();

  if (fetchErr || !sale) throw new Error('Sale not found');
  if ((sale as any).status === 'cancelled') throw new Error('Sale is already cancelled');
  if ((sale as any).status !== 'final') {
    throw new Error('Only final invoices can be cancelled. Draft sales can be deleted.');
  }

  // Check for returns
  const { data: returns } = await supabase
    .from('sale_returns')
    .select('id')
    .eq('original_sale_id', saleId)
    .neq('status', 'void');

  if (returns && returns.length > 0) {
    throw new Error('Cannot cancel sale: It has linked returns. Void the returns first.');
  }

  await saleService.cancelSale(saleId, {
    reason: options.reason,
    performedBy: options.performedBy,
    refundOption: options.refundOption,
    refundAmount: options.refundAmount,
    refundMethod: options.refundMethod,
    refundAccountId: options.refundAccountId,
  });
}

/**
 * Cancel a final purchase. Reverses stock, ledger, journal; sets status=cancelled.
 * Throws if purchase is draft.
 */
export async function cancelPurchase(purchaseId: string, options: CancelOptions): Promise<void> {
  const { data: purchase, error: fetchErr } = await supabase
    .from('purchases')
    .select('id, status, po_no, company_id')
    .eq('id', purchaseId)
    .single();

  if (fetchErr || !purchase) throw new Error('Purchase not found');
  if ((purchase as any).status === 'cancelled') throw new Error('Purchase is already cancelled');
  const status = (purchase as any).status;
  if (status === 'draft') {
    throw new Error('Draft purchases can be deleted. Only final/received purchases can be cancelled.');
  }

  await purchaseService.cancelPurchase(purchaseId, options);
}

/**
 * Cancel expense (soft delete with reason). Sets status=rejected, cancel_reason.
 */
export async function cancelExpense(
  expenseId: string,
  options: CancelOptions,
  companyId: string
): Promise<void> {
  const { error } = await supabase
    .from('expenses')
    .update({
      status: 'rejected',
      cancel_reason: options.reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', expenseId);

  if (error) throw error;

  await activityLogService.logActivity({
    companyId,
    module: 'expense',
    entityId: expenseId,
    action: 'expense_cancelled',
    performedBy: options.performedBy,
    description: `Expense cancelled: ${options.reason}`,
    notes: options.reason,
  }).catch(() => {});
}
