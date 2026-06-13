import type { AccountLedgerEntry } from '@/app/services/accountingService';
import type { Transaction } from '@/app/services/customerLedgerTypes';

export type LedgerStatementV2Type = 'customer' | 'supplier' | 'worker' | 'account';

/** Pre-select entity when opening from Balance Sheet, COA, Contacts, etc. */
export type LedgerStatementV2Initial = {
  entityId: string;
  statementType: LedgerStatementV2Type;
  entityLabel?: string;
};

export type LedgerTransactionTypeFilter =
  | 'all'
  | 'sale'
  | 'purchase'
  | 'payment_received'
  | 'payment_paid'
  | 'return'
  | 'rental'
  | 'expense'
  | 'journal'
  | 'opening';

export interface LedgerStatementV2Filters {
  statementType: LedgerStatementV2Type;
  entityId: string;
  fromDate: string;
  toDate: string;
  branchId?: string | null;
  transactionType: LedgerTransactionTypeFilter;
  search: string;
}

export interface LedgerEntityOption {
  id: string;
  label: string;
  sublabel?: string;
  phone?: string;
  code?: string;
}

export interface LedgerStatementV2Row {
  id: string;
  date: string;
  referenceNo: string;
  transactionType: string;
  description: string;
  branch: string;
  debit: number;
  credit: number;
  runningBalance: number;
  paymentMethod: string;
  createdBy: string;
  hasAttachments: boolean;
  sourceKind: 'sale' | 'purchase' | 'payment' | 'rental' | 'expense' | 'journal' | 'opening' | 'return' | 'other';
  sourceId?: string;
  journalEntryId?: string;
  paymentId?: string;
  /** Original GL row when loaded from account ledger. */
  glEntry?: AccountLedgerEntry;
  /** Original operational row when loaded from party operational ledger. */
  operationalTx?: Transaction;
}

export interface LedgerStatementV2Summary {
  openingBalance: number;
  closingBalance: number;
  totalDebit: number;
  totalCredit: number;
  /** Customer-specific optional breakdown. */
  totalSales?: number;
  totalSalesReturn?: number;
  totalPaymentsReceived?: number;
  totalRefunds?: number;
  totalRentalCharges?: number;
  totalRentalPayments?: number;
  totalPenalties?: number;
  /** Supplier-specific. */
  totalPurchases?: number;
  totalPurchaseReturns?: number;
  totalPaymentsPaid?: number;
  /** Worker-specific. */
  totalWorkCharges?: number;
  totalAdjustments?: number;
  netMovement?: number;
  netOwed?: number;
}

export interface LedgerStatementV2Result {
  entityLabel: string;
  /** Official statement basis — always posted GL after alignment update. */
  basis: 'gl';
  rows: LedgerStatementV2Row[];
  summary: LedgerStatementV2Summary;
}

export interface LedgerDocumentComparisonRef {
  referenceNo: string;
  date: string;
  amount: number;
  debit: number;
  credit: number;
  source: 'gl' | 'document';
}

export interface LedgerDocumentComparisonResult {
  glClosingBalance: number;
  documentClosingBalance: number;
  difference: number;
  onlyInGl: LedgerDocumentComparisonRef[];
  onlyInDocuments: LedgerDocumentComparisonRef[];
  note?: string;
}
