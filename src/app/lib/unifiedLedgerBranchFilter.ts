/**
 * Strict branch filter for unified ledger (Phase 1.5).
 * Branch-specific ledgers must NOT include NULL-branch transactional rows.
 * Only verified opening/system reference types may pass with NULL branch_id.
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
  if (!rt) return false;
  if (OPENING_REFERENCE_EXACT.has(rt)) return true;
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
