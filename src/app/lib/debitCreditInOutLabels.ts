export type LedgerSide = 'debit' | 'credit';

export const IN_OUT = {
  debit: {
    badge: 'IN',
    arrow: '↑',
    hint: 'Money / value coming IN to this account',
    drCr: 'Dr',
  },
  credit: {
    badge: 'OUT',
    arrow: '↓',
    hint: 'Money / value going OUT from this account',
    drCr: 'Cr',
  },
} as const;

export type AddEntryPaymentType =
  | 'customer_receipt'
  | 'supplier_payment'
  | 'worker_payment'
  | 'expense_payment'
  | 'courier_payment';

export type PaymentContextType = 'supplier' | 'customer' | 'worker' | 'rental';

export type MobilePaymentMode = 'receive' | 'pay-supplier' | 'pay-worker' | 'rental' | 'expense';

/** Cash/bank account side for payment flows (Dr = IN, Cr = OUT). */
export function getPaymentAccountSide(entryType: AddEntryPaymentType | MobilePaymentMode | PaymentContextType): LedgerSide {
  if (entryType === 'customer_receipt' || entryType === 'receive' || entryType === 'customer' || entryType === 'rental') {
    return 'debit';
  }
  return 'credit';
}

export function paymentAccountFieldTitle(side: LedgerSide): string {
  return `Payment account (${IN_OUT[side].drCr})`;
}

export function transferFromTitle(): string {
  return `From account (${IN_OUT.credit.drCr})`;
}

export function transferToTitle(): string {
  return `To account (${IN_OUT.debit.drCr})`;
}

export function debitAccountTitle(): string {
  return `Debit account (${IN_OUT.debit.drCr})`;
}

export function creditAccountTitle(): string {
  return `Credit account (${IN_OUT.credit.drCr})`;
}

export function getPaymentFlowSummary(
  entryType: AddEntryPaymentType | MobilePaymentMode | PaymentContextType
): { inLabel: string; outLabel: string } | null {
  switch (entryType) {
    case 'customer_receipt':
    case 'receive':
    case 'customer':
      return { inLabel: 'Cash / Bank', outLabel: 'Customer balance' };
    case 'rental':
      return { inLabel: 'Cash / Bank', outLabel: 'Rental booking' };
    case 'supplier_payment':
    case 'pay-supplier':
    case 'supplier':
      return { inLabel: 'Supplier payable', outLabel: 'Cash / Bank' };
    case 'worker_payment':
    case 'pay-worker':
    case 'worker':
      return { inLabel: 'Worker payable', outLabel: 'Cash / Bank' };
    case 'courier_payment':
      return { inLabel: 'Courier payable', outLabel: 'Cash / Bank' };
    case 'expense_payment':
    case 'expense':
      return { inLabel: 'Expense category', outLabel: 'Cash / Bank' };
    default:
      return null;
  }
}
