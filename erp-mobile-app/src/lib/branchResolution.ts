import type { Branch } from '../api/branches';

const MAIN_BRANCH_NAME_RE = /^main\s*branch/i;

/** Prefer "Main Branch" (case-insensitive), else first branch in the loaded list. */
export function pickCompanyDefaultBranch(branches: Branch[]): Branch | null {
  if (branches.length === 0) return null;
  const namedMain = branches.find((b) => MAIN_BRANCH_NAME_RE.test(b.name.trim()));
  return namedMain ?? branches[0];
}

/**
 * Restricted users: use assigned user_branches ids.
 * Single-branch companies: auto that branch when no rows yet.
 * Multi-branch companies: empty until admin assigns (no Main Branch guess).
 */
export function resolveEffectiveBranchIds(
  branches: Branch[],
  rawUserBranchIds: string[],
  unrestricted: boolean
): string[] {
  if (unrestricted) return rawUserBranchIds;
  if (rawUserBranchIds.length > 0) {
    if (branches.length > 1 && rawUserBranchIds.length < branches.length) {
      return branches.map((b) => b.id);
    }
    return rawUserBranchIds;
  }
  if (branches.length === 1) return [branches[0].id];
  if (branches.length > 1) return branches.map((b) => b.id);
  return [];
}

/** Resolve a single effective branch id to a Branch row for auto-home bootstrap. */
export function resolveBranchForSingleEffectiveId(
  companyBranches: Branch[],
  effectiveBranchIds: string[]
): Branch | null {
  if (effectiveBranchIds.length !== 1) return null;
  const id = effectiveBranchIds[0];
  return (
    companyBranches.find((b) => b.id === id) ?? {
      id,
      name: 'Branch',
      location: '—',
    }
  );
}
