/**
 * Couriers list + courier payment (mobile parity with web courierPaymentService).
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { resolveBranchUuidForWrite, safeRpcBranchId } from '../utils/branchId';
import { dispatchMobileAccountingInvalidated } from '../lib/dataInvalidationBus';

export interface CourierRow {
  id: string;
  name: string;
  contact_id: string | null;
}

export async function getCouriersByCompany(companyId: string): Promise<{ data: CourierRow[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  const { data, error } = await supabase
    .from('couriers')
    .select('id, name, contact_id')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('name', { ascending: true });
  if (error) return { data: [], error: error.message };
  return { data: (data || []) as CourierRow[], error: null };
}

function normalizePaymentMethod(method?: string): 'cash' | 'bank' | 'card' | 'other' {
  const m = String(method || 'cash').toLowerCase().trim();
  if (m === 'bank' || m === 'card') return m;
  if (m === 'wallet' || m === 'mobile_wallet' || m === 'other' || m === 'cheque') return 'other';
  return 'cash';
}

function appendPayReferenceAllocationHint(message: string): string {
  if (/sequence|document.?number|reference.?number|duplicate/i.test(message)) {
    return `${message} Check payment document sequences (PAY) for this company/branch.`;
  }
  return message;
}

/**
 * Canonical courier payment: `record_payment_with_accounting` + payments patch
 * (same semantics as web createCourierPayment).
 */
export async function recordCourierPayment(params: {
  companyId: string;
  branchId?: string | null;
  courierId: string;
  courierName: string;
  courierContactId: string;
  amount: number;
  paymentDate: string;
  paymentAt?: string | null;
  paymentAccountId: string;
  paymentMethod?: string;
  notes?: string | null;
  paymentReference?: string | null;
  userId?: string | null;
  attachments?: { url: string; name: string }[] | null;
}): Promise<{
  data: { paymentId: string; journalEntryId?: string; referenceNumber?: string | null } | null;
  error: string | null;
}> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const contactId = String(params.courierContactId || '').trim();
  if (!params.companyId || !params.courierId || !contactId || !params.paymentAccountId || Number(params.amount) <= 0) {
    return {
      data: null,
      error: 'Company, courier contact, amount, and payment account are required.',
    };
  }

  let branchResolved: string;
  try {
    branchResolved = await resolveBranchUuidForWrite(
      params.companyId,
      safeRpcBranchId(params.branchId),
      'No branch set up. Add a branch in Settings to record payments.',
    );
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Branch required' };
  }

  const amount = Number(params.amount) || 0;
  const paymentMethod = normalizePaymentMethod(params.paymentMethod);
  const notes =
    String(params.notes ?? '').trim() ||
    `Courier payment – ${params.courierName || 'Courier'}`;

  const { data, error } = await supabase.rpc('record_payment_with_accounting', {
    p_company_id: params.companyId,
    p_branch_id: branchResolved,
    p_payment_type: 'paid',
    p_reference_type: 'courier_payment',
    p_reference_id: contactId,
    p_amount: amount,
    p_payment_method: paymentMethod,
    p_payment_date: params.paymentDate,
    p_payment_account_id: params.paymentAccountId,
    p_reference_number: params.paymentReference?.trim() ? params.paymentReference.trim() : null,
    p_notes: notes,
    p_created_by: params.userId ?? null,
    p_worker_stage_id: null,
  });

  if (error) return { data: null, error: appendPayReferenceAllocationHint(error.message) };

  const res = data as {
    success?: boolean;
    payment_id?: string;
    journal_entry_id?: string;
    reference_number?: string | null;
    error?: string;
  } | null;
  if (!res?.success || !res.payment_id) {
    const msg = typeof res?.error === 'string' ? res.error : 'Courier payment failed.';
    return { data: null, error: appendPayReferenceAllocationHint(msg) };
  }

  const paymentId = res.payment_id;
  const patch: Record<string, unknown> = {
    reference_type: 'courier_payment',
    reference_id: params.courierId,
    contact_id: contactId,
    created_by: params.userId ?? null,
  };
  if (params.attachments?.length) {
    patch.attachments = params.attachments;
  }

  let upd = await supabase.from('payments').update(patch).eq('id', paymentId);
  if (upd.error?.code === 'PGRST204' && String(upd.error.message || '').includes('attachments')) {
    const { attachments: _a, ...rest } = patch;
    upd = await supabase.from('payments').update(rest).eq('id', paymentId);
  }
  if (upd.error) {
    return {
      data: null,
      error: `Payment recorded but could not finalize courier link: ${upd.error.message}`,
    };
  }

  if (params.paymentAt) {
    const { patchPaymentCreatedAt } = await import('./paymentTimestamp');
    await patchPaymentCreatedAt(paymentId, params.paymentAt);
  }

  dispatchMobileAccountingInvalidated({
    companyId: params.companyId,
    branchId: branchResolved,
    reason: 'courier-payment',
  });

  return {
    data: {
      paymentId,
      journalEntryId: res.journal_entry_id,
      referenceNumber: res.reference_number ?? null,
    },
    error: null,
  };
}
