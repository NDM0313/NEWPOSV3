/**
 * Add Entry V2 – Typed entry services. One path per entry type.
 * SOURCE LOCK (Phase 1): COA=accounts, Journal=journal_entries+journal_entry_lines, Roznamcha=payments, numbering=erp_document_sequences.
 * ledger_master + ledger_entries used only for UI ledger sync (supplier/user screens), not for GL reports.
 * Rule: If entry touches Cash/Bank/Wallet → create payments row first, then JE with payment_id, then ledger sync where applicable.
 */

import { supabase } from '@/lib/supabase';
import { documentNumberService } from '@/app/services/documentNumberService';
import { accountingService, type JournalEntry, type JournalEntryLine } from '@/app/services/accountingService';
import { getOrCreateLedger, addLedgerEntry } from '@/app/services/ledgerService';
import { generatePaymentReference } from '@/app/utils/paymentUtils';

const PAYMENT_METHOD_MAP: Record<string, string> = {
  cash: 'cash', Cash: 'cash', bank: 'bank', Bank: 'bank', 'mobile wallet': 'mobile_wallet', 'Mobile Wallet': 'mobile_wallet',
  wallet: 'mobile_wallet', Wallet: 'mobile_wallet', card: 'other', cheque: 'other',
};

function normalizePaymentMethod(m: string): string {
  const s = (m || 'cash').toLowerCase().trim();
  return PAYMENT_METHOD_MAP[s] || PAYMENT_METHOD_MAP[m] || 'cash';
}

function validBranchId(branchId: string | null | undefined): string | null {
  return branchId && branchId !== 'all' ? branchId : null;
}

async function getPayRef(companyId: string, branchId: string | null): Promise<string> {
  try {
    return await documentNumberService.getNextDocumentNumber(companyId, branchId, 'payment');
  } catch {
    return generatePaymentReference(null);
  }
}

async function getApAccountId(companyId: string): Promise<string> {
  const { data } = await supabase.from('accounts').select('id').eq('company_id', companyId).or('code.eq.2000,name.ilike.%Accounts Payable%').limit(1);
  const id = (data?.[0] as { id: string })?.id;
  if (!id) throw new Error('Accounts Payable account (2000) not found');
  return id;
}

async function getWorkerPayableAccountId(companyId: string): Promise<string> {
  const { data } = await supabase.from('accounts').select('id').eq('company_id', companyId).or('code.eq.2010,name.ilike.%Worker Payable%').limit(1);
  const id = (data?.[0] as { id: string })?.id;
  if (!id) throw new Error('Worker Payable account (2010) not found');
  return id;
}

async function getCourierPayableAccountId(companyId: string, contactId: string, contactName: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_courier_payable_account', {
    p_company_id: companyId,
    p_contact_id: contactId,
    p_contact_name: contactName,
  });
  if (error || !data) throw new Error('Courier payable account not found');
  return data as string;
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
}

export async function createPureJournalEntry(params: CreatePureJournalParams): Promise<{ journalEntryId: string }> {
  const { companyId, branchId, entryDate, debitAccountId, creditAccountId, amount, description, createdBy } = params;
  if (!companyId || !debitAccountId || !creditAccountId || amount <= 0) throw new Error('Invalid pure journal params');
  const branch = validBranchId(branchId);
  const entryNo = `JE-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
  const journalEntry: JournalEntry = {
    company_id: companyId,
    branch_id: branch ?? undefined,
    entry_no: entryNo,
    entry_date: entryDate,
    description: description || 'Journal entry',
    reference_type: 'journal',
    reference_id: undefined,
    created_by: createdBy ?? undefined,
  };
  const lines: JournalEntryLine[] = [
    { account_id: debitAccountId, debit: amount, credit: 0, description: description || undefined },
    { account_id: creditAccountId, debit: 0, credit: amount, description: description || undefined },
  ];
  const saved = await accountingService.createEntry(journalEntry, lines);
  return { journalEntryId: (saved as { id: string }).id };
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
}

export async function createCustomerReceiptEntry(params: CreateCustomerReceiptParams): Promise<{ paymentId: string; journalEntryId: string; referenceNumber: string }> {
  const { companyId, branchId, customerId, customerName, amount, paymentAccountId, paymentDate, paymentMethod, notes } = params;
  if (!companyId || !customerId || amount <= 0 || !paymentAccountId) throw new Error('Invalid customer receipt params');
  const branch = validBranchId(branchId);
  const refNo = await getPayRef(companyId, branch);
  const { data: { user } } = await supabase.auth.getUser();
  const uid = (user as any)?.id ?? null;

  const { data: arAccounts } = await supabase.from('accounts').select('id').eq('company_id', companyId).or('code.eq.1100,name.ilike.%Accounts Receivable%').limit(1);
  const arId = (arAccounts?.[0] as { id: string })?.id;
  if (!arId) throw new Error('Accounts Receivable account (1100) not found');

  const { data: paymentRow, error: payErr } = await supabase.from('payments').insert({
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
  }).select('id').single();
  if (payErr) throw new Error(`Payment row failed: ${payErr.message}`);
  const paymentId = (paymentRow as { id: string }).id;

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
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'customer', entityId: customerId } }));
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
}

export async function createSupplierPaymentEntry(params: CreateSupplierPaymentParams): Promise<{ paymentId: string; journalEntryId: string; referenceNumber: string }> {
  const { companyId, branchId, supplierContactId, supplierName, amount, paymentAccountId, paymentDate, paymentMethod, notes } = params;
  if (!companyId || !supplierContactId || amount <= 0 || !paymentAccountId) throw new Error('Invalid supplier payment params');
  const branch = validBranchId(branchId);
  const refNo = await getPayRef(companyId, branch);
  const { data: { user } } = await supabase.auth.getUser();
  const uid = (user as any)?.id ?? null;

  const { data: paymentRow, error: payErr } = await supabase.from('payments').insert({
    company_id: companyId,
    branch_id: branch,
    payment_type: 'paid',
    reference_type: 'manual_payment',
    reference_id: null,
    contact_id: supplierContactId,
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

  const apId = await getApAccountId(companyId);
  const desc = notes || `Manual payment to ${supplierName}`;
  const entryNo = `JE-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
  const journalEntry: JournalEntry = {
    company_id: companyId,
    branch_id: branch ?? undefined,
    entry_no: entryNo,
    entry_date: paymentDate,
    description: desc,
    reference_type: 'manual_payment',
    reference_id: null,
    created_by: uid ?? undefined,
  };
  const lines: JournalEntryLine[] = [
    { account_id: apId, debit: amount, credit: 0, description: desc },
    { account_id: paymentAccountId, debit: 0, credit: amount, description: desc },
  ];
  const saved = await accountingService.createEntry(journalEntry, lines, paymentId);

  const ledger = await getOrCreateLedger(companyId, 'supplier', supplierContactId, supplierName);
  if (ledger) {
    await addLedgerEntry({
      companyId,
      ledgerId: ledger.id,
      entryDate: paymentDate,
      debit: amount,
      credit: 0,
      source: 'payment',
      referenceNo: (saved as any)?.entry_no ?? refNo,
      referenceId: paymentId,
      remarks: desc,
    });
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'supplier', entityId: supplierContactId } }));
  }
  return { paymentId, journalEntryId: (saved as { id: string }).id, referenceNumber: refNo };
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
  notes?: string | null;
}

export async function createWorkerPaymentEntry(params: CreateWorkerPaymentParams): Promise<{ paymentId: string; journalEntryId: string; referenceNumber: string }> {
  const { companyId, branchId, workerId, workerName, amount, paymentAccountId, paymentDate, paymentMethod, notes } = params;
  if (!companyId || !workerId || amount <= 0 || !paymentAccountId) throw new Error('Invalid worker payment params');
  const branch = validBranchId(branchId);
  const refNo = await getPayRef(companyId, branch);
  const { data: { user } } = await supabase.auth.getUser();
  const uid = (user as any)?.id ?? null;

  const { data: paymentRow, error: payErr } = await supabase.from('payments').insert({
    company_id: companyId,
    branch_id: branch,
    payment_type: 'paid',
    reference_type: 'worker_payment',
    reference_id: workerId,
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

  const wpId = await getWorkerPayableAccountId(companyId);
  const desc = notes || `Payment to worker ${workerName}`;
  const entryNo = `JE-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
  const journalEntry: JournalEntry = {
    company_id: companyId,
    branch_id: branch ?? undefined,
    entry_no: entryNo,
    entry_date: paymentDate,
    description: desc,
    reference_type: 'worker_payment',
    reference_id: workerId,
    created_by: uid ?? undefined,
  };
  const lines: JournalEntryLine[] = [
    { account_id: wpId, debit: amount, credit: 0, description: desc },
    { account_id: paymentAccountId, debit: 0, credit: amount, description: desc },
  ];
  const saved = await accountingService.createEntry(journalEntry, lines, paymentId);

  const { studioProductionService } = await import('@/app/services/studioProductionService');
  await studioProductionService.recordAccountingPaymentToLedger({
    companyId,
    workerId,
    amount,
    paymentReference: refNo,
    notes: desc,
    journalEntryId: (saved as { id: string }).id,
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'worker', entityId: workerId } }));
  }
  return { paymentId, journalEntryId: (saved as { id: string }).id, referenceNumber: refNo };
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
  const refNo = await getPayRef(companyId, branch);
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

  const desc = notes || 'Expense payment';
  const entryNo = `JE-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
  const journalEntry: JournalEntry = {
    company_id: companyId,
    branch_id: branch ?? undefined,
    entry_no: entryNo,
    entry_date: paymentDate,
    description: desc,
    reference_type: 'expense',
    reference_id: null,
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
}

export async function createInternalTransferEntry(params: CreateInternalTransferParams): Promise<{ journalEntryId: string }> {
  const { companyId, branchId, fromAccountId, toAccountId, amount, entryDate, description, createdBy } = params;
  if (!companyId || !fromAccountId || !toAccountId || amount <= 0) throw new Error('Invalid transfer params');
  const branch = validBranchId(branchId);
  const desc = description || 'Internal transfer';
  const entryNo = `JE-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
  const journalEntry: JournalEntry = {
    company_id: companyId,
    branch_id: branch ?? undefined,
    entry_no: entryNo,
    entry_date: entryDate,
    description: desc,
    reference_type: 'transfer',
    reference_id: undefined,
    created_by: createdBy ?? undefined,
  };
  const lines: JournalEntryLine[] = [
    { account_id: toAccountId, debit: amount, credit: 0, description: desc },
    { account_id: fromAccountId, debit: 0, credit: amount, description: desc },
  ];
  const saved = await accountingService.createEntry(journalEntry, lines);
  return { journalEntryId: (saved as { id: string }).id };
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
}

export async function createCourierPaymentEntry(params: CreateCourierPaymentParams): Promise<{ paymentId: string; journalEntryId: string; referenceNumber: string }> {
  const { companyId, branchId, courierId, courierName, courierContactId, amount, paymentAccountId, paymentDate, paymentMethod, notes } = params;
  if (!companyId || !courierId || amount <= 0 || !paymentAccountId) throw new Error('Invalid courier payment params');
  const branch = validBranchId(branchId);
  const refNo = await getPayRef(companyId, branch);
  const { data: { user } } = await supabase.auth.getUser();
  const uid = (user as any)?.id ?? null;

  const rawContactId = courierContactId || courierId;
  const contactIdForPayments = await validPaymentsContactId(companyId, rawContactId);
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('[AddEntryV2] createCourierPaymentEntry – courier/contact:', {
      courierId,
      courierName,
      rawContactId,
      contactIdValid: !!contactIdForPayments,
    });
  }

  const paymentPayload: Record<string, unknown> = {
    company_id: companyId,
    branch_id: branch,
    payment_type: 'paid',
    reference_type: 'courier_payment',
    reference_id: courierId,
    amount,
    payment_method: normalizePaymentMethod(paymentMethod),
    payment_account_id: paymentAccountId,
    payment_date: paymentDate,
    reference_number: refNo,
    notes: notes || undefined,
    received_by: uid,
    created_by: uid,
  };
  if (contactIdForPayments != null) {
    paymentPayload.contact_id = contactIdForPayments;
  }

  const { data: paymentRow, error: payErr } = await supabase.from('payments').insert(paymentPayload).select('id').single();
  if (payErr) throw new Error(`Payment row failed: ${payErr.message}`);
  const paymentId = (paymentRow as { id: string }).id;

  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('[AddEntryV2] createCourierPaymentEntry – payments row created:', { paymentId, contact_id: contactIdForPayments ?? null });
  }

  const courierPayableId = await getCourierPayableAccountId(companyId, rawContactId, courierName);
  const desc = notes || `Courier payment – ${courierName}`;
  const entryNo = `JE-COUR-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  const journalEntry: JournalEntry = {
    company_id: companyId,
    branch_id: branch ?? undefined,
    entry_no: entryNo,
    entry_date: paymentDate,
    description: desc,
    reference_type: 'courier_payment',
    reference_id: rawContactId,
    created_by: uid ?? undefined,
  };
  const lines: JournalEntryLine[] = [
    { account_id: courierPayableId, debit: amount, credit: 0, description: desc },
    { account_id: paymentAccountId, debit: 0, credit: amount, description: `Payment to ${courierName}` },
  ];
  const saved = await accountingService.createEntry(journalEntry, lines, paymentId);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'courier', entityId: rawContactId } }));
  }
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('[AddEntryV2] createCourierPaymentEntry – JE + ledgerUpdated:', {
      journalEntryId: (saved as { id: string }).id,
      courierEntityId: rawContactId,
    });
  }
  return { paymentId, journalEntryId: (saved as { id: string }).id, referenceNumber: refNo };
}
