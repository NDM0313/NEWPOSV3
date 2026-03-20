/**
 * Purchase `status` values that exist in the DB schema (see `Purchase` in purchaseService).
 * Do NOT use UI-only labels like `completed` in PostgREST `.in('status', …)` — that causes 400.
 */
export const PURCHASE_STATUSES_FOR_PAYABLE_RECONCILIATION = ['final', 'received'] as const;
