import type { HierarchyAccountRow, OperationalLedgerRole } from './accountHierarchy';
import { getNextChildAccountCode } from './addAccountCoaPicker';
import { resolveCanonicalParentId } from './accountHierarchy';

const RESERVED_CODES: Record<string, string> = {
  cash: '1000',
  bank: '1010',
  mobile_wallet: '1020',
};

/** Operational tab code assignment — mirrors web AddAccountDrawer.getOperationalCode */
export function getOperationalAccountCode(
  role: OperationalLedgerRole,
  accounts: HierarchyAccountRow[]
): string | undefined {
  const codes = accounts.map((a) => (a.code || '').trim()).filter(Boolean);
  const reserved = RESERVED_CODES[role];
  if (reserved && !codes.includes(reserved)) return reserved;
  if (reserved) {
    const prefix = reserved.slice(0, 3);
    let n = parseInt(reserved.slice(3), 10) || 0;
    while (codes.includes(prefix + n)) n += 1;
    return prefix + n;
  }
  const seriesPrefix: Record<string, string> = {
    receivable: '110',
    payable: '200',
    expense: '600',
    income: '400',
  };
  const sp = seriesPrefix[role];
  if (!sp) return undefined;
  let n = 1;
  while (codes.includes(sp + n)) n += 1;
  return sp + n;
}

/** Next code when creating under canonical parent (cash/bank/wallet children). */
export function getOperationalCodeWithParent(
  role: OperationalLedgerRole,
  accounts: HierarchyAccountRow[],
  explicitCode?: string
): string {
  const trimmed = (explicitCode || '').trim();
  if (trimmed) return trimmed;
  const parentId = resolveCanonicalParentId(accounts, role);
  if (parentId) {
    const parent = accounts.find((a) => a.id === parentId);
    if (parent) return getNextChildAccountCode(parent, accounts);
  }
  return getOperationalAccountCode(role, accounts) || `GEN-${Date.now().toString(36).slice(2, 8)}`;
}
