import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/** Deterministic UUID for DIN CHINA import (separate namespace from phase13). */
export function dinChinaUuid(namespace, legacyId) {
  const key = `din_china:${namespace}:${String(legacyId)}`;
  const hex = createHash('sha256').update(key).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export const SOURCE_SYSTEM = 'legacy_din_china';

export function legacyTxnNote(legacyTransactionId) {
  return `[${SOURCE_SYSTEM} legacy_transaction_id=${legacyTransactionId}]`;
}

export function legacyPaymentNote(legacyPaymentId, extra = '') {
  const base = `[${SOURCE_SYSTEM} legacy_payment_id=${legacyPaymentId}]`;
  return extra ? `${base} ${extra}`.trim() : base;
}

export function legacyContactNote(legacyContactId) {
  return `[${SOURCE_SYSTEM} legacy_contact_id=${legacyContactId}]`;
}

export function legacyProductNote(legacyProductId, legacyVariationId = null) {
  if (legacyVariationId != null && legacyVariationId !== '') {
    return `[${SOURCE_SYSTEM} legacy_product_id=${legacyProductId} legacy_variation_id=${legacyVariationId}]`;
  }
  return `[${SOURCE_SYSTEM} legacy_product_id=${legacyProductId}]`;
}

export function legacyInvoiceNo(invoiceNo) {
  const raw = String(invoiceNo ?? '').trim();
  const padded = raw.padStart(4, '0');
  return `DC-${padded}`;
}

export function loadLegacyMapFile(mapPath) {
  if (!fs.existsSync(mapPath)) return { version: 1, mappings: {} };
  return JSON.parse(fs.readFileSync(mapPath, 'utf8'));
}

export function saveLegacyMapFile(mapPath, data) {
  fs.mkdirSync(path.dirname(mapPath), { recursive: true });
  fs.writeFileSync(mapPath, JSON.stringify(data, null, 2), 'utf8');
}

/** Check if a legacy sale was already imported (dry-run + apply idempotency). */
export async function findExistingLegacySale(supabase, companyId, legacyTransactionId) {
  const id = dinChinaUuid('transactions', legacyTransactionId);
  const { data: byId } = await supabase
    .from('sales')
    .select('id, invoice_no, total, paid_amount')
    .eq('id', id)
    .maybeSingle();
  if (byId) return { match: 'id', row: byId };

  const note = legacyTxnNote(legacyTransactionId);
  const { data: bySource } = await supabase
    .from('sales')
    .select('id, invoice_no, total, paid_amount, notes, source')
    .eq('company_id', companyId)
    .eq('source', SOURCE_SYSTEM)
    .ilike('notes', `%legacy_transaction_id=${legacyTransactionId}%`)
    .limit(1)
    .maybeSingle();
  if (bySource) return { match: 'source_notes', row: bySource };

  return null;
}

export async function findExistingLegacyPurchase(supabase, companyId, legacyTransactionId) {
  const id = dinChinaUuid('transactions', legacyTransactionId);
  const { data: byId } = await supabase
    .from('purchases')
    .select('id, po_no, total, paid_amount')
    .eq('id', id)
    .maybeSingle();
  if (byId) return { match: 'id', row: byId };

  const { data: byNotes } = await supabase
    .from('purchases')
    .select('id, po_no, total, paid_amount, notes')
    .eq('company_id', companyId)
    .ilike('notes', `%legacy_transaction_id=${legacyTransactionId}%`)
    .limit(1)
    .maybeSingle();
  if (byNotes) return { match: 'notes', row: byNotes };

  return null;
}

export async function findExistingLegacyPayment(supabase, companyId, legacyPaymentId) {
  const id = dinChinaUuid('transaction_payments', legacyPaymentId);
  const { data: byId } = await supabase
    .from('payments')
    .select('id, reference_number, amount')
    .eq('id', id)
    .maybeSingle();
  if (byId) return { match: 'id', row: byId };

  const needle = `legacy_payment_id=${legacyPaymentId}`;
  const { data: byNotes } = await supabase
    .from('payments')
    .select('id, reference_number, amount, notes')
    .eq('company_id', companyId)
    .ilike('notes', `%${needle}%`)
    .limit(1)
    .maybeSingle();
  if (byNotes) return { match: 'notes', row: byNotes };

  return null;
}

export async function findExistingLegacyExpense(supabase, companyId, legacyTransactionId) {
  const id = dinChinaUuid('transactions', legacyTransactionId);
  const { data: byId } = await supabase
    .from('expenses')
    .select('id, expense_no, amount')
    .eq('id', id)
    .maybeSingle();
  if (byId) return { match: 'id', row: byId };

  const { data: byDesc } = await supabase
    .from('expenses')
    .select('id, expense_no, amount, description')
    .eq('company_id', companyId)
    .ilike('description', `%legacy_transaction_id=${legacyTransactionId}%`)
    .limit(1)
    .maybeSingle();
  if (byDesc) return { match: 'description', row: byDesc };

  return null;
}
