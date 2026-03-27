/**
 * PF-14.1: Payment amount edit – post delta JE only (never touch original payment JE).
 * When user edits a posted payment amount (e.g. 30,000 → 27,000), we update the payment row
 * so effective = 27,000, and post this adjustment JE so accounting net effect is correct.
 */

import { supabase } from '@/lib/supabase';
import { accountHelperService } from './accountHelperService';
import { accountingService, type JournalEntry, type JournalEntryLine } from './accountingService';

/** Journal rows linked to a payment but not the PF-14 adjustment layer (those use reference_id only). */
function isPrimaryPaymentLinkedJe(je: { reference_type?: string | null; payment_id?: string | null }): boolean {
  const rt = String(je.reference_type || '').toLowerCase();
  if (!je.payment_id) return false;
  return rt !== 'payment_adjustment';
}

export type PaymentContext = 'sale' | 'purchase';

/**
 * Post a single journal entry for the difference between old and new payment amount.
 * - If newAmount < oldAmount: reversal (Dr AR, Cr Cash/Bank) for (oldAmount - newAmount).
 * - If newAmount > oldAmount: additional (Dr Cash/Bank, Cr AR) for (newAmount - oldAmount).
 * Original payment JE is never modified.
 */
export async function postPaymentAmountAdjustment(params: {
  context: PaymentContext;
  companyId: string;
  branchId: string | null;
  paymentId: string;
  referenceId: string;
  oldAmount: number;
  newAmount: number;
  paymentAccountId: string;
  invoiceNoOrRef: string;
  entryDate: string;
  createdBy?: string | null;
}): Promise<void> {
  const {
    context,
    companyId,
    branchId,
    paymentId,
    referenceId,
    oldAmount,
    newAmount,
    paymentAccountId,
    invoiceNoOrRef,
    entryDate,
    createdBy,
  } = params;

  const delta = Math.round((newAmount - oldAmount) * 100) / 100;
  if (delta === 0) return;

  // PF-14.4: Idempotency – skip if this payment amount adjustment already exists.
  const alreadyExists = await accountingService.hasExistingPaymentAmountAdjustment(companyId, paymentId, oldAmount, newAmount);
  if (alreadyExists) {
    if (import.meta.env?.DEV) console.log('[paymentAdjustmentService] Skipping duplicate payment amount adjustment JE (idempotent):', paymentId);
    return;
  }

  const absDelta = Math.abs(delta);
  const isReversal = delta < 0; // amount decreased → we reverse the decrease (Dr AR, Cr Cash)

  const arAccount = await accountHelperService.getAccountByCode('1100', companyId);
  if (!arAccount?.id) {
    console.warn('[paymentAdjustmentService] AR account (1100) not found, skipping adjustment JE');
    return;
  }

  const entryNo = `JE-PAY-ADJ-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  const desc =
    context === 'sale'
      ? `Payment edited: was Rs ${Number(oldAmount).toLocaleString()}, now Rs ${Number(newAmount).toLocaleString()} – ${invoiceNoOrRef}`
      : `Payment edited: was Rs ${Number(oldAmount).toLocaleString()}, now Rs ${Number(newAmount).toLocaleString()} – ${invoiceNoOrRef}`;

  const fingerprintAmount = `payment_adjustment_amount:${companyId}:${paymentId}:${oldAmount}:${newAmount}`;
  const entry: JournalEntry = {
    id: '',
    company_id: companyId,
    branch_id: branchId && branchId !== 'all' ? branchId : undefined,
    entry_no: entryNo,
    entry_date: entryDate,
    description: desc,
    reference_type: 'payment_adjustment',
    reference_id: paymentId,
    created_by: createdBy || undefined,
    action_fingerprint: fingerprintAmount,
  };

  let lines: JournalEntryLine[];
  if (context === 'sale') {
    // Sale: original payment = Dr Cash, Cr AR. So reversal = Dr AR, Cr Cash.
    if (isReversal) {
      lines = [
        { id: '', journal_entry_id: '', account_id: arAccount.id, debit: absDelta, credit: 0, description: `AR – ${invoiceNoOrRef}` },
        { id: '', journal_entry_id: '', account_id: paymentAccountId, debit: 0, credit: absDelta, description: `Cash/Bank reversal – ${invoiceNoOrRef}` },
      ];
    } else {
      lines = [
        { id: '', journal_entry_id: '', account_id: paymentAccountId, debit: absDelta, credit: 0, description: `Cash/Bank – ${invoiceNoOrRef}` },
        { id: '', journal_entry_id: '', account_id: arAccount.id, debit: 0, credit: absDelta, description: `AR – ${invoiceNoOrRef}` },
      ];
    }
  } else {
    // Purchase: original = Dr AP, Cr Cash. Reversal = Dr Cash, Cr AP. Need AP account.
    const apAccount = await accountHelperService.getAccountByCode('2000', companyId);
    if (!apAccount?.id) {
      console.warn('[paymentAdjustmentService] AP account (2000) not found, skipping adjustment JE');
      return;
    }
    if (isReversal) {
      lines = [
        { id: '', journal_entry_id: '', account_id: paymentAccountId, debit: absDelta, credit: 0, description: `Cash/Bank reversal – ${invoiceNoOrRef}` },
        { id: '', journal_entry_id: '', account_id: apAccount.id, debit: 0, credit: absDelta, description: `AP – ${invoiceNoOrRef}` },
      ];
    } else {
      lines = [
        { id: '', journal_entry_id: '', account_id: apAccount.id, debit: absDelta, credit: 0, description: `AP – ${invoiceNoOrRef}` },
        { id: '', journal_entry_id: '', account_id: paymentAccountId, debit: 0, credit: absDelta, description: `Cash/Bank – ${invoiceNoOrRef}` },
      ];
    }
  }

  await accountingService.createEntry(entry, lines);
}

/**
 * PF-14.1: When user changes payment method/account only (e.g. Cash → Bank/NDM), post a single JE
 * that moves the amount from old account to new account: Dr New, Cr Old.
 * Original payment JE is never modified; this keeps books correct and matches Payment Details UI.
 */
export async function postPaymentAccountAdjustment(params: {
  context: PaymentContext;
  companyId: string;
  branchId: string | null;
  paymentId: string;
  referenceId: string;
  oldAccountId: string;
  newAccountId: string;
  amount: number;
  invoiceNoOrRef: string;
  entryDate: string;
  createdBy?: string | null;
}): Promise<void> {
  const {
    context,
    companyId,
    branchId,
    paymentId,
    referenceId,
    oldAccountId,
    newAccountId,
    amount,
    invoiceNoOrRef,
    entryDate,
    createdBy,
  } = params;

  if (amount <= 0 || oldAccountId === newAccountId) return;

  // PF-14.4: Idempotency – skip if this payment account adjustment already exists (e.g. from sync or double save).
  const alreadyExists = await accountingService.hasExistingPaymentAccountAdjustment(
    companyId, paymentId, oldAccountId, newAccountId, amount
  );
  if (alreadyExists) {
    if (import.meta.env?.DEV) console.log('[paymentAdjustmentService] Skipping duplicate payment account adjustment JE (idempotent):', paymentId);
    return;
  }

  const entryNo = `JE-PAY-ACC-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  const desc =
    context === 'sale'
      ? `Payment account changed – ${invoiceNoOrRef} (same amount, new account)`
      : `Payment account changed – ${invoiceNoOrRef} (same amount, new account)`;

  const fingerprintAccount = `payment_adjustment_account:${companyId}:${paymentId}:${oldAccountId}:${newAccountId}:${amount}`;
  const entry: JournalEntry = {
    id: '',
    company_id: companyId,
    branch_id: branchId && branchId !== 'all' ? branchId : undefined,
    entry_no: entryNo,
    entry_date: entryDate,
    description: desc,
    reference_type: 'payment_adjustment',
    reference_id: paymentId,
    created_by: createdBy || undefined,
    action_fingerprint: fingerprintAccount,
  };

  // Dr new account (money now in Bank), Cr old account (money left Cash)
  const lines: JournalEntryLine[] = [
    { id: '', journal_entry_id: '', account_id: newAccountId, debit: amount, credit: 0, description: `Payment – ${invoiceNoOrRef}` },
    { id: '', journal_entry_id: '', account_id: oldAccountId, debit: 0, credit: amount, description: `Transfer out – ${invoiceNoOrRef}` },
  ];

  await accountingService.createEntry(entry, lines);
}

/**
 * Liquidity leg on the *primary* payment JE (the row with journal_entries.payment_id set, not payment_adjustment).
 * - Sale receipt: Dr Cash/Bank, Cr AR → liquidity = account that is not AR (1100).
 * - Supplier payment: Dr AP, Cr Cash/Bank → liquidity = account that is not AP (2000).
 * Previous bug: used "max net debit account" globally, which picks AP on purchase payments → bogus
 * Dr Bank / Cr AP "adjustment" stacked on every accounting load. See postingDuplicateRepairService for duplicate JE scans.
 */
function liquidityAccountOnPrimaryJe(
  lines: { account_id?: string | null; debit?: number | null; credit?: number | null }[],
  apAccountId: string | null,
  arAccountId: string | null
): string | null {
  const cleaned = (lines || []).filter((l) => l.account_id && (Number(l.debit) > 0 || Number(l.credit) > 0));
  if (cleaned.length < 2) return null;
  const ap = apAccountId || '';
  const ar = arAccountId || '';
  const nonAp = cleaned.filter((l) => String(l.account_id) !== ap);
  const nonAr = cleaned.filter((l) => String(l.account_id) !== ar);
  const hasApDebit = cleaned.some((l) => String(l.account_id) === ap && Number(l.debit) > 0);
  const hasArCredit = cleaned.some((l) => String(l.account_id) === ar && Number(l.credit) > 0);
  if (hasApDebit && nonAp.length === 1) return String(nonAp[0].account_id);
  if (hasArCredit && nonAr.length === 1) return String(nonAr[0].account_id);
  if (ap && ar) {
    const neither = cleaned.filter((l) => String(l.account_id) !== ap && String(l.account_id) !== ar);
    if (neither.length === 1) return String(neither[0].account_id);
  }
  return null;
}

function paymentAdjustmentContextFromPrimaryLines(
  lines: { account_id?: string | null; debit?: number | null; credit?: number | null }[],
  apAccountId: string | null
): PaymentContext {
  const ap = apAccountId || '';
  const hasApDebit = (lines || []).some((l) => String(l.account_id) === ap && Number(l.debit) > 0);
  return hasApDebit ? 'purchase' : 'sale';
}

/**
 * Sync ledger with payments.payment_account_id using only the canonical primary JE per payment.
 * Skips payments with 0 or 2+ primary JEs (duplicates — repair via postingDuplicateRepairService).
 */
export async function syncPaymentAccountAdjustmentsForCompany(companyId: string): Promise<{
  synced: number;
  errors: number;
  skippedDuplicates: number;
  skippedAmbiguous: number;
}> {
  if (!companyId) return { synced: 0, errors: 0, skippedDuplicates: 0, skippedAmbiguous: 0 };

  const apAccount = await accountHelperService.getAccountByCode('2000', companyId);
  const arAccount = await accountHelperService.getAccountByCode('1100', companyId);
  const apId = apAccount?.id ?? null;
  const arId = arAccount?.id ?? null;

  const { data: payments, error: payErr } = await supabase
    .from('payments')
    .select('id, amount, payment_account_id, payment_date, company_id, branch_id, reference_id, reference_type')
    .eq('company_id', companyId)
    .not('payment_account_id', 'is', null);

  if (payErr || !payments?.length) return { synced: 0, errors: 0, skippedDuplicates: 0, skippedAmbiguous: 0 };

  const paymentIds = payments.map((p: any) => p.id);
  const { data: paymentJEs } = await supabase
    .from('journal_entries')
    .select(`
      id,
      payment_id,
      reference_type,
      reference_id,
      entry_date,
      branch_id,
      created_at,
      lines:journal_entry_lines(account_id, debit, credit)
    `)
    .eq('company_id', companyId)
    .in('payment_id', paymentIds)
    .or('is_void.is.null,is_void.eq.false')
    .neq('reference_type', 'payment_adjustment');

  const byPaymentPrimary = new Map<string, any[]>();
  for (const je of paymentJEs || []) {
    const row = je as any;
    if (!isPrimaryPaymentLinkedJe(row)) continue;
    const pid = row.payment_id;
    if (!pid) continue;
    if (!byPaymentPrimary.has(pid)) byPaymentPrimary.set(pid, []);
    byPaymentPrimary.get(pid)!.push(row);
  }

  let synced = 0;
  let errors = 0;
  let skippedDuplicates = 0;
  let skippedAmbiguous = 0;

  for (const p of payments as any[]) {
    const paymentId = p.id;
    const currentAccountId = p.payment_account_id ?? '';
    if (!currentAccountId) continue;

    const primaries = byPaymentPrimary.get(paymentId) || [];
    if (primaries.length === 0) continue;
    if (primaries.length > 1) {
      skippedDuplicates++;
      if (import.meta.env?.DEV) {
        console.warn('[paymentAdjustmentService] Skip sync: multiple primary JEs for payment', paymentId);
      }
      continue;
    }

    const primary = primaries[0];
    const lines = primary.lines ?? [];
    const effectiveLiquidity = liquidityAccountOnPrimaryJe(lines, apId, arId);
    if (!effectiveLiquidity) {
      skippedAmbiguous++;
      continue;
    }
    if (effectiveLiquidity === currentAccountId) continue;

    const amount = Math.round((p.amount ?? 0) * 100) / 100;
    if (amount <= 0) continue;

    const context = paymentAdjustmentContextFromPrimaryLines(lines, apId);
    const refType = String(p.reference_type || '');
    const invoiceNoOrRef =
      refType === 'purchase' && p.reference_id
        ? `PUR-${String(p.reference_id).slice(0, 8)}`
        : refType === 'sale' && p.reference_id
          ? `Sale ${String(p.reference_id).slice(0, 8)}`
          : `Payment ${paymentId.slice(0, 8)}`;

    try {
      await postPaymentAccountAdjustment({
        context,
        companyId: p.company_id,
        branchId: primary.branch_id ?? p.branch_id ?? null,
        paymentId,
        referenceId: p.reference_id || paymentId,
        oldAccountId: effectiveLiquidity,
        newAccountId: currentAccountId,
        amount,
        invoiceNoOrRef,
        entryDate: (p.payment_date || primary.entry_date || new Date().toISOString().slice(0, 10)).toString().slice(0, 10),
        createdBy: null,
      });
      synced++;
    } catch {
      errors++;
    }
  }
  return { synced, errors, skippedDuplicates, skippedAmbiguous };
}

