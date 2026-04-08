export interface Customer {
  id: string;
  code: string;
  name: string;
  phone: string;
  city: string;
  email?: string;
  address?: string;
  creditLimit?: number;
  outstandingBalance?: number;
}

export interface Transaction {
  id: string;
  date: string;
  referenceNo: string;
  documentType: 'Sale' | 'Studio Sale' | 'Studio Order' | 'Sale Return' | 'Payment' | 'On-account Payment' | 'Return Payment' | 'Discount' | 'Opening Balance' | 'Purchase' | 'Purchase Return' | 'Expense' | 'Job' | 'Rental' | 'Rental Payment';
  description: string;
  paymentAccount: string;
  notes: string;
  debit: number;
  credit: number;
  runningBalance: number;
  linkedInvoices?: string[];
  linkedPayments?: string[];
  /** Set when reference (sale/purchase) is cancelled – show Cancelled badge and reversal text */
  referenceStatus?: 'cancelled';
  /** Resolved GL cash/bank/wallet account name when payment_account_id is set */
  paymentAccountDisplay?: string;
  /** Raw payment_method from payments row (cash / bank / …) */
  paymentMethodKind?: string;
  /** Live ledger excludes voided; audit scope may show voided rows with this badge */
  ledgerPaymentLifecycle?: 'active' | 'voided';
  /** Manual receipt: invoice allocations + unapplied credit (expand in table views) */
  ledgerExpandRows?: { label: string; sublabel?: string; amount: number }[];
}

/** Build transaction list with Opening Balance as first entry (for all views). */
export function buildTransactionsWithOpeningBalance(
  openingBalance: number,
  transactions: Transaction[],
  fromDate: string,
  opts?: { openingPerspective?: 'receivable' | 'payable' }
): Transaction[] {
  const perspective = opts?.openingPerspective ?? 'receivable';
  const debit =
    perspective === 'payable'
      ? openingBalance < 0
        ? Math.abs(openingBalance)
        : 0
      : openingBalance > 0
        ? openingBalance
        : 0;
  const credit =
    perspective === 'payable'
      ? openingBalance > 0
        ? openingBalance
        : 0
      : openingBalance < 0
        ? Math.abs(openingBalance)
        : 0;
  const openingEntry: Transaction = {
    id: 'opening-balance',
    date: fromDate,
    referenceNo: 'Opening Balance',
    documentType: 'Opening Balance',
    description: 'Opening Balance',
    paymentAccount: '—',
    notes: '',
    debit,
    credit,
    runningBalance: openingBalance,
    linkedInvoices: [],
    linkedPayments: [],
  };
  return [openingEntry, ...transactions];
}

export interface InvoiceItem {
  itemName: string;
  qty: number;
  rate: number;
  lineTotal: number;
}

export interface Invoice {
  id?: string;
  invoiceNo: string;
  date: string;
  invoiceTotal: number;
  items: InvoiceItem[];
  status: 'Fully Paid' | 'Partially Paid' | 'Unpaid';
  paidAmount: number;
  pendingAmount: number;
}

export interface Payment {
  id: string;
  paymentNo: string;
  date: string;
  amount: number;
  method: string;
  referenceNo: string;
  appliedInvoices: string[];
  status: 'Completed' | 'Pending' | 'Failed';
  ledgerLifecycle?: 'active' | 'voided';
}

export interface DetailTransaction extends Transaction {
  children?: {
    type: 'Sale' | 'Discount' | 'Extra Charge' | 'Payment';
    description: string;
    amount: number;
  }[];
}

export interface LedgerData {
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  transactions: Transaction[];
  detailTransactions: DetailTransaction[];
  invoices: Invoice[];
  invoicesSummary: {
    totalInvoices: number;
    totalInvoiceAmount: number;
    totalPaymentReceived: number;
    pendingAmount: number;
    fullyPaid: number;
    partiallyPaid: number;
    unpaid: number;
  };
}
