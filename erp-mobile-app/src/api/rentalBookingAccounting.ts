/**
 * Mobile rental booking → GL parity with web (rentalService + AccountingContext advance path).
 * Dr payment account / Cr Rental Advance (2020); dress devaluation: Dr Rental Income (4200) / Cr party AR when customerId set, else legacy Dr 5300 / Cr cash.
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

/** Same fingerprints as web [`rentalPartyArAccounting`](src/app/services/rentalPartyArAccounting.ts). */
export const rentalPartyRevenueFingerprint = (companyId: string, rentalId: string) =>
  `rental_party_revenue:${companyId}:${rentalId}`;
export const rentalPartyPaymentFingerprint = (companyId: string, rentalPaymentId: string) =>
  `rental_party_payment:${companyId}:${rentalPaymentId}`;

/** Same stable key + fingerprint as web `rentalPartyArAccounting` (party devaluation JE). */
export function rentalDevaluationExpenseStableKey(
  expenses: Array<{ description?: string; amount?: number }>
): string {
  const norm = [...expenses]
    .map((e) => ({
      d: String(e.description ?? '').trim().toLowerCase(),
      a: Math.round((Number(e.amount) || 0) * 100) / 100,
    }))
    .sort((x, y) => (x.d === y.d ? x.a - y.a : x.d.localeCompare(y.d)));
  return JSON.stringify(norm);
}

function djb2Hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export const rentalPartyDevaluationFingerprint = (companyId: string, rentalId: string, expenseStableKey: string) =>
  `rental_party_devaluation:${companyId}:${rentalId}:${djb2Hash(expenseStableKey)}`;

async function journalFingerprintExists(companyId: string, fingerprint: string): Promise<boolean> {
  const { data } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('company_id', companyId)
    .eq('action_fingerprint', fingerprint)
    .maybeSingle();
  return !!(data as { id?: string } | null)?.id;
}

async function resolveReceivablePostingAccountIdMobile(companyId: string, contactId: string): Promise<string | null> {
  const { data: ctrl } = await supabase
    .from('accounts')
    .select('id')
    .eq('company_id', companyId)
    .eq('code', '1100')
    .eq('is_active', true)
    .maybeSingle();
  const rootId = (ctrl as { id?: string } | null)?.id;
  if (!rootId) return null;
  const { data: sub } = await supabase
    .from('accounts')
    .select('id')
    .eq('company_id', companyId)
    .eq('linked_contact_id', contactId)
    .eq('parent_id', rootId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  return (sub as { id?: string } | null)?.id ?? rootId;
}

async function resolveRentalIncomeAccountIdMobile(companyId: string): Promise<string | null> {
  const { data: rows } = await supabase
    .from('accounts')
    .select('id, name, code')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .eq('code', '4200');
  const list = (rows || []) as { id: string; name?: string }[];
  const named = list.find((a) => {
    const n = String(a.name || '').toLowerCase();
    return n.includes('rental') && (n.includes('income') || n.includes('revenue'));
  });
  return named?.id || list[0]?.id || (await getAccountIdByCodes(companyId, ['4200'])) || null;
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
  /** When set with rentalPaymentId, posts party AR + revenue (same as web). */
  customerId?: string | null;
  rentalCharges?: number;
  securityDeposit?: number;
  rentalPaymentId?: string | null;
}

export async function postRentalPartyRevenueJournalMobile(params: {
  companyId: string;
  branchId: string;
  rentalId: string;
  customerId: string;
  customerName: string;
  rentalCharges: number;
  entryDate: string;
  userId: string | null;
}): Promise<{ error: string | null }> {
  const { companyId, branchId, rentalId, customerId, customerName, rentalCharges, entryDate, userId } = params;
  if (rentalCharges <= 0) return { error: null };
  const fp = rentalPartyRevenueFingerprint(companyId, rentalId);
  if (await journalFingerprintExists(companyId, fp)) return { error: null };
  const arId = await resolveReceivablePostingAccountIdMobile(companyId, customerId);
  const incId = await resolveRentalIncomeAccountIdMobile(companyId);
  if (!arId || !incId) return { error: 'AR or Rental Income account not found.' };
  const desc = `Rental charges — ${customerName}`;
  const res = await createJournalEntry({
    companyId,
    branchId: branchId === 'all' ? null : branchId,
    entryDate: entryDate.slice(0, 10),
    description: desc,
    referenceType: 'rental',
    referenceId: rentalId,
    actionFingerprint: fp,
    userId,
    lines: [
      { accountId: arId, debit: rentalCharges, credit: 0, description: desc },
      { accountId: incId, debit: 0, credit: rentalCharges, description: desc },
    ],
  });
  return { error: res.error };
}

/**
 * Idempotent: same fingerprint skips duplicate if DB supports action_fingerprint.
 * Named customer: Dr payment / Cr party AR (+ revenue JE). Else: Dr payment / Cr 2020.
 */
export async function postRentalAdvanceJournalMobile(
  params: PostRentalAdvanceJournalParams
): Promise<{ journalEntryId: string | null; error: string | null }> {
  if (!isSupabaseConfigured) return { journalEntryId: null, error: 'Not configured.' };
  const {
    companyId,
    branchId,
    rentalId,
    bookingNo,
    customerName,
    amount,
    paymentAccountId,
    entryDate,
    userId,
    customerId,
    rentalCharges = 0,
    securityDeposit = 0,
    rentalPaymentId,
  } = params;
  if (amount <= 0) return { journalEntryId: null, error: null };
  const { data: payAcc, error: payErr } = await supabase
    .from('accounts')
    .select('id')
    .eq('id', paymentAccountId)
    .eq('company_id', companyId)
    .eq('is_active', true)
    .maybeSingle();
  if (payErr || !payAcc) return { journalEntryId: null, error: 'Invalid payment account.' };

  if (customerId && rentalPaymentId) {
    const revErr = await postRentalPartyRevenueJournalMobile({
      companyId,
      branchId,
      rentalId,
      customerId,
      customerName,
      rentalCharges,
      entryDate,
      userId,
    });
    if (revErr.error) return { journalEntryId: null, error: revErr.error };

    const fp = rentalPartyPaymentFingerprint(companyId, rentalPaymentId);
    if (await journalFingerprintExists(companyId, fp)) {
      const { data: existing } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('company_id', companyId)
        .eq('action_fingerprint', fp)
        .maybeSingle();
      return { journalEntryId: (existing as { id?: string } | null)?.id ?? null, error: null };
    }

    const arId = await resolveReceivablePostingAccountIdMobile(companyId, customerId);
    if (!arId) return { journalEntryId: null, error: 'Customer receivable account not found.' };

    const towardRent = Math.min(amount, Math.max(0, rentalCharges));
    const afterRent = Math.max(0, amount - towardRent);
    const towardDeposit = securityDeposit > 0 ? Math.min(afterRent, securityDeposit) : 0;
    const overpay = Math.max(0, afterRent - towardDeposit);
    let creditAr = towardRent + overpay;
    let creditSd = towardDeposit;
    const sdId = creditSd > 0 ? (await getAccountIdByCodes(companyId, ['2011'])) : null;
    if (creditSd > 0 && !sdId) {
      creditAr = amount;
      creditSd = 0;
    }

    const desc = `Rental booking advance — ${bookingNo} (${customerName})`;
    const lines: { accountId: string; debit: number; credit: number; description?: string }[] = [
      { accountId: paymentAccountId, debit: amount, credit: 0, description: desc },
    ];
    if (creditAr > 0) lines.push({ accountId: arId, debit: 0, credit: creditAr, description: desc });
    if (creditSd > 0 && sdId) lines.push({ accountId: sdId, debit: 0, credit: creditSd, description: `${desc} (security deposit)` });

    const res = await createJournalEntry({
      companyId,
      branchId: branchId === 'all' ? null : branchId,
      entryDate: entryDate.slice(0, 10),
      description: desc,
      referenceType: 'rental',
      referenceId: rentalId,
      actionFingerprint: fp,
      userId,
      lines,
    });
    return { journalEntryId: res.data?.id ?? null, error: res.error };
  }

  const advId = await resolveRentalAdvanceAccountId(companyId);
  if (!advId) return { journalEntryId: null, error: 'Rental Advance account (code 2020) not found.' };
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
  /** Named customer: Dr Rental Income / Cr party AR (same as web). Omit for walk-in → legacy Dr 5300 / Cr cash. */
  customerId?: string | null;
  customerName?: string | null;
}

export async function postRentalExpenseJournalMobile(
  params: PostRentalExpenseJournalParams
): Promise<{ journalEntryId: string | null; error: string | null }> {
  if (!isSupabaseConfigured) return { journalEntryId: null, error: 'Not configured.' };
  const total = params.expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  if (total <= 0) return { journalEntryId: null, error: null };

  if (params.customerId) {
    const expenseKey = rentalDevaluationExpenseStableKey(params.expenses);
    const fp = rentalPartyDevaluationFingerprint(params.companyId, params.rentalId, expenseKey);
    if (await journalFingerprintExists(params.companyId, fp)) {
      const { data: existing } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('company_id', params.companyId)
        .eq('action_fingerprint', fp)
        .maybeSingle();
      return { journalEntryId: (existing as { id?: string } | null)?.id ?? null, error: null };
    }
    const arId = await resolveReceivablePostingAccountIdMobile(params.companyId, params.customerId);
    const incId = await resolveRentalIncomeAccountIdMobile(params.companyId);
    if (!arId || !incId) {
      return { journalEntryId: null, error: 'Customer receivable or Rental Income (4200) not found for devaluation JE.' };
    }
    const expDesc = params.expenses.map((e) => `${e.description}: Rs ${e.amount}`).join(', ');
    const cust = String(params.customerName || '').trim() || 'Customer';
    const desc = `Rental devaluation (wear) — ${params.bookingNo} (${cust}) (${expDesc})`;
    const res = await createJournalEntry({
      companyId: params.companyId,
      branchId: params.branchId === 'all' ? null : params.branchId,
      entryDate: params.entryDate.slice(0, 10),
      description: desc,
      referenceType: 'rental',
      referenceId: params.rentalId,
      actionFingerprint: fp,
      userId: params.userId,
      lines: [
        { accountId: incId, debit: total, credit: 0, description: desc },
        { accountId: arId, debit: 0, credit: total, description: desc },
      ],
    });
    return { journalEntryId: res.data?.id ?? null, error: res.error };
  }

  const expAcc = await resolveRentalExpenseAccountId(params.companyId);
  const cashAcc = await resolveDefaultCashAccountId(params.companyId);
  if (!expAcc || !cashAcc) return { journalEntryId: null, error: 'Expense or cash account not found (5300/6100, 1000).' };
  const expDesc = params.expenses.map((e) => `${e.description}: Rs ${e.amount}`).join(', ');
  const desc = `Rental expense (walk-in / no party AR) — ${params.bookingNo} (${expDesc})`;
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
