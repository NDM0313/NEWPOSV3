/**
 * Numbering Maintenance / Sequence Sync Tool
 * Analyze DB max vs sequence last_number, fix out-of-sync sequences.
 */

import { supabase } from '@/lib/supabase';

const SENTINEL = '00000000-0000-0000-0000-000000000000';

/** Sequence numbers are small (e.g. 1–999999). Ignore timestamp-like or junk values. */
const MAX_REASONABLE_SEQUENCE = 999_999_999;

/** Extract numeric part from document numbers (e.g. PUR-0006 → 6, SL-26-0001 → 1). Ignores huge numbers (timestamps). */
function parseLastNumber(value: string | null | undefined): number {
  if (value == null || typeof value !== 'string') return 0;
  const s = value.trim();
  if (!s) return 0;
  const parts = s.split('-').filter((p) => /^\d+$/.test(p));
  if (parts.length === 0) return 0;
  const last = parseInt(parts[parts.length - 1], 10);
  if (isNaN(last) || last < 0 || last > MAX_REASONABLE_SEQUENCE) return 0;
  return last;
}

/** Max of parsed numbers from an array of document number strings. Only counts ERP-style numbers (e.g. PAY-0001), not timestamps. */
function maxFromStrings(values: (string | null | undefined)[]): number {
  let max = 0;
  for (const v of values) {
    const n = parseLastNumber(v);
    if (n > max) max = n;
  }
  return max;
}

export interface NumberingAnalysisRow {
  document_type: string;
  label: string;
  sequence_last: number;
  database_max: number;
  status: 'ok' | 'out_of_sync';
}

const DOC_TYPES: { document_type: string; label: string; prefix: string; table: string; column: string; prefixFilter?: (v: string) => boolean }[] = [
  { document_type: 'SALE', label: 'Sales', prefix: 'SL', table: 'sales', column: 'invoice_no', prefixFilter: (v) => /^SL-/i.test(v) && !/^STD-/i.test(v) && !/^POS-/i.test(v) },
  { document_type: 'STUDIO', label: 'Studio', prefix: 'STD', table: 'sales', column: 'invoice_no', prefixFilter: (v) => /^STD-/i.test(v) },
  { document_type: 'POS', label: 'POS', prefix: 'POS', table: 'sales', column: 'invoice_no', prefixFilter: (v) => /^POS-/i.test(v) },
  { document_type: 'PURCHASE', label: 'Purchase', prefix: 'PUR', table: 'purchases', column: 'po_no' },
  { document_type: 'PAYMENT', label: 'Payment', prefix: 'PAY', table: 'payments', column: 'reference_number', prefixFilter: (v) => /^PAY-\d/i.test(v) },
  { document_type: 'EXPENSE', label: 'Expense', prefix: 'EXP', table: 'expenses', column: 'expense_no' },
  { document_type: 'RENTAL', label: 'Rental', prefix: 'REN', table: 'rentals', column: 'booking_no' },
];

export const numberingMaintenanceService = {
  /**
   * Analyze: for each document type get DB max and sequence last_number; return status.
   */
  async analyze(companyId: string): Promise<NumberingAnalysisRow[]> {
    const year = new Date().getFullYear();

    const [sequencesRes, ...tableResults] = await Promise.all([
      supabase
        .from('erp_document_sequences')
        .select('document_type, last_number')
        .eq('company_id', companyId)
        .eq('branch_id', SENTINEL)
        .eq('year', year),
      supabase.from('sales').select('invoice_no').eq('company_id', companyId),
      supabase.from('purchases').select('po_no').eq('company_id', companyId),
      supabase.from('payments').select('reference_number').eq('company_id', companyId),
      supabase.from('expenses').select('expense_no').eq('company_id', companyId),
      supabase.from('rentals').select('booking_no').eq('company_id', companyId),
    ]);

    const sequenceByType = new Map<string, number>();
    if (sequencesRes.data) {
      for (const r of sequencesRes.data as { document_type: string; last_number: number }[]) {
        sequenceByType.set((r.document_type || '').toUpperCase(), Number(r.last_number ?? 0));
      }
    }

    const salesRows = (tableResults[0].data || []) as { invoice_no?: string }[];
    const purchaseRows = (tableResults[1].data || []) as { po_no?: string }[];
    const paymentRows = (tableResults[2].data || []) as { reference_number?: string }[];
    const expenseRows = (tableResults[3].data || []) as { expense_no?: string }[];
    const rentalRows = (tableResults[4].data || []) as { booking_no?: string }[];

    const result: NumberingAnalysisRow[] = [];

    for (const doc of DOC_TYPES) {
      let databaseMax = 0;
      if (doc.table === 'sales') {
        const values = salesRows.map((r) => r.invoice_no).filter((v) => !doc.prefixFilter || doc.prefixFilter(v || ''));
        databaseMax = maxFromStrings(values);
      } else if (doc.table === 'purchases') {
        databaseMax = maxFromStrings(purchaseRows.map((r) => r.po_no));
      } else if (doc.table === 'payments') {
        const values = paymentRows.map((r) => r.reference_number).filter((v) => !doc.prefixFilter || doc.prefixFilter(v || ''));
        databaseMax = maxFromStrings(values);
      } else if (doc.table === 'expenses') {
        databaseMax = maxFromStrings(expenseRows.map((r) => r.expense_no));
      } else if (doc.table === 'rentals') {
        databaseMax = maxFromStrings(rentalRows.map((r) => r.booking_no));
      }

      const sequenceLast = sequenceByType.get(doc.document_type) ?? 0;
      const status: 'ok' | 'out_of_sync' = databaseMax > sequenceLast ? 'out_of_sync' : 'ok';

      result.push({
        document_type: doc.document_type,
        label: doc.label,
        sequence_last: sequenceLast,
        database_max: databaseMax,
        status,
      });
    }

    return result;
  },

  /**
   * Fix sequence: set last_number = newLastNumber for (company, sentinel, document_type, year).
   * Upserts so row exists; next generated number will be newLastNumber + 1.
   * Caps newLastNumber to avoid integer overflow or timestamp-like values.
   */
  async fixSequence(companyId: string, documentType: string, newLastNumber: number): Promise<void> {
    const safeLast = Math.min(Math.max(0, Math.floor(newLastNumber)), MAX_REASONABLE_SEQUENCE);
    const year = new Date().getFullYear();
    const { data: existing } = await supabase
      .from('erp_document_sequences')
      .select('id, prefix, padding, year_reset, branch_based')
      .eq('company_id', companyId)
      .eq('branch_id', SENTINEL)
      .eq('document_type', documentType.toUpperCase())
      .eq('year', year)
      .maybeSingle();

    const payload: Record<string, unknown> = {
      company_id: companyId,
      branch_id: SENTINEL,
      document_type: documentType.toUpperCase(),
      year,
      last_number: safeLast,
      updated_at: new Date().toISOString(),
    };
    if (existing) {
      if ((existing as any).prefix != null) payload.prefix = (existing as any).prefix;
      if ((existing as any).padding != null) payload.padding = (existing as any).padding;
      if ((existing as any).year_reset != null) payload.year_reset = (existing as any).year_reset;
      if ((existing as any).branch_based != null) payload.branch_based = (existing as any).branch_based;
    } else {
      const defaults: Record<string, string> = {
        SALE: 'SL', PURCHASE: 'PUR', PAYMENT: 'PAY', EXPENSE: 'EXP', RENTAL: 'REN', STUDIO: 'STD', POS: 'POS',
      };
      payload.prefix = defaults[documentType.toUpperCase()] || documentType.substring(0, 3).toUpperCase();
      payload.padding = 4;
      payload.year_reset = true;
      payload.branch_based = false;
    }

    const { error } = await supabase.from('erp_document_sequences').upsert(payload, {
      onConflict: 'company_id,branch_id,document_type,year',
    });
    if (error) throw error;
  },
};
