import type { AccountRow } from '../api/accounts';

export type CoaDisplayRow = {
  account: AccountRow;
  depth: number;
};

const PARTY_CONTROL_CODES = new Set(['1100', '2000', '2010', '1180']);

const EQUITY_PARTNER_CODES = ['3003', '3005'] as const;

/** Committees & Dasti + partner equity (aligned with web accountHierarchy.ts). */
export function isOperationalExtendedCoaCode(code: string | null | undefined): boolean {
  const c = String(code ?? '').trim();
  if (!c) return false;
  if (c === '1170') return true;
  if ((EQUITY_PARTNER_CODES as readonly string[]).includes(c)) return true;
  const n = Number.parseInt(c, 10);
  if (!Number.isFinite(n)) return false;
  if (n >= 1171 && n <= 1177) return true;
  if (n >= 1181 && n <= 1187) return true;
  return false;
}

function matchesOperationalView(acc: AccountRow): boolean {
  const code = (acc.code || '').trim();
  if (isOperationalExtendedCoaCode(code)) {
    return code === '1170' || !acc.isGroup;
  }
  if (acc.isGroup) return false;
  const t = (acc.type || '').toLowerCase();
  return (
    t.includes('cash') ||
    t.includes('bank') ||
    t.includes('wallet') ||
    t.includes('expense') ||
    t.includes('revenue') ||
    t.includes('income') ||
    t.includes('receivable') ||
    t.includes('payable') ||
    t.includes('advance') ||
    t.includes('inventory') ||
    ['1000', '1010', '1020', '1100', '1200', '2000', '2010', '1180'].includes(code)
  );
}

function isPartyLeaf(acc: AccountRow, byId: Map<string, AccountRow>): boolean {
  if (acc.linkedContactId) return true;
  let pid = acc.parentId;
  let guard = 0;
  while (pid && guard++ < 24) {
    const p = byId.get(pid);
    const pc = String(p?.code || '').trim();
    if (PARTY_CONTROL_CODES.has(pc)) return true;
    pid = p?.parentId ?? null;
  }
  return false;
}

/** Account ids that have at least one child in the operational display list. */
export function getCoaParentIdsWithChildren(
  displayRows: CoaDisplayRow[],
  accounts: AccountRow[]
): Set<string> {
  const childParentIds = new Set<string>();
  displayRows.forEach(({ account }) => {
    if (account.parentId) childParentIds.add(account.parentId);
  });
  const inDisplay = new Set(displayRows.map((r) => r.account.id));
  const parents = new Set<string>();
  childParentIds.forEach((pid) => {
    if (inDisplay.has(pid) || accounts.some((a) => a.id === pid)) {
      parents.add(pid);
    }
  });
  return parents;
}

/** Hide rows under collapsed ancestors (id in set = collapsed). */
export function filterCoaRowsByCollapse(
  displayRows: CoaDisplayRow[],
  collapsedParentIds: Set<string>,
  accounts: AccountRow[]
): CoaDisplayRow[] {
  if (collapsedParentIds.size === 0) return displayRows;
  const byId = new Map(accounts.map((a) => [a.id, a]));
  return displayRows.filter(({ account }) => {
    let pid: string | null | undefined = account.parentId;
    let guard = 0;
    while (pid && guard++ < 40) {
      if (collapsedParentIds.has(pid)) return false;
      pid = byId.get(pid)?.parentId ?? null;
    }
    return true;
  });
}

/** Flatten operational COA tree (same pool + walk as web useAccountsHierarchyModel). */
export function buildOperationalCoaDisplayRows(accounts: AccountRow[]): CoaDisplayRow[] {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const opBase = accounts.filter(matchesOperationalView);
  const withAncestors = new Set(opBase.map((a) => a.id));
  opBase.forEach((a) => {
    let pid: string | null | undefined = a.parentId;
    let guard = 0;
    while (pid && guard++ < 40) {
      withAncestors.add(pid);
      pid = byId.get(pid)?.parentId ?? null;
    }
  });
  accounts.forEach((a) => {
    if (!a.parentId) return;
    const p = byId.get(a.parentId);
    const pc = String(p?.code || '').trim();
    if (!PARTY_CONTROL_CODES.has(pc)) return;
    withAncestors.add(a.id);
    let pid: string | null | undefined = a.parentId;
    let guard = 0;
    while (pid && guard++ < 40) {
      withAncestors.add(pid);
      pid = byId.get(pid)?.parentId ?? null;
    }
  });
  accounts.forEach((a) => {
    if (!a.linkedContactId) return;
    withAncestors.add(a.id);
    let pid: string | null | undefined = a.parentId;
    let guard = 0;
    while (pid && guard++ < 40) {
      withAncestors.add(pid);
      pid = byId.get(pid)?.parentId ?? null;
    }
  });

  const pool = accounts.filter((a) => withAncestors.has(a.id));
  const idPool = new Set(pool.map((a) => a.id));
  const kids = new Map<string | null, AccountRow[]>();
  pool.forEach((a) => {
    const pid = a.parentId && idPool.has(a.parentId) ? a.parentId : null;
    if (!kids.has(pid)) kids.set(pid, []);
    kids.get(pid)!.push(a);
  });
  kids.forEach((arr) =>
    arr.sort((x, y) => (x.code || '').localeCompare(y.code || '') || x.name.localeCompare(y.name))
  );

  const compareCode = (x: AccountRow, y: AccountRow) =>
    (x.code || '').localeCompare(y.code || '') || x.name.localeCompare(y.name);
  const rootNodes = [...(kids.get(null) || [])].sort(compareCode);
  const ordered: AccountRow[] = [];
  const walk = (pid: string | null) => {
    const nodes = pid === null ? rootNodes : [...(kids.get(pid) || [])].sort(compareCode);
    for (const n of nodes) {
      ordered.push(n);
      walk(n.id);
    }
  };
  walk(null);

  const hidePartyLeaves = ordered.filter((a) => !isPartyLeaf(a, byId));
  const depthById = new Map<string, number>();
  const depthOf = (id: string): number => {
    if (depthById.has(id)) return depthById.get(id)!;
    const row = byId.get(id);
    if (!row?.parentId || !idPool.has(row.parentId)) {
      depthById.set(id, 0);
      return 0;
    }
    const d = depthOf(row.parentId) + 1;
    depthById.set(id, d);
    return d;
  };
  hidePartyLeaves.forEach((a) => depthOf(a.id));

  return hidePartyLeaves.map((account) => ({
    account,
    depth: depthById.get(account.id) ?? 0,
  }));
}
