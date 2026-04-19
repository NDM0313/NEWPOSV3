/**
 * PF-14.1: Payment amount edit – post delta JE only (never touch original payment JE).
 * When user edits a posted payment amount (e.g. 30,000 → 27,000), we update the payment row
 * so effective = 27,000, and post this adjustment JE so accounting net effect is correct.
 */

import { supabase } from '@/lib/supabase';
import { accountHelperService } from './accountHelperService';
import { accountingService, type JournalEntry, type JournalEntryLine } from './accountingService';
import { recordTransactionMutation } from './transactionMutationService';

/** Journal rows linked to a payment but not the PF-14 adjustment layer (those use reference_id only). */
function isPrimaryPaymentLinkedJe(je: { reference_type?: string | null; payment_id?: string | null }): boolean {
  const rt = String(je.reference_type || '').toLowerCase();
  if (!je.payment_id) return false;
  return rt !== 'payment_adjustment';
}

/** Payments confirmed as "skip" during this browser session. Cleared on page refresh. */
const _skippedPaymentIds = new Set<string>();

/** Clear cache for a specific payment (after edit) or all (on demand). */
export function clearSkippedPaymentCache(paymentId?: string) {
  if (paymentId) _skippedPaymentIds.delete(paymentId);
  else _skippedPaymentIds.clear();
}

export type PaymentContext = 'sale' | 'purchase';

/**
 * True when at least one non-void PF-14 "Payment account changed" JE exists for this payment.
 * The primary receipt JE still shows the **original** liquidity account; comparing primary-only
 * liquidity to `payments.payment_account_id` would be wrong — PF-14 transfers already moved cash.
 * Used to skip `syncPaymentAccountAdjustmentsForCompany` backfill that would otherwise replay Petty→Bank on every load.
 */
export async function hasPaymentAccountChangedPf14Journal(companyId: string, paymentId: string): Promise<boolean> {
  if (!companyId || !paymentId) return false;
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('company_id', companyId)
    .eq('reference_type', 'payment_adjustment')
    .eq('reference_id', paymentId)
    .ilike('description', '%Payment account changed%')
    .or('is_void.is.null,is_void.eq.false')
    .limit(1);
  if (error) return false;
  return Array.isArray(data) && data.length > 0;
}

export type PaymentEffectiveLiquiditySnapshot = {
  paymentId: string;
  declaredPaymentAccountId: string | null;
  amount: number;
  primaryJeLiquidityAccountId: string | null;
  hasPf14AccountTransferJournals: boolean;
  /** If true, comparing primary JE to payments row would be misleading (PF-14 owns the chain). */
  primaryLiquidityLikelyStaleVsDeclared: boolean;
};

/** Read-only snapshot for Truth Lab / audits — does not post. */
export async function getPaymentEffectiveLiquiditySnapshot(
  companyId: string,
  paymentId: string,
  primaryLines: { account_id?: string | null; debit?: number | null; credit?: number | null }[],
  apId: string | null,
  arId: string | null
): Promise<PaymentEffectiveLiquiditySnapshot | null> {
  const { data: pay, error } = await supabase
    .from('payments')
    .select('id, amount, payment_account_id')
    .eq('company_id', companyId)
    .eq('id', paymentId)
    .maybeSingle();
  if (error || !pay) return null;
  const declared = String((pay as { payment_account_id?: string | null }).payment_account_id || '').trim() || null;
  const amount = Math.round(Number((pay as { amount?: number }).amount ?? 0) * 100) / 100;
  const primaryLiq = liquidityAccountOnPrimaryJe(primaryLines, apId, arId);
  const hasPf = await hasPaymentAccountChangedPf14Journal(companyId, paymentId);
  const stale = Boolean(hasPf && primaryLiq && declared && primaryLiq !== declared);
  return {
    paymentId,
    declaredPaymentAccountId: declared,
    amount,
    primaryJeLiquidityAccountId: primaryLiq,
    hasPf14AccountTransferJournals: hasPf,
    primaryLiquidityLikelyStaleVsDeclared: stale,
  };
}

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
  /** Party AP sub-account (supplier); when set, used instead of generic 2000 so GL matches `get_contact_party_gl_balances`. */
  payableAccountId?: string | null;
  /** Party AR sub-account (customer); when set, used instead of generic 1100 for sale-context deltas. */
  receivableAccountId?: string | null;
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
    payableAccountId: payableAccountIdParam,
    receivableAccountId: receivableAccountIdParam,
  } = params;

  const { tracePaymentEditFlow } = await import('@/app/lib/paymentEditFlowTrace');
  tracePaymentEditFlow('paymentAdjustment.post_amount_adjust.enter', {
    paymentId,
    companyId,
    oldAmount,
    newAmount,
    paymentAccountId,
    context,
  });

  const delta = Math.round((newAmount - oldAmount) * 100) / 100;
  if (delta === 0) return;
  if (!String(paymentAccountId || '').trim()) {
    console.warn('[paymentAdjustmentService] Missing liquidity account for amount delta; skipping.');
    return;
  }

  // PF-14.4: Idempotency – fingerprint includes liquidity account so a corrected re-post is not blocked by description-only match.
  const alreadyExists = await accountingService.hasExistingPaymentAmountAdjustment(
    companyId,
    paymentId,
    oldAmount,
    newAmount,
    paymentAccountId
  );
  if (alreadyExists) {
    tracePaymentEditFlow('paymentAdjustment.post_amount_adjust.skip_idempotent', { paymentId, oldAmount, newAmount });
    if (import.meta.env?.DEV) console.log('[paymentAdjustmentService] Skipping duplicate payment amount adjustment JE (idempotent):', paymentId);
    return;
  }

  const absDelta = Math.abs(delta);
  const isReversal = delta < 0; // amount decreased → we reverse the decrease (Dr AR, Cr Cash)

  const entryNo = `JE-PAY-ADJ-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  const desc =
    context === 'sale'
      ? `Payment edited: was Rs ${Number(oldAmount).toLocaleString()}, now Rs ${Number(newAmount).toLocaleString()} – ${invoiceNoOrRef}`
      : `Payment edited: was Rs ${Number(oldAmount).toLocaleString()}, now Rs ${Number(newAmount).toLocaleString()} – ${invoiceNoOrRef}`;

  const fingerprintAmount = `payment_adjustment_amount:${companyId}:${paymentId}:${oldAmount}:${newAmount}:${paymentAccountId}`;
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
    economic_event_id: paymentId,
  };

  let lines: JournalEntryLine[];
  if (context === 'sale') {
    const arId =
      (receivableAccountIdParam && String(receivableAccountIdParam).trim()) ||
      (await accountHelperService.getAccountByCode('1100', companyId))?.id;
    if (!arId) {
      console.warn('[paymentAdjustmentService] AR account not found (party or 1100), skipping adjustment JE');
      return;
    }
    // Sale: original payment = Dr Cash, Cr AR. So reversal = Dr AR, Cr Cash.
    if (isReversal) {
      lines = [
        { id: '', journal_entry_id: '', account_id: arId, debit: absDelta, credit: 0, description: `AR – ${invoiceNoOrRef}` },
        { id: '', journal_entry_id: '', account_id: paymentAccountId, debit: 0, credit: absDelta, description: `Cash/Bank reversal – ${invoiceNoOrRef}` },
      ];
    } else {
      lines = [
        { id: '', journal_entry_id: '', account_id: paymentAccountId, debit: absDelta, credit: 0, description: `Cash/Bank – ${invoiceNoOrRef}` },
        { id: '', journal_entry_id: '', account_id: arId, debit: 0, credit: absDelta, description: `AR – ${invoiceNoOrRef}` },
      ];
    }
  } else {
    // Purchase: original = Dr AP, Cr Cash. Reversal = Dr Cash, Cr AP. Need AP account.
    const apId =
      (payableAccountIdParam && String(payableAccountIdParam).trim()) ||
      (await accountHelperService.getAccountByCode('2000', companyId))?.id;
    if (!apId) {
      console.warn('[paymentAdjustmentService] AP account not found (party or 2000), skipping adjustment JE');
      return;
    }
    if (isReversal) {
      lines = [
        { id: '', journal_entry_id: '', account_id: paymentAccountId, debit: absDelta, credit: 0, description: `Cash/Bank reversal – ${invoiceNoOrRef}` },
        { id: '', journal_entry_id: '', account_id: apId, debit: 0, credit: absDelta, description: `AP – ${invoiceNoOrRef}` },
      ];
    } else {
      lines = [
        { id: '', journal_entry_id: '', account_id: apId, debit: absDelta, credit: 0, description: `AP – ${invoiceNoOrRef}` },
        { id: '', journal_entry_id: '', account_id: paymentAccountId, debit: 0, credit: absDelta, description: `Cash/Bank – ${invoiceNoOrRef}` },
      ];
    }
  }

  tracePaymentEditFlow('paymentAdjustment.post_amount_adjust.createEntry', {
    paymentId,
    fingerprint: fingerprintAmount,
    economic_event_id: paymentId,
  });
  const saved = await accountingService.createEntry(entry, lines, paymentId);
  const jeId = String((saved as { id?: string })?.id || '');
  if (jeId) {
    void recordTransactionMutation({
      companyId,
      branchId,
      entityType: 'payment',
      entityId: paymentId,
      mutationType: 'amount_edit',
      oldState: { amount: oldAmount },
      newState: { amount: newAmount },
      deltaAmount: delta,
      adjustmentJournalEntryId: jeId,
      actorUserId: createdBy ?? null,
      reason: 'PF-14 payment amount delta JE',
      metadata: { fingerprint: fingerprintAmount },
    });
  }
}

/**
 * Sum Dr on `accountId` across active "Payment account changed" PF-14 JEs for this payment.
 * Used to block stale UI `oldAccountId` (e.g. wallet) after liquidity already moved via another leg (e.g. wallet→cash→NDM).
 */
async function sumDebitOnAccountPaymentAccountChangeJes(
  companyId: string,
  paymentId: string,
  accountId: string
): Promise<number> {
  const { data: jes, error } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('company_id', companyId)
    .eq('reference_type', 'payment_adjustment')
    .eq('reference_id', paymentId)
    .ilike('description', '%Payment account changed%')
    .or('is_void.is.null,is_void.eq.false');
  if (error || !jes?.length) return 0;
  const ids = jes.map((j: { id: string }) => j.id);
  const { data: lines } = await supabase
    .from('journal_entry_lines')
    .select('debit')
    .in('journal_entry_id', ids)
    .eq('account_id', accountId);
  return (lines || []).reduce((s, l) => s + Number((l as { debit?: number }).debit ?? 0), 0);
}

/**
 * PF-14.1: When user changes payment method/account only (e.g. Cash → Bank/NDM), post a single JE
 * that moves the amount from old account to new account: Dr New, Cr Old.
 * Original payment JE is never modified; this keeps books correct and matches Payment Details UI.
 * @returns true if a new JE was inserted; false if skipped (invalid args or idempotent duplicate).
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
}): Promise<boolean> {
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

  const { tracePaymentEditFlow: traceAcc } = await import('@/app/lib/paymentEditFlowTrace');
  traceAcc('paymentAdjustment.post_account_adjust.enter', {
    paymentId,
    companyId,
    oldAccountId,
    newAccountId,
    amount,
    context,
  });

  if (amount <= 0 || oldAccountId === newAccountId) return false;

  const { data: payRow } = await supabase
    .from('payments')
    .select('payment_account_id, amount')
    .eq('id', paymentId)
    .eq('company_id', companyId)
    .maybeSingle();
  const payAcc = String((payRow as { payment_account_id?: string | null } | null)?.payment_account_id || '').trim();
  const payAmt = Number((payRow as { amount?: number } | null)?.amount ?? 0);
  if (
    payAcc &&
    payAcc === String(newAccountId).trim() &&
    payAmt > 0 &&
    Math.abs(amount - payAmt) < 0.02
  ) {
    const funded = await sumDebitOnAccountPaymentAccountChangeJes(companyId, paymentId, newAccountId);
    if (funded >= amount - 0.02) {
      traceAcc('paymentAdjustment.post_account_adjust.skip_destination_already_funded', {
        paymentId,
        newAccountId,
        amount,
        fundedDrOnNew: funded,
      });
      if (import.meta.env?.DEV) {
        console.log(
          '[paymentAdjustmentService] Skipping account adjustment — destination already funded from prior PF-14 transfer:',
          paymentId
        );
      }
      return false;
    }
  }

  // PF-14.4: Idempotency – skip if this payment account adjustment already exists (e.g. from sync or double save).
  const alreadyExists = await accountingService.hasExistingPaymentAccountAdjustment(
    companyId, paymentId, oldAccountId, newAccountId, amount
  );
  if (alreadyExists) {
    traceAcc('paymentAdjustment.post_account_adjust.skip_idempotent', { paymentId, oldAccountId, newAccountId, amount });
    if (import.meta.env?.DEV) console.log('[paymentAdjustmentService] Skipping duplicate payment account adjustment JE (idempotent):', paymentId);
    return false;
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
    economic_event_id: paymentId,
  };

  // Customer receipt primary = Dr Cash(old), Cr AR → inflow; move debit from old→new: Dr new, Cr old.
  // Purchase payment primary = Dr AP, Cr Cash(old) → outflow; move credit from old→new: Dr old, Cr new.
  const lines: JournalEntryLine[] = context === 'purchase'
    ? [
        { id: '', journal_entry_id: '', account_id: oldAccountId, debit: amount, credit: 0, description: `Neutralize outflow – ${invoiceNoOrRef}` },
        { id: '', journal_entry_id: '', account_id: newAccountId, debit: 0, credit: amount, description: `New outflow – ${invoiceNoOrRef}` },
      ]
    : [
        { id: '', journal_entry_id: '', account_id: newAccountId, debit: amount, credit: 0, description: `Payment – ${invoiceNoOrRef}` },
        { id: '', journal_entry_id: '', account_id: oldAccountId, debit: 0, credit: amount, description: `Transfer out – ${invoiceNoOrRef}` },
      ];

  traceAcc('paymentAdjustment.post_account_adjust.createEntry', {
    paymentId,
    fingerprint: fingerprintAccount,
    economic_event_id: paymentId,
  });
  const saved = await accountingService.createEntry(entry, lines, paymentId);
  const jeId = String((saved as { id?: string })?.id || '');
  if (jeId) {
    void recordTransactionMutation({
      companyId,
      branchId,
      entityType: 'payment',
      entityId: paymentId,
      mutationType: 'account_change',
      oldState: { payment_account_id: oldAccountId },
      newState: { payment_account_id: newAccountId, amount },
      adjustmentJournalEntryId: jeId,
      actorUserId: createdBy ?? null,
      reason: 'PF-14 liquidity transfer (same receipt, new cash/bank account)',
      metadata: { fingerprint: fingerprintAccount },
    });
  }
  return true;
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
  /** PF-14 account-change JEs exist — primary JE liquidity is not authoritative; sync skipped (prevents duplicate replay). */
  skippedPf14Chain: number;
}> {
  if (!companyId) {
    return { synced: 0, errors: 0, skippedDuplicates: 0, skippedAmbiguous: 0, skippedPf14Chain: 0 };
  }

  const apAccount = await accountHelperService.getAccountByCode('2000', companyId);
  const arAccount = await accountHelperService.getAccountByCode('1100', companyId);
  const apId = apAccount?.id ?? null;
  const arId = arAccount?.id ?? null;

  const { data: payments, error: payErr } = await supabase
    .from('payments')
    .select('id, amount, payment_account_id, payment_date, company_id, branch_id, reference_id, reference_type')
    .eq('company_id', companyId)
    .not('payment_account_id', 'is', null);

  if (payErr || !payments?.length) {
    return { synced: 0, errors: 0, skippedDuplicates: 0, skippedAmbiguous: 0, skippedPf14Chain: 0 };
  }

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
  let skippedPf14Chain = 0;

  for (const p of payments as any[]) {
    const paymentId = p.id;

    // Session-level cache: skip payments already evaluated this browser session
    if (_skippedPaymentIds.has(paymentId)) continue;

    const currentAccountId = p.payment_account_id ?? '';
    if (!currentAccountId) { _skippedPaymentIds.add(paymentId); continue; }

    const primaries = byPaymentPrimary.get(paymentId) || [];
    if (primaries.length === 0) { _skippedPaymentIds.add(paymentId); continue; }
    if (primaries.length > 1) {
      skippedDuplicates++;
      _skippedPaymentIds.add(paymentId);
      // Data integrity: more than one “primary” payment JE — cannot pick liquidity safely; sync skipped.
      if (import.meta.env?.DEV) {
        console.debug('[paymentAdjustmentService] Skip sync: multiple primary JEs for payment', paymentId);
      }
      continue;
    }

    const primary = primaries[0];
    const lines = primary.lines ?? [];
    const effectiveLiquidity = liquidityAccountOnPrimaryJe(lines, apId, arId);
    if (!effectiveLiquidity) {
      skippedAmbiguous++;
      _skippedPaymentIds.add(paymentId);
      continue;
    }
    if (effectiveLiquidity === currentAccountId) { _skippedPaymentIds.add(paymentId); continue; }

    // PF-14.7: After one or more user-driven account transfers, primary JE still shows the **original**
    // receipt account. payments.payment_account_id is authoritative. Do NOT post another transfer from
    // primary liquidity — that replays Petty→Bank on every Accounting tab load (duplicate JE-0078 class bugs).
    if (await hasPaymentAccountChangedPf14Journal(companyId, paymentId)) {
      skippedPf14Chain++;
      _skippedPaymentIds.add(paymentId);
      // PF-14: payments.payment_account_id is authoritative; do not re-post from stale primary JE liquidity.
      if (import.meta.env?.DEV) {
        console.debug(
          '[paymentAdjustmentService] Skip payment_account sync: PF-14 account-change JEs exist (primary JE liquidity stale vs payments row):',
          paymentId
        );
      }
      continue;
    }

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
      const posted = await postPaymentAccountAdjustment({
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
      if (posted) synced++;
    } catch {
      errors++;
    }
  }
  return { synced, errors, skippedDuplicates, skippedAmbiguous, skippedPf14Chain };
}

