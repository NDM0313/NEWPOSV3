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
  documentType: 'Sale' | 'Payment' | 'Discount';
  description: string;
  paymentAccount: string;
  notes: string;
  debit: number;
  credit: number;
  runningBalance: number;
  linkedInvoices?: string[];
  linkedPayments?: string[];
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
