import { supabase } from '../lib/supabase';

export const BRANCH_ALL_SENTINELS = ['all', 'default'] as const;

const BRANCH_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isBranchSentinel(branchId: string | null | undefined): boolean {
  if (branchId == null || branchId === '') return true;
  return BRANCH_ALL_SENTINELS.includes(branchId as (typeof BRANCH_ALL_SENTINELS)[number]);
}

/** True when branchId is a Postgres UUID suitable for `branch_id` / `p_branch_id`. */
export function isRealBranchUuid(branchId: string | null | undefined): branchId is string {
  if (branchId == null || typeof branchId !== 'string') return false;
  const t = branchId.trim();
  return BRANCH_UUID_RE.test(t);
}

/** For read RPCs: null when all/default/invalid (company-wide). */
export function safeRpcBranchId(branchId: string | null | undefined): string | null {
  return isRealBranchUuid(branchId) ? branchId.trim() : null;
}

/**
 * Resolve a branch UUID for writes (payments, expenses, sales, etc.).
 * Sentinels `all` / `default` → first branch for the company.
 */
export async function resolveBranchUuidForWrite(
  companyId: string,
  branchId: string | null | undefined,
  errorMessage = 'No branch set up. Add a branch in Settings to continue.',
): Promise<string> {
  if (isRealBranchUuid(branchId)) return branchId.trim();

  const { data, error } = await supabase
    .from('branches')
    .select('id')
    .eq('company_id', companyId)
    .limit(1)
    .maybeSingle();

  if (error || !(data as { id?: string })?.id) {
    throw new Error(errorMessage);
  }
  return String((data as { id: string }).id);
}
