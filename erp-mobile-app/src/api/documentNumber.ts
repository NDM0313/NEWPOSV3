/**
 * Central document number generation — ERP Numbering Engine (Settings parity with web).
 *
 * Uses `generate_document_number` RPC → `erp_document_sequences`.
 * Respects Settings → Numbering Rules: prefix, padding, year reset,
 * branch_based counter, and include_branch_code (e.g. CR-SL-0001).
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type DocumentType =
  | 'sale'
  | 'purchase'
  | 'expense'
  | 'rental'
  | 'studio'
  | 'journal'
  | 'payment'
  | 'receipt'
  | 'product'
  | 'pos'
  | 'customer'
  | 'supplier'
  | 'worker'
  | 'job';

/** Maps mobile document types to generate_document_number p_document_type. */
const ERP_DOC_TYPE: Record<DocumentType, string> = {
  sale: 'sale',
  purchase: 'purchase',
  expense: 'expense',
  rental: 'rental',
  studio: 'studio',
  journal: 'journal',
  payment: 'payment',
  receipt: 'customer_receipt',
  product: 'product',
  pos: 'pos',
  customer: 'customer',
  supplier: 'supplier',
  worker: 'worker',
  job: 'job',
};

const FALLBACK_PREFIX: Record<DocumentType, string> = {
  sale: 'SL-',
  purchase: 'PUR-',
  expense: 'EXP-',
  rental: 'RNT-',
  studio: 'STD-',
  journal: 'JE-',
  payment: 'PAY-',
  receipt: 'RCP-',
  product: 'PRD-',
  pos: 'PS-',
  customer: 'CUS-',
  supplier: 'SUP-',
  worker: 'WRK-',
  job: 'JOB-',
};

/**
 * Get next document number from the ERP numbering engine (same as web Settings).
 */
export async function getNextDocumentNumber(
  companyId: string,
  branchId: string | null,
  documentType: DocumentType,
  includeYear?: boolean
): Promise<string> {
  const erpType = ERP_DOC_TYPE[documentType];
  if (!isSupabaseConfigured) {
    return `${FALLBACK_PREFIX[documentType]}${String(Date.now()).slice(-4)}`;
  }

  const { data, error } = await supabase.rpc('generate_document_number', {
    p_company_id: companyId,
    p_branch_id: branchId,
    p_document_type: erpType,
    p_include_year: includeYear ?? false,
  });

  if (error) {
    console.error(
      `[DOCUMENT NUMBER] generate_document_number failed (${documentType}/${erpType}):`,
      error,
    );
    return `${FALLBACK_PREFIX[documentType]}${String(Date.now()).slice(-4)}`;
  }

  if (typeof data === 'string' && data) return data;
  return `${FALLBACK_PREFIX[documentType]}${String(Date.now()).slice(-4)}`;
}
