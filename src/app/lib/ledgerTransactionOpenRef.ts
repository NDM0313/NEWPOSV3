import type { AccountLedgerEntry } from '@/app/services/accountingService';
import { formatRentalPaymentRef } from '@/app/lib/rentalPaymentRef';

export type LedgerTransactionOpenRef = {
  referenceNumber: string;
  journalEntryId?: string;
};

function normalizeLower(x: unknown): string {
  return String(x || '').toLowerCase().trim();
}

function isRentalPaymentLedgerRow(entry: AccountLedgerEntry): boolean {
  const jeType = normalizeLower(entry.je_reference_type);
  if (jeType !== 'rental') return false;
  const fp = String(entry.je_action_fingerprint || '').trim();
  if (fp.startsWith('rental_party_payment:')) return true;
  const desc = normalizeLower(entry.description);
  return desc.includes('rental payment');
}

function isRentalRevenueLedgerRow(entry: AccountLedgerEntry): boolean {
  const jeType = normalizeLower(entry.je_reference_type);
  if (jeType !== 'rental') return false;
  const fp = String(entry.je_action_fingerprint || '').trim();
  if (fp.startsWith('rental_party_revenue:') || fp.startsWith('rental_party_discount:')) return true;
  const desc = normalizeLower(entry.description);
  return desc.includes('rental charges') || desc.includes('rental discount');
}

function rentalPaymentOpenRef(entry: AccountLedgerEntry): string {
  const ref = String(entry.reference_number || '').trim();
  if (/^REN-.+-PAY$/i.test(ref)) return ref;
  if (/^REN-\d+$/i.test(ref)) return formatRentalPaymentRef(ref);
  const bookingFromDesc = String(entry.description || '').match(/\bREN-\d+\b/i)?.[0];
  if (bookingFromDesc) return formatRentalPaymentRef(bookingFromDesc);
  return String(entry.journal_entry_id || '').trim();
}

/** Resolve which reference to pass to TransactionDetailModal from a ledger row. */
export function resolveLedgerTransactionOpenRef(entry: AccountLedgerEntry): LedgerTransactionOpenRef {
  const ref = String(entry.reference_number || '').trim();
  const entryNo = String(entry.entry_no || '').trim();
  const jeId = String(entry.journal_entry_id || '').trim();

  if (isRentalPaymentLedgerRow(entry)) {
    const referenceNumber = rentalPaymentOpenRef(entry);
    return {
      referenceNumber: referenceNumber || jeId,
      journalEntryId: jeId || undefined,
    };
  }

  if (isRentalRevenueLedgerRow(entry)) {
    return {
      referenceNumber: jeId || entryNo || ref,
      journalEntryId: jeId || undefined,
    };
  }

  if (entry.payment_id && ref && !/^JE-/i.test(ref)) {
    return { referenceNumber: ref, journalEntryId: jeId || undefined };
  }

  if (normalizeLower(entry.je_reference_type) === 'rental' && /^REN-/i.test(ref)) {
    if (/^REN-.+-PAY$/i.test(ref)) {
      return { referenceNumber: ref, journalEntryId: jeId || undefined };
    }
    if (/^REN-\d+$/i.test(ref)) {
      return { referenceNumber: formatRentalPaymentRef(ref), journalEntryId: jeId || undefined };
    }
  }

  return {
    referenceNumber: entryNo || jeId || ref,
    journalEntryId: jeId || undefined,
  };
}

/** Dispatch payload for openTransactionDetail custom event. */
export function ledgerTransactionOpenEventDetail(
  entry: AccountLedgerEntry,
  autoLaunchUnifiedEdit = false
): { referenceNumber: string; journalEntryId?: string; autoLaunchUnifiedEdit: boolean } {
  const resolved = resolveLedgerTransactionOpenRef(entry);
  return {
    referenceNumber: resolved.referenceNumber,
    journalEntryId: resolved.journalEntryId,
    autoLaunchUnifiedEdit,
  };
}
