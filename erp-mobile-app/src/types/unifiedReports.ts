export type UnifiedLedgerBasis = 'official_gl' | 'management' | 'cash_basis';

export const DEFAULT_UNIFIED_BASIS: UnifiedLedgerBasis = 'official_gl';

export type TrialBalanceRow = {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  debit: number;
  credit: number;
  balance: number;
};

export type TrialBalanceResult = {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  difference: number;
};

export type BalanceSheetLineItem = {
  name: string;
  amount: number;
  code?: string;
};

export type BalanceSheetResult = {
  assets: { label: string; items: BalanceSheetLineItem[]; total: number };
  liabilities: { label: string; items: BalanceSheetLineItem[]; total: number };
  equity: { label: string; items: BalanceSheetLineItem[]; total: number };
  totalAssets: number;
  totalLiabilitiesAndEquity: number;
  difference: number;
  tbImbalance: number;
  asOfDate: string;
};

export type ProfitLossResult = {
  revenue: { label: string; items: BalanceSheetLineItem[]; total: number };
  costOfSales: { label: string; items: BalanceSheetLineItem[]; total: number };
  grossProfit: number;
  expenses: { label: string; items: BalanceSheetLineItem[]; total: number };
  netProfit: number;
  startDate: string;
  endDate: string;
};

export type CashFlowRow = {
  id: string;
  date: string;
  reference: string;
  party: string | null;
  cashIn: number;
  cashOut: number;
  runningBalance: number;
  details: string;
  attachments?: { url: string; name: string }[];
  sourcePaymentId?: string | null;
  sourceJournalEntryId?: string | null;
  referenceType?: string | null;
};

export type CashFlowResult = {
  rows: CashFlowRow[];
  openingBalance: number;
  closingBalance: number;
  totalCashIn: number;
  totalCashOut: number;
  startDate: string;
  endDate: string;
};

export type UnifiedLedgerRow = {
  journalEntryLineId: string;
  journalEntryId: string;
  entryDate: string;
  entryNo: string | null;
  referenceType: string | null;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
  paymentId: string | null;
  accountCode: string | null;
  accountName: string | null;
  partyResolved: string | null;
};

export type AccountStatementResult = {
  rows: UnifiedLedgerRow[];
  closingBalance: number;
  openingBalance: number;
};

export const MOBILE_BS_PL_GOLDENS = {
  '30bd8592-3384-4f34-899a-f3907e336485': { name: 'DIN CHINA', bsAssets: 89754087.52, plNet: 8465730.87 },
  '597a5292-14c8-4cd8-96bd-c61b5a0d8c92': { name: 'DIN BRIDAL', bsAssets: 13521792, plNet: 119992 },
  '2ab65903-62a3-4bcf-bced-076b681e9b74': { name: 'DIN COUTURE', bsAssets: 22667273, plNet: -16750 },
} as const;
