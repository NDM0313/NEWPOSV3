import type { Branch } from '../api/branches';

const MAIN_BRANCH_NAME_RE = /^main\s*branch/i;

/** Prefer "Main Branch" (case-insensitive), else first branch in the loaded list. */
export function pickCompanyDefaultBranch(branches: Branch[]): Branch | null {
  if (branches.length === 0) return null;
  const namedMain = branches.find((b) => MAIN_BRANCH_NAME_RE.test(b.name.trim()));
  return namedMain ?? branches[0];
}

/**
 * Restricted users with no explicit user_branches rows fall back to the company default branch.
 * Admin/owner callers should pass through raw ids unchanged (unrestricted = true).
 */
export function resolveEffectiveBranchIds(
  branches: Branch[],
  rawUserBranchIds: string[],
  unrestricted: boolean
): string[] {
  if (unrestricted) return rawUserBranchIds;
  if (rawUserBranchIds.length > 0) return rawUserBranchIds;
  const def = pickCompanyDefaultBranch(branches);
  return def ? [def.id] : [];
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
