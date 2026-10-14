/**
 * Mobile rental booking → GL parity with web (rentalService + AccountingContext advance path).
 * Dr payment account / Cr Rental Advance (2020); dress devaluation RPC posts Dr Rental Income (4200) / Cr expense (5300).
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

/** Same fingerprints as web [`rentalPartyArAccounting`](src/app/services/rentalPartyArAccounting.ts). */
export const rentalPartyRevenueFingerprint = (companyId: string, rentalId: string) =>
  `rental_party_revenue:${companyId}:${rentalId}`;
export const rentalPartyPaymentFingerprint = (companyId: string, rentalPaymentId: string) =>
  `rental_party_payment:${companyId}:${rentalPaymentId}`;

export const rentalPartyPenaltyChargeFingerprint = (companyId: string, rentalId: string) =>
  `rental_party_penalty_charge:${companyId}:${rentalId}`;

export const rentalPartyPenaltyPaymentFingerprint = (companyId: string, rentalPaymentId: string) =>
  `rental_party_penalty_payment:${companyId}:${rentalPaymentId}`;

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

async function getArControlAccountId(companyId: string): Promise<string | null> {
  const { data: ctrl } = await supabase
    .from('accounts')
    .select('id')
    .eq('company_id', companyId)
    .eq('code', '1100')
    .eq('is_active', true)
    .maybeSingle();
  return (ctrl as { id?: string } | null)?.id ?? null;
}

/** Ensure AR-CUS* sub-ledger exists; never fall back to control 1100 for named customers. */
async function resolveReceivablePostingAccountIdMobile(
  companyId: string,
  contactId: string
): Promise<{ arId: string | null; error: string | null }> {
  if (!contactId) {
    return { arId: null, error: 'Customer contact id is required for AR posting.' };
  }
  const { data, error } = await supabase.rpc('ensure_party_subledgers_for_contact', {
    p_contact_id: contactId,
  });
  if (error) return { arId: null, error: error.message };
  const result = data as { success?: boolean; error?: string; ar_account_id?: string } | null;
  if (!result?.success) {
    return { arId: null, error: result?.error ?? 'Could not resolve customer AR sub-account.' };
  }
  const arId = result.ar_account_id ?? null;
  if (!arId) return { arId: null, error: 'Customer receivable account not found.' };

  const controlId = await getArControlAccountId(companyId);
  if (controlId && arId === controlId) {
    return {
      arId: null,
      error: 'Named customer must post to AR sub-ledger (AR-CUS*), not control account 1100.',
    };
  }
  const { data: acc } = await supabase.from('accounts').select('code').eq('id', arId).maybeSingle();
  if (String((acc as { code?: string } | null)?.code || '').trim() === '1100') {
    return {
      arId: null,
      error: 'Named customer must post to AR sub-ledger (AR-CUS*), not control account 1100.',
    };
  }
  return { arId, error: null };
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
  const { arId, error: arErr } = await resolveReceivablePostingAccountIdMobile(companyId, customerId);
  const incId = await resolveRentalIncomeAccountIdMobile(companyId);
  if (arErr || !arId || !incId) return { error: arErr ?? 'AR or Rental Income account not found.' };
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

    const { arId, error: arErr } = await resolveReceivablePostingAccountIdMobile(companyId, customerId);
    if (arErr || !arId) {
      return { journalEntryId: null, error: arErr ?? 'Customer receivable account not found.' };
    }

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
  /** Rental expense journal via DB RPC (same as web). */
  customerId?: string | null;
  customerName?: string | null;
}

export async function postRentalExpenseJournalMobile(
  params: PostRentalExpenseJournalParams
): Promise<{ journalEntryId: string | null; error: string | null }> {
  if (!isSupabaseConfigured) return { journalEntryId: null, error: 'Not configured.' };
  const total = params.expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  if (total <= 0) return { journalEntryId: null, error: null };

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
  const expDesc = params.expenses.map((e) => `${e.description}: Rs ${e.amount}`).join(', ');
  const cust = String(params.customerName || '').trim() || 'Customer';
  const desc = `Rental devaluation (wear) — ${params.bookingNo} (${cust}) (${expDesc})`;
  const { data: rpcData, error: rpcErr } = await supabase.rpc('record_rental_expense_devaluation_journal', {
    p_rental_id: params.rentalId,
    p_amount: total,
    p_action_fingerprint: fp,
    p_entry_date: params.entryDate.slice(0, 10),
    p_created_by: params.userId,
    p_line_description: desc,
    p_debit_account_code: '4200',
    p_credit_account_code: '5300',
  });
  if (rpcErr) {
    return { journalEntryId: null, error: rpcErr.message };
  }
  const row = rpcData as {
    success?: boolean;
    skipped?: boolean;
    journal_entry_id?: string;
    error?: string;
  } | null;
  if (!row || row.success === false) {
    return { journalEntryId: null, error: row?.error ?? 'record_rental_expense_devaluation_journal failed' };
  }
  if (row.skipped && row.journal_entry_id) {
    return { journalEntryId: row.journal_entry_id, error: null };
  }
  if (row.skipped) {
    return { journalEntryId: null, error: null };
  }
  return { journalEntryId: row.journal_entry_id ?? null, error: null };
}

/** Dr AR / Cr Rental Income (charge) + Dr payment / Cr AR (receipt) for return penalty. */
export async function postRentalPartyPenaltySettlementMobile(params: {
  companyId: string;
  branchId: string;
  rentalId: string;
  rentalPaymentId: string;
  customerId: string;
  customerName: string;
  amount: number;
  paymentAccountId: string;
  entryDate: string;
  userId: string | null;
}): Promise<{ chargeJournalEntryId: string | null; receiptJournalEntryId: string | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { chargeJournalEntryId: null, receiptJournalEntryId: null, error: 'Not configured.' };
  }
  const {
    companyId,
    branchId,
    rentalId,
    rentalPaymentId,
    customerId,
    customerName,
    amount,
    paymentAccountId,
    entryDate,
    userId,
  } = params;
  if (amount <= 0) return { chargeJournalEntryId: null, receiptJournalEntryId: null, error: null };

  const { arId, error: arErr } = await resolveReceivablePostingAccountIdMobile(companyId, customerId);
  const incId = await resolveRentalIncomeAccountIdMobile(companyId);
  if (arErr || !arId || !incId) {
    return {
      chargeJournalEntryId: null,
      receiptJournalEntryId: null,
      error: arErr ?? 'AR or Rental Income account not found.',
    };
  }

  const chargeFp = rentalPartyPenaltyChargeFingerprint(companyId, rentalId);
  let chargeJournalEntryId: string | null = null;
  if (await journalFingerprintExists(companyId, chargeFp)) {
    const { data: existing } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('company_id', companyId)
      .eq('action_fingerprint', chargeFp)
      .maybeSingle();
    chargeJournalEntryId = (existing as { id?: string } | null)?.id ?? null;
  } else {
    const chargeDesc = `Rental penalty / damage — ${customerName}`;
    const chargeRes = await createJournalEntry({
      companyId,
      branchId: branchId === 'all' ? null : branchId,
      entryDate: entryDate.slice(0, 10),
      description: chargeDesc,
      referenceType: 'rental',
      referenceId: rentalId,
      actionFingerprint: chargeFp,
      userId,
      lines: [
        { accountId: arId, debit: amount, credit: 0, description: chargeDesc },
        { accountId: incId, debit: 0, credit: amount, description: chargeDesc },
      ],
    });
    if (chargeRes.error) {
      return { chargeJournalEntryId: null, receiptJournalEntryId: null, error: chargeRes.error };
    }
    chargeJournalEntryId = chargeRes.data?.id ?? null;
  }

  const receiptFp = rentalPartyPenaltyPaymentFingerprint(companyId, rentalPaymentId);
  let receiptJournalEntryId: string | null = null;
  if (await journalFingerprintExists(companyId, receiptFp)) {
    const { data: existing } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('company_id', companyId)
      .eq('action_fingerprint', receiptFp)
      .maybeSingle();
    receiptJournalEntryId = (existing as { id?: string } | null)?.id ?? null;
  } else {
    const receiptDesc = `Rental penalty receipt — ${customerName}`;
    const receiptRes = await createJournalEntry({
      companyId,
      branchId: branchId === 'all' ? null : branchId,
      entryDate: entryDate.slice(0, 10),
      description: receiptDesc,
      referenceType: 'rental',
      referenceId: rentalId,
      actionFingerprint: receiptFp,
      userId,
      lines: [
        { accountId: paymentAccountId, debit: amount, credit: 0, description: receiptDesc },
        { accountId: arId, debit: 0, credit: amount, description: receiptDesc },
      ],
    });
    if (receiptRes.error) {
      return { chargeJournalEntryId, receiptJournalEntryId: null, error: receiptRes.error };
    }
    receiptJournalEntryId = receiptRes.data?.id ?? null;
  }

  if (receiptJournalEntryId) {
    await linkRentalPaymentJournalEntry(rentalPaymentId, receiptJournalEntryId);
  }

  return { chargeJournalEntryId, receiptJournalEntryId, error: null };
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
