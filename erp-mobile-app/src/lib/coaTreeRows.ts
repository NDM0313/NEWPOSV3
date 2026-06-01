import type { AccountRow } from '../api/accounts';

export type CoaDisplayRow = {
  account: AccountRow;
  depth: number;
};

const PARTY_CONTROL_CODES = new Set(['1100', '2000', '2010', '1180']);

function matchesOperationalView(acc: AccountRow): boolean {
  if (acc.isGroup) return false;
  const t = (acc.type || '').toLowerCase();
  const code = (acc.code || '').trim();
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
