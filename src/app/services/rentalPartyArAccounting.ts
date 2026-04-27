/**
 * Rental GL: party AR + Rental Income (sale-style), replacing generic Cr 2020 for named customers.
 * Security deposit (when > 0) is split on cash receipt: Cr party AR for rent portion, Cr 2011 for deposit portion.
 */

import { supabase } from '@/lib/supabase';
import { accountingService, type JournalEntry, type JournalEntryLine } from '@/app/services/accountingService';
import { resolveReceivablePostingAccountId } from '@/app/services/partySubledgerAccountService';
import { accountHelperService } from '@/app/services/accountHelperService';
import { documentNumberService } from '@/app/services/documentNumberService';

export const rentalPartyRevenueFingerprint = (companyId: string, rentalId: string) =>
  `rental_party_revenue:${companyId}:${rentalId}`;

export const rentalPartyPaymentFingerprint = (companyId: string, rentalPaymentId: string) =>
  `rental_party_payment:${companyId}:${rentalPaymentId}`;

/** Amounts for AR / income posting (discount reserved for future column). */
export interface RentalPartyArAmounts {
  rentalCharges: number;
  securityDeposit: number;
  /** Optional; when set, Dr Discount Allowed / Cr party AR (same fingerprint extension later). */
  discountAmount: number;
}

export async function fetchRentalArAmounts(rentalId: string): Promise<RentalPartyArAmounts | null> {
  let res = await supabase
    .from('rentals')
    .select('rental_charges, security_deposit, discount_amount')
    .eq('id', rentalId)
    .maybeSingle();
  if (res.error && String(res.error.message || '').toLowerCase().includes('discount_amount')) {
    res = await supabase.from('rentals').select('rental_charges, security_deposit').eq('id', rentalId).maybeSingle();
  }
  const { data, error } = res;
  if (error || !data) return null;
  const row = data as {
    rental_charges?: number | null;
    security_deposit?: number | null;
    discount_amount?: number | null;
  };
  return {
    rentalCharges: Math.max(0, Number(row.rental_charges) || 0),
    securityDeposit: Math.max(0, Number(row.security_deposit) || 0),
    discountAmount: Math.max(0, Number(row.discount_amount) || 0),
  };
}

async function resolveRentalIncomeAccountId(companyId: string): Promise<string | null> {
  const { data: rows } = await supabase
    .from('accounts')
    .select('id,name,code')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .eq('code', '4200');
  const list = (rows || []) as { id: string; name?: string; code?: string }[];
  const named = list.find((a) => {
    const n = String(a.name || '').toLowerCase();
    return n.includes('rental') && (n.includes('income') || n.includes('revenue'));
  });
  if (named?.id) return named.id;
  if (list[0]?.id) return list[0].id;
  return (await accountHelperService.getAccountByCode('4200', companyId))?.id ?? null;
}

async function resolveRentalAdvance2020Id(companyId: string): Promise<string | null> {
  const { data: rows } = await supabase
    .from('accounts')
    .select('id, name, code')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .eq('code', '2020');
  const list = (rows || []) as { id: string; name?: string }[];
  const named = list.find(
    (a) =>
      String(a.name || '')
        .toLowerCase()
        .includes('rental') && String(a.name || '').toLowerCase().includes('advance')
  );
  return named?.id || list[0]?.id || null;
}

async function nextJournalEntryNo(companyId: string, branchId: string | null | undefined): Promise<string> {
  try {
    return await documentNumberService.getNextDocumentNumber(companyId, branchId ?? null, 'journal');
  } catch {
    return `JE-${Date.now()}`;
  }
}

/**
 * Dr party AR / Cr Rental Income for rental_charges (once per rental). Idempotent via action_fingerprint.
 */
export async function postRentalPartyRevenueIfNeeded(params: {
  companyId: string;
  branchId: string | null | undefined;
  rentalId: string;
  customerId: string | null | undefined;
  customerName: string;
  rentalCharges: number;
  entryDate: string;
  createdBy?: string | null;
}): Promise<{ journalEntryId: string | null; skipped: boolean }> {
  const { companyId, branchId, rentalId, customerId, customerName, rentalCharges, entryDate, createdBy } = params;
  if (!customerId || rentalCharges <= 0) return { journalEntryId: null, skipped: true };

  const fp = rentalPartyRevenueFingerprint(companyId, rentalId);
  const { data: dup } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('company_id', companyId)
    .eq('action_fingerprint', fp)
    .maybeSingle();
  if (dup?.id) return { journalEntryId: String((dup as { id: string }).id), skipped: true };

  const arId = await resolveReceivablePostingAccountId(companyId, customerId);
  const incId = await resolveRentalIncomeAccountId(companyId);
  if (!arId || !incId) return { journalEntryId: null, skipped: false };

  const entryNo = await nextJournalEntryNo(companyId, branchId ?? null);
  const desc = `Rental charges — ${customerName}`;
  const lines: JournalEntryLine[] = [
    { id: '', journal_entry_id: '', account_id: arId, debit: rentalCharges, credit: 0, description: desc },
    { id: '', journal_entry_id: '', account_id: incId, debit: 0, credit: rentalCharges, description: desc },
  ];
  const entry: JournalEntry = {
    id: '',
    company_id: companyId,
    branch_id: branchId && branchId !== 'all' ? branchId : undefined,
    entry_no: entryNo,
    entry_date: entryDate.slice(0, 10),
    description: desc,
    reference_type: 'rental',
    reference_id: rentalId,
    created_by: createdBy ?? null,
    action_fingerprint: fp,
  };
  const saved = await accountingService.createEntry(entry, lines);
  return { journalEntryId: (saved as { id?: string } | null)?.id ?? null, skipped: false };
}

/**
 * Dr Discount Allowed (5200) / Cr party AR when discount_amount > 0 on rental row. Idempotent fingerprint.
 */
export async function postRentalPartyDiscountIfNeeded(params: {
  companyId: string;
  branchId: string | null | undefined;
  rentalId: string;
  customerId: string | null | undefined;
  customerName: string;
  discountAmount: number;
  entryDate: string;
  createdBy?: string | null;
}): Promise<{ journalEntryId: string | null; skipped: boolean }> {
  const { companyId, branchId, rentalId, customerId, customerName, discountAmount, entryDate, createdBy } = params;
  if (!customerId || discountAmount <= 0) return { journalEntryId: null, skipped: true };

  const fp = `rental_party_discount:${companyId}:${rentalId}`;
  const { data: dup } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('company_id', companyId)
    .eq('action_fingerprint', fp)
    .maybeSingle();
  if (dup?.id) return { journalEntryId: String((dup as { id: string }).id), skipped: true };

  const arId = await resolveReceivablePostingAccountId(companyId, customerId);
  const discId =
    (await accountHelperService.getAccountByCode('5200', companyId))?.id ||
    (await accountHelperService.getAccountByCode('5210', companyId))?.id ||
    null;
  if (!arId || !discId) return { journalEntryId: null, skipped: false };

  const entryNo = await nextJournalEntryNo(companyId, branchId ?? null);
  const desc = `Rental discount — ${customerName}`;
  const lines: JournalEntryLine[] = [
    { id: '', journal_entry_id: '', account_id: discId, debit: discountAmount, credit: 0, description: desc },
    { id: '', journal_entry_id: '', account_id: arId, debit: 0, credit: discountAmount, description: desc },
  ];
  const entry: JournalEntry = {
    id: '',
    company_id: companyId,
    branch_id: branchId && branchId !== 'all' ? branchId : undefined,
    entry_no: entryNo,
    entry_date: entryDate.slice(0, 10),
    description: desc,
    reference_type: 'rental',
    reference_id: rentalId,
    created_by: createdBy ?? null,
    action_fingerprint: fp,
  };
  const saved = await accountingService.createEntry(entry, lines);
  return { journalEntryId: (saved as { id?: string } | null)?.id ?? null, skipped: false };
}

/**
 * Cash receipt: named customer → Dr payment / Cr party AR (and Cr security deposit liability for deposit slice on this receipt).
 * Walk-in (no customerId) → Dr payment / Cr 2020 Rental Advance (legacy).
 */
export async function postRentalPartyCashReceipt(params: {
  companyId: string;
  branchId: string | null | undefined;
  rentalId: string;
  rentalPaymentId: string;
  customerId: string | null | undefined;
  customerName: string;
  amount: number;
  paymentAccountId: string;
  rentalCharges: number;
  securityDeposit: number;
  entryDate: string;
  createdBy?: string | null;
  description?: string;
}): Promise<{ journalEntryId: string | null }> {
  const {
    companyId,
    branchId,
    rentalId,
    rentalPaymentId,
    customerId,
    customerName,
    amount,
    paymentAccountId,
    rentalCharges,
    securityDeposit,
    entryDate,
    createdBy,
    description,
  } = params;
  if (amount <= 0 || !paymentAccountId) return { journalEntryId: null };

  const fp = rentalPartyPaymentFingerprint(companyId, rentalPaymentId);
  const { data: dup } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('company_id', companyId)
    .eq('action_fingerprint', fp)
    .maybeSingle();
  if (dup?.id) return { journalEntryId: String((dup as { id: string }).id) };

  const payAcc = (
    await supabase.from('accounts').select('id').eq('id', paymentAccountId).eq('company_id', companyId).maybeSingle()
  ).data as { id: string } | null;
  if (!payAcc?.id) return { journalEntryId: null };

  const entryNo = await nextJournalEntryNo(companyId, branchId ?? null);
  const baseDesc = description || `Rental payment — ${customerName}`;

  if (!customerId) {
    const advId = await resolveRentalAdvance2020Id(companyId);
    if (!advId) return { journalEntryId: null };
    const lines: JournalEntryLine[] = [
      { id: '', journal_entry_id: '', account_id: payAcc.id, debit: amount, credit: 0, description: baseDesc },
      { id: '', journal_entry_id: '', account_id: advId, debit: 0, credit: amount, description: baseDesc },
    ];
    const entry: JournalEntry = {
      id: '',
      company_id: companyId,
      branch_id: branchId && branchId !== 'all' ? branchId : undefined,
      entry_no: entryNo,
      entry_date: entryDate.slice(0, 10),
      description: baseDesc,
      reference_type: 'rental',
      reference_id: rentalId,
      created_by: createdBy ?? null,
      action_fingerprint: fp,
    };
    const saved = await accountingService.createEntry(entry, lines);
    return { journalEntryId: (saved as { id?: string } | null)?.id ?? null };
  }

  const arId = await resolveReceivablePostingAccountId(companyId, customerId);
  if (!arId) return { journalEntryId: null };

  const towardRent = Math.min(amount, Math.max(0, rentalCharges));
  const afterRent = Math.max(0, amount - towardRent);
  const towardDeposit = securityDeposit > 0 ? Math.min(afterRent, securityDeposit) : 0;
  const overpay = Math.max(0, afterRent - towardDeposit);
  let creditAr = towardRent + overpay;
  let creditSd = towardDeposit;

  const sdId = creditSd > 0 ? (await accountHelperService.getAccountByCode('2011', companyId))?.id ?? null : null;
  if (creditSd > 0 && !sdId) {
    creditAr = amount;
    creditSd = 0;
  }

  const lines: JournalEntryLine[] = [{ id: '', journal_entry_id: '', account_id: payAcc.id, debit: amount, credit: 0, description: baseDesc }];
  if (creditAr > 0) {
    lines.push({
      id: '',
      journal_entry_id: '',
      account_id: arId,
      debit: 0,
      credit: creditAr,
      description: baseDesc,
    });
  }
  if (creditSd > 0 && sdId) {
    lines.push({
      id: '',
      journal_entry_id: '',
      account_id: sdId,
      debit: 0,
      credit: creditSd,
      description: `${baseDesc} (security deposit)`,
    });
  }

  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
  if (Math.abs(totalCredit - amount) > 0.01) {
    return { journalEntryId: null };
  }

  const entry: JournalEntry = {
    id: '',
    company_id: companyId,
    branch_id: branchId && branchId !== 'all' ? branchId : undefined,
    entry_no: entryNo,
    entry_date: entryDate.slice(0, 10),
    description: baseDesc,
    reference_type: 'rental',
    reference_id: rentalId,
    created_by: createdBy ?? null,
    action_fingerprint: fp,
  };
  const saved = await accountingService.createEntry(entry, lines);
  return { journalEntryId: (saved as { id?: string } | null)?.id ?? null };
}

/** Stable key from expense rows for idempotency (same rental + same lines → same fingerprint). */
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

/**
 * Integrity Lab backfill: one correct JE per reversed legacy row (avoids colliding with live `rental_party_devaluation:*` keys).
 */
export const rentalPartyDevaluationRepairFingerprint = (companyId: string, originalJournalEntryId: string) =>
  `rental_party_devaluation_repair:${companyId}:${originalJournalEntryId}`;

/**
 * Dress devaluation (wear): Dr Rental Income 4200 (reduces revenue), Cr party AR.
 * Walk-in (no customerId): use legacy Dr 5300 / Cr cash in the caller instead.
 * `reference_type` = rental, `reference_id` = rental id.
 */
export async function postRentalPartyDevaluationIfNeeded(params: {
  companyId: string;
  branchId: string | null | undefined;
  rentalId: string;
  customerId: string | null | undefined;
  customerName: string;
  amount: number;
  expenses: Array<{ description: string; amount: number }>;
  bookingNo: string;
  entryDate: string;
  createdBy?: string | null;
  /** When set (e.g. Lab repair), uses repair fingerprint instead of expense-hash fingerprint. */
  repairSourceJournalEntryId?: string | null;
}): Promise<{ journalEntryId: string | null; skipped: boolean; reason?: string }> {
  const {
    companyId,
    branchId,
    rentalId,
    customerId,
    customerName,
    amount,
    expenses,
    bookingNo,
    entryDate,
    createdBy,
    repairSourceJournalEntryId,
  } = params;
  if (!customerId || amount <= 0) {
    return { journalEntryId: null, skipped: true, reason: 'walk_in_or_zero' };
  }
  const fp = repairSourceJournalEntryId
    ? rentalPartyDevaluationRepairFingerprint(companyId, repairSourceJournalEntryId)
    : rentalPartyDevaluationFingerprint(companyId, rentalId, rentalDevaluationExpenseStableKey(expenses));

  const { data: dup } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('company_id', companyId)
    .eq('action_fingerprint', fp)
    .maybeSingle();
  if (dup?.id) return { journalEntryId: String((dup as { id: string }).id), skipped: true };

  const arId = await resolveReceivablePostingAccountId(companyId, customerId);
  const incId = await resolveRentalIncomeAccountId(companyId);
  if (!arId || !incId) {
    return { journalEntryId: null, skipped: false, reason: 'missing_gl_accounts' };
  }

  const entryNo = await nextJournalEntryNo(companyId, branchId ?? null);
  const expDesc = expenses.map((e) => `${e.description}: Rs ${e.amount}`).join(', ');
  const desc = repairSourceJournalEntryId
    ? `Rental devaluation (wear) — repair — ${bookingNo} (${expDesc})`
    : `Rental devaluation (wear) — ${bookingNo} (${expDesc})`;
  const lines: JournalEntryLine[] = [
    { id: '', journal_entry_id: '', account_id: incId, debit: amount, credit: 0, description: desc },
    { id: '', journal_entry_id: '', account_id: arId, debit: 0, credit: amount, description: desc },
  ];
  const entry: JournalEntry = {
    id: '',
    company_id: companyId,
    branch_id: branchId && branchId !== 'all' ? branchId : undefined,
    entry_no: entryNo,
    entry_date: entryDate.slice(0, 10),
    description: desc,
    reference_type: 'rental',
    reference_id: rentalId,
    created_by: createdBy ?? null,
    action_fingerprint: fp,
  };
  const saved = await accountingService.createEntry(entry, lines);
  return { journalEntryId: (saved as { id?: string } | null)?.id ?? null, skipped: false };
}
