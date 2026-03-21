/**
 * UI workflow: same-row status transitions with stage numbering (no converted clone rows).
 * Uses documentNumberService for missing stage numbers; preserves existing stage fields.
 */

import { documentNumberService } from '@/app/services/documentNumberService';
import { saleService } from '@/app/services/saleService';
import { purchaseService } from '@/app/services/purchaseService';
import { postPurchaseDocumentAccounting } from '@/app/services/documentPostingEngine';

/** Headless stage moves only — finalize always via SaleForm / convert_to_final (stock + JE). */
export type SaleLifecycleTarget = 'draft' | 'quotation' | 'order' | 'cancelled';

export async function restoreSaleFromCancelled(
  saleId: string,
  target: 'draft' | 'quotation' | 'order',
  companyId: string
): Promise<void> {
  await saleService.restoreCancelledSale(saleId, target, companyId);
}

export async function restorePurchaseFromCancelled(
  purchaseId: string,
  target: 'draft' | 'ordered',
  companyId: string
): Promise<void> {
  await purchaseService.restoreCancelledPurchase(purchaseId, target, companyId);
}

export async function transitionSaleLifecycle(
  saleId: string,
  target: SaleLifecycleTarget,
  companyId: string
): Promise<void> {
  const row = await saleService.getSaleById(saleId);
  if (!row) throw new Error('Sale not found');

  const cur = String((row as { status?: string }).status || '').toLowerCase();
  if (cur === 'cancelled' && target !== 'cancelled') {
    throw new Error('Cancelled sale must be restored (Draft / Quotation / Order) before other lifecycle moves.');
  }

  const r = row as Record<string, unknown>;
  const patch: Record<string, unknown> = { status: target };

  patch.invoice_no = null;
  if (target === 'draft' && !(r.draft_no && String(r.draft_no).trim())) {
    patch.draft_no = await documentNumberService.getNextDocumentNumberGlobal(companyId, 'SDR');
  }
  if (target === 'quotation' && !(r.quotation_no && String(r.quotation_no).trim())) {
    patch.quotation_no = await documentNumberService.getNextDocumentNumberGlobal(companyId, 'SQT');
  }
  if (target === 'order' && !(r.order_no && String(r.order_no).trim())) {
    patch.order_no = await documentNumberService.getNextDocumentNumberGlobal(companyId, 'SOR');
  }

  if (target === 'cancelled') {
    await saleService.cancelSale(saleId);
    return;
  }

  await saleService.updateSale(saleId, patch as any);
}

export type PurchaseLifecycleTarget = 'draft' | 'ordered' | 'received' | 'final' | 'cancelled';

/** App may use `completed` — DB uses `final`. */
export async function transitionPurchaseLifecycle(
  purchaseId: string,
  target: PurchaseLifecycleTarget,
  companyId: string
): Promise<void> {
  const row = await purchaseService.getPurchase(purchaseId);
  if (!row) throw new Error('Purchase not found');

  const cur = String((row as { status?: string }).status || '').toLowerCase();
  if (cur === 'cancelled' && target !== 'cancelled') {
    throw new Error('Cancelled purchase must be restored (Draft or Order) before other lifecycle moves.');
  }

  const r = row as Record<string, unknown>;
  const dbStatus: 'draft' | 'ordered' | 'received' | 'final' | 'cancelled' =
    target === 'final' ? 'final' : target === 'cancelled' ? 'cancelled' : target;

  if (target === 'cancelled') {
    await purchaseService.cancelPurchase(purchaseId);
    return;
  }

  const patch: Record<string, unknown> = { status: dbStatus };

  const posted = dbStatus === 'final' || dbStatus === 'received';
  if (posted) {
    const po =
      (typeof r.po_no === 'string' && r.po_no.trim()) ||
      (await documentNumberService.getNextDocumentNumberGlobal(companyId, 'PUR'));
    patch.po_no = po;
  } else {
    patch.po_no = null;
    if (dbStatus === 'draft' && !(r.draft_no && String(r.draft_no).trim())) {
      patch.draft_no = await documentNumberService.getNextDocumentNumberGlobal(companyId, 'PDR');
    }
    if (dbStatus === 'ordered' && !(r.order_no && String(r.order_no).trim())) {
      patch.order_no = await documentNumberService.getNextDocumentNumberGlobal(companyId, 'POR');
    }
  }

  await purchaseService.updatePurchase(purchaseId, patch as any);
  if (posted) {
    await postPurchaseDocumentAccounting(purchaseId);
  }
}
