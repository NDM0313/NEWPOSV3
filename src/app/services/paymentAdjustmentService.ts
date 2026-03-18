/**
 * PF-14.1: Payment amount edit – post delta JE only (never touch original payment JE).
 * When user edits a posted payment amount (e.g. 30,000 → 27,000), we update the payment row
 * so effective = 27,000, and post this adjustment JE so accounting net effect is correct.
 */

import { supabase } from '@/lib/supabase';
import { accountHelperService } from './accountHelperService';
import { accountingService, type JournalEntry, type JournalEntryLine } from './accountingService';

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
 * Sync ledger with payments table: for any sale payment where the effective debit account
 * (from all payment + payment_adjustment JEs) differs from payment.payment_account_id,
 * post the missing account-adjustment JE so Cash/Bank ledgers show correctly.
 * Single source of truth = payments.payment_account_id; ledger is built from JEs only.
 * Call once per company when loading accounting (idempotent).
 */
export async function syncPaymentAccountAdjustmentsForCompany(companyId: string): Promise<{ synced: number; errors: number }> {
  if (!companyId) return { synced: 0, errors: 0 };

  const { data: payments, error: payErr } = await supabase
    .from('payments')
    .select('id, amount, payment_account_id, payment_date, company_id, branch_id, reference_id')
    .eq('company_id', companyId)
    .not('payment_account_id', 'is', null);

  if (payErr || !payments?.length) return { synced: 0, errors: 0 };

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
      lines:journal_entry_lines(account_id, debit, credit)
    `)
    .eq('company_id', companyId)
    .in('payment_id', paymentIds);

  const { data: adjustmentJEs } = await supabase
    .from('journal_entries')
    .select(`
      id,
      payment_id,
      reference_type,
      reference_id,
      entry_date,
      branch_id,
      lines:journal_entry_lines(account_id, debit, credit)
    `)
    .eq('company_id', companyId)
    .eq('reference_type', 'payment_adjustment')
    .in('reference_id', paymentIds);

  const journalEntries = [...(paymentJEs || []), ...(adjustmentJEs || [])];
  if (!journalEntries.length) return { synced: 0, errors: 0 };

  const byPayment = new Map<string, { debitByAccount: Map<string, number>; creditByAccount: Map<string, number>; entryDate: string; branchId: string | null; referenceId: string }>();
  for (const je of journalEntries as any[]) {
    const paymentId = je.payment_id || je.reference_id;
    if (!paymentId || !paymentIds.includes(paymentId)) continue;
    if (!byPayment.has(paymentId)) {
      byPayment.set(paymentId, {
        debitByAccount: new Map(),
        creditByAccount: new Map(),
        entryDate: je.entry_date || new Date().toISOString().slice(0, 10),
        branchId: je.branch_id ?? null,
        referenceId: (payments.find((p: any) => p.id === paymentId) as any)?.reference_id ?? '',
      });
    }
    const rec = byPayment.get(paymentId)!;
    const lines = je.lines ?? [];
    for (const line of lines) {
      const aid = line.account_id ?? '';
      if (!aid) continue;
      const d = (rec.debitByAccount.get(aid) ?? 0) + Number(line.debit ?? 0);
      const c = (rec.creditByAccount.get(aid) ?? 0) + Number(line.credit ?? 0);
      rec.debitByAccount.set(aid, d);
      rec.creditByAccount.set(aid, c);
    }
  }

  let synced = 0;
  let errors = 0;
  for (const p of payments as any[]) {
    const paymentId = p.id;
    const currentAccountId = p.payment_account_id ?? '';
    if (!currentAccountId) continue;
    const rec = byPayment.get(paymentId);
    if (!rec) continue;

    let effectiveDebitAccount = '';
    let netDebit = 0;
    for (const [aid, debit] of rec.debitByAccount) {
      const credit = rec.creditByAccount.get(aid) ?? 0;
      const net = debit - credit;
      if (net > 0 && net > netDebit) {
        netDebit = net;
        effectiveDebitAccount = aid;
      }
    }
    if (!effectiveDebitAccount || effectiveDebitAccount === currentAccountId) continue;

    const amount = Math.round((p.amount ?? 0) * 100) / 100;
    if (amount <= 0) continue;

    try {
      const invoiceNoOrRef = p.reference_id ? `Sale ${p.reference_id.slice(0, 8)}` : `Payment ${paymentId.slice(0, 8)}`;
      await postPaymentAccountAdjustment({
        context: 'sale',
        companyId: p.company_id,
        branchId: rec.branchId,
        paymentId,
        referenceId: rec.referenceId || p.reference_id || paymentId,
        oldAccountId: effectiveDebitAccount,
        newAccountId: currentAccountId,
        amount,
        invoiceNoOrRef,
        entryDate: (p.payment_date || rec.entryDate || new Date().toISOString().slice(0, 10)).toString().slice(0, 10),
        createdBy: null,
      });
      synced++;
    } catch (e) {
      errors++;
    }
  }
  return { synced, errors };
}

