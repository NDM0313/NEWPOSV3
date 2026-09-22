/**
 * Payment / journal metadata repair actions (Phase F3).
 */

import { computeDryRunHash } from '@/app/lib/developerRepairHash';
import type { ApplyResult, DeveloperRepairAction, DeveloperRepairContext, DryRunResult } from '@/app/lib/developerRepairTypes';
import {
  amountsMatch,
  blockCrossCompany,
  datesClose,
  isVoided,
  pickSingleLiquidityLine,
  type LiquidityLineCandidate,
} from '@/app/lib/paymentJournalRepairEligibility';
import { isLiquidityPaymentAccount } from '@/app/lib/liquidityPaymentAccount';
import { rentalService } from '@/app/services/rentalService';
import { supabase } from '@/lib/supabase';

const MONEY_EPS = 0.02;

async function loadJeLiquidityLines(journalEntryId: string): Promise<LiquidityLineCandidate[]> {
  const { data: lines } = await supabase
    .from('journal_entry_lines')
    .select('account_id, debit, credit, account:accounts(id, name, type, code)')
    .eq('journal_entry_id', journalEntryId);
  const out: LiquidityLineCandidate[] = [];
  for (const line of lines || []) {
    const rawAcc = (line as { account?: unknown }).account;
    const acc = (Array.isArray(rawAcc) ? rawAcc[0] : rawAcc) as LiquidityLineCandidate['account'];
    const debit = Number((line as { debit?: number }).debit) || 0;
    const credit = Number((line as { credit?: number }).credit) || 0;
    const amount = debit > 0 ? debit : credit;
    if (amount <= MONEY_EPS) continue;
    out.push({
      accountId: String((line as { account_id?: string }).account_id || ''),
      debit,
      credit,
      amount,
      account: acc || {},
    });
  }
  return out;
}

async function jePrimaryAmount(journalEntryId: string): Promise<number> {
  const { data: lines } = await supabase
    .from('journal_entry_lines')
    .select('debit, credit')
    .eq('journal_entry_id', journalEntryId);
  let max = 0;
  for (const line of lines || []) {
    max = Math.max(max, Number((line as { debit?: number }).debit) || 0, Number((line as { credit?: number }).credit) || 0);
  }
  return max;
}

async function dryRunRelinkPaymentToJe(
  params: Record<string, unknown>,
  ctx: DeveloperRepairContext
): Promise<DryRunResult> {
  const paymentId = String(params.paymentId || '');
  const journalEntryId = String(params.journalEntryId || '');
  if (!paymentId || !journalEntryId) {
    return { ok: false, dryRunHash: '', before: {}, afterPreview: {}, blockedReason: 'paymentId and journalEntryId required' };
  }

  const { data: pay } = await supabase
    .from('payments')
    .select('id, company_id, amount, payment_date, contact_id, reference_type, reference_id, voided_at')
    .eq('id', paymentId)
    .maybeSingle();
  const companyBlock = blockCrossCompany((pay as { company_id?: string } | null)?.company_id, ctx.companyId);
  if (!pay || companyBlock) {
    return { ok: false, dryRunHash: '', before: {}, afterPreview: {}, blockedReason: companyBlock || 'Payment not found' };
  }
  if (isVoided(pay as { voided_at?: string | null })) {
    return { ok: false, dryRunHash: '', before: {}, afterPreview: {}, blockedReason: 'Payment is voided' };
  }

  const { data: je } = await supabase
    .from('journal_entries')
    .select('id, company_id, payment_id, entry_date, is_void, reference_type, reference_id')
    .eq('id', journalEntryId)
    .maybeSingle();
  const jeCompanyBlock = blockCrossCompany((je as { company_id?: string } | null)?.company_id, ctx.companyId);
  if (!je || jeCompanyBlock) {
    return { ok: false, dryRunHash: '', before: {}, afterPreview: {}, blockedReason: jeCompanyBlock || 'Journal entry not found' };
  }
  if (isVoided(je as { is_void?: boolean })) {
    return { ok: false, dryRunHash: '', before: {}, afterPreview: {}, blockedReason: 'Journal entry is void' };
  }
  if (!amountsMatch((pay as { amount?: number }).amount, await jePrimaryAmount(journalEntryId))) {
    return { ok: false, dryRunHash: '', before: {}, afterPreview: {}, blockedReason: 'Amount mismatch' };
  }
  if (
    !datesClose(
      (pay as { payment_date?: string }).payment_date,
      (je as { entry_date?: string }).entry_date
    )
  ) {
    return { ok: false, dryRunHash: '', before: {}, afterPreview: {}, blockedReason: 'Date mismatch' };
  }
  if ((je as { payment_id?: string }).payment_id && (je as { payment_id?: string }).payment_id !== paymentId) {
    return { ok: false, dryRunHash: '', before: {}, afterPreview: {}, blockedReason: 'JE linked to another payment' };
  }

  const { data: otherJe } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('payment_id', paymentId)
    .neq('id', journalEntryId)
    .or('is_void.is.null,is_void.eq.false')
    .limit(1)
    .maybeSingle();
  if (otherJe) {
    return { ok: false, dryRunHash: '', before: {}, afterPreview: {}, blockedReason: 'Payment already linked to another active JE' };
  }

  const before = {
    paymentId,
    journalEntryId,
    jePaymentId: (je as { payment_id?: string | null }).payment_id ?? null,
    amount: (pay as { amount?: number }).amount,
  };
  const afterPreview = { ...before, jePaymentId: paymentId };
  const dryRunHash = computeDryRunHash('payment.relink_payment_to_journal', params, before);

  return {
    ok: true,
    dryRunHash,
    before,
    afterPreview,
    targetTable: 'journal_entries',
    targetId: journalEntryId,
    title: 'Relink payment to journal entry',
    impactSummary: 'Sets journal_entries.payment_id only',
  };
}

async function applyRelinkPaymentToJe(
  params: Record<string, unknown>,
  ctx: DeveloperRepairContext,
  dryRunHash: string
): Promise<ApplyResult> {
  const fresh = await dryRunRelinkPaymentToJe(params, ctx);
  if (fresh.dryRunHash !== dryRunHash) return { ok: false, error: 'Dry-run hash mismatch' };
  if (!fresh.ok) return { ok: false, error: fresh.blockedReason };

  const { data, error } = await supabase.rpc('developer_repair_relink_payment_je', {
    p_company_id: ctx.companyId,
    p_payment_id: String(params.paymentId),
    p_journal_entry_id: String(params.journalEntryId),
  });
  if (error) {
    const { data: je } = await supabase
      .from('journal_entries')
      .update({ payment_id: String(params.paymentId) })
      .eq('id', String(params.journalEntryId))
      .eq('company_id', ctx.companyId)
      .select('id, payment_id')
      .maybeSingle();
    if (!je) return { ok: false, error: error.message };
    return { ok: true, after: { payment_id: (je as { payment_id?: string }).payment_id }, message: 'Linked via direct update' };
  }
  const payload = data as { after?: Record<string, unknown> };
  return { ok: true, after: payload?.after || fresh.afterPreview, message: 'Payment linked to journal entry' };
}

async function dryRunFillPaymentAccount(
  params: Record<string, unknown>,
  ctx: DeveloperRepairContext
): Promise<DryRunResult> {
  const targetTable = String(params.targetTable || 'payments');
  const rowId = String(params.rowId || params.paymentId || params.rentalPaymentId || '');
  if (!rowId) {
    return { ok: false, dryRunHash: '', before: {}, afterPreview: {}, blockedReason: 'rowId required' };
  }

  const table = targetTable === 'rental_payments' ? 'rental_payments' : 'payments';
  const { data: row } = await supabase
    .from(table)
    .select('id, company_id, amount, payment_account_id, journal_entry_id, rental_id')
    .eq('id', rowId)
    .maybeSingle();
  const block = blockCrossCompany((row as { company_id?: string } | null)?.company_id, ctx.companyId);
  if (!row || block) {
    return { ok: false, dryRunHash: '', before: {}, afterPreview: {}, blockedReason: block || 'Row not found' };
  }
  if ((row as { payment_account_id?: string }).payment_account_id) {
    return { ok: false, dryRunHash: '', before: {}, afterPreview: {}, blockedReason: 'payment_account_id already set' };
  }
  const jeId = (row as { journal_entry_id?: string }).journal_entry_id;
  if (!jeId) {
    return { ok: false, dryRunHash: '', before: {}, afterPreview: {}, blockedReason: 'No linked journal entry' };
  }

  const lines = await loadJeLiquidityLines(jeId);
  const picked = pickSingleLiquidityLine(lines, (row as { amount?: number }).amount);
  if (!picked) {
    return {
      ok: false,
      dryRunHash: '',
      before: {},
      afterPreview: {},
      blockedReason: 'JE must have exactly one liquidity line matching amount',
    };
  }

  const before = {
    table,
    rowId,
    payment_account_id: null,
    journal_entry_id: jeId,
    amount: (row as { amount?: number }).amount,
  };
  const afterPreview = { ...before, payment_account_id: picked.accountId };
  const actionId = 'payment.fill_payment_account_from_je';
  return {
    ok: true,
    dryRunHash: computeDryRunHash(actionId, params, before),
    before,
    afterPreview,
    targetTable: table,
    targetId: rowId,
    title: 'Fill payment_account_id from JE liquidity line',
  };
}

async function applyFillPaymentAccount(
  params: Record<string, unknown>,
  ctx: DeveloperRepairContext,
  dryRunHash: string
): Promise<ApplyResult> {
  const fresh = await dryRunFillPaymentAccount(params, ctx);
  if (fresh.dryRunHash !== dryRunHash) return { ok: false, error: 'Dry-run hash mismatch' };
  if (!fresh.ok) return { ok: false, error: fresh.blockedReason };

  const table = String(fresh.before.table || 'payments');
  const rowId = String(fresh.before.rowId);
  const accountId = String(fresh.afterPreview.payment_account_id);
  const { error } = await supabase
    .from(table)
    .update({ payment_account_id: accountId })
    .eq('id', rowId)
    .eq('company_id', ctx.companyId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, after: fresh.afterPreview, message: 'payment_account_id updated' };
}

async function resolveDocumentBranch(
  referenceType: string | null | undefined,
  referenceId: string | null | undefined
): Promise<string | null> {
  const rt = String(referenceType || '').toLowerCase();
  const rid = String(referenceId || '').trim();
  if (!rid) return null;
  if (rt === 'sale' || rt === 'sales') {
    const { data } = await supabase.from('sales').select('branch_id').eq('id', rid).maybeSingle();
    return (data as { branch_id?: string } | null)?.branch_id ?? null;
  }
  if (rt === 'purchase' || rt === 'purchases') {
    const { data } = await supabase.from('purchases').select('branch_id').eq('id', rid).maybeSingle();
    return (data as { branch_id?: string } | null)?.branch_id ?? null;
  }
  if (rt === 'rental' || rt === 'rentals') {
    const { data } = await supabase.from('rentals').select('branch_id').eq('id', rid).maybeSingle();
    return (data as { branch_id?: string } | null)?.branch_id ?? null;
  }
  return null;
}

async function dryRunSyncBranch(
  params: Record<string, unknown>,
  ctx: DeveloperRepairContext
): Promise<DryRunResult> {
  const targetTable = String(params.targetTable || 'payments');
  const rowId = String(params.rowId || '');
  if (!rowId) {
    return { ok: false, dryRunHash: '', before: {}, afterPreview: {}, blockedReason: 'rowId required' };
  }

  const allowed = ['payments', 'rental_payments', 'journal_entries'];
  if (!allowed.includes(targetTable)) {
    return { ok: false, dryRunHash: '', before: {}, afterPreview: {}, blockedReason: 'Unsupported target table' };
  }

  const selectCols =
    targetTable === 'journal_entries'
      ? 'id, company_id, branch_id, reference_type, reference_id'
      : 'id, company_id, branch_id, reference_type, reference_id, rental_id';
  const { data: row } = await supabase.from(targetTable).select(selectCols).eq('id', rowId).maybeSingle();
  const block = blockCrossCompany((row as { company_id?: string } | null)?.company_id, ctx.companyId);
  if (!row || block) {
    return { ok: false, dryRunHash: '', before: {}, afterPreview: {}, blockedReason: block || 'Row not found' };
  }

  let refType = (row as { reference_type?: string }).reference_type;
  let refId = (row as { reference_id?: string }).reference_id;
  if (targetTable === 'rental_payments' && (row as { rental_id?: string }).rental_id) {
    refType = 'rental';
    refId = (row as { rental_id?: string }).rental_id;
  }

  const docBranch = await resolveDocumentBranch(refType, refId);
  if (!docBranch) {
    return { ok: false, dryRunHash: '', before: {}, afterPreview: {}, blockedReason: 'Source document branch not found' };
  }
  const currentBranch = (row as { branch_id?: string | null }).branch_id ?? null;
  if (currentBranch === docBranch) {
    return { ok: false, dryRunHash: '', before: {}, afterPreview: {}, blockedReason: 'Branch already matches document' };
  }

  const before = { targetTable, rowId, branch_id: currentBranch, documentBranch: docBranch };
  const afterPreview = { ...before, branch_id: docBranch };
  return {
    ok: true,
    dryRunHash: computeDryRunHash('payment.sync_branch_from_document', params, before),
    before,
    afterPreview,
    targetTable,
    targetId: rowId,
    title: 'Sync branch from source document',
  };
}

async function applySyncBranch(
  params: Record<string, unknown>,
  ctx: DeveloperRepairContext,
  dryRunHash: string
): Promise<ApplyResult> {
  const fresh = await dryRunSyncBranch(params, ctx);
  if (fresh.dryRunHash !== dryRunHash) return { ok: false, error: 'Dry-run hash mismatch' };
  if (!fresh.ok) return { ok: false, error: fresh.blockedReason };

  const table = String(fresh.before.targetTable);
  const rowId = String(fresh.before.rowId);
  const branchId = String(fresh.afterPreview.branch_id);
  const { error } = await supabase
    .from(table)
    .update({ branch_id: branchId })
    .eq('id', rowId)
    .eq('company_id', ctx.companyId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, after: fresh.afterPreview, message: 'Branch synced from document' };
}

async function dryRunRelinkRentalPayment(
  params: Record<string, unknown>,
  ctx: DeveloperRepairContext
): Promise<DryRunResult> {
  const rentalPaymentId = String(params.rentalPaymentId || '');
  const journalEntryId = String(params.journalEntryId || '');
  if (!rentalPaymentId || !journalEntryId) {
    return { ok: false, dryRunHash: '', before: {}, afterPreview: {}, blockedReason: 'rentalPaymentId and journalEntryId required' };
  }

  const { data: rp } = await supabase
    .from('rental_payments')
    .select('id, company_id, rental_id, amount, payment_date, journal_entry_id, payment_account_id')
    .eq('id', rentalPaymentId)
    .maybeSingle();
  const block = blockCrossCompany((rp as { company_id?: string } | null)?.company_id, ctx.companyId);
  if (!rp || block) {
    return { ok: false, dryRunHash: '', before: {}, afterPreview: {}, blockedReason: block || 'Rental payment not found' };
  }

  const { data: je } = await supabase
    .from('journal_entries')
    .select('id, company_id, entry_date, is_void, reference_type, reference_id')
    .eq('id', journalEntryId)
    .maybeSingle();
  if (!je || blockCrossCompany((je as { company_id?: string }).company_id, ctx.companyId)) {
    return { ok: false, dryRunHash: '', before: {}, afterPreview: {}, blockedReason: 'Journal entry not found' };
  }
  if (isVoided(je as { is_void?: boolean })) {
    return { ok: false, dryRunHash: '', before: {}, afterPreview: {}, blockedReason: 'Journal entry is void' };
  }
  if ((je as { reference_type?: string }).reference_type !== 'rental') {
    return { ok: false, dryRunHash: '', before: {}, afterPreview: {}, blockedReason: 'JE is not a rental payment entry' };
  }
  if ((je as { reference_id?: string }).reference_id !== (rp as { rental_id?: string }).rental_id) {
    return { ok: false, dryRunHash: '', before: {}, afterPreview: {}, blockedReason: 'Rental id mismatch' };
  }
  if (!amountsMatch((rp as { amount?: number }).amount, await jePrimaryAmount(journalEntryId))) {
    return { ok: false, dryRunHash: '', before: {}, afterPreview: {}, blockedReason: 'Amount mismatch' };
  }
  if (
    !datesClose(
      (rp as { payment_date?: string }).payment_date,
      (je as { entry_date?: string }).entry_date
    )
  ) {
    return { ok: false, dryRunHash: '', before: {}, afterPreview: {}, blockedReason: 'Date mismatch' };
  }
  if ((rp as { journal_entry_id?: string }).journal_entry_id && (rp as { journal_entry_id?: string }).journal_entry_id !== journalEntryId) {
    return { ok: false, dryRunHash: '', before: {}, afterPreview: {}, blockedReason: 'Rental payment already linked to another JE' };
  }

  const liquidityId = await rentalService.resolveLiquidityAccountFromJournal(journalEntryId);
  const before = {
    rentalPaymentId,
    journalEntryId,
    journal_entry_id: (rp as { journal_entry_id?: string | null }).journal_entry_id ?? null,
    payment_account_id: (rp as { payment_account_id?: string | null }).payment_account_id ?? null,
  };
  const afterPreview = {
    ...before,
    journal_entry_id: journalEntryId,
    payment_account_id: (rp as { payment_account_id?: string }).payment_account_id || liquidityId,
  };

  return {
    ok: true,
    dryRunHash: computeDryRunHash('rental.relink_rental_payment_to_journal', params, before),
    before,
    afterPreview,
    targetTable: 'rental_payments',
    targetId: rentalPaymentId,
    title: 'Relink rental payment to journal entry',
  };
}

async function applyRelinkRentalPayment(
  params: Record<string, unknown>,
  ctx: DeveloperRepairContext,
  dryRunHash: string
): Promise<ApplyResult> {
  const fresh = await dryRunRelinkRentalPayment(params, ctx);
  if (fresh.dryRunHash !== dryRunHash) return { ok: false, error: 'Dry-run hash mismatch' };
  if (!fresh.ok) return { ok: false, error: fresh.blockedReason };

  const rentalPaymentId = String(params.rentalPaymentId);
  const journalEntryId = String(params.journalEntryId);
  const liquidityId = await rentalService.resolveLiquidityAccountFromJournal(journalEntryId);

  const patch: Record<string, unknown> = { journal_entry_id: journalEntryId };
  if (liquidityId && !fresh.before.payment_account_id) {
    patch.payment_account_id = liquidityId;
  }

  const { error } = await supabase
    .from('rental_payments')
    .update(patch)
    .eq('id', rentalPaymentId)
    .eq('company_id', ctx.companyId);
  if (error) return { ok: false, error: error.message };

  return { ok: true, after: fresh.afterPreview, message: 'Rental payment linked to journal entry' };
}

export const paymentRelinkToJournalAction: DeveloperRepairAction = {
  id: 'payment.relink_payment_to_journal',
  title: 'Relink payment to journal entry',
  description: 'Sets journal_entries.payment_id when payment and JE match safely.',
  riskLevel: 'medium',
  requiredRole: 'super-admin',
  confirmPhrase: (p) => `RELINK-PAYMENT-JE-${String(p.paymentId || '').slice(0, 8)}`,
  whatItChanges: ['journal_entries.payment_id'],
  whatItNeverChanges: ['Payment amount', 'JE lines', 'Reference numbers', 'contact_id'],
  dryRun: dryRunRelinkPaymentToJe,
  apply: applyRelinkPaymentToJe,
  auditPayload: (b, a) => ({ before: b, after: a }),
  rollbackNote: 'Clear journal_entries.payment_id using before_json.jePaymentId',
};

export const paymentFillAccountAction: DeveloperRepairAction = {
  id: 'payment.fill_payment_account_from_je',
  title: 'Fill payment_account_id from JE',
  description: 'Backfills payment_account_id when null and JE has one liquidity line.',
  riskLevel: 'medium',
  requiredRole: 'super-admin',
  confirmPhrase: (p) => `FILL-PAYMENT-ACCOUNT-${String(p.rowId || p.paymentId || '').slice(0, 8)}`,
  whatItChanges: ['payments.payment_account_id or rental_payments.payment_account_id'],
  whatItNeverChanges: ['GL lines', 'Amounts', 'Fake cash movement rows'],
  dryRun: dryRunFillPaymentAccount,
  apply: applyFillPaymentAccount,
  auditPayload: (b, a) => ({ before: b, after: a }),
  rollbackNote: 'Set payment_account_id back to null from before_json',
};

export const paymentSyncBranchAction: DeveloperRepairAction = {
  id: 'payment.sync_branch_from_document',
  title: 'Sync branch from source document',
  description: 'Copies branch_id from sale/purchase/rental when target branch is null or wrong.',
  riskLevel: 'medium',
  requiredRole: 'super-admin',
  confirmPhrase: (p) => `SYNC-BRANCH-${String(p.rowId || '').slice(0, 8)}`,
  whatItChanges: ['branch_id on payment, rental_payment, or journal_entry metadata'],
  whatItNeverChanges: ['Source document branch', 'GL amounts'],
  dryRun: dryRunSyncBranch,
  apply: applySyncBranch,
  auditPayload: (b, a) => ({ before: b, after: a }),
  rollbackNote: 'Restore branch_id from before_json.branch_id',
};

export const rentalRelinkPaymentAction: DeveloperRepairAction = {
  id: 'rental.relink_rental_payment_to_journal',
  title: 'Relink rental payment to journal entry',
  description: 'Sets rental_payments.journal_entry_id and optional payment_account_id backfill.',
  riskLevel: 'medium',
  requiredRole: 'super-admin',
  confirmPhrase: (p) => `RELINK-RENTAL-PAY-${String(p.rentalPaymentId || '').slice(0, 8)}`,
  whatItChanges: ['rental_payments.journal_entry_id', 'rental_payments.payment_account_id when null'],
  whatItNeverChanges: ['GL lines', 'Amounts', 'Rental totals'],
  dryRun: dryRunRelinkRentalPayment,
  apply: applyRelinkRentalPayment,
  auditPayload: (b, a) => ({ before: b, after: a }),
  rollbackNote: 'Restore journal_entry_id from before_json',
};

export const PAYMENT_REPAIR_ACTIONS = [
  paymentRelinkToJournalAction,
  paymentFillAccountAction,
  paymentSyncBranchAction,
  rentalRelinkPaymentAction,
];
