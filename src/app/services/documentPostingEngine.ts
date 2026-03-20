/**
 * Single document posting engine (sales + purchases).
 *
 * Canonical document JEs must ONLY be created through this module’s post/rebuild paths.
 * Payment JEs remain on the payments trigger + payment adjustment services.
 *
 * @see saleAccountingService / purchaseAccountingService for line-building (internal).
 */

import { supabase } from '@/lib/supabase';
import { canPostAccountingForPurchaseStatus, canPostAccountingForSaleStatus } from '@/app/lib/postingStatusGate';
import { saleAccountingService, listActiveCanonicalSaleDocumentJournalEntryIds } from './saleAccountingService';
import {
  createPurchaseJournalEntry,
  listActiveCanonicalPurchaseDocumentJournalEntryIds,
  reversePurchaseDocumentJournalEntry,
} from './purchaseAccountingService';

/** Post canonical sale document JE (idempotent). Loads sale row from DB. */
export async function postSaleDocumentAccounting(saleId: string): Promise<string | null> {
  if (!saleId) return null;
  const { data: sale, error } = await supabase
    .from('sales')
    .select('id, company_id, branch_id, status, total, discount_amount, shipment_charges, invoice_no, created_by')
    .eq('id', saleId)
    .maybeSingle();
  if (error || !sale) {
    console.warn('[documentPostingEngine] postSaleDocumentAccounting: sale not found', saleId, error?.message);
    return null;
  }
  if (!canPostAccountingForSaleStatus((sale as { status?: string }).status)) return null;
  const total = Number((sale as { total?: number }).total) || 0;
  if (total <= 0) return null;
  return saleAccountingService.createSaleJournalEntry({
    saleId,
    companyId: (sale as { company_id: string }).company_id,
    branchId: (sale as { branch_id?: string | null }).branch_id,
    total,
    discountAmount: Number((sale as { discount_amount?: number }).discount_amount ?? 0) || undefined,
    shipmentCharges: Number((sale as { shipment_charges?: number }).shipment_charges ?? 0) || undefined,
    invoiceNo: (sale as { invoice_no?: string }).invoice_no || `SL-${saleId.slice(0, 8)}`,
    performedBy: (sale as { created_by?: string | null }).created_by ?? null,
  });
}

/** Void active canonical sale document JEs, then post fresh (document only; never touches payment JEs). */
export async function rebuildSaleDocumentAccounting(saleId: string): Promise<string | null> {
  const ids = await listActiveCanonicalSaleDocumentJournalEntryIds(saleId);
  if (ids.length > 0) {
    const now = new Date().toISOString();
    await supabase
      .from('journal_entries')
      .update({
        is_void: true,
        void_reason: 'rebuild_sale_document_accounting',
        voided_at: now,
      })
      .in('id', ids);
  }
  return postSaleDocumentAccounting(saleId);
}

/** Reverse canonical sale document (adds sale_reversal JE; does not void original). */
export async function reverseSaleDocumentAccounting(saleId: string): Promise<string | null> {
  const { data: sale, error } = await supabase
    .from('sales')
    .select('id, company_id, branch_id, total, discount_amount, shipment_charges, invoice_no, created_by')
    .eq('id', saleId)
    .maybeSingle();
  if (error || !sale) return null;
  return saleAccountingService.reverseSaleJournalEntry({
    saleId,
    companyId: (sale as { company_id: string }).company_id,
    branchId: (sale as { branch_id?: string | null }).branch_id,
    total: Number((sale as { total?: number }).total) || 0,
    discountAmount: Number((sale as { discount_amount?: number }).discount_amount ?? 0) || undefined,
    shipmentCharges: Number((sale as { shipment_charges?: number }).shipment_charges ?? 0) || undefined,
    invoiceNo: (sale as { invoice_no?: string }).invoice_no || `SL-${saleId.slice(0, 8)}`,
    performedBy: (sale as { created_by?: string | null }).created_by ?? null,
  });
}

/** Post canonical purchase document JE (idempotent). Loads purchase from DB. */
export async function postPurchaseDocumentAccounting(purchaseId: string): Promise<string | null> {
  if (!purchaseId) return null;
  const { data: p, error } = await supabase
    .from('purchases')
    .select('id, company_id, branch_id, status, total, subtotal, discount_amount, po_no, supplier_name, po_date')
    .eq('id', purchaseId)
    .maybeSingle();
  if (error || !p) {
    console.warn('[documentPostingEngine] postPurchaseDocumentAccounting: purchase not found', purchaseId, error?.message);
    return null;
  }
  if (!canPostAccountingForPurchaseStatus((p as { status?: string }).status)) return null;
  const total = Number((p as { total?: number }).total) || 0;
  if (total <= 0) return null;

  const { data: chargeRows } = await supabase
    .from('purchase_charges')
    .select('charge_type, amount')
    .eq('purchase_id', purchaseId);
  const charges = (chargeRows || []) as { charge_type?: string; amount?: number }[];

  return createPurchaseJournalEntry({
    purchaseId,
    companyId: (p as { company_id: string }).company_id,
    branchId: (p as { branch_id?: string | null }).branch_id,
    total,
    subtotal: Number((p as { subtotal?: number }).subtotal) || undefined,
    poNo: (p as { po_no?: string }).po_no || `PUR-${purchaseId.slice(0, 8)}`,
    supplierName: (p as { supplier_name?: string }).supplier_name || 'Supplier',
    entryDate: (p as { po_date?: string }).po_date || undefined,
    charges,
    createdBy: null,
  });
}

/** Void active canonical purchase document JEs, then post fresh. */
export async function rebuildPurchaseDocumentAccounting(purchaseId: string): Promise<string | null> {
  const ids = await listActiveCanonicalPurchaseDocumentJournalEntryIds(purchaseId);
  if (ids.length > 0) {
    const now = new Date().toISOString();
    await supabase
      .from('journal_entries')
      .update({
        is_void: true,
        void_reason: 'rebuild_purchase_document_accounting',
        voided_at: now,
      })
      .in('id', ids);
  }
  return postPurchaseDocumentAccounting(purchaseId);
}

/** Adds purchase_reversal JE mirroring the canonical document JE lines. */
export async function reversePurchaseDocumentAccounting(purchaseId: string): Promise<string | null> {
  const { data: p, error } = await supabase
    .from('purchases')
    .select('id, company_id, branch_id, po_no, supplier_name, created_by')
    .eq('id', purchaseId)
    .maybeSingle();
  if (error || !p) return null;
  return reversePurchaseDocumentJournalEntry({
    purchaseId,
    companyId: (p as { company_id: string }).company_id,
    branchId: (p as { branch_id?: string | null }).branch_id,
    poNo: (p as { po_no?: string }).po_no || `PUR-${purchaseId.slice(0, 8)}`,
    performedBy: (p as { created_by?: string | null }).created_by ?? null,
  });
}

/**
 * Sale payment accounting: canonical path is DB trigger on `payments` insert (journal_entries.payment_id).
 * This helper verifies linkage exists (and can be extended for backfill).
 */
export async function postSalePaymentAccounting(paymentId: string): Promise<{ ok: boolean; journalEntryId?: string }> {
  if (!paymentId) return { ok: false };
  const { data: je } = await supabase.from('journal_entries').select('id').eq('payment_id', paymentId).limit(1).maybeSingle();
  return je?.id ? { ok: true, journalEntryId: je.id as string } : { ok: false };
}

/** Purchase payment: supplier payments create JE via supplierPaymentService + trigger; verify link. */
export async function postPurchasePaymentAccounting(paymentId: string): Promise<{ ok: boolean; journalEntryId?: string }> {
  if (!paymentId) return { ok: false };
  const { data: je } = await supabase.from('journal_entries').select('id').eq('payment_id', paymentId).limit(1).maybeSingle();
  return je?.id ? { ok: true, journalEntryId: je.id as string } : { ok: false };
}
