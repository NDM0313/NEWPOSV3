export type ListBranchScope =
  | { mode: 'single'; branchId: string }
  | { mode: 'accessible'; branchIds: string[] }
  | { mode: 'all' };

/** Resolve which branches a list query / client filter should cover. */
export function resolveListBranchScope(
  selectedBranchId: string | null | undefined,
  accessibleBranchIds: string[],
  isAdminOrOwner: boolean,
): ListBranchScope {
  const selected = selectedBranchId?.trim() ?? '';
  if (selected && selected !== 'all' && selected !== 'default') {
    return { mode: 'single', branchId: selected };
  }
  if (isAdminOrOwner) {
    return { mode: 'all' };
  }
  const ids = [...new Set(accessibleBranchIds.filter(Boolean))];
  if (ids.length > 0) {
    return { mode: 'accessible', branchIds: ids };
  }
  if (!isAdminOrOwner) {
    return { mode: 'accessible', branchIds: [] };
  }
  return { mode: 'all' };
}

function rowBranchId(row: Record<string, unknown>): string | null {
  const direct = row.branch_id;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  const branch = row.branch as { id?: string } | null | undefined;
  if (branch?.id && typeof branch.id === 'string') return branch.id;
  return null;
}

/** Resolve list branch scope for workers on shared tablet (ignore admin-only global branch). */
export function resolveRestrictedListBranchScope(
  selectedBranchId: string | null | undefined,
  accessibleBranchIds: string[],
): ListBranchScope {
  const selected = selectedBranchId?.trim() ?? '';
  const ids = [...new Set(accessibleBranchIds.filter(Boolean))];
  if (
    selected &&
    selected !== 'all' &&
    selected !== 'default' &&
    ids.includes(selected)
  ) {
    return { mode: 'single', branchId: selected };
  }
  if (ids.length > 0) {
    return { mode: 'accessible', branchIds: ids };
  }
  return { mode: 'accessible', branchIds: [] };
}

/** Shared list scope for Sales, Expense, Inventory (worker + restricted branch rules). */
export function resolveModuleListBranchScope(
  selectedBranchId: string | null | undefined,
  accessibleBranchIds: string[],
  isAdminOrOwner: boolean,
  isolateWorkerData?: boolean,
): ListBranchScope {
  if (isolateWorkerData || (!isAdminOrOwner && accessibleBranchIds.length > 0)) {
    return resolveRestrictedListBranchScope(selectedBranchId, accessibleBranchIds);
  }
  return resolveListBranchScope(selectedBranchId, accessibleBranchIds, isAdminOrOwner);
}

export function rowInListBranchScope(row: Record<string, unknown>, scope: ListBranchScope): boolean {
  if (scope.mode === 'all') return true;
  const bid = rowBranchId(row);
  if (!bid) return false;
  if (scope.mode === 'single') return bid === scope.branchId;
  return scope.branchIds.includes(bid);
}
