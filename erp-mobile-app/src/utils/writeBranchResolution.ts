import type { Branch } from '../api/branches';
import { pickCompanyDefaultBranch, resolveEffectiveBranchIds } from '../lib/branchResolution';
import { isBranchSentinel, isRealBranchUuid } from './branchId';

export type WriteBranchResolution =
  | { status: 'resolved'; branchId: string }
  | { status: 'pick'; branches: Branch[]; suggestedId: string | null }
  | { status: 'error'; message: string };

/** Pure resolver for write paths (sales, POS, purchases, transfers). */
export function resolveWriteBranchFromList(
  globalBranchId: string | null | undefined,
  accessibleBranches: Branch[],
  documentBranchId?: string | null,
  options?: { forcePickWhenMultiple?: boolean },
): WriteBranchResolution {
  if (isRealBranchUuid(documentBranchId)) {
    return { status: 'resolved', branchId: documentBranchId.trim() };
  }

  if (accessibleBranches.length === 0) {
    return {
      status: 'error',
      message: 'No branch set up. Add a branch in Settings to continue.',
    };
  }

  if (accessibleBranches.length === 1) {
    return { status: 'resolved', branchId: accessibleBranches[0].id };
  }

  if (options?.forcePickWhenMultiple) {
    const globalInList = isRealBranchUuid(globalBranchId)
      ? accessibleBranches.find((b) => b.id === globalBranchId.trim())
      : undefined;
    const suggested = globalInList ?? pickCompanyDefaultBranch(accessibleBranches);
    return {
      status: 'pick',
      branches: accessibleBranches,
      suggestedId: suggested?.id ?? accessibleBranches[0]?.id ?? null,
    };
  }

  if (isRealBranchUuid(globalBranchId)) {
    return { status: 'resolved', branchId: globalBranchId.trim() };
  }

  const suggested = pickCompanyDefaultBranch(accessibleBranches);
  return {
    status: 'pick',
    branches: accessibleBranches,
    suggestedId: suggested?.id ?? accessibleBranches[0]?.id ?? null,
  };
}

export function filterAccessibleBranches(
  branches: Branch[],
  userBranchIds: string[],
  unrestricted: boolean,
): Branch[] {
  const effectiveIds = resolveEffectiveBranchIds(branches, userBranchIds, unrestricted);
  if (unrestricted) return branches;
  if (effectiveIds.length === 0) return [];
  const idSet = new Set(effectiveIds);
  return branches.filter((b) => idSet.has(b.id));
}

/** Effective branch for payment sheets: document wins over global header. */
export function resolvePaymentBranchId(
  globalBranchId: string | null | undefined,
  documentBranchId?: string | null,
): string | null {
  if (isRealBranchUuid(documentBranchId)) return documentBranchId.trim();
  if (isRealBranchUuid(globalBranchId)) return globalBranchId.trim();
  return null;
}

export function pickEffectiveWriteBranchId(
  globalBranchId: string | null | undefined,
  pickedBranchId: string | null | undefined,
  documentBranchId?: string | null,
): string | null {
  if (isRealBranchUuid(documentBranchId)) return documentBranchId.trim();
  if (isRealBranchUuid(globalBranchId)) return globalBranchId.trim();
  if (isRealBranchUuid(pickedBranchId)) return pickedBranchId.trim();
  return null;
}

export { isBranchSentinel, isRealBranchUuid };
