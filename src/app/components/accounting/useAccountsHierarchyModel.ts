import { useCallback, useMemo, type Dispatch, type SetStateAction } from 'react';
import type { Account } from '@/app/context/AccountingContext';
import {
  COA_SECTION_LABEL,
  coaStatementSection,
  compareCoaSection,
  type CoaStatementSection,
} from '@/app/lib/accountHierarchy';

type JournalTouch = { debitAccount: string; creditAccount: string };

/** Control accounts that carry party / worker sub-ledgers in Operational COA view */
const PARTY_CONTROL_CODES = new Set(['1100', '2000', '2010', '1180']);

function partyRoleLabel(type: string | null | undefined): string | null {
  const t = String(type || '').toLowerCase();
  if (t === 'customer') return 'Customer';
  if (t === 'supplier') return 'Supplier';
  if (t === 'both') return 'Customer · Supplier';
  if (t === 'worker') return 'Worker';
  return null;
}

export type AccountsHierarchyRowModel = {
  account: Account & {
    is_default_cash?: boolean;
    is_default_bank?: boolean;
    linked_contact_name?: string | null;
    linked_contact_party_type?: string | null;
  };
  depth: number;
  hasChildRows: boolean;
  isCollapsed: boolean;
  displayBalance: number;
  entryCount: number;
  /** Reserved for period-over-period; null shows em dash in UI */
  trendPct: number | null;
  onToggleCollapse: () => void;
  /** Professional mode: first row of a statement section (Assets, Liabilities, …). */
  sectionHeader?: string;
  /** Operational COA: party / contact name as main title when linked */
  coaPrimaryLabel: string;
  /** Customer, Supplier, Worker, etc. */
  coaPartyRoleLabel: string | null;
  /** Sub-account code, GL line name, parent control — second line */
  coaDetailLine: string | null;
};

export function useAccountsHierarchyModel(
  accounts: Array<
    Account & {
      is_default_cash?: boolean;
      is_default_bank?: boolean;
      parent_id?: string | null;
      is_group?: boolean;
    }
  >,
  journalTouches: JournalTouch[],
  accountsViewMode: 'operational' | 'professional',
  showSubAccounts: boolean,
  collapsedGroupIds: Set<string>,
  setCollapsedGroupIds: Dispatch<SetStateAction<Set<string>>>
): { hierarchyRows: AccountsHierarchyRowModel[]; parentIdsWithChildren: Set<string> } {
  const matchesOperationalAccountView = useCallback((acc: { type?: string; accountType?: string; code?: string; is_group?: boolean }) => {
    if (acc.is_group) return false;
    const t = String(acc.type || acc.accountType || '').toLowerCase();
    const code = String(acc.code || '').trim();
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
      t.includes('suspense') ||
      t.includes('inventory') ||
      code === '1000' ||
      code === '1010' ||
      code === '1020' ||
      code === '1100' ||
      code === '1200' ||
      code === '2000' ||
      code === '2010' ||
      code === '1180' ||
      code === '1195'
    );
  }, []);

  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const parentIdsWithChildren = useMemo(() => {
    const s = new Set<string>();
    accounts.forEach((a) => {
      if (a.parent_id) s.add(a.parent_id);
    });
    return s;
  }, [accounts]);

  const balanceRollupById = useMemo(() => {
    const all = accounts;
    const memo = new Map<string, number>();
    const go = (id: string): number => {
      if (memo.has(id)) return memo.get(id)!;
      const row = all.find((a) => a.id === id);
      const self = row?.balance ?? 0;
      const kids = all.filter((a) => a.parent_id === id);
      const v = self + kids.reduce((sum, c) => sum + go(c.id), 0);
      memo.set(id, v);
      return v;
    };
    all.forEach((a) => go(a.id));
    return memo;
  }, [accounts]);

  const accountsTableRows = useMemo(() => {
    const all = accounts;
    const opBase = all.filter(matchesOperationalAccountView);
    const opIds = new Set(opBase.map((a) => a.id));
    const withAncestors = new Set(opIds);
    opBase.forEach((a) => {
      let pid: string | null | undefined = a.parent_id;
      let guard = 0;
      while (pid && guard++ < 40) {
        withAncestors.add(pid);
        const p = accountsById.get(pid);
        pid = p?.parent_id ?? undefined;
      }
    });
    // Party / worker sub-ledgers (children of 1100 / 2000 / 2010 / 1180): show under Operational COA even if leaf type is generic.
    all.forEach((a) => {
      if (!a.parent_id) return;
      const p = accountsById.get(a.parent_id);
      const pc = String(p?.code || '').trim();
      if (!PARTY_CONTROL_CODES.has(pc)) return;
      withAncestors.add(a.id);
      let pid: string | null | undefined = a.parent_id;
      let guard = 0;
      while (pid && guard++ < 40) {
        withAncestors.add(pid);
        const par = accountsById.get(pid);
        pid = par?.parent_id ?? undefined;
      }
    });
    // Any account linked to a contact (AR/AP party row): include with ancestors
    all.forEach((a) => {
      const lc = (a as { linked_contact_id?: string | null }).linked_contact_id;
      if (!lc) return;
      withAncestors.add(a.id);
      let pid: string | null | undefined = a.parent_id;
      let guard = 0;
      while (pid && guard++ < 40) {
        withAncestors.add(pid);
        const par = accountsById.get(pid);
        pid = par?.parent_id ?? undefined;
      }
    });
    const operationalPool = all.filter((a) => withAncestors.has(a.id));

    let pool = all;
    if (accountsViewMode === 'operational') {
      pool = operationalPool;
    } else if (!showSubAccounts) {
      pool = all.filter((a) => !a.parent_id);
    }

    const idPool = new Set(pool.map((a) => a.id));
    const kids = new Map<string | null, typeof all>();
    pool.forEach((a) => {
      const pid = a.parent_id && idPool.has(a.parent_id) ? a.parent_id : null;
      if (!kids.has(pid)) kids.set(pid, []);
      kids.get(pid)!.push(a);
    });
    kids.forEach((arr) =>
      arr.sort((x, y) => (x.code || '').localeCompare(y.code || '') || x.name.localeCompare(y.name))
    );
    const compareCode = (x: (typeof all)[0], y: (typeof all)[0]) =>
      (x.code || '').localeCompare(y.code || '') || x.name.localeCompare(y.name);
    const rootNodes = [...(kids.get(null) || [])];
    if (accountsViewMode === 'professional') {
      rootNodes.sort((x, y) => {
        const sx = coaStatementSection({ type: x.type || x.accountType, code: x.code });
        const sy = coaStatementSection({ type: y.type || y.accountType, code: y.code });
        const d = compareCoaSection(sx, sy);
        if (d !== 0) return d;
        return compareCode(x, y);
      });
    } else {
      rootNodes.sort(compareCode);
    }
    const out: typeof all = [];
    const walk = (pid: string | null) => {
      const nodes = pid === null ? rootNodes : [...(kids.get(pid) || [])].sort(compareCode);
      for (const n of nodes) {
        out.push(n);
        walk(n.id);
      }
    };
    walk(null);
    return out;
  }, [accounts, accountsViewMode, showSubAccounts, accountsById, matchesOperationalAccountView]);

  const tableRowIdSet = useMemo(() => new Set(accountsTableRows.map((a) => a.id)), [accountsTableRows]);

  const visibleAccountsTableRows = useMemo(() => {
    return accountsTableRows.filter((a) => {
      let pid: string | null | undefined = a.parent_id;
      let guard = 0;
      while (pid && guard++ < 40) {
        if (collapsedGroupIds.has(pid)) return false;
        const p = accountsById.get(pid);
        pid = p?.parent_id ?? undefined;
      }
      return true;
    });
  }, [accountsTableRows, collapsedGroupIds, accountsById]);

  const accountRowDepth = useCallback(
    (account: (typeof accounts)[0]) => {
      let d = 0;
      let pid: string | null | undefined = account.parent_id;
      let guard = 0;
      while (pid && tableRowIdSet.has(pid) && guard++ < 40) {
        d += 1;
        pid = accountsById.get(pid)?.parent_id ?? undefined;
      }
      return d;
    },
    [accountsById, tableRowIdSet]
  );

  const entryCountByAccountName = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of journalTouches) {
      for (const side of [e.debitAccount, e.creditAccount]) {
        if (!side) continue;
        m.set(side, (m.get(side) || 0) + 1);
      }
    }
    return m;
  }, [journalTouches]);

  const hierarchyRows = useMemo((): AccountsHierarchyRowModel[] => {
    let prevSection: CoaStatementSection | null = null;
    return visibleAccountsTableRows.map((account) => {
      const hasChildRows = parentIdsWithChildren.has(account.id);
      const isCollapsed = collapsedGroupIds.has(account.id);
      const depth = accountRowDepth(account);
      const displayBalance = hasChildRows ? balanceRollupById.get(account.id) ?? account.balance : account.balance;
      const name = account.name || '';
      const entryCount = entryCountByAccountName.get(name) ?? 0;
      const sec = coaStatementSection({ type: account.type || account.accountType, code: account.code });
      const sectionHeader =
        accountsViewMode === 'professional' && sec !== prevSection ? COA_SECTION_LABEL[sec] : undefined;
      if (accountsViewMode === 'professional') prevSection = sec;

      const parent = account.parent_id ? accountsById.get(account.parent_id) : undefined;
      const parentCode = String(parent?.code || '').trim();
      const underPartyControl = parent ? PARTY_CONTROL_CODES.has(parentCode) : false;
      const ext = account as Account & { linked_contact_name?: string | null; linked_contact_party_type?: string | null };
      const linkedName = ext.linked_contact_name?.trim() || '';
      const partyType = ext.linked_contact_party_type;

      let coaPrimaryLabel = linkedName || account.name || 'Account';
      let coaPartyRoleLabel: string | null = linkedName ? partyRoleLabel(partyType) : null;
      let coaDetailLine: string | null = null;

      if (linkedName) {
        const parts: string[] = [];
        if (account.code) parts.push(String(account.code));
        if (account.name && account.name.trim() !== linkedName) parts.push(account.name.trim());
        if (parent) parts.push(`under ${parent.name}${parent.code ? ` (${parent.code})` : ''}`);
        coaDetailLine = parts.length > 0 ? parts.join(' · ') : null;
      } else if (underPartyControl && parent && !account.is_group) {
        coaDetailLine = `Sub-account · ${parent.name}${parent.code ? ` (${parent.code})` : ''}`;
      }

      return {
        account,
        depth,
        hasChildRows,
        isCollapsed,
        displayBalance,
        entryCount,
        trendPct: null,
        sectionHeader,
        coaPrimaryLabel,
        coaPartyRoleLabel,
        coaDetailLine,
        onToggleCollapse: () => {
          setCollapsedGroupIds((prev) => {
            const n = new Set(prev);
            if (n.has(account.id)) n.delete(account.id);
            else n.add(account.id);
            return n;
          });
        },
      };
    });
  }, [
    visibleAccountsTableRows,
    parentIdsWithChildren,
    collapsedGroupIds,
    accountRowDepth,
    balanceRollupById,
    entryCountByAccountName,
    setCollapsedGroupIds,
    accountsViewMode,
  ]);

  return { hierarchyRows, parentIdsWithChildren };
}
