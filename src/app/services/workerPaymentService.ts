/**
 * Canonical worker payment flow (Phase-2).
 * One path: payment ref from erp_document_sequences → payments row → journal entry → worker_ledger_entries.
 * Ensures Roznamcha shows worker payments (payments-only) and worker ledger has exactly one payment row per PAY ref.
 */

import { supabase } from '@/lib/supabase';
import { documentNumberService } from '@/app/services/documentNumberService';
import { accountingService } from '@/app/services/accountingService';
import type { JournalEntry, JournalEntryLine } from '@/app/services/accountingService';
import { studioProductionService } from '@/app/services/studioProductionService';
import { generatePaymentReference } from '@/app/utils/paymentUtils';
import {
  getWorkerAdvanceAccountId,
  shouldDebitWorkerPayableForPayment,
} from '@/app/services/workerAdvanceService';
import { dispatchContactBalancesRefresh } from '@/app/lib/contactBalancesRefresh';

export interface CreateWorkerPaymentParams {
  companyId: string;
  branchId: string | null;
  workerId: string;
  workerName: string;
  amount: number;
  paymentMethod: string;
  paymentAccountId: string;
  /** Pay Now: stage being paid; when amount >= stageAmount we call markStageLedgerPaid (job row stays without PAY ref). */
  stageId?: string | null;
  stageAmount?: number | null;
  notes?: string | null;
}

export interface CreateWorkerPaymentResult {
  paymentId: string;
  journalEntryId: string;
  referenceNumber: string;
}

const PAYMENT_METHOD_MAP: Record<string, string> = {
  cash: 'cash', Cash: 'cash', bank: 'bank', Bank: 'bank', card: 'card', Card: 'card',
  cheque: 'other', Cheque: 'other', 'mobile wallet': 'other', 'Mobile Wallet': 'other',
  mobile_wallet: 'other', wallet: 'other', Wallet: 'other',
};

function normalizePaymentMethod(method: string): string {
  const m = (method || 'cash').toLowerCase().trim();
  return PAYMENT_METHOD_MAP[method] || PAYMENT_METHOD_MAP[m] || 'cash';
}

/**
 * Canonical worker payment: one payments row (PAY-xxxx), one journal entry, one worker_ledger_entries payment row.
 * Roznamcha shows it via payments. Job rows (studio_production_stage) are never given payment_reference.
 */
export async function createWorkerPayment(params: CreateWorkerPaymentParams): Promise<CreateWorkerPaymentResult> {
  const {
    companyId,
    branchId,
    workerId,
    workerName,
    amount,
    paymentMethod,
    paymentAccountId,
    stageId,
    stageAmount,
    notes,
  } = params;

  if (!companyId || !workerId || amount <= 0 || !paymentAccountId) {
    throw new Error('companyId, workerId, amount, and paymentAccountId are required');
  }

  const validBranchId = (branchId && branchId !== 'all') ? branchId : null;
  const enumPaymentMethod = normalizePaymentMethod(paymentMethod);
  const paymentDate = new Date().toISOString().split('T')[0];

  // 1) Payment reference from canonical source only
  let referenceNumber: string;
  try {
    referenceNumber = await documentNumberService.getNextDocumentNumber(companyId, validBranchId, 'payment');
  } catch (e) {
    referenceNumber = generatePaymentReference(null);
  }

  const { data: { user: authUser } } = await supabase.auth.getUser();
  const authUserId = authUser?.id ?? null;

  // 2) Insert payments row (so Roznamcha shows it)
  const { data: paymentRow, error: paymentErr } = await supabase
    .from('payments')
    .insert({
      company_id: companyId,
      branch_id: validBranchId,
      payment_type: 'paid',
      reference_type: 'worker_payment',
      reference_id: workerId,
      amount,
      payment_method: enumPaymentMethod,
      payment_account_id: paymentAccountId,
      payment_date: paymentDate,
      reference_number: referenceNumber,
      notes: notes || undefined,
      received_by: authUserId,
      created_by: authUserId,
    })
    .select('id')
    .single();

  if (paymentErr) throw new Error(`Worker payment (payments row) failed: ${paymentErr.message}`);
  const paymentId = (paymentRow as { id: string }).id;

  // 3) Debit Worker Payable (2010) if a stage bill exists; else Worker Advance (1180)
  const payToPayable = await shouldDebitWorkerPayableForPayment(companyId, workerId, stageId ?? null, validBranchId);
  const { data: wpAccounts } = await supabase
    .from('accounts')
    .select('id')
    .eq('company_id', companyId)
    .or('code.eq.2010,name.ilike.%Worker Payable%')
    .limit(1);
  const workerPayableAccountId = (wpAccounts?.[0] as { id: string } | undefined)?.id;
  if (!workerPayableAccountId) throw new Error('Worker Payable account (2010) not found');

  let debitAccountId = workerPayableAccountId;
  if (!payToPayable) {
    const advId = await getWorkerAdvanceAccountId(companyId);
    if (!advId) throw new Error('Worker Advance account (1180) not found. Run migrations or ensure default accounts.');
    debitAccountId = advId;
  }

  const debitLabel = payToPayable ? 'Worker payable' : 'Worker advance (pre-bill)';
  const entryNo = `JE-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
  const journalEntry: JournalEntry = {
    company_id: companyId,
    branch_id: validBranchId ?? undefined,
    entry_no: entryNo,
    entry_date: paymentDate,
    description: `Payment to worker ${workerName} (${debitLabel})`,
    reference_type: 'worker_payment',
    reference_id: workerId,
    created_by: authUserId ?? undefined,
  };
  const lines: JournalEntryLine[] = [
    { account_id: debitAccountId, debit: amount, credit: 0, description: `${debitLabel} – ${workerName}` },
    { account_id: paymentAccountId, debit: 0, credit: amount, description: `Payment to worker ${workerName}` },
  ];
  const savedEntry = await accountingService.createEntry(journalEntry, lines, paymentId);
  const journalEntryId = (savedEntry as { id: string }).id;

  // 5) One worker_ledger_entries row (accounting_payment) with this PAY ref
  const isPayNowFull = stageId != null && stageAmount != null && amount >= Number(stageAmount);
  if (!isPayNowFull) {
    await studioProductionService.recordAccountingPaymentToLedger({
      companyId,
      workerId,
      amount,
      paymentReference: referenceNumber,
      notes: notes || `Payment to worker`,
      journalEntryId,
    });
  }

  // 6) Pay Now full: mark stage/job as paid without putting PAY ref on job row (contamination fix)
  if (isPayNowFull && stageId) {
    await studioProductionService.markStageLedgerPaid(stageId, null);
  }

  dispatchContactBalancesRefresh(companyId);
  return { paymentId, journalEntryId, referenceNumber };
}
