/**
 * Canonical supplier payment flow (Accounting Stabilization Phase 3).
 * One path: PAY ref from erp_document_sequences → payments row → one journal entry (Dr AP, Cr Cash/Bank).
 * All supplier payment entry points (document-linked and on-account) use this service to avoid duplicate JEs.
 */

import { supabase } from '@/lib/supabase';
import { documentNumberService } from '@/app/services/documentNumberService';
import { accountingService } from '@/app/services/accountingService';
import type { JournalEntry, JournalEntryLine } from '@/app/services/accountingService';
import { generatePaymentReference } from '@/app/utils/paymentUtils';
import { dispatchContactBalancesRefresh } from '@/app/lib/contactBalancesRefresh';
import { resolvePayablePostingAccountId } from '@/app/services/partySubledgerAccountService';

export type SupplierPaymentReferenceType = 'purchase' | 'on_account';

export interface CreateSupplierPaymentParams {
  companyId: string;
  branchId: string | null;
  amount: number;
  paymentMethod: string;
  paymentAccountId: string;
  /** Document-linked: purchase id */
  purchaseId?: string | null;
  /** On-account: contact (supplier) id and name */
  contactId?: string | null;
  supplierName?: string | null;
  paymentDate?: string;
  notes?: string | null;
  attachments?: { url: string; name: string }[] | null;
}

export interface CreateSupplierPaymentResult {
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
 * Canonical supplier payment: one payments row (PAY-xxxx), one journal entry (Dr AP, Cr Cash/Bank).
 * Use for both document-linked (purchaseId) and on-account (contactId) supplier payments.
 */
export async function createSupplierPayment(params: CreateSupplierPaymentParams): Promise<CreateSupplierPaymentResult> {
  const {
    companyId,
    branchId,
    amount,
    paymentMethod,
    paymentAccountId,
    purchaseId,
    contactId,
    supplierName,
    paymentDate,
    notes,
    attachments,
  } = params;

  if (!companyId || amount <= 0 || !paymentAccountId) {
    throw new Error('companyId, amount, and paymentAccountId are required');
  }

  const isOnAccount = !purchaseId && !!contactId;
  if (!isOnAccount && !purchaseId) {
    throw new Error('Either purchaseId (document-linked) or contactId (on-account) is required');
  }

  // For purchase-linked payments: resolve contact_id from purchase so supplier ledger and reports can link
  let resolvedContactId: string | null = isOnAccount ? contactId : null;
  if (purchaseId && !resolvedContactId) {
    const { data: purchaseRow } = await supabase
      .from('purchases')
      .select('supplier_id')
      .eq('id', purchaseId)
      .single();
    if ((purchaseRow as any)?.supplier_id) resolvedContactId = (purchaseRow as any).supplier_id;
  }

  const validBranchId = (branchId && branchId !== 'all') ? branchId : null;
  const enumPaymentMethod = normalizePaymentMethod(paymentMethod);
  const paymentDateValue = paymentDate || new Date().toISOString().split('T')[0];

  // 1) Payment reference from canonical source only
  let referenceNumber: string;
  try {
    referenceNumber = await documentNumberService.getNextDocumentNumber(companyId, validBranchId, 'payment');
  } catch (e) {
    referenceNumber = generatePaymentReference(null);
  }

  const { data: { user: authUser } } = await supabase.auth.getUser();
  const authUserId = authUser?.id ?? null;

  // 2) Insert payments row (Roznamcha shows it). contact_id required for supplier ledger.
  const referenceType: string = isOnAccount ? 'on_account' : 'purchase';
  const insertPayload: Record<string, unknown> = {
    company_id: companyId,
    branch_id: validBranchId,
    payment_type: 'paid',
    reference_type: referenceType,
    reference_id: isOnAccount ? null : purchaseId,
    contact_id: resolvedContactId,
    amount,
    payment_method: enumPaymentMethod,
    payment_account_id: paymentAccountId,
    payment_date: paymentDateValue,
    reference_number: referenceNumber,
    received_by: authUserId,
    created_by: authUserId,
  };
  if (notes) insertPayload.notes = notes;
  if (attachments && attachments.length > 0) insertPayload.attachments = attachments;

  const { data: paymentRow, error: paymentErr } = await supabase
    .from('payments')
    .insert(insertPayload)
    .select('id')
    .single();

  if (paymentErr) throw new Error(`Supplier payment (payments row) failed: ${paymentErr.message}`);
  const paymentId = (paymentRow as { id: string }).id;

  // 3) Accounts Payable account (2000)
  const { data: apAccounts } = await supabase
    .from('accounts')
    .select('id')
    .eq('company_id', companyId)
    .or('code.eq.2000,name.ilike.%Accounts Payable%')
    .limit(1);
  const apControlId = (apAccounts?.[0] as { id: string } | undefined)?.id;
  if (!apControlId) throw new Error('Accounts Payable account (2000) not found');
  const apAccountId =
    (await resolvePayablePostingAccountId(companyId, resolvedContactId || undefined)) || apControlId;

  // 4) Journal entry (Dr AP, Cr Cash/Bank) linked to payment
  const description = isOnAccount
    ? `On-account payment to supplier ${supplierName || contactId}`
    : `Payment for purchase ${purchaseId}`;
  const entryNo = `JE-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
  const journalEntry: JournalEntry = {
    company_id: companyId,
    branch_id: validBranchId ?? undefined,
    entry_no: entryNo,
    entry_date: paymentDateValue,
    description,
    reference_type: referenceType,
    reference_id: isOnAccount ? contactId ?? undefined : purchaseId ?? undefined,
    created_by: authUserId ?? undefined,
  };
  const lines: JournalEntryLine[] = [
    { account_id: apAccountId, debit: amount, credit: 0, description },
    { account_id: paymentAccountId, debit: 0, credit: amount, description: `Payment from account` },
  ];
  const savedEntry = await accountingService.createEntry(journalEntry, lines, paymentId);
  const journalEntryId = (savedEntry as { id: string }).id;

  dispatchContactBalancesRefresh(companyId);
  return { paymentId, journalEntryId, referenceNumber };
}
