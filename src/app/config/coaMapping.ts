/**
 * Phase 2 COA mapping lock — canonical account codes only.
 * Do not use for DB writes; use for lookups and validation.
 * Full matrix: docs/accounting/COA_MAPPING_MATRIX.md
 */
export const COA_CODES = {
  CASH: '1000',
  BANK: '1010',
  ACCOUNTS_RECEIVABLE: '1100',
  INVENTORY: '1200',
  INVENTORY_LEGACY: '1500', // Prefer 1200; 1500 fallback for backward compat
  ACCOUNTS_PAYABLE: '2000',
  WORKER_PAYABLE: '2010',
  COURIER_PAYABLE_PREFIX: '203', // 2031, 2032, …
  SALESMAN_PAYABLE: '2040',
  CAPITAL: '3000',
  SALES_REVENUE: '4000',
  /** Product sales revenue in seed (`4100`); shipping charged to customer posts to `4110` to avoid mixing with Sales Revenue. */
  SHIPPING_INCOME: '4110',
  COGS: '5000',
  SHIPPING_EXPENSE: '5100',
  SALES_COMMISSION_EXPENSE: '5110',
  DISCOUNT_ALLOWED: '5200',
  DISCOUNT_RECEIVED: '5210',
  EXTRA_EXPENSE: '5300',
} as const;

/** Codes that must not be used for new posting (legacy/duplicate). */
export const COA_LEGACY_AVOID = ['2020'] as const;
