const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** JE ids backed by synthetic liquidity payments visible in the current Roznamcha payment set. */
export function buildPaymentBackedSkipJeIdsFromPayments(
  payments: Array<{ reference_id?: string | null }>,
): Set<string> {
  const out = new Set<string>();
  for (const p of payments) {
    const rid = String(p.reference_id || '').trim();
    if (rid && UUID_RE.test(rid)) out.add(rid);
  }
  return out;
}

/** Branch filter: payment row branch OR linked rental document branch (legacy null payment.branch_id). */
export function paymentMatchesRoznamchaBranch(
  payment: {
    branch_id?: string | null;
    reference_type?: string | null;
    reference_id?: string | null;
  },
  branchId: string | null,
  rentalBranchById: Map<string, string>,
): boolean {
  if (!branchId) return true;
  const payBranch = payment.branch_id != null ? String(payment.branch_id) : '';
  if (!payBranch) return true;
  if (payBranch === branchId) return true;
  const rt = String(payment.reference_type || '').toLowerCase();
  if (rt === 'rental' && payment.reference_id) {
    return rentalBranchById.get(String(payment.reference_id)) === branchId;
  }
  return false;
}

export function rentalMatchesRoznamchaBranch(
  branchId: string | null,
  rentalBranchId: string | null | undefined,
  jeBranchId: string | null | undefined,
): boolean {
  if (!branchId) return true;
  if (rentalBranchId) return String(rentalBranchId) === branchId;
  if (jeBranchId) return String(jeBranchId) === branchId;
  return true;
}
