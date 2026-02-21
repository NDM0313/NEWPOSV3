/**
 * Central document number generation – same format as web ERP.
 * Uses RPC get_next_document_number (atomic, document_sequences).
 * All mobile sub-modules (expenses, accounts, payments, etc.) use this.
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
  | 'product';

const FALLBACK_PREFIX: Record<DocumentType, string> = {
  sale: 'INV-',
  purchase: 'PO-',
  expense: 'EXP-',
  rental: 'RNT-',
  studio: 'STU-',
  journal: 'JE-',
  payment: 'PMT-',
  receipt: 'RCP-',
  product: 'PRD-',
};

async function getFirstBranchId(companyId: string): Promise<string | null> {
  const { data } = await supabase
    .from('branches')
    .select('id')
    .eq('company_id', companyId)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Get next document number from server – ATOMIC, web ERP format.
 * When branchId is null, uses first branch of company.
 */
export async function getNextDocumentNumber(
  companyId: string,
  branchId: string | null,
  documentType: DocumentType
): Promise<string> {
  if (!isSupabaseConfigured) {
    const prefix = FALLBACK_PREFIX[documentType];
    return `${prefix}${String(Date.now()).slice(-4)}`;
  }
  let effectiveBranchId = branchId;
  if (!effectiveBranchId) {
    effectiveBranchId = await getFirstBranchId(companyId);
  }
  if (!effectiveBranchId) {
    const prefix = FALLBACK_PREFIX[documentType];
    return `${prefix}${String(Date.now()).slice(-4)}`;
  }
  const { data, error } = await supabase.rpc('get_next_document_number', {
    p_company_id: companyId,
    p_branch_id: effectiveBranchId,
    p_document_type: documentType,
  });
  if (error) {
    console.error(`[DOCUMENT NUMBER] get_next_document_number failed (${documentType}):`, error);
    const prefix = FALLBACK_PREFIX[documentType];
    return `${prefix}${String(Date.now()).slice(-4)}`;
  }
  return typeof data === 'string' ? data : `${FALLBACK_PREFIX[documentType]}${String(Date.now()).slice(-4)}`;
}
