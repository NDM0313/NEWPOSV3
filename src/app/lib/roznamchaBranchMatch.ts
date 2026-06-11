/** Branch filter helpers for Roznamcha payment rows (shared with tests). */

export type RoznamchaBranchMaps = {
  rentalBranchById: Map<string, string>;
  journalBranchById: Map<string, string>;
  saleBranchById: Map<string, string>;
};

/**
 * Branch filter: payment row branch OR linked document branch (rental / JE / sale).
 * Legacy rows may have null payments.branch_id when mobile wrote without branch context.
 */
export function paymentMatchesRoznamchaBranch(
  payment: {
    branch_id?: string | null;
    reference_type?: string | null;
    reference_id?: string | null;
  },
  branchId: string | null,
  maps: RoznamchaBranchMaps
): boolean {
  if (!branchId) return true;
  const payBranch = payment.branch_id != null ? String(payment.branch_id) : '';
  if (payBranch === branchId) return true;

  const rt = String(payment.reference_type || '').toLowerCase();
  const refId = payment.reference_id ? String(payment.reference_id) : '';

  if (rt === 'rental' && refId) {
    return maps.rentalBranchById.get(refId) === branchId;
  }
  if ((rt === 'manual_receipt' || rt === 'manual_payment') && refId) {
    const jeBranch = maps.journalBranchById.get(refId);
    if (jeBranch) return jeBranch === branchId;
  }
  if (rt === 'sale' && refId) {
    const saleBranch = maps.saleBranchById.get(refId);
    if (saleBranch) return saleBranch === branchId;
  }

  return false;
}
