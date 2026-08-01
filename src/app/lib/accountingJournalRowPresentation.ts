import type { AccountingEntry } from '@/app/context/AccountingContext';

/** Journal list: line amount is stored positive; classify by module/source (sign-based Income/Expense was wrong for all rows). */
export function journalRowPresentation(entry: AccountingEntry): {
  typeLabel: string;
  amountClass: string;
  badgeClass: string;
} {
  if (entry.source === 'Reversal') {
    return {
      typeLabel: 'Reversal',
      amountClass: 'text-amber-400',
      badgeClass: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    };
  }
  const meta = entry.metadata as {
    referenceType?: string;
    paymentId?: string;
    rootReferenceType?: string;
    linkedPaymentReferenceType?: string;
  } | undefined;
  const rtRaw = String(meta?.referenceType || '').toLowerCase();
  const payId = meta?.paymentId;
  const rootRt = String(meta?.rootReferenceType || '').toLowerCase();
  const linkedPayRt = String(meta?.linkedPaymentReferenceType || '').toLowerCase();
  if (rtRaw === 'worker_payment') {
    return {
      typeLabel: 'Worker payment',
      amountClass: 'text-violet-400',
      badgeClass: 'bg-violet-500/20 text-violet-300 border-violet-500/35',
    };
  }
  if (rtRaw === 'stock_adjustment') {
    return {
      typeLabel: 'Stock adjustment',
      amountClass: 'text-yellow-400',
      badgeClass: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/35',
    };
  }
  if (payId && rtRaw === 'purchase') {
    return {
      typeLabel: 'Supplier payment',
      amountClass: 'text-sky-400',
      badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/35',
    };
  }
  if (payId && rtRaw === 'sale') {
    return {
      typeLabel: 'Customer receipt',
      amountClass: 'text-emerald-400',
      badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/35',
    };
  }
  if (rtRaw === 'payment_adjustment' && payId) {
    if (rootRt === 'purchase' || rootRt === 'manual_payment' || rootRt === 'on_account') {
      return {
        typeLabel: 'Supplier payment',
        amountClass: 'text-sky-400',
        badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/35',
      };
    }
    if (rootRt === 'sale' || rootRt === 'manual_receipt') {
      return {
        typeLabel: 'Customer receipt',
        amountClass: 'text-emerald-400',
        badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/35',
      };
    }
    return {
      typeLabel: 'Payment edit',
      amountClass: 'text-cyan-400',
      badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/35',
    };
  }
  if (rtRaw === 'manual_receipt') {
    return {
      typeLabel: 'Customer receipt',
      amountClass: 'text-emerald-400',
      badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/35',
    };
  }
  if (rtRaw === 'on_account' && payId) {
    return {
      typeLabel: 'Customer receipt',
      amountClass: 'text-emerald-400',
      badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/35',
    };
  }
  if (linkedPayRt === 'sale' || (payId && linkedPayRt === 'sale')) {
    return {
      typeLabel: 'Customer receipt',
      amountClass: 'text-emerald-400',
      badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/35',
    };
  }
  if (linkedPayRt === 'purchase' || (payId && linkedPayRt === 'purchase')) {
    return {
      typeLabel: 'Supplier payment',
      amountClass: 'text-sky-400',
      badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/35',
    };
  }
  if (entry.module === 'Payments' || rtRaw === 'manual_payment') {
    if (rtRaw === 'manual_payment') {
      return {
        typeLabel: 'Supplier payment',
        amountClass: 'text-sky-400',
        badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/35',
      };
    }
    return {
      typeLabel: 'Payment',
      amountClass: 'text-cyan-400',
      badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/35',
    };
  }
  if (entry.module === 'Expenses' || entry.source === 'Expense') {
    return {
      typeLabel: 'Expense',
      amountClass: 'text-red-400',
      badgeClass: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
  }
  if (entry.module === 'Purchases' || entry.source === 'Purchase') {
    return {
      typeLabel: 'Purchase',
      amountClass: 'text-orange-400',
      badgeClass: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    };
  }
  if (entry.source === 'Sale' || entry.module === 'Sales') {
    return {
      typeLabel: 'Income',
      amountClass: 'text-[var(--erp-money-positive)]',
      badgeClass: 'bg-green-500/20 text-[var(--erp-money-positive)] border-green-500/30',
    };
  }
  if (entry.source === 'Payment') {
    return {
      typeLabel: 'Payment',
      amountClass: 'text-cyan-400',
      badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/35',
    };
  }
  return {
    typeLabel: 'Journal',
    amountClass: 'text-muted-foreground',
    badgeClass: 'bg-gray-500/20 text-muted-foreground border-gray-500/30',
  };
}
