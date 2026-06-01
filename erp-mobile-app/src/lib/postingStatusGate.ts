/** Mirror web src/app/lib/postingStatusGate.ts — when sale stock may post. */

export function normalizeDocStatus(status: unknown): string {
  return String(status ?? '')
    .trim()
    .toLowerCase();
}

/** Sale: only `final` posts stock / COGS (draft, quotation, order do not). */
export function canPostStockForSaleStatus(status: unknown): boolean {
  return normalizeDocStatus(status) === 'final';
}
