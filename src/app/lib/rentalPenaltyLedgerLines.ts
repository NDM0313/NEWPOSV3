import { resolvePartyLedgerReference, rentalPaymentLedgerDescription } from '@/app/lib/partyLedgerReference';

export type RentalPenaltyMergeItem = {
  date: string;
  reference_number: string;
  description: string;
  debit: number;
  credit: number;
  rental_id: string;
  source_module: string;
  document_type: string;
};

/** rental_payments row is a return penalty / damage receipt. */
export function isRentalPenaltyPayment(p: {
  payment_type?: string | null;
  reference?: string | null;
}): boolean {
  return (
    String(p.payment_type || '').toLowerCase() === 'penalty' ||
    /penalty|damage|planty|plant/i.test(String(p.reference || ''))
  );
}

type LedgerRowLike = {
  rental_id?: string | null;
  debit?: number | null;
  credit?: number | null;
  description?: string | null;
};

/** True when GL/merged ledger already shows both penalty charge (debit) and receipt (credit). */
export function penaltyFullyRepresentedInLedger(
  ledgerRows: LedgerRowLike[],
  rentalId: string,
  amount: number,
): boolean {
  const rid = String(rentalId || '').trim();
  if (!rid || amount <= 0) return false;
  const tol = 0.01;
  const hasDebit = ledgerRows.some(
    (e) =>
      String(e.rental_id || '') === rid &&
      (Number(e.debit) || 0) >= amount - tol &&
      /penalty|damage/i.test(String(e.description || '')),
  );
  const hasCredit = ledgerRows.some(
    (e) =>
      String(e.rental_id || '') === rid &&
      (Number(e.credit) || 0) >= amount - tol &&
      (/penalty|damage|payment|receipt|rcv/i.test(String(e.description || '')) ||
        String(e.description || '').toLowerCase().includes('rental')),
  );
  return hasDebit && hasCredit;
}

/**
 * Build merge rows for customer statement / operational ledger:
 * penalty charge (debit) then receipt (credit).
 */
export function buildRentalPenaltyMergeItems(opts: {
  payment: {
    rental_id: string;
    amount?: number | null;
    payment_date?: string | null;
    created_at?: string | null;
    reference?: string | null;
    payment_type?: string | null;
    method?: string | null;
  };
  rental?: {
    id?: string;
    booking_no?: string | null;
    damage_charges?: number | null;
  } | null;
  customerDisplayName: string;
  skipCharge?: boolean;
  skipReceipt?: boolean;
}): RentalPenaltyMergeItem[] {
  const { payment, rental, customerDisplayName, skipCharge, skipReceipt } = opts;
  const rawDate = payment.payment_date || payment.created_at;
  const d = rawDate
    ? typeof rawDate === 'string' && rawDate.length >= 10
      ? rawDate.slice(0, 10)
      : new Date(rawDate).toISOString().slice(0, 10)
    : '';
  if (!d) return [];

  const rentalId = String(payment.rental_id || rental?.id || '').trim();
  const bookingNo = String(rental?.booking_no || `RN-${rentalId.slice(0, 8)}`).trim();
  const amount = Number(payment.amount) || 0;
  const chargeAmt = Math.max(amount, Number(rental?.damage_charges) || 0) || amount;
  const out: RentalPenaltyMergeItem[] = [];

  if (!skipCharge && chargeAmt > 0) {
    out.push({
      date: d,
      reference_number: bookingNo,
      description: `Rental penalty charge — ${bookingNo}`,
      debit: chargeAmt,
      credit: 0,
      rental_id: rentalId,
      source_module: 'Rental',
      document_type: 'Rental Penalty',
    });
  }

  if (!skipReceipt && amount > 0) {
    out.push({
      date: d,
      reference_number: resolvePartyLedgerReference({
        lineKind: 'receipt_credit',
        rentalBookingNo: bookingNo,
        rentalPaymentRef: payment.reference,
      }),
      description: rentalPaymentLedgerDescription({
        bookingNo,
        customerName: customerDisplayName,
        penaltyRef: payment.reference,
        paymentType: payment.payment_type,
        method: payment.method,
      }),
      debit: 0,
      credit: amount,
      rental_id: rentalId,
      source_module: 'Rental',
      document_type: 'Rental Payment',
    });
  }

  return out;
}

function penaltyChargeInLedger(ledgerRows: LedgerRowLike[], rentalId: string, amount: number): boolean {
  const rid = String(rentalId || '').trim();
  if (!rid || amount <= 0) return false;
  return ledgerRows.some(
    (e) =>
      String(e.rental_id || '') === rid &&
      (Number(e.debit) || 0) >= amount - 0.01 &&
      /penalty|damage/i.test(String(e.description || '')),
  );
}

function penaltyReceiptInLedger(ledgerRows: LedgerRowLike[], rentalId: string, amount: number): boolean {
  const rid = String(rentalId || '').trim();
  if (!rid || amount <= 0) return false;
  return ledgerRows.some(
    (e) =>
      String(e.rental_id || '') === rid &&
      (Number(e.credit) || 0) >= amount - 0.01 &&
      (/penalty|damage|payment|receipt|rcv/i.test(String(e.description || '')) ||
        String(e.description || '').toLowerCase().includes('rental')),
  );
}

/** Push rental payment rows into statement merge list (penalty = debit charge + credit receipt). */
export function appendRentalPaymentMergeItems(
  mergeItems: RentalPenaltyMergeItem[],
  opts: {
    payment: {
      rental_id: string;
      amount?: number | null;
      payment_date?: string | null;
      created_at?: string | null;
      reference?: string | null;
      payment_type?: string | null;
      method?: string | null;
      journal_entry_id?: string | null;
    };
    rental?: { id?: string; booking_no?: string | null; damage_charges?: number | null } | null;
    customerDisplayName: string;
    ledgerRows?: LedgerRowLike[];
    startDate?: string;
    endDate?: string;
  },
): void {
  const { payment, rental, customerDisplayName, ledgerRows = [], startDate, endDate } = opts;
  const rawDate = payment.payment_date || payment.created_at;
  const d = rawDate
    ? typeof rawDate === 'string' && rawDate.length >= 10
      ? rawDate.slice(0, 10)
      : new Date(rawDate).toISOString().slice(0, 10)
    : '';
  if (!d) return;
  if (startDate && d < startDate) return;
  if (endDate && d > endDate) return;

  const amount = Number(payment.amount) || 0;
  const rentalId = String(payment.rental_id || '').trim();
  const isPenalty = isRentalPenaltyPayment(payment);

  if (!isPenalty) {
    if (payment.journal_entry_id) return;
    const bookingNo = String(rental?.booking_no || `RN-${rentalId.slice(0, 8)}`).trim();
    mergeItems.push({
      date: d,
      reference_number: resolvePartyLedgerReference({
        lineKind: 'receipt_credit',
        rentalBookingNo: bookingNo,
        rentalPaymentRef: payment.reference,
      }),
      description: rentalPaymentLedgerDescription({
        bookingNo,
        customerName: customerDisplayName,
        penaltyRef: payment.reference,
        paymentType: payment.payment_type,
        method: payment.method,
      }),
      debit: 0,
      credit: amount,
      rental_id: rentalId,
      source_module: 'Rental',
      document_type: 'Rental Payment',
    });
    return;
  }

  if (penaltyFullyRepresentedInLedger(ledgerRows, rentalId, amount)) return;

  const rows = buildRentalPenaltyMergeItems({
    payment,
    rental,
    customerDisplayName,
    skipCharge: penaltyChargeInLedger(ledgerRows, rentalId, amount),
    skipReceipt: Boolean(payment.journal_entry_id) && penaltyReceiptInLedger(ledgerRows, rentalId, amount),
  });
  mergeItems.push(...rows);
}
