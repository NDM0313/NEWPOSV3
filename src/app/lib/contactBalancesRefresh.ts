/** Window event so Contacts / ledgers refetch operational balances after payments or journals. */
export const CONTACT_BALANCES_REFRESH_EVENT = 'contactBalancesRefresh';

export function dispatchContactBalancesRefresh(companyId: string | null | undefined): void {
  if (typeof window === 'undefined' || !companyId) return;
  window.dispatchEvent(new CustomEvent(CONTACT_BALANCES_REFRESH_EVENT, { detail: { companyId } }));
}
