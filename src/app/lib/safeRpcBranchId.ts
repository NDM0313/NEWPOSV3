const BRANCH_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Maps TopHeader / filter sentinels to null for Postgres UUID RPC args. */
export function safeRpcBranchId(branchId: string | null | undefined): string | null {
  if (branchId == null || branchId === '' || branchId === 'all' || branchId === 'default') {
    return null;
  }
  const t = String(branchId).trim();
  return BRANCH_UUID_RE.test(t) ? t : null;
}
