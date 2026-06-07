/**
 * Prefix-agnostic voucher numeric suffix parser.
 * Sequence continuity is company + document_type + year; prefix/branch-code is display only.
 */

export const MAX_REASONABLE_SEQUENCE_SUFFIX = 999_999_999;

/** Extract final numeric segment from RCV-0008, HQ-RCV-0009, G140-RCV-0010, JV-000103, etc. */
export function parseVoucherNumericSuffix(ref: string | null | undefined): number {
  if (ref == null || typeof ref !== 'string') return 0;
  const s = ref.trim();
  if (!s) return 0;
  const parts = s.split('-').filter((p) => /^\d+$/.test(p));
  if (parts.length === 0) return 0;
  const last = parseInt(parts[parts.length - 1], 10);
  if (isNaN(last) || last < 0 || last > MAX_REASONABLE_SEQUENCE_SUFFIX) return 0;
  return last;
}

export function isReasonableSequenceSuffix(n: number): boolean {
  return Number.isFinite(n) && n >= 0 && n <= MAX_REASONABLE_SEQUENCE_SUFFIX;
}

/** Max suffix from an array of voucher strings (optional row filter). */
export function maxVoucherNumericSuffix(
  values: (string | null | undefined)[],
  rowFilter?: (value: string) => boolean
): number {
  let max = 0;
  for (const v of values) {
    const s = String(v || '').trim();
    if (!s) continue;
    if (rowFilter && !rowFilter(s)) continue;
    const n = parseVoucherNumericSuffix(s);
    if (n > max) max = n;
  }
  return max;
}

/** Voucher document types with unified company-wide numeric counter in SQL. */
export const UNIFIED_VOUCHER_DOC_TYPES = [
  'CUSTOMER_RECEIPT',
  'PAYMENT',
  'EXPENSE',
  'MANUAL_JOURNAL',
  'FUND_TRANSFER',
] as const;

export type UnifiedVoucherDocType = (typeof UNIFIED_VOUCHER_DOC_TYPES)[number];

export function isUnifiedVoucherDocType(documentType: string): boolean {
  return (UNIFIED_VOUCHER_DOC_TYPES as readonly string[]).includes(
    String(documentType || '').toUpperCase()
  );
}

/** Maintenance analyze sources per document type. */
export const VOUCHER_ANALYZE_SOURCES: Record<
  string,
  { tables: { table: string; column: string; filter?: (row: Record<string, unknown>) => boolean }[] }
> = {
  CUSTOMER_RECEIPT: {
    tables: [
      {
        table: 'payments',
        column: 'reference_number',
        filter: (r) => String(r.payment_type || '').toLowerCase() === 'received',
      },
      { table: 'rental_payments', column: 'reference' },
    ],
  },
  PAYMENT: {
    tables: [
      {
        table: 'payments',
        column: 'reference_number',
        filter: (r) =>
          String(r.payment_type || '').toLowerCase() === 'paid' &&
          !String(r.reference_number || '').toUpperCase().startsWith('PAY-BACKFILL-'),
      },
    ],
  },
  EXPENSE: {
    tables: [
      { table: 'expenses', column: 'expense_no' },
      {
        table: 'payments',
        column: 'reference_number',
        filter: (r) => /(?:^|-)EXP-\d/i.test(String(r.reference_number || '')),
      },
    ],
  },
  MANUAL_JOURNAL: {
    tables: [
      { table: 'journal_entries', column: 'entry_no' },
      { table: 'journal_entries', column: 'document_no' },
    ],
  },
  FUND_TRANSFER: {
    tables: [
      { table: 'journal_entries', column: 'entry_no' },
      { table: 'journal_entries', column: 'document_no' },
    ],
  },
};
