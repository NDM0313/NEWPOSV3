/**
 * Numbering Maintenance / Sequence Sync Tool
 * Analyze DB max vs sequence last_number, fix out-of-sync sequences.
 * Phase B: unified PAY counter; legacy SUPPLIER_PAYMENT / WORKER_PAYMENT read-only.
 */

import { supabase } from '@/lib/supabase';

const SENTINEL = '00000000-0000-0000-0000-000000000000';

function isMissingColumnError(
  error: { code?: string; message?: string } | null | undefined,
  column: string,
): boolean {
  if (!error) return false;
  const msg = error.message ?? '';
  return (
    error.code === 'PGRST204'
    || msg.includes('schema cache')
    || msg.includes(`'${column}'`)
    || msg.includes(column)
  );
}

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
  effective_max: number;
  status: 'ok' | 'out_of_sync';
  /** Min last_number across counter rows for this type/year (when rows diverge). */
  sequence_min_row?: number;
  /** PAYMENT row alone before folding legacy SUPPLIER_PAYMENT into effective last. */
  sequence_payment_only?: number;
  /** Max WPY-* voucher suffix in payments (historical; informational). */
  legacy_wpy_max?: number;
}

export interface NumberingLegacyRow {
  document_type: string;
  label: string;
  sequence_last: number;
}

export interface NumberingAnalyzeResult {
  rows: NumberingAnalysisRow[];
  legacyRows: NumberingLegacyRow[];
}

const LEGACY_DOC_TYPES: { document_type: string; label: string }[] = [
  { document_type: 'SUPPLIER_PAYMENT', label: 'Supplier payment (legacy)' },
  { document_type: 'WORKER_PAYMENT', label: 'Worker payment (legacy WPY)' },
];

const DOC_TYPES: {
  document_type: string;
  label: string;
  prefix: string;
  table: string;
  column: string;
  paymentType?: 'paid' | 'received';
  prefixFilter?: (v: string) => boolean;
}[] = [
  { document_type: 'SALE', label: 'Sales', prefix: 'SL', table: 'sales', column: 'invoice_no', prefixFilter: (v) => /^SL-/i.test(v) && !/^STD-/i.test(v) && !/^POS-/i.test(v) },
  { document_type: 'STUDIO', label: 'Studio', prefix: 'STD', table: 'sales', column: 'invoice_no', prefixFilter: (v) => /^STD-/i.test(v) },
  { document_type: 'POS', label: 'POS', prefix: 'POS', table: 'sales', column: 'invoice_no', prefixFilter: (v) => /^POS-/i.test(v) },
  { document_type: 'PURCHASE', label: 'Purchase', prefix: 'PUR', table: 'purchases', column: 'po_no' },
  {
    document_type: 'PAYMENT',
    label: 'Outgoing payment',
    prefix: 'PAY',
    table: 'payments',
    column: 'reference_number',
    paymentType: 'paid',
    prefixFilter: (v) => /^PAY-\d/i.test(v) && !/^PAY-BACKFILL-/i.test(v),
  },
  {
    document_type: 'CUSTOMER_RECEIPT',
    label: 'Customer receipt',
    prefix: 'RCV',
    table: 'payments',
    column: 'reference_number',
    paymentType: 'received',
    prefixFilter: (v) => /^(RCV|PAY)-\d/i.test(v) && !/^PAY-BACKFILL/i.test(v),
  },
  { document_type: 'EXPENSE', label: 'Expense', prefix: 'EXP', table: 'expenses', column: 'expense_no' },
  { document_type: 'RENTAL', label: 'Rental', prefix: 'REN', table: 'rentals', column: 'booking_no' },
  { document_type: 'PRODUCT', label: 'Product', prefix: 'PRD', table: 'products', column: 'sku', prefixFilter: (v) => /^PRD-/i.test(v) },
];

type SeqRow = {
  document_type: string;
  last_number: number;
  year: number;
  year_reset?: boolean | null;
  branch_id?: string | null;
};

/** Effective sequence year for a doc type (calendar year when year_reset, else 0). */
function resolveSeqYear(
  sequences: SeqRow[],
  documentType: string,
  calendarYear: number,
): number {
  const typeUpper = documentType.toUpperCase();
  const sentinelCurrent = sequences.find(
    (r) =>
      (r.document_type || '').toUpperCase() === typeUpper
      && String(r.branch_id || '') === SENTINEL
      && Number(r.year) === calendarYear,
  );
  if (sentinelCurrent && sentinelCurrent.year_reset === false) return 0;
  const anyType = sequences.find((r) => (r.document_type || '').toUpperCase() === typeUpper);
  if (anyType && anyType.year_reset === false) return 0;
  return calendarYear;
}

/** Max / min last_number across all branch rows for type + effective year. */
function sequenceStatsForType(
  sequences: SeqRow[],
  documentType: string,
  seqYear: number,
): { max: number; min: number } {
  const typeUpper = documentType.toUpperCase();
  let max = 0;
  let min = Number.POSITIVE_INFINITY;
  let found = false;
  for (const r of sequences) {
    if ((r.document_type || '').toUpperCase() !== typeUpper) continue;
    if (Number(r.year) !== seqYear) continue;
    const n = Number(r.last_number ?? 0);
    if (n > max) max = n;
    if (n < min) min = n;
    found = true;
  }
  return { max, min: found ? min : 0 };
}

export const numberingMaintenanceService = {
  /**
   * Analyze: for each document type get DB max and sequence last_number; return status.
   * Phase B shape: `{ rows, legacyRows }`.
   */
  async analyze(companyId: string): Promise<NumberingAnalyzeResult> {
    const calendarYear = new Date().getFullYear();

    const [sequencesRes, ...tableResults] = await Promise.all([
      supabase
        .from('erp_document_sequences')
        .select('document_type, last_number, year, year_reset, branch_id')
        .eq('company_id', companyId),
      supabase.from('sales').select('invoice_no').eq('company_id', companyId),
      supabase.from('purchases').select('po_no').eq('company_id', companyId),
      supabase.from('payments').select('reference_number, payment_type, reference_type').eq('company_id', companyId),
      supabase.from('expenses').select('expense_no').eq('company_id', companyId),
      supabase.from('rentals').select('booking_no').eq('company_id', companyId),
      supabase.from('products').select('sku').eq('company_id', companyId),
    ]);

    const sequences = (sequencesRes.data || []) as SeqRow[];

    const salesRows = (tableResults[0].data || []) as { invoice_no?: string }[];
    const purchaseRows = (tableResults[1].data || []) as { po_no?: string }[];
    const paymentRows = (tableResults[2].data || []) as {
      reference_number?: string;
      payment_type?: string;
      reference_type?: string;
    }[];
    const expenseRows = (tableResults[3].data || []) as { expense_no?: string }[];
    const rentalRows = (tableResults[4].data || []) as { booking_no?: string }[];
    const productRows = (tableResults[5].data || []) as { sku?: string }[];

    const supplierSeqYear = resolveSeqYear(sequences, 'SUPPLIER_PAYMENT', calendarYear);
    const supplierStats = sequenceStatsForType(sequences, 'SUPPLIER_PAYMENT', supplierSeqYear);

    const result: NumberingAnalysisRow[] = [];

    for (const doc of DOC_TYPES) {
      let databaseMax = 0;
      if (doc.table === 'sales') {
        const values = salesRows.map((r) => r.invoice_no).filter((v) => !doc.prefixFilter || doc.prefixFilter(v || ''));
        databaseMax = maxFromStrings(values);
      } else if (doc.table === 'purchases') {
        databaseMax = maxFromStrings(purchaseRows.map((r) => r.po_no));
      } else if (doc.table === 'payments') {
        const values = paymentRows
          .filter((r) => !doc.paymentType || String(r.payment_type || '').toLowerCase() === doc.paymentType)
          .map((r) => r.reference_number)
          .filter((v) => !doc.prefixFilter || doc.prefixFilter(v || ''));
        databaseMax = maxFromStrings(values);
      } else if (doc.table === 'expenses') {
        databaseMax = maxFromStrings(expenseRows.map((r) => r.expense_no));
      } else if (doc.table === 'rentals') {
        databaseMax = maxFromStrings(rentalRows.map((r) => r.booking_no));
      } else if (doc.table === 'products') {
        const values = productRows.map((r) => r.sku).filter((v) => !doc.prefixFilter || doc.prefixFilter(v || ''));
        databaseMax = maxFromStrings(values);
      }

      const seqYear = resolveSeqYear(sequences, doc.document_type, calendarYear);
      const stats = sequenceStatsForType(sequences, doc.document_type, seqYear);
      let sequenceLast = stats.max;
      const sequenceMinRow = stats.min;

      const row: NumberingAnalysisRow = {
        document_type: doc.document_type,
        label: doc.label,
        sequence_last: sequenceLast,
        database_max: databaseMax,
        effective_max: Math.max(sequenceLast, databaseMax),
        status: databaseMax > sequenceLast ? 'out_of_sync' : 'ok',
      };

      if (sequenceMinRow < sequenceLast) {
        row.sequence_min_row = sequenceMinRow;
      }

      if (doc.document_type === 'PAYMENT') {
        row.sequence_payment_only = sequenceLast;
        // Effective counter last includes legacy supplier sequence (Phase B unified PAY).
        const folded = Math.max(sequenceLast, supplierStats.max);
        if (folded > sequenceLast) {
          row.sequence_last = folded;
          row.effective_max = Math.max(folded, databaseMax);
          row.status = databaseMax > folded ? 'out_of_sync' : 'ok';
        }
        const wpyValues = paymentRows
          .map((r) => r.reference_number)
          .filter((v) => /^WPY-/i.test(v || ''));
        const wpyMax = maxFromStrings(wpyValues);
        if (wpyMax > 0) row.legacy_wpy_max = wpyMax;
      }

      result.push(row);
    }

    const legacyRows: NumberingLegacyRow[] = [];
    for (const leg of LEGACY_DOC_TYPES) {
      const seqYear = resolveSeqYear(sequences, leg.document_type, calendarYear);
      const stats = sequenceStatsForType(sequences, leg.document_type, seqYear);
      if (stats.max > 0 || sequences.some((r) => (r.document_type || '').toUpperCase() === leg.document_type)) {
        legacyRows.push({
          document_type: leg.document_type,
          label: leg.label,
          sequence_last: stats.max,
        });
      }
    }

    return { rows: result, legacyRows };
  },

  /**
   * Fold SUPPLIER_PAYMENT counter into PAYMENT via company-scoped RPC (no voucher rewrites).
   */
  async mergeLegacyPaySequences(companyId: string): Promise<{
    success: boolean;
    updated: boolean;
    mergedLastNumber?: number;
    message?: string;
    error?: string;
  }> {
    const { data, error } = await supabase.rpc('merge_supplier_payment_sequence_for_company', {
      p_company_id: companyId,
    });
    if (error) {
      return { success: false, updated: false, error: error.message };
    }
    const json = (data || {}) as {
      success?: boolean;
      updated?: boolean;
      merged_last_number?: number;
      message?: string;
      error?: string;
    };
    if (json.success === false) {
      return { success: false, updated: false, error: json.error || 'Merge failed' };
    }
    return {
      success: true,
      updated: Boolean(json.updated),
      mergedLastNumber: json.merged_last_number,
      message: json.message,
    };
  },

  /**
   * Fix sequence: set last_number = newLastNumber for (company, sentinel, document_type, year).
   * Upserts so row exists; next generated number will be newLastNumber + 1.
   * Caps newLastNumber to avoid integer overflow or timestamp-like values.
   * When year_reset is false, uses year = 0.
   */
  async fixSequence(companyId: string, documentType: string, newLastNumber: number): Promise<void> {
    const safeLast = Math.min(Math.max(0, Math.floor(newLastNumber)), MAX_REASONABLE_SEQUENCE);
    const calendarYear = new Date().getFullYear();
    const docUpper = documentType.toUpperCase();

    const selectColumns = 'id, prefix, padding, year_reset, branch_based, include_branch_code, year, last_number';
    let existing: Record<string, unknown> | null = null;
    let selectError: { code?: string; message?: string } | null = null;

    const primary = await supabase
      .from('erp_document_sequences')
      .select(selectColumns)
      .eq('company_id', companyId)
      .eq('branch_id', SENTINEL)
      .eq('document_type', docUpper)
      .eq('year', calendarYear)
      .maybeSingle();

    existing = (primary.data as Record<string, unknown> | null) ?? null;
    selectError = primary.error;

    if (selectError && isMissingColumnError(selectError, 'include_branch_code')) {
      const fallback = await supabase
        .from('erp_document_sequences')
        .select('id, prefix, padding, year_reset, branch_based, year, last_number')
        .eq('company_id', companyId)
        .eq('branch_id', SENTINEL)
        .eq('document_type', docUpper)
        .eq('year', calendarYear)
        .maybeSingle();
      existing = (fallback.data as Record<string, unknown> | null) ?? null;
      selectError = fallback.error;
    }

    // Fallback: year=0 counter when year_reset is false or current-year row missing
    if (!existing && !selectError) {
      const year0 = await supabase
        .from('erp_document_sequences')
        .select(selectColumns)
        .eq('company_id', companyId)
        .eq('branch_id', SENTINEL)
        .eq('document_type', docUpper)
        .eq('year', 0)
        .maybeSingle();
      if (!year0.error && year0.data) {
        existing = year0.data as Record<string, unknown>;
      } else if (year0.error && isMissingColumnError(year0.error, 'include_branch_code')) {
        const year0fb = await supabase
          .from('erp_document_sequences')
          .select('id, prefix, padding, year_reset, branch_based, year, last_number')
          .eq('company_id', companyId)
          .eq('branch_id', SENTINEL)
          .eq('document_type', docUpper)
          .eq('year', 0)
          .maybeSingle();
        existing = (year0fb.data as Record<string, unknown> | null) ?? null;
        selectError = year0fb.error;
      }
    }

    if (selectError) throw selectError;

    const yearReset = existing?.year_reset !== false;
    const year = existing && existing.year_reset === false
      ? 0
      : (existing?.year != null ? Number(existing.year) : calendarYear);

    const payload: Record<string, unknown> = {
      company_id: companyId,
      branch_id: SENTINEL,
      document_type: docUpper,
      year: yearReset ? (Number.isFinite(year) ? year : calendarYear) : 0,
      last_number: safeLast,
      updated_at: new Date().toISOString(),
    };
    if (existing) {
      if (existing.prefix != null) payload.prefix = existing.prefix;
      if (existing.padding != null) payload.padding = existing.padding;
      if (existing.year_reset != null) payload.year_reset = existing.year_reset;
      if (existing.branch_based != null) payload.branch_based = existing.branch_based;
      if (existing.include_branch_code != null) payload.include_branch_code = existing.include_branch_code;
    } else {
      const defaults: Record<string, string> = {
        SALE: 'SL',
        PURCHASE: 'PUR',
        PAYMENT: 'PAY',
        CUSTOMER_RECEIPT: 'RCV',
        EXPENSE: 'EXP',
        RENTAL: 'REN',
        STUDIO: 'STD',
        POS: 'POS',
        PRODUCT: 'PRD',
        CUSTOMER: 'CUS',
        SUPPLIER: 'SUP',
        WORKER: 'WRK',
        JOB: 'JOB',
      };
      payload.prefix = defaults[docUpper] || documentType.substring(0, 3).toUpperCase();
      payload.padding = 4;
      payload.year_reset = true;
      payload.branch_based = false;
    }

    // Also bump all other branch rows for this type/year to at least safeLast (never decrease).
    const { data: allRows } = await supabase
      .from('erp_document_sequences')
      .select('id, last_number, branch_id')
      .eq('company_id', companyId)
      .eq('document_type', docUpper)
      .eq('year', payload.year as number);

    if (allRows && allRows.length > 0) {
      for (const r of allRows as { id: string; last_number: number; branch_id: string }[]) {
        const cur = Number(r.last_number ?? 0);
        if (cur >= safeLast) continue;
        const { error: updErr } = await supabase
          .from('erp_document_sequences')
          .update({ last_number: safeLast, updated_at: new Date().toISOString() })
          .eq('id', r.id);
        if (updErr) throw updErr;
      }
      // Ensure sentinel row exists / is upserted
      const hasSentinel = allRows.some(
        (r: { branch_id: string }) => String(r.branch_id) === SENTINEL,
      );
      if (hasSentinel) return;
    }

    let { error } = await supabase.from('erp_document_sequences').upsert(payload, {
      onConflict: 'company_id,branch_id,document_type,year',
    });

    if (error && isMissingColumnError(error, 'include_branch_code')) {
      delete payload.include_branch_code;
      const retry = await supabase.from('erp_document_sequences').upsert(payload, {
        onConflict: 'company_id,branch_id,document_type,year',
      });
      error = retry.error;
    }

    if (error) throw error;
  },

  async syncToEffectiveMax(
    companyId: string,
    documentType: string
  ): Promise<{ success: boolean; updated: boolean; message?: string; error?: string }> {
    try {
      const { rows } = await this.analyze(companyId);
      const docTypeUpper = documentType.toUpperCase();
      const row = rows.find((r) => r.document_type.toUpperCase() === docTypeUpper);
      if (!row) {
        return { success: false, updated: false, error: `Unknown document type: ${documentType}` };
      }
      if (row.status === 'ok') {
        return {
          success: true,
          updated: false,
          message: `${row.label} sequence already in sync (last=${row.sequence_last}, db max=${row.database_max})`,
        };
      }
      await this.fixSequence(companyId, row.document_type, row.effective_max);
      return {
        success: true,
        updated: true,
        message: `Synced ${row.label} sequence to ${row.effective_max}`,
      };
    } catch (e) {
      return {
        success: false,
        updated: false,
        error: e instanceof Error ? e.message : 'Sequence sync failed',
      };
    }
  },
};
