/**
 * Canonical chart hierarchy — aligned with web ERP (src/app/lib/accountHierarchy.ts).
 */

export const CANONICAL_LEAF_CODES = {
  cash: '1000',
  bank: '1010',
  mobile_wallet: '1020',
  petty_cash: '1001',
  ar: '1100',
  worker_advance: '1180',
  ap: '2000',
  worker_payable: '2010',
  owner_capital: '3000',
} as const;

export const COA_PARENT_GROUP_CODES = {
  cash: '1050',
  bank: '1060',
  mobile_wallet: '1070',
  ar: '1100',
  ap: '2000',
} as const;

export type OperationalLedgerRole =
  | 'cash'
  | 'bank'
  | 'mobile_wallet'
  | 'expense'
  | 'income'
  | 'receivable'
  | 'payable';

export interface HierarchyAccountRow {
  id: string;
  code?: string | null;
  name?: string | null;
  type?: string | null;
  parent_id?: string | null;
  is_group?: boolean | null;
}

export function accountByCode(accounts: HierarchyAccountRow[], code: string): HierarchyAccountRow | undefined {
  const c = code.trim();
  return accounts.find((a) => String(a.code || '').trim() === c);
}

/** Default parent for operational roles: prefer section group (1050/1060/1070), else legacy header leaf. */
export function resolveCanonicalParentId(
  accounts: HierarchyAccountRow[],
  role: OperationalLedgerRole
): string | null {
  const map: Record<OperationalLedgerRole, { group: string | null; legacyLeaf: string | null }> = {
    cash: { group: COA_PARENT_GROUP_CODES.cash, legacyLeaf: CANONICAL_LEAF_CODES.cash },
    bank: { group: COA_PARENT_GROUP_CODES.bank, legacyLeaf: CANONICAL_LEAF_CODES.bank },
    mobile_wallet: { group: COA_PARENT_GROUP_CODES.mobile_wallet, legacyLeaf: CANONICAL_LEAF_CODES.mobile_wallet },
    receivable: { group: COA_PARENT_GROUP_CODES.ar, legacyLeaf: COA_PARENT_GROUP_CODES.ar },
    payable: { group: COA_PARENT_GROUP_CODES.ap, legacyLeaf: COA_PARENT_GROUP_CODES.ap },
    expense: { group: null, legacyLeaf: null },
    income: { group: null, legacyLeaf: null },
  };
  const { group, legacyLeaf } = map[role];
  if (!group && !legacyLeaf) return null;
  const gid = group ? accountByCode(accounts, group)?.id : null;
  if (gid) return gid;
  const lid = legacyLeaf ? accountByCode(accounts, legacyLeaf)?.id : null;
  return lid ?? null;
}
