/**
 * Central document number generation – PER-COMPANY GLOBAL sequence.
 *
 * Uses the web ERP's `get_next_document_number_global` RPC which stores
 * counters in `document_sequences_global (company_id, document_type)`.
 * Numbers never regress and are shared across mobile, web, and POS.
 *
 * On the very first call for a (company, type) pair we also run
 * `_bootstrap_company_doc_sequence` so that if web documents already exist
 * we pick up from MAX(existing) instead of starting from 1.
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

/** Short code used as `document_sequences_global.document_type`. */
const SHORT_CODE: Record<DocumentType, string> = {
  sale: 'SL',
  purchase: 'PUR',
  expense: 'EXP',
  rental: 'RNT',
  studio: 'STD',
  journal: 'JE',
  payment: 'PAY',
  receipt: 'RCP',
  product: 'PRD',
  pos: 'PS',
  customer: 'CUS',
  supplier: 'SUP',
  worker: 'WRK',
  job: 'JOB',
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

const bootstrapped = new Set<string>();

async function ensureBootstrap(companyId: string, shortCode: string): Promise<void> {
  const key = `${companyId}:${shortCode}`;
  if (bootstrapped.has(key)) return;
  try {
    await supabase.rpc('_bootstrap_company_doc_sequence', {
      p_company_id: companyId,
      p_type: shortCode,
    });
  } catch (err) {
    // Non-fatal: if bootstrap RPC is missing the global RPC will still start
    // from 1, which is acceptable for fresh companies.
    console.warn('[DOCUMENT NUMBER] bootstrap skipped:', err);
  }
  bootstrapped.add(key);
}

/**
 * Get next document number from the per-company global sequence.
 *
 * NOTE: `branchId` is ignored (kept in the signature for backward compatibility
 * with earlier mobile callers). Numbers are per-company, not per-branch.
 * `includeYear` is not honored by `get_next_document_number_global`; if year
 * prefixing is needed it should be added to the RPC.
 */
export async function getNextDocumentNumber(
  companyId: string,
  _branchId: string | null,
  documentType: DocumentType,
  _includeYear?: boolean
): Promise<string> {
  const shortCode = SHORT_CODE[documentType];
  if (!isSupabaseConfigured) {
    return `${FALLBACK_PREFIX[documentType]}${String(Date.now()).slice(-4)}`;
  }

  await ensureBootstrap(companyId, shortCode);

  const { data, error } = await supabase.rpc('get_next_document_number_global', {
    p_company_id: companyId,
    p_type: shortCode,
  });

  if (error) {
    console.error(
      `[DOCUMENT NUMBER] get_next_document_number_global failed (${documentType}/${shortCode}):`,
      error,
    );
    return `${FALLBACK_PREFIX[documentType]}${String(Date.now()).slice(-4)}`;
  }

  if (typeof data === 'string' && data) return data;
  return `${FALLBACK_PREFIX[documentType]}${String(Date.now()).slice(-4)}`;
}
