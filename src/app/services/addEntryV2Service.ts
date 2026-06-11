/**
 * Add Entry V2 – Typed entry services. One path per entry type.
 * SOURCE LOCK (Phase 1): COA=accounts, Journal=journal_entries+journal_entry_lines, Roznamcha=payments, numbering=erp_document_sequences.
 * Supplier statement uses payments + purchases; GL uses journal_entries only.
 * Rule: If entry touches Cash/Bank/Wallet → create payments row first, then JE with payment_id, then ledger sync where applicable.
 */

import { supabase } from '@/lib/supabase';
import { documentNumberService } from '@/app/services/documentNumberService';
import { accountingService, type JournalEntry, type JournalEntryLine } from '@/app/services/accountingService';
import { dispatchContactBalancesRefresh } from '@/app/lib/contactBalancesRefresh';
import { applyManualReceiptAllocations } from '@/app/services/paymentAllocationService';
import { generatePaymentReference } from '@/app/utils/paymentUtils';
import { createManualSupplierPayment } from '@/app/services/supplierPaymentService';
import { createWorkerPayment } from '@/app/services/workerPaymentService';
import { createCourierPayment } from '@/app/services/courierPaymentService';
import { logPaymentCreated } from '@/app/services/auditLogService';
import { ensurePaymentsForLiquidityJournal } from '@/app/services/journalLiquidityPaymentService';

const PAYMENT_METHOD_MAP: Record<string, string> = {
  cash: 'cash', Cash: 'cash', bank: 'bank', Bank: 'bank', 'mobile wallet': 'other', 'Mobile Wallet': 'other',
  wallet: 'other', Wallet: 'other', mobile_wallet: 'other', card: 'other', cheque: 'other',
};

function normalizePaymentMethod(m: string): string {
  const s = (m || 'cash').toLowerCase().trim();
  return PAYMENT_METHOD_MAP[s] || PAYMENT_METHOD_MAP[m] || 'cash';
}

function validBranchId(branchId: string | null | undefined): string | null {
  return branchId && branchId !== 'all' ? branchId : null;
}

async function getCustomerReceiptRef(companyId: string, branchId: string | null): Promise<string> {
  try {
    return await documentNumberService.getNextDocumentNumber(companyId, branchId, 'customer_receipt');
  } catch {
    return generatePaymentReference(null);
  }
}

/** Returns contactId only if it exists in contacts. Used to avoid payments.contact_id FK violation (e.g. courier with stale/missing contact). */
async function validPaymentsContactId(_companyId: string, contactId: string | null): Promise<string | null> {
  if (!contactId) return null;
  const { data } = await supabase.from('contacts').select('id').eq('id', contactId).maybeSingle();
  return (data && (data as { id: string }).id) ? contactId : null;
}

// ─── 1. Pure Journal ─────────────────────────────────────────────────────
export interface CreatePureJournalParams {
  companyId: string;
  branchId: string | null;
  entryDate: string;
  debitAccountId: string;
  creditAccountId: string;
  amount: number;
  description?: string | null;
  createdBy?: string | null;
  attachments?: { url: string; name: string }[] | null;
}

export async function createPureJournalEntry(params: CreatePureJournalParams): Promise<{ journalEntryId: string }> {
  const { companyId, branchId, entryDate, debitAccountId, creditAccountId, amount, description, createdBy, attachments } = params;
  if (!companyId || !debitAccountId || !creditAccountId || amount <= 0) throw new Error('Invalid pure journal params');
  const branch = validBranchId(branchId);
  let entryNo: string;
  try {
    entryNo = await documentNumberService.getNextDocumentNumber(companyId, branch, 'manual_journal');
  } catch {
    entryNo = `JV-${Date.now()}`;
  }
  const journalEntry: JournalEntry = {
    company_id: companyId,
    branch_id: branch ?? undefined,
    entry_no: entryNo,
    document_no: entryNo,
    entry_date: entryDate,
    description: description || 'Journal entry',
    reference_type: 'journal',
    reference_id: undefined,
    created_by: createdBy ?? undefined,
    ...(attachments && attachments.length > 0 ? { attachments } : {}),
  };
  const lines: JournalEntryLine[] = [
    { account_id: debitAccountId, debit: amount, credit: 0, description: description || undefined },
    { account_id: creditAccountId, debit: 0, credit: amount, description: description || undefined },
  ];
  const saved = await accountingService.createEntry(journalEntry, lines);
  const journalEntryId = (saved as { id: string }).id;
  await ensurePaymentsForLiquidityJournal({
    companyId,
    branchId: branch,
    journalEntryId,
    entryNo,
    entryDate,
    description: description || 'Journal entry',
    lines: lines.map((l) => ({
      accountId: l.account_id,
      debit: l.debit,
      credit: l.credit,
    })),
    createdBy: createdBy ?? null,
  });
  return { journalEntryId };
}

// ─── 2. Customer Receipt ───────────────────────────────────────────────────
export interface CreateCustomerReceiptParams {
  companyId: string;
  branchId: string | null;
  customerId: string;
  customerName: string;
  amount: number;
  paymentAccountId: string;
  paymentDate: string;
  paymentMethod: string;
  notes?: string | null;
  attachments?: { url: string; name: string }[] | null;
  /** Optional override: explicit invoice splits; otherwise FIFO auto-allocation to open invoices. */
  invoiceAllocations?: { saleId: string; amount: number; invoiceNo?: string }[];
}

export async function createCustomerReceiptEntry(params: CreateCustomerReceiptParams): Promise<{ paymentId: string; journalEntryId: string; referenceNumber: string }> {
  const { companyId, branchId, customerId, customerName, amount, paymentAccountId, paymentDate, paymentMethod, notes, attachments, invoiceAllocations } = params;
  if (!companyId || !customerId || amount <= 0 || !paymentAccountId) throw new Error('Invalid customer receipt params');
  const branch = validBranchId(branchId);
  const refNo = await getCustomerReceiptRef(companyId, branch);
  const { data: { user } } = await supabase.auth.getUser();
  const uid = (user as any)?.id ?? null;

  const { data: arAccounts } = await supabase.from('accounts').select('id').eq('company_id', companyId).or('code.eq.1100,name.ilike.%Accounts Receivable%').limit(1);
  const arId = (arAccounts?.[0] as { id: string })?.id;
  if (!arId) throw new Error('Accounts Receivable account (1100) not found');

  const receiptPayload: Record<string, unknown> = {
    company_id: companyId,
    branch_id: branch,
    payment_type: 'received',
    reference_type: 'manual_receipt',
    reference_id: null,
    contact_id: customerId,
    amount,
    payment_method: normalizePaymentMethod(paymentMethod),
    payment_account_id: paymentAccountId,
    payment_date: paymentDate,
    reference_number: refNo,
    notes: notes || undefined,
    received_by: uid,
    created_by: uid,
  };
  if (attachments && attachments.length > 0) receiptPayload.attachments = attachments;
  const { data: paymentRow, error: payErr } = await supabase.from('payments').insert(receiptPayload).select('id').single();
  if (payErr) throw new Error(`Payment row failed: ${payErr.message}`);
  const paymentId = (paymentRow as { id: string }).id;
  logPaymentCreated(companyId, paymentId, { reference_type: 'manual_receipt', amount, contact_id: customerId });

  const entryNo = `JE-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
  const desc = notes || `Receipt from ${customerName}`;
  const journalEntry: JournalEntry = {
    company_id: companyId,
    branch_id: branch ?? undefined,
    entry_no: entryNo,
    entry_date: paymentDate,
    description: desc,
    reference_type: 'manual_receipt',
    reference_id: customerId,
    created_by: uid ?? undefined,
  };
  const lines: JournalEntryLine[] = [
    { account_id: paymentAccountId, debit: amount, credit: 0, description: desc },
    { account_id: arId, debit: 0, credit: amount, description: desc },
  ];
  const saved = await accountingService.createEntry(journalEntry, lines, paymentId);

  await applyManualReceiptAllocations({
    companyId,
    branchId: branch,
    paymentId,
    customerId,
    amount,
    paymentDate,
    referenceNumber: refNo,
    createdBy: uid,
    explicitAllocations: invoiceAllocations && invoiceAllocations.length > 0 ? invoiceAllocations : null,
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'customer', entityId: customerId } }));
    window.dispatchEvent(new CustomEvent('accountingEntriesChanged'));
  }
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('[AddEntryV2] createCustomerReceiptEntry:', {
      payload: { customerId, customerName, amount, paymentAccountId, paymentDate },
      paymentId,
      journalEntryId: (saved as { id: string }).id,
      referenceNumber: refNo,
      refetchEvent: 'ledgerUpdated(customer)',
    });
  }
  return { paymentId, journalEntryId: (saved as { id: string }).id, referenceNumber: refNo };
}

// ─── 3. Supplier Payment ──────────────────────────────────────────────────
export interface CreateSupplierPaymentParams {
  companyId: string;
  branchId: string | null;
  supplierContactId: string;
  supplierName: string;
  amount: number;
  paymentAccountId: string;
  paymentDate: string;
  paymentMethod: string;
  notes?: string | null;
  attachments?: { url: string; name: string }[] | null;
}

export async function createSupplierPaymentEntry(params: CreateSupplierPaymentParams): Promise<{ paymentId: string; journalEntryId: string; referenceNumber: string }> {
  const { companyId, branchId, supplierContactId, supplierName, amount, paymentAccountId, paymentDate, paymentMethod, notes, attachments } = params;
  if (!companyId || !supplierContactId || amount <= 0 || !paymentAccountId) throw new Error('Invalid supplier payment params');
  const desc = notes || `Manual payment to ${supplierName}`;
  const result = await createManualSupplierPayment({
    companyId,
    branchId: validBranchId(branchId),
    supplierContactId,
    amount,
    paymentMethod,
    paymentAccountId,
    paymentDate,
    notes: desc,
    attachments,
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('accountingEntriesChanged'));
  }
  return result;
}

// ─── 4. Worker Payment ────────────────────────────────────────────────────
export interface CreateWorkerPaymentParams {
  companyId: string;
  branchId: string | null;
  workerId: string;
  workerName: string;
  amount: number;
  paymentAccountId: string;
  paymentDate: string;
  paymentMethod: string;
  /** Pay Now: when set, routing uses this stage's bill row if present */
  stageId?: string | null;
  notes?: string | null;
  attachments?: { url: string; name: string }[] | null;
}

export async function createWorkerPaymentEntry(params: CreateWorkerPaymentParams): Promise<{ paymentId: string; journalEntryId: string; referenceNumber: string }> {
  const { companyId, branchId, workerId, workerName, amount, paymentAccountId, paymentDate, paymentMethod, notes, stageId, attachments } = params;
  if (!companyId || !workerId || amount <= 0 || !paymentAccountId) throw new Error('Invalid worker payment params');
  const desc = notes || `Payment to worker ${workerName}`;
  const result = await createWorkerPayment({
    companyId,
    branchId: validBranchId(branchId),
    workerId,
    workerName,
    amount,
    paymentMethod,
    paymentAccountId,
    paymentDate,
    stageId: stageId ?? null,
    notes: desc,
  });
  if (attachments && attachments.length > 0) {
    const upd = await supabase.from('payments').update({ attachments }).eq('id', result.paymentId);
    if (upd.error?.code === 'PGRST204') {
      /* attachments column optional */
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'worker', entityId: workerId } }));
    window.dispatchEvent(new CustomEvent('accountingEntriesChanged'));
  }
  return result;
}

// ─── 5. Expense Payment ─────────────────────────────────────────────────────
export interface CreateExpensePaymentParams {
  companyId: string;
  branchId: string | null;
  expenseAccountId: string;
  amount: number;
  paymentAccountId: string;
  paymentDate: string;
  paymentMethod: string;
  notes?: string | null;
}

export async function createExpensePaymentEntry(params: CreateExpensePaymentParams): Promise<{ paymentId: string; journalEntryId: string; referenceNumber: string }> {
  const { companyId, branchId, expenseAccountId, amount, paymentAccountId, paymentDate, paymentMethod, notes } = params;
  if (!companyId || !expenseAccountId || amount <= 0 || !paymentAccountId) throw new Error('Invalid expense payment params');
  const branch = validBranchId(branchId);
  let refNo: string;
  try {
    refNo = await documentNumberService.getNextDocumentNumber(companyId, branch, 'expense');
  } catch {
    refNo = generatePaymentReference(null);
  }
  const { data: { user } } = await supabase.auth.getUser();
  const uid = (user as any)?.id ?? null;

  const { data: paymentRow, error: payErr } = await supabase.from('payments').insert({
    company_id: companyId,
    branch_id: branch,
    payment_type: 'paid',
    reference_type: 'expense',
    reference_id: null,
    amount,
    payment_method: normalizePaymentMethod(paymentMethod),
    payment_account_id: paymentAccountId,
    payment_date: paymentDate,
    reference_number: refNo,
    notes: notes || undefined,
    received_by: uid,
    created_by: uid,
  }).select('id').single();
  if (payErr) throw new Error(`Payment row failed: ${payErr.message}`);
  const paymentId = (paymentRow as { id: string }).id;
  logPaymentCreated(companyId, paymentId, { reference_type: 'expense', amount });

  const desc = notes || 'Expense payment';
  const entryNo = `JE-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
  const journalEntry: JournalEntry = {
    company_id: companyId,
    branch_id: branch ?? undefined,
    entry_no: entryNo,
    entry_date: paymentDate,
    description: desc,
    reference_type: 'expense',
    reference_id: paymentId,
    created_by: uid ?? undefined,
  };
  const lines: JournalEntryLine[] = [
    { account_id: expenseAccountId, debit: amount, credit: 0, description: desc },
    { account_id: paymentAccountId, debit: 0, credit: amount, description: desc },
  ];
  const saved = await accountingService.createEntry(journalEntry, lines, paymentId);
  return { paymentId, journalEntryId: (saved as { id: string }).id, referenceNumber: refNo };
}

// ─── 6. Internal Transfer ──────────────────────────────────────────────────
export interface CreateInternalTransferParams {
  companyId: string;
  branchId: string | null;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  entryDate: string;
  description?: string | null;
  createdBy?: string | null;
  attachments?: { url: string; name: string }[] | null;
}

export async function createInternalTransferEntry(params: CreateInternalTransferParams): Promise<{ journalEntryId: string }> {
  const { companyId, branchId, fromAccountId, toAccountId, amount, entryDate, description, createdBy, attachments } = params;
  if (!companyId || !fromAccountId || !toAccountId || amount <= 0) throw new Error('Invalid transfer params');
  const branch = validBranchId(branchId);
  const desc = description || 'Internal transfer';
  let entryNo: string;
  try {
    entryNo = await documentNumberService.getNextDocumentNumber(companyId, branch, 'fund_transfer');
  } catch {
    entryNo = `FT-${Date.now()}`;
  }
  const journalEntry: JournalEntry = {
    company_id: companyId,
    branch_id: branch ?? undefined,
    entry_no: entryNo,
    document_no: entryNo,
    entry_date: entryDate,
    description: desc,
    reference_type: 'transfer',
    reference_id: undefined,
    created_by: createdBy ?? undefined,
    ...(attachments && attachments.length > 0 ? { attachments } : {}),
  };
  const lines: JournalEntryLine[] = [
    { account_id: toAccountId, debit: amount, credit: 0, description: desc },
    { account_id: fromAccountId, debit: 0, credit: amount, description: desc },
  ];
  const saved = await accountingService.createEntry(journalEntry, lines);
  const journalEntryId = (saved as { id: string }).id;
  await ensurePaymentsForLiquidityJournal({
    companyId,
    branchId: branch,
    journalEntryId,
    entryNo,
    entryDate,
    description: desc,
    lines: [
      { accountId: toAccountId, debit: amount, credit: 0 },
      { accountId: fromAccountId, debit: 0, credit: amount },
    ],
    createdBy: createdBy ?? null,
  });
  return { journalEntryId };
}

// ─── 7. Courier Payment ────────────────────────────────────────────────────
export interface CreateCourierPaymentParams {
  companyId: string;
  branchId: string | null;
  courierId: string;
  courierName: string;
  courierContactId: string | null;
  amount: number;
  paymentAccountId: string;
  paymentDate: string;
  paymentMethod: string;
  notes?: string | null;
  attachments?: { url: string; name: string }[] | null;
}

export async function createCourierPaymentEntry(params: CreateCourierPaymentParams): Promise<{ paymentId: string; journalEntryId: string; referenceNumber: string }> {
  const { companyId, branchId, courierId, courierName, courierContactId, amount, paymentAccountId, paymentDate, paymentMethod, notes, attachments } = params;
  if (!companyId || !courierId || amount <= 0 || !paymentAccountId) throw new Error('Invalid courier payment params');
  const rawContactId = courierContactId || courierId;
  const contactIdForPayments = await validPaymentsContactId(companyId, rawContactId);
  if (!contactIdForPayments) {
    throw new Error('Courier payment requires a valid contact linked to the courier.');
  }
  const desc = notes || `Courier payment – ${courierName}`;
  const result = await createCourierPayment({
    companyId,
    branchId: validBranchId(branchId),
    courierContactId: contactIdForPayments,
    courierReferenceId: courierId,
    amount,
    paymentMethod,
    paymentAccountId,
    paymentDate,
    notes: desc,
    attachments,
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('accountingEntriesChanged'));
  }
  return result;
}
