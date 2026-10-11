import { canViewFinancialBalances } from '../config/functionalRoles';
import { rowBelongsToCounterWorker } from '../lib/counterDataIsolation';

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

const MASKED_BALANCE = '****';

export function formatAccountBalanceLine(balance: number, appRole: string | null | undefined): string {
  if (!canViewFinancialBalances(appRole)) return MASKED_BALANCE;
  return `Balance: Rs. ${(Number(balance) || 0).toLocaleString()}`;
}

export function formatAccountBalanceLineIfAllowed(balance: number, canView: boolean): string {
  if (!canView) return MASKED_BALANCE;
  return `Balance: Rs. ${(Number(balance) || 0).toLocaleString()}`;
}

/** Subtitle for account picker rows: "Rs. 1,234" or masked. */
export function formatAccountPickerSubtitle(balance: number, canView: boolean): string {
  if (!canView) return MASKED_BALANCE;
  return `Rs. ${(Number(balance) || 0).toLocaleString()}`;
}

/** Inline balance line for account lists in forms. */
export function formatAccountBalanceInline(balance: number, canView: boolean): string | null {
  if (!canView) return null;
  if (balance <= 0) return null;
  return `Balance: Rs. ${balance.toLocaleString()}`;
}

/** Show sale received/due amounts for admins/managers, or for the worker who owns the row. */
export function canViewSaleBalances(
  canViewAll: boolean,
  saleRow: Record<string, unknown>,
  authUserId: string,
  profileId?: string | null,
): boolean {
  return canViewAll || rowBelongsToCounterWorker(saleRow, authUserId, profileId);
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
