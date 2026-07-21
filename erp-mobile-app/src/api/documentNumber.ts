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
 * Pass the real branch UUID; Postgres resolves global vs branch_based. Expenses: use create_expense_document RPC.
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

/** Global contact reference types — same as web contactService (get_next_document_number_global). */
export type GlobalContactCodeType = 'CUS' | 'SUP' | 'WRK';

/** Global sale / POS / studio stage sequences — same as web documentNumberService. */
export type GlobalSaleDocumentType = 'SDR' | 'SQT' | 'SOR' | 'SL' | 'STD' | 'PS';

export type GlobalDocumentNumberType = GlobalContactCodeType | GlobalSaleDocumentType;

export function contactCodeTypeForBackendType(
  type: 'customer' | 'supplier' | 'worker' | 'both',
): GlobalContactCodeType | null {
  if (type === 'supplier') return 'SUP';
  if (type === 'worker') return 'WRK';
  if (type === 'customer' || type === 'both') return 'CUS';
  return null;
}

/**
 * Next global document number (company-level, atomic) — web SalesContext parity.
 * Sales stages: SDR / SQT / SOR; final SL; POS PS; studio STD.
 */
export async function getNextDocumentNumberGlobal(
  companyId: string,
  type: GlobalDocumentNumberType,
): Promise<string> {
  if (!isSupabaseConfigured) {
    return `${type}-${String(Date.now()).slice(-4)}`;
  }

  const { data, error } = await supabase.rpc('get_next_document_number_global', {
    p_company_id: companyId,
    p_type: type,
  });

  if (error) {
    console.error(`[DOCUMENT NUMBER] get_next_document_number_global(${type}) failed:`, error);
    throw new Error(error.message || `Failed to get next document number (${type})`);
  }
  if (typeof data !== 'string' || !data.trim()) {
    throw new Error(`Invalid document number returned from database (${type})`);
  }
  return data.trim();
}

/**
 * Next CUS/SUP/WRK code for contacts.code — must match web ERP global sequence.
 */
export async function getNextContactReferenceCode(
  companyId: string,
  backendType: 'customer' | 'supplier' | 'worker' | 'both',
): Promise<{ code: string | null; error: string | null }> {
  const codeType = contactCodeTypeForBackendType(backendType);
  if (!codeType) return { code: null, error: 'Invalid contact type for reference number.' };
  if (!isSupabaseConfigured) {
    return { code: null, error: 'App not configured.' };
  }

  try {
    const code = await getNextDocumentNumberGlobal(companyId, codeType);
    return { code, error: null };
  } catch (e) {
    return { code: null, error: (e as Error).message || 'Failed to get next contact reference number.' };
  }
}
