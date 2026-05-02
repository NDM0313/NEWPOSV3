/**
 * Canonical default Chart of Accounts (seed order + hierarchy).
 * Mirrors company auto-seed in defaultAccountsService.ensureDefaultAccounts.
 * GL balances remain journal-derived; codes are stable identifiers for parent resolution and BS classification.
 */

export const COA_HEADER_CODE_LIST = [
  '1050',
  '1060',
  '1070',
  '1080',
  '1090',
  '2090',
  '3090',
  '4050',
  '6090',
] as const;

/** COA section headers — exclude from payment pickers and BS detail lines. */
export const COA_HEADER_CODES: ReadonlySet<string> = new Set(COA_HEADER_CODE_LIST);

/** Document / API shape for exports and audits (not used for runtime seed — see defaultAccountsService). */
export const DEFAULT_COA_SEED_JSON = {
  version: 1,
  structure: {
    assets: {
      '1050_CashAndCashEquivalents_group': { children: ['1000_Cash', '1001_PettyCash'] },
      '1060_BankAccounts_group': { children: ['1010_DefaultBank'] },
      '1070_MobileWallets_group': { children: ['1020_MobileWallet'] },
      '1100_AccountsReceivable': { note: 'Control / root (no intermediate group)' },
      '1080_WorkerAdvances_group': { children: ['1180_WorkerAdvance'] },
      '1090_Inventory_group': { children: ['1200_Inventory'] },
    },
    liabilities: {
      '2090_TradeAndOtherPayables_group': {
        children: ['2000_AccountsPayable', '2010_WorkerPayable', '2011_SecurityDeposit', '2020_RentalAdvance', '2030_CourierPayableControl'],
      },
    },
    equity: {
      '3090_Equity_group': { children: ['3000_OwnerCapital'] },
    },
    income: {
      '4050_Revenue_group': {
        children: ['4100_SalesRevenue_or_legacy_4000', '4110_ShippingIncome', '4200_RentalIncome'],
      },
    },
    expenses: {
      '6090_OperatingExpenses_group': {
        children: ['5000_CostOfProduction', '5010_COGSInventory', '6100_OperatingExpense', '6110_SalaryExpense', '6120_MarketingExpense'],
      },
    },
  },
} as const;
