import { getCurrentLocalTimestamp, localNowDateString } from '@/app/utils/localDate';
/**
 * Canonical supplier payment flow (Accounting Stabilization Phase 3).
 * Single backend path: `record_payment_with_accounting` allocates PAY refs and posts Dr AP / Cr Cash(Bank).
 * Document-linked and on-account supplier payments both use the RPC (no client-side getNextDocumentNumber).
 */

import { supabase } from '@/lib/supabase';
import { dispatchContactBalancesRefresh } from '@/app/lib/contactBalancesRefresh';
import { logPaymentCreated } from '@/app/services/auditLogService';
import { recordPaymentWithAccounting } from '@/app/services/recordPaymentWithAccountingRpc';

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

function buildPaymentNote(extraDescription?: string | null): string | null {
  const extra = String(extraDescription ?? '').trim();
  return extra || null;
}

/**
 * Canonical supplier payment: RPC allocates PAY ref; optional patch for contact_id / received_by / attachments.
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

  let resolvedContactId: string | null = isOnAccount ? contactId : null;
  if (purchaseId && !resolvedContactId) {
    const { data: purchaseRow } = await supabase
      .from('purchases')
      .select('supplier_id')
      .eq('id', purchaseId)
      .single();
    if ((purchaseRow as { supplier_id?: string })?.supplier_id) {
      resolvedContactId = (purchaseRow as { supplier_id: string }).supplier_id;
    }
  }
  if (!resolvedContactId) {
    throw new Error('Supplier payment requires a linked supplier contact (contact_id) for AR/AP accountability.');
  }

  const validBranchId = branchId && branchId !== 'all' ? branchId : null;
  const paymentDateValue = paymentDate || localNowDateString();

  const { data: { user: authUser } } = await supabase.auth.getUser();
  const authUserId = authUser?.id ?? null;

  const combinedDescription = buildPaymentNote(notes);
  const referenceType = isOnAccount ? 'on_account' : 'purchase';
  const rpcReferenceId = isOnAccount ? resolvedContactId : String(purchaseId);

  const rpcResult = await recordPaymentWithAccounting({
    companyId,
    branchId: validBranchId,
    paymentType: 'paid',
    referenceType,
    referenceId: rpcReferenceId,
    amount,
    paymentMethod,
    paymentDate: paymentDateValue,
    paymentAccountId,
    notes: combinedDescription,
    bankTraceId: null,
    createdBy: authUserId,
  });

  const paymentId = rpcResult.paymentId;
  const journalEntryId = rpcResult.journalEntryId;
  const referenceNumber = rpcResult.referenceNumber;

  const patch: Record<string, unknown> = {
    contact_id: resolvedContactId,
    received_by: authUserId,
  };
  if (attachments && attachments.length > 0) {
    patch.attachments = attachments;
  }

  let upd = await supabase.from('payments').update(patch).eq('id', paymentId);
  if (upd.error?.code === 'PGRST204' && String(upd.error.message || '').includes('attachments')) {
    upd = await supabase
      .from('payments')
      .update({ contact_id: resolvedContactId, received_by: authUserId })
      .eq('id', paymentId);
  } else if (upd.error) {
    console.warn('[supplierPaymentService] payments patch after RPC:', upd.error.message);
  }

  logPaymentCreated(companyId, paymentId, {
    reference_type: referenceType,
    reference_id: isOnAccount ? contactId ?? null : purchaseId ?? null,
    amount,
  });

  dispatchContactBalancesRefresh(companyId);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('paymentAdded'));
    window.dispatchEvent(
      new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'supplier', entityId: resolvedContactId } })
    );
  }
  return { paymentId, journalEntryId, referenceNumber };
}
