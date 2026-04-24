/**
 * Mobile rental booking → GL parity with web (rentalService + AccountingContext advance path).
 * Dr payment account / Cr Rental Advance (2020); optional expense JE (5300/6100 vs cash).
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { createJournalEntry } from './accounts';

async function getAccountIdByCodes(
  companyId: string,
  codes: string[]
): Promise<string | null> {
  const { data } = await supabase
    .from('accounts')
    .select('id')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .in('code', codes)
    .limit(1)
    .maybeSingle();
  return (data as { id?: string } | null)?.id ?? null;
}

/** Prefer code 2020 with name hint "rental" + "advance". */
export async function resolveRentalAdvanceAccountId(companyId: string): Promise<string | null> {
  const { data: rows } = await supabase
    .from('accounts')
    .select('id, name, code')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .eq('code', '2020');
  const list = (rows || []) as { id: string; name?: string; code?: string }[];
  const named =
    list.find(
      (a) =>
        String(a.name || '')
          .toLowerCase()
          .includes('rental') &&
        String(a.name || '')
          .toLowerCase()
          .includes('advance')
    ) || list[0];
  if (named?.id) return named.id;
  return getAccountIdByCodes(companyId, ['2020']);
}

export async function resolveRentalExpenseAccountId(companyId: string): Promise<string | null> {
  return (await getAccountIdByCodes(companyId, ['5300'])) || (await getAccountIdByCodes(companyId, ['6100']));
}

/** Default cash for expense credit side (matches web rentalService.createBooking). */
export async function resolveDefaultCashAccountId(companyId: string): Promise<string | null> {
  return (await getAccountIdByCodes(companyId, ['1000'])) || (await getAccountIdByCodes(companyId, ['1010']));
}

export interface PostRentalAdvanceJournalParams {
  companyId: string;
  branchId: string;
  rentalId: string;
  bookingNo: string;
  customerName: string;
  amount: number;
  paymentAccountId: string;
  entryDate: string;
  userId: string | null;
}

/**
 * Idempotent: same fingerprint skips duplicate if DB supports action_fingerprint.
 * Dr payment_account / Cr Rental Advance.
 */
export async function postRentalAdvanceJournalMobile(
  params: PostRentalAdvanceJournalParams
): Promise<{ journalEntryId: string | null; error: string | null }> {
  if (!isSupabaseConfigured) return { journalEntryId: null, error: 'Not configured.' };
  const { companyId, branchId, rentalId, bookingNo, customerName, amount, paymentAccountId, entryDate, userId } = params;
  if (amount <= 0) return { journalEntryId: null, error: null };
  const advId = await resolveRentalAdvanceAccountId(companyId);
  if (!advId) return { journalEntryId: null, error: 'Rental Advance account (code 2020) not found.' };
  const { data: payAcc, error: payErr } = await supabase
    .from('accounts')
    .select('id')
    .eq('id', paymentAccountId)
    .eq('company_id', companyId)
    .eq('is_active', true)
    .maybeSingle();
  if (payErr || !payAcc) return { journalEntryId: null, error: 'Invalid payment account.' };
  const fingerprint = `rental_booking_advance:${companyId}:${rentalId}`;
  const desc = `Rental booking advance — ${bookingNo} (${customerName})`;
  const res = await createJournalEntry({
    companyId,
    branchId: branchId === 'all' ? null : branchId,
    entryDate: entryDate.slice(0, 10),
    description: desc,
    referenceType: 'rental',
    referenceId: rentalId,
    actionFingerprint: fingerprint,
    userId,
    lines: [
      { accountId: paymentAccountId, debit: amount, credit: 0, description: desc },
      { accountId: advId, debit: 0, credit: amount, description: desc },
    ],
  });
  return { journalEntryId: res.data?.id ?? null, error: res.error };
}

export interface PostRentalExpenseJournalParams {
  companyId: string;
  branchId: string;
  rentalId: string;
  bookingNo: string;
  expenses: Array<{ description: string; amount: number }>;
  entryDate: string;
  userId: string | null;
}

export async function postRentalExpenseJournalMobile(
  params: PostRentalExpenseJournalParams
): Promise<{ journalEntryId: string | null; error: string | null }> {
  if (!isSupabaseConfigured) return { journalEntryId: null, error: 'Not configured.' };
  const total = params.expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  if (total <= 0) return { journalEntryId: null, error: null };
  const expAcc = await resolveRentalExpenseAccountId(params.companyId);
  const cashAcc = await resolveDefaultCashAccountId(params.companyId);
  if (!expAcc || !cashAcc) return { journalEntryId: null, error: 'Expense or cash account not found (5300/6100, 1000).' };
  const expDesc = params.expenses.map((e) => `${e.description}: Rs ${e.amount}`).join(', ');
  const desc = `Rental expense — ${params.bookingNo} (${expDesc})`;
  const fingerprint = `rental_booking_expense:${params.companyId}:${params.rentalId}`;
  const res = await createJournalEntry({
    companyId: params.companyId,
    branchId: params.branchId === 'all' ? null : params.branchId,
    entryDate: params.entryDate.slice(0, 10),
    description: desc,
    referenceType: 'expense',
    referenceId: params.rentalId,
    actionFingerprint: fingerprint,
    userId: params.userId,
    lines: [
      { accountId: expAcc, debit: total, credit: 0, description: desc },
      { accountId: cashAcc, debit: 0, credit: total, description: desc },
    ],
  });
  return { journalEntryId: res.data?.id ?? null, error: res.error };
}

export async function linkRentalPaymentJournalEntry(
  rentalPaymentId: string,
  journalEntryId: string
): Promise<void> {
  const { error } = await supabase
    .from('rental_payments')
    .update({ journal_entry_id: journalEntryId })
    .eq('id', rentalPaymentId);
  if (error && !String(error.message || '').toLowerCase().includes('journal_entry')) {
    console.warn('[rentalBookingAccounting] linkRentalPaymentJournalEntry:', error.message);
  }
}
