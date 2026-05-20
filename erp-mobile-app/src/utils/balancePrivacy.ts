import { canViewFinancialBalances } from '../config/functionalRoles';

/** Format account or party balance for UI; hidden from worker/salesman roles. */
export function formatBalanceAmount(
  amount: number,
  appRole: string | null | undefined,
  options?: { prefix?: string; signedDueCredit?: boolean },
): string | null {
  if (!canViewFinancialBalances(appRole)) return null;
  const prefix = options?.prefix ?? 'Rs. ';
  const n = Math.abs(Number(amount) || 0);
  if (options?.signedDueCredit && amount !== 0) {
    if (amount > 0) return `Due: ${prefix}${n.toLocaleString()}`;
    return `Credit: ${prefix}${n.toLocaleString()}`;
  }
  return `${prefix}${n.toLocaleString()}`;
}

export function formatAccountBalanceLine(balance: number, appRole: string | null | undefined): string {
  if (!canViewFinancialBalances(appRole)) return 'Balance: ***';
  return `Balance: Rs. ${(Number(balance) || 0).toLocaleString()}`;
}

export function formatAccountBalanceLineIfAllowed(balance: number, canView: boolean): string {
  if (!canView) return 'Balance: ***';
  return `Balance: Rs. ${(Number(balance) || 0).toLocaleString()}`;
}

/** Mask a money amount for list/detail rows when the viewer cannot see balances. */
export function maskMoney(amount: number, canView: boolean, prefix = 'Rs. '): string {
  return canView ? `${prefix}${amount.toLocaleString()}` : '***';
}

/** Customer/supplier due or credit line; null when hidden or zero. */
export function getPartyBalanceLabel(balance: number, canView: boolean): string | null {
  if (!canView || balance === 0) return null;
  if (balance > 0) return `Due: Rs. ${balance.toLocaleString()}`;
  return `Credit: Rs. ${Math.abs(balance).toLocaleString()}`;
}
