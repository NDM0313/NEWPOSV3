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
  documentType: 'Sale' | 'Sale Return' | 'Payment' | 'Discount' | 'Opening Balance' | 'Purchase' | 'Expense' | 'Job';
  description: string;
  paymentAccount: string;
  notes: string;
  debit: number;
  credit: number;
  runningBalance: number;
  linkedInvoices?: string[];
  linkedPayments?: string[];
}

/** Build transaction list with Opening Balance as first entry (for all views). */
export function buildTransactionsWithOpeningBalance(
  openingBalance: number,
  transactions: Transaction[],
  fromDate: string
): Transaction[] {
  const openingEntry: Transaction = {
    id: 'opening-balance',
    date: fromDate,
    referenceNo: 'Opening Balance',
    documentType: 'Opening Balance',
    description: 'Opening Balance',
    paymentAccount: '—',
    notes: '',
    debit: openingBalance > 0 ? openingBalance : 0,
    credit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
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
