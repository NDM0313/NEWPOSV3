/**
 * Canonical document status labels aligned with PostgreSQL enums on `sales` / `purchases`.
 * Use these for PostgREST `.in('status', …)`, Integrity Lab samples, conversion checks, and posting gate logic.
 *
 * Live verification (2026-03-12): `sale_status` = draft, quotation, order, final, cancelled;
 * purchase status enum = draft, ordered, received, final, cancelled.
 */

/** Business-only — must NOT drive GL, stock, AR, reversal JEs. */
export const SALE_BUSINESS_ONLY_STATUSES = ['draft', 'quotation', 'order'] as const;
export type SaleBusinessOnlyStatus = (typeof SALE_BUSINESS_ONLY_STATUSES)[number];

/** Only this sale status posts revenue/AR/COGS/stock in this ERP. */
export const SALE_POSTED_ACCOUNTING_STATUS = 'final' as const;

export const SALE_CANCELLED_STATUS = 'cancelled' as const;

/** Business-only purchase rows (no GL/stock until converted to final/received). */
export const PURCHASE_BUSINESS_ONLY_STATUSES = ['draft', 'ordered'] as const;
export type PurchaseBusinessOnlyStatus = (typeof PURCHASE_BUSINESS_ONLY_STATUSES)[number];

/**
 * Purchase rows treated as posted for inventory/AP (see `postingStatusGate`).
 * App label `completed` is normalized to `final` in gate helpers — do not use `completed` in SQL filters.
 */
export const PURCHASE_POSTED_ACCOUNTING_STATUSES = ['final', 'received'] as const;

/** Payables reconciliation, dashboards — same set as posted-for-AP truth. */
export const PURCHASE_STATUSES_FOR_PAYABLE_RECONCILIATION = PURCHASE_POSTED_ACCOUNTING_STATUSES;
