/**
 * PF-14.1 Global Posted Document Edit Engine – Effective State
 *
 * Business and UI must always show the current effective document and payment state,
 * not raw accounting (which keeps immutable JEs + adjustments for audit).
 *
 * - getEffectiveDocumentState: current document row (sales, purchases, etc.) = single source of truth.
 * - getEffectivePaymentState: current payment rows for that document = effective payment history.
 */

import { saleService } from './saleService';
import { purchaseService } from './purchaseService';

export type EffectiveDocumentReferenceType = 'sale' | 'purchase' | 'rental' | 'expense' | 'studio';

/** Effective document = current row in document table (already updated on edit). Use for UI and business reports. */
export async function getEffectiveDocumentState(
  referenceType: EffectiveDocumentReferenceType,
  referenceId: string
): Promise<Record<string, unknown> | null> {
  if (!referenceId) return null;
  switch (referenceType) {
    case 'sale':
      return (await saleService.getSaleById(referenceId)) as Record<string, unknown> | null;
    case 'purchase':
      return (await purchaseService.getPurchase(referenceId)) as Record<string, unknown> | null;
    case 'rental':
    case 'expense':
    case 'studio':
      // TODO: wire rentalService.getById, expenseService.getById when needed
      return null;
    default:
      return null;
  }
}

/** Effective payments = current payment rows for that document. Use for payment history and "total paid". */
export async function getEffectivePaymentState(
  referenceType: EffectiveDocumentReferenceType,
  referenceId: string
): Promise<{ id: string; amount: number; payment_method?: string; payment_date?: string; reference_number?: string }[]> {
  if (!referenceId) return [];
  switch (referenceType) {
    case 'sale': {
      const rows = await saleService.getSalePayments(referenceId);
      return (rows || []).map((p: any) => ({
        id: p.id,
        amount: Number(p.amount ?? 0) || 0,
        payment_method: p.payment_method ?? p.paymentMethod,
        payment_date: p.payment_date ?? p.paymentDate,
        reference_number: p.reference_number ?? p.referenceNumber,
      }));
    }
    case 'purchase': {
      const rows = await purchaseService.getPurchasePayments(referenceId);
      return (rows || []).map((p: any) => ({
        id: p.id,
        amount: Number(p.amount ?? 0) || 0,
        payment_method: p.payment_method ?? p.paymentMethod,
        payment_date: p.payment_date ?? p.paymentDate,
        reference_number: p.reference_number ?? p.referenceNumber,
      }));
    }
    case 'rental':
    case 'expense':
    case 'studio':
      return [];
    default:
      return [];
  }
}

export const effectiveDocumentService = {
  getEffectiveDocumentState,
  getEffectivePaymentState,
};
