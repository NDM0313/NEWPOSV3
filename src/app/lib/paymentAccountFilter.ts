/** Payment ledger filter: single id, expanded parent tree (string[]), or no filter. */
export type PaymentAccountFilter = string | string[] | null;

export function paymentAccountFilterIds(filter: PaymentAccountFilter): string[] {
  if (filter == null) return [];
  if (Array.isArray(filter)) return filter.filter((id) => typeof id === 'string' && id.length > 0);
  return filter.length > 0 ? [filter] : [];
}

export function matchesPaymentAccountFilter(
  filter: PaymentAccountFilter,
  accountId: string | null | undefined,
): boolean {
  const ids = paymentAccountFilterIds(filter);
  if (ids.length === 0) return true;
  if (!accountId) return false;
  return ids.includes(accountId);
}
