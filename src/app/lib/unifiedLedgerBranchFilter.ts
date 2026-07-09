/**
 * Strict branch filter for unified ledger (Phase 1.5 + 20260708190000).
 * Branch-specific ledgers must NOT include NULL-branch transactional rows.
 * NULL branch_id may pass for openings/system seed and company-level journal /
 * gl_correction families — mirrors `_unified_ledger_strict_branch_includes_row`.
 */

const OPENING_REFERENCE_PREFIXES = ['opening_balance'] as const;

const OPENING_REFERENCE_EXACT = new Set([
  'opening_balance',
  'opening_balance_contact_ar',
  'opening_balance_contact_ap',
  'opening_balance_contact_worker',
  'system_seed',
  'coa_opening',
]);

/** Company-wide JE families allowed with NULL branch under a branch filter (SQL 190000). */
const NULL_BRANCH_COMPANY_WIDE_REFS = new Set([
  'journal',
  'manual_journal',
  'gl_correction',
  'correction_reversal',
]);

export type BranchFilterRow = {
  branchId?: string | null;
  referenceType?: string | null;
};

function normalizeRefType(ref: string | null | undefined): string {
  return String(ref ?? '')
    .trim()
    .toLowerCase();
}

/** True when NULL branch_id is allowed under a branch-specific filter. */
export function isVerifiedNullBranchRow(referenceType: string | null | undefined): boolean {
  const rt = normalizeRefType(referenceType);
  // Empty reference_type allowed (matches SQL IN (..., ''))
  if (!rt) return true;
  if (OPENING_REFERENCE_EXACT.has(rt)) return true;
  if (NULL_BRANCH_COMPANY_WIDE_REFS.has(rt)) return true;
  return OPENING_REFERENCE_PREFIXES.some((p) => rt === p || rt.startsWith(`${p}_`));
}

/**
 * Whether a journal row belongs in a branch-scoped ledger.
 * - branchId filter null → include all rows
 * - row.branchId matches → include
 * - row.branchId null + verified opening/system ref → include
 * - otherwise → exclude (report as branch_attribution_risk in diagnostics)
 */
export function unifiedLedgerBranchIncludesRow(
  filterBranchId: string | null | undefined,
  row: BranchFilterRow
): boolean {
  if (!filterBranchId) return true;
  const rowBranch = row.branchId ?? null;
  if (rowBranch === filterBranchId) return true;
  if (rowBranch == null && isVerifiedNullBranchRow(row.referenceType)) return true;
  return false;
}

/** Reference types treated as transactional for branch_attribution_risk diagnostics. */
export const TRANSACTIONAL_REFERENCE_TYPES = new Set([
  'sale',
  'sale_adjustment',
  'sale_reversal',
  'sale_return',
  'payment',
  'payment_adjustment',
  'manual_receipt',
  'purchase',
  'purchase_adjustment',
  'rental',
  'expense',
  'transfer',
]);

export function isTransactionalReferenceType(referenceType: string | null | undefined): boolean {
  const rt = normalizeRefType(referenceType);
  return TRANSACTIONAL_REFERENCE_TYPES.has(rt);
}
