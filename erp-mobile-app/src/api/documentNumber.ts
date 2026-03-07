/**
 * Central document number generation – same engine as Web ERP (Settings → Numbering Rules).
 * Uses RPC generate_document_number (erp_document_sequences). Single source of truth.
 * All mobile modules (sales, purchases, expenses, payments, etc.) use this.
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

const FALLBACK_PREFIX: Record<DocumentType, string> = {
  sale: 'SL-',
  purchase: 'PUR-',
  expense: 'EXP-',
  rental: 'REN-',
  studio: 'STD-',
  journal: 'JE-',
  payment: 'PAY-',
  receipt: 'RCP-',
  product: 'PRD-',
  pos: 'POS-',
  customer: 'CUS-',
  supplier: 'SUP-',
  worker: 'WRK-',
  job: 'JOB-',
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
 * Get next document number from server – ATOMIC, same as Web (Settings → Numbering Rules).
 * Uses generate_document_number RPC (erp_document_sequences). No duplicates across Web/Mobile/POS.
 * When branchId is null, uses first branch of company (or company-level sequence per engine).
 */
export async function getNextDocumentNumber(
  companyId: string,
  branchId: string | null,
  documentType: DocumentType,
  includeYear?: boolean
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
  const { data, error } = await supabase.rpc('generate_document_number', {
    p_company_id: companyId,
    p_branch_id: effectiveBranchId,
    p_document_type: documentType,
    p_include_year: includeYear ?? false,
  });
  if (error) {
    console.error(`[DOCUMENT NUMBER] generate_document_number failed (${documentType}):`, error);
    const prefix = FALLBACK_PREFIX[documentType];
    return `${prefix}${String(Date.now()).slice(-4)}`;
  }
  return typeof data === 'string' ? data : `${FALLBACK_PREFIX[documentType]}${String(Date.now()).slice(-4)}`;
}
