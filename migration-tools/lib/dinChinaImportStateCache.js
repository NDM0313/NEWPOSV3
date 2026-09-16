/**
 * Batch-load legacy DIN CHINA import state for idempotent dry-run/apply without per-row API reads.
 */
import {
  dinChinaUuid,
  SOURCE_SYSTEM,
} from './dinChinaLegacyMap.js';
import { supabaseRead } from './supabaseReadRetry.js';

function parseLegacyTxnId(text) {
  const m = String(text || '').match(/legacy_transaction_id=(\d+)/);
  return m ? Number(m[1]) : null;
}

function parseLegacyPaymentId(text) {
  const m = String(text || '').match(/legacy_payment_id=(\d+)/);
  return m ? Number(m[1]) : null;
}

function rowToMatch(match, row) {
  return { match, row };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} companyId
 * @param {{ legacyTransactionIds?: number[], legacyPaymentIds?: number[] }} hints
 */
export async function loadDinChinaImportStateCache(supabase, companyId, hints = {}) {
  const legacyTxnIds = hints.legacyTransactionIds || [];
  const legacyPaymentIds = hints.legacyPaymentIds || [];

  const deterministicTxnIds = legacyTxnIds.map((id) => dinChinaUuid('transactions', id));
  const deterministicPaymentIds = legacyPaymentIds.map((id) => dinChinaUuid('transaction_payments', id));

  const salesByLegacyTxnId = new Map();
  const salesByDeterministicId = new Map();
  const purchasesByLegacyTxnId = new Map();
  const purchasesByDeterministicId = new Map();
  const expensesByLegacyTxnId = new Map();
  const expensesByDeterministicId = new Map();
  const paymentsByLegacyPaymentId = new Map();
  const paymentsByDeterministicId = new Map();
  const saleItemsById = new Set();
  const purchaseItemsById = new Set();

  const { data: salesBySource } = await supabaseRead('cache_sales_source', () =>
    supabase
      .from('sales')
      .select('id, invoice_no, total, paid_amount, due_amount, notes, source, status')
      .eq('company_id', companyId)
      .eq('source', SOURCE_SYSTEM));

  const { data: salesByNotes } = await supabaseRead('cache_sales_notes', () =>
    supabase
      .from('sales')
      .select('id, invoice_no, total, paid_amount, due_amount, notes, source, status')
      .eq('company_id', companyId)
      .ilike('notes', `%${SOURCE_SYSTEM}%`));

  for (const row of [...(salesBySource || []), ...(salesByNotes || [])]) {
    salesByDeterministicId.set(row.id, row);
    const lid = parseLegacyTxnId(row.notes);
    if (lid != null && !salesByLegacyTxnId.has(lid)) {
      salesByLegacyTxnId.set(lid, row);
    }
  }

  if (deterministicTxnIds.length) {
    const { data: salesByIds } = await supabaseRead('cache_sales_det_ids', () =>
      supabase
        .from('sales')
        .select('id, invoice_no, total, paid_amount, due_amount, notes, source, status')
        .in('id', deterministicTxnIds));
    for (const row of salesByIds || []) {
      salesByDeterministicId.set(row.id, row);
      const lid = parseLegacyTxnId(row.notes);
      if (lid != null) salesByLegacyTxnId.set(lid, row);
    }
  }

  const { data: purchasesByNotes } = await supabaseRead('cache_purchases_notes', () =>
    supabase
      .from('purchases')
      .select('id, po_no, total, paid_amount, notes, status')
      .eq('company_id', companyId)
      .ilike('notes', `%${SOURCE_SYSTEM}%`));

  for (const row of purchasesByNotes || []) {
    purchasesByDeterministicId.set(row.id, row);
    const lid = parseLegacyTxnId(row.notes);
    if (lid != null) purchasesByLegacyTxnId.set(lid, row);
  }

  if (deterministicTxnIds.length) {
    const { data: purchByIds } = await supabaseRead('cache_purchases_det_ids', () =>
      supabase
        .from('purchases')
        .select('id, po_no, total, paid_amount, notes, status')
        .in('id', deterministicTxnIds));
    for (const row of purchByIds || []) {
      purchasesByDeterministicId.set(row.id, row);
      const lid = parseLegacyTxnId(row.notes);
      if (lid != null) purchasesByLegacyTxnId.set(lid, row);
    }
  }

  const { data: expensesByDesc } = await supabaseRead('cache_expenses_desc', () =>
    supabase
      .from('expenses')
      .select('id, expense_no, amount, description, status')
      .eq('company_id', companyId)
      .ilike('description', `%${SOURCE_SYSTEM}%`));

  for (const row of expensesByDesc || []) {
    expensesByDeterministicId.set(row.id, row);
    const lid = parseLegacyTxnId(row.description);
    if (lid != null) expensesByLegacyTxnId.set(lid, row);
  }

  if (deterministicTxnIds.length) {
    const { data: expByIds } = await supabaseRead('cache_expenses_det_ids', () =>
      supabase
        .from('expenses')
        .select('id, expense_no, amount, description, status')
        .in('id', deterministicTxnIds));
    for (const row of expByIds || []) {
      expensesByDeterministicId.set(row.id, row);
      const lid = parseLegacyTxnId(row.description);
      if (lid != null) expensesByLegacyTxnId.set(lid, row);
    }
  }

  const { data: paymentsByNotes } = await supabaseRead('cache_payments_notes', () =>
    supabase
      .from('payments')
      .select('id, reference_number, amount, notes, reference_type, reference_id')
      .eq('company_id', companyId)
      .ilike('notes', `%${SOURCE_SYSTEM}%`));

  for (const row of paymentsByNotes || []) {
    paymentsByDeterministicId.set(row.id, row);
    const lid = parseLegacyPaymentId(row.notes);
    if (lid != null) paymentsByLegacyPaymentId.set(lid, row);
  }

  if (deterministicPaymentIds.length) {
    const { data: payByIds } = await supabaseRead('cache_payments_det_ids', () =>
      supabase
        .from('payments')
        .select('id, reference_number, amount, notes, reference_type, reference_id')
        .in('id', deterministicPaymentIds));
    for (const row of payByIds || []) {
      paymentsByDeterministicId.set(row.id, row);
      const lid = parseLegacyPaymentId(row.notes);
      if (lid != null) paymentsByLegacyPaymentId.set(lid, row);
    }
  }

  const importedSaleIds = [...salesByDeterministicId.values()].map((r) => r.id);
  if (importedSaleIds.length) {
    const { data: saleItems } = await supabaseRead('cache_sale_items', () =>
      supabase.from('sale_items').select('id').in('sale_id', importedSaleIds));
    if (saleItems?.length) {
      for (const it of saleItems) saleItemsById.add(it.id);
    } else {
      const { data: alt } = await supabaseRead('cache_sales_items', () =>
        supabase.from('sales_items').select('id').in('sale_id', importedSaleIds));
      for (const it of alt || []) saleItemsById.add(it.id);
    }
  }

  const importedPurchIds = [...purchasesByDeterministicId.values()].map((r) => r.id);
  if (importedPurchIds.length) {
    const { data: pi } = await supabaseRead('cache_purchase_items', () =>
      supabase.from('purchase_items').select('id').in('purchase_id', importedPurchIds));
    for (const it of pi || []) purchaseItemsById.add(it.id);
  }

  return {
    salesByLegacyTxnId,
    salesByDeterministicId,
    purchasesByLegacyTxnId,
    purchasesByDeterministicId,
    expensesByLegacyTxnId,
    expensesByDeterministicId,
    paymentsByLegacyPaymentId,
    paymentsByDeterministicId,
    saleItemsById,
    purchaseItemsById,
    findExistingSale(legacyTransactionId) {
      const detId = dinChinaUuid('transactions', legacyTransactionId);
      const byDet = salesByDeterministicId.get(detId);
      if (byDet) return rowToMatch('id', byDet);
      const byLegacy = salesByLegacyTxnId.get(Number(legacyTransactionId));
      if (byLegacy) return rowToMatch('source_notes', byLegacy);
      return null;
    },
    findExistingPurchase(legacyTransactionId) {
      const detId = dinChinaUuid('transactions', legacyTransactionId);
      const byDet = purchasesByDeterministicId.get(detId);
      if (byDet) return rowToMatch('id', byDet);
      const byLegacy = purchasesByLegacyTxnId.get(Number(legacyTransactionId));
      if (byLegacy) return rowToMatch('notes', byLegacy);
      return null;
    },
    findExistingExpense(legacyTransactionId) {
      const detId = dinChinaUuid('transactions', legacyTransactionId);
      const byDet = expensesByDeterministicId.get(detId);
      if (byDet) return rowToMatch('id', byDet);
      const byLegacy = expensesByLegacyTxnId.get(Number(legacyTransactionId));
      if (byLegacy) return rowToMatch('description', byLegacy);
      return null;
    },
    findExistingPayment(legacyPaymentId) {
      const detId = dinChinaUuid('transaction_payments', legacyPaymentId);
      const byDet = paymentsByDeterministicId.get(detId);
      if (byDet) return rowToMatch('id', byDet);
      const byLegacy = paymentsByLegacyPaymentId.get(Number(legacyPaymentId));
      if (byLegacy) return rowToMatch('notes', byLegacy);
      return null;
    },
    hasSaleItem(itemId) {
      return saleItemsById.has(itemId);
    },
    hasPurchaseItem(itemId) {
      return purchaseItemsById.has(itemId);
    },
  };
}

export function collectLegacyIdsFromCsv(data) {
  const legacyTransactionIds = new Set();
  const legacyPaymentIds = new Set();
  for (const r of data.sales?.rows || []) legacyTransactionIds.add(Number(r.legacy_transaction_id));
  for (const r of data.purchases?.rows || []) legacyTransactionIds.add(Number(r.legacy_transaction_id));
  for (const r of data.expenses?.rows || []) legacyTransactionIds.add(Number(r.legacy_transaction_id));
  for (const r of data.salePayments?.rows || []) legacyPaymentIds.add(Number(r.payment_id));
  for (const r of data.purchasePayments?.rows || []) legacyPaymentIds.add(Number(r.payment_id));
  return {
    legacyTransactionIds: [...legacyTransactionIds],
    legacyPaymentIds: [...legacyPaymentIds],
  };
}
