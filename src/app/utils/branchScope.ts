import type { Branch } from '@/app/services/branchService';

const BRANCH_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BRANCH_SENTINELS = new Set(['all', 'default']);

/** True when id is a Postgres UUID suitable for `branch_id` columns. */
export function isRealBranchUuid(branchId: string | null | undefined): branchId is string {
  if (branchId == null || typeof branchId !== 'string') return false;
  const t = branchId.trim();
  if (!t || BRANCH_SENTINELS.has(t)) return false;
  return BRANCH_UUID_RE.test(t);
}

/**
 * Branch id for stock_movements writes and branch-scoped stock reads.
 * Uses context branch when valid; otherwise company default branch (e.g. admin on "All branches").
 */
export function resolveStockWriteBranchId(
  contextBranchId: string | null | undefined,
  defaultBranchId?: string | null,
): string | null {
  if (isRealBranchUuid(contextBranchId)) return contextBranchId.trim();
  if (isRealBranchUuid(defaultBranchId)) return defaultBranchId.trim();
  return null;
}

/** Initial branch for stock adjust dialogs: context branch, else default, else first active. */
export function pickInitialStockAdjustBranchId(
  branches: Branch[],
  contextBranchId: string | null,
  defaultBranchId: string | null,
): string | null {
  const fromContext = resolveStockWriteBranchId(contextBranchId, defaultBranchId);
  if (fromContext && branches.some((b) => b.id === fromContext)) return fromContext;
  const active = branches.filter((b) => b.is_active !== false);
  return active[0]?.id ?? branches[0]?.id ?? null;
}

/** For inventory overview / movement queries: null = company-wide (all branches). */
export function stockOverviewBranchId(branchId: string | null | undefined): string | null {
  return isRealBranchUuid(branchId) ? branchId.trim() : null;
}

/** Minimal PostgREST query shape for branch stock filters. */
export type BranchStockFilterableQuery = {
  eq: (column: string, value: string) => BranchStockFilterableQuery;
  or: (filters: string) => BranchStockFilterableQuery;
};

/**
 * Branch-scoped stock reads: include branch-specific rows plus company-wide rows (branch_id null).
 * Opening stock and legacy adjustments often use null branch_id; must count for the selected location.
 */
export function applyBranchStockMovementFilter<Q extends BranchStockFilterableQuery>(
  query: Q,
  branchId?: string | null,
): Q {
  if (!isRealBranchUuid(branchId)) return query;
  const id = branchId.trim();
  return query.or(`branch_id.eq.${id},branch_id.is.null`) as Q;
}
