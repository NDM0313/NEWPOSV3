import type { AccountRow } from '../api/accounts';

/** Recursive roll-up: own journal balance + all descendants (web useAccountsHierarchyModel parity). */
export function buildBalanceRollupById(
  accounts: AccountRow[],
  balancesById: Map<string, number>
): Map<string, number> {
  const memo = new Map<string, number>();
  const go = (id: string): number => {
    if (memo.has(id)) return memo.get(id)!;
    const self = balancesById.get(id) ?? 0;
    const kids = accounts.filter((a) => a.parentId === id);
    const v = self + kids.reduce((sum, c) => sum + go(c.id), 0);
    memo.set(id, v);
    return v;
  };
  accounts.forEach((a) => go(a.id));
  return memo;
}

/** Account ids that are parents of at least one row in the full chart. */
export function getParentIdsWithAnyDescendant(accounts: AccountRow[]): Set<string> {
  const s = new Set<string>();
  for (const a of accounts) {
    if (a.parentId) s.add(a.parentId);
  }
  return s;
}

/**
 * Display balance for a COA row: roll-up when account has descendants in full chart,
 * else direct journal balance for that account id.
 */
export function getCoaDisplayBalance(
  account: AccountRow,
  balancesById: Map<string, number>,
  rollupById: Map<string, number>,
  parentIdsWithAnyDescendant: Set<string>
): number {
  if (parentIdsWithAnyDescendant.has(account.id)) {
    return rollupById.get(account.id) ?? balancesById.get(account.id) ?? 0;
  }
  return balancesById.get(account.id) ?? 0;
}
