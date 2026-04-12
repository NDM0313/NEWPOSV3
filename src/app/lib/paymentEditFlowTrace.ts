/**
 * DEV-only structured trace for payment edit / PF-14 posting audits.
 * Enables proving double-fire (React, modal, loadEntries+sync, etc.) without changing GL math.
 * Enable by running the app in development; search console for [PAYMENT_EDIT_TRACE].
 */

export type PaymentEditTraceEvent =
  | 'saleService.updatePayment.start'
  | 'saleService.updatePayment.db_updated'
  | 'saleService.updatePayment.post_amount_adjust'
  | 'saleService.updatePayment.post_account_adjust'
  | 'saleService.updatePayment.rebuild_manual_receipt_allocations'
  | 'purchaseService.updatePayment.start'
  | 'purchaseService.updatePayment.db_updated'
  | 'purchaseService.updatePayment.post_amount_adjust'
  | 'purchaseService.updatePayment.post_account_adjust'
  | 'UnifiedPaymentDialog.edit.sale_purchase_routed'
  | 'UnifiedPaymentDialog.edit.manual_patch_done'
  | 'UnifiedPaymentDialog.edit.manual_amount_adjust'
  | 'UnifiedPaymentDialog.edit.manual_account_transfer'
  | 'paymentAdjustment.post_amount_adjust.enter'
  | 'paymentAdjustment.post_amount_adjust.skip_idempotent'
  | 'paymentAdjustment.post_amount_adjust.createEntry'
  | 'paymentAdjustment.post_account_adjust.enter'
  | 'paymentAdjustment.post_account_adjust.skip_idempotent'
  | 'paymentAdjustment.post_account_adjust.createEntry'
  | 'AccountingContext.loadEntries.sync_payment_accounts'
  | 'SalesContext.sync_sale_payment.updatePayment';

export function tracePaymentEditFlow(event: PaymentEditTraceEvent, payload: Record<string, unknown>): void {
  if (!import.meta.env?.DEV) return;
  const line = {
    event,
    ts: new Date().toISOString(),
    ...payload,
  };
  // Single console line for easy grep / export
  console.info('[PAYMENT_EDIT_TRACE]', JSON.stringify(line));
}
