/**
 * Canonical courier payment: `record_payment_with_accounting` (unified PAY-*) + courier payable GL in RPC.
 */

import { supabase } from '@/lib/supabase';
import { dispatchContactBalancesRefresh } from '@/app/lib/contactBalancesRefresh';
import { logPaymentCreated } from '@/app/services/auditLogService';
import {
  recordPaymentWithAccounting,
  resolveBranchIdForPaymentRpc,
} from '@/app/services/recordPaymentWithAccountingRpc';

export interface CreateCourierPaymentParams {
  companyId: string;
  branchId: string | null;
  /** Contact id for courier payable sub-ledger (2031+). */
  courierContactId: string;
  /** Stored on payments.reference_id when distinct from contact (e.g. couriers.id). */
  courierReferenceId?: string | null;
  amount: number;
  paymentMethod: string;
  paymentAccountId: string;
  paymentDate?: string;
  notes?: string | null;
  attachments?: { url: string; name: string }[] | null;
}

export interface CreateCourierPaymentResult {
  paymentId: string;
  journalEntryId: string;
  referenceNumber: string;
}

export async function createCourierPayment(params: CreateCourierPaymentParams): Promise<CreateCourierPaymentResult> {
  const {
    companyId,
    branchId,
    courierContactId,
    courierReferenceId,
    amount,
    paymentMethod,
    paymentAccountId,
    paymentDate,
    notes,
    attachments,
  } = params;

  if (!companyId || !courierContactId || amount <= 0 || !paymentAccountId) {
    throw new Error('companyId, courierContactId, amount, and paymentAccountId are required');
  }

  const branchResolved = await resolveBranchIdForPaymentRpc(companyId, branchId);
  const paymentDateValue = paymentDate || new Date().toISOString().split('T')[0];
  const { data: { user: authUser } } = await supabase.auth.getUser();
  const authUserId = authUser?.id ?? null;

  const rpcReferenceId = courierContactId;
  const rpcResult = await recordPaymentWithAccounting({
    companyId,
    branchId: branchResolved,
    paymentType: 'paid',
    referenceType: 'courier_payment',
    referenceId: rpcReferenceId,
    amount,
    paymentMethod,
    paymentDate: paymentDateValue,
    paymentAccountId,
    notes: notes?.trim() || null,
    createdBy: authUserId,
  });

  const paymentId = rpcResult.paymentId;
  const patch: Record<string, unknown> = {
    reference_type: 'courier_payment',
    reference_id: courierReferenceId ?? courierContactId,
    contact_id: courierContactId,
    received_by: authUserId,
    created_by: authUserId,
  };
  if (attachments && attachments.length > 0) {
    patch.attachments = attachments;
  }

  let upd = await supabase.from('payments').update(patch).eq('id', paymentId);
  if (upd.error?.code === 'PGRST204' && String(upd.error.message || '').includes('attachments')) {
    const { attachments: _a, ...rest } = patch;
    upd = await supabase.from('payments').update(rest).eq('id', paymentId);
  } else if (upd.error) {
    console.warn('[courierPaymentService] payments patch after RPC:', upd.error.message);
  }

  logPaymentCreated(companyId, paymentId, {
    reference_type: 'courier_payment',
    amount,
    reference_id: courierReferenceId ?? courierContactId,
  });

  dispatchContactBalancesRefresh(companyId);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('paymentAdded'));
    window.dispatchEvent(
      new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'courier', entityId: courierContactId } })
    );
  }

  return {
    paymentId: rpcResult.paymentId,
    journalEntryId: rpcResult.journalEntryId,
    referenceNumber: rpcResult.referenceNumber,
  };
}
