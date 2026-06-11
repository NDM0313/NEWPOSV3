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

export type MobilePaymentMode = 'receive' | 'pay-supplier' | 'pay-worker' | 'rental' | 'expense';

export function getPaymentAccountSide(mode: MobilePaymentMode): LedgerSide {
  return mode === 'receive' || mode === 'rental' ? 'debit' : 'credit';
}

export function paymentAccountFieldTitle(side: LedgerSide): string {
  return `Payment account (${IN_OUT[side].drCr})`;
}

export function getPaymentFlowSummary(mode: MobilePaymentMode): { inLabel: string; outLabel: string } | null {
  switch (mode) {
    case 'receive':
      return { inLabel: 'Cash / Bank', outLabel: 'Customer balance' };
    case 'rental':
      return { inLabel: 'Cash / Bank', outLabel: 'Rental booking' };
    case 'pay-supplier':
      return { inLabel: 'Supplier payable', outLabel: 'Cash / Bank' };
    case 'pay-worker':
      return { inLabel: 'Worker payable', outLabel: 'Cash / Bank' };
    case 'expense':
      return { inLabel: 'Expense category', outLabel: 'Cash / Bank' };
    default:
      return null;
  }
}
