/**
 * Single backend path for posting payments + journal lines (matches mobile `record_payment_with_accounting`).
 * Never allocate PAY reference numbers on the client — the RPC uses generate_document_number server-side.
 */

import { supabase } from '@/lib/supabase';

export type RpcPaymentMethod = 'cash' | 'bank' | 'card' | 'other';

const PAYMENT_METHOD_MAP: Record<string, RpcPaymentMethod> = {
  cash: 'cash',
  Cash: 'cash',
  bank: 'bank',
  Bank: 'bank',
  card: 'card',
  Card: 'card',
  cheque: 'other',
  Cheque: 'other',
  'mobile wallet': 'other',
  'Mobile Wallet': 'other',
  mobile_wallet: 'other',
  wallet: 'other',
  Wallet: 'other',
  other: 'other',
};

export function normalizePaymentMethodForRpc(method: string | undefined | null): RpcPaymentMethod {
  const raw = String(method || 'cash').trim();
  const lower = raw.toLowerCase();
  return PAYMENT_METHOD_MAP[raw] || PAYMENT_METHOD_MAP[lower] || 'cash';
}

/** Same pattern as erp-mobile `recordSupplierPayment` / `recordSalePayment` notes. */
export function composePaymentRpcNotes(
  baseNotes: string | null | undefined,
  bankTraceId: string | null | undefined
): string | null {
  const base = String(baseNotes ?? '').trim();
  const trace = String(bankTraceId ?? '').trim();
  if (trace) {
    return base ? `${base} | Bank Trace ID: ${trace}` : `Bank Trace ID: ${trace}`;
  }
  return base || null;
}

export interface RecordPaymentWithAccountingArgs {
  companyId: string;
  branchId: string;
  paymentType: 'received' | 'paid';
  referenceType: string;
  referenceId: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  paymentAccountId: string;
  notes?: string | null;
  /** Bank / transaction trace shown in notes (optional). */
  bankTraceId?: string | null;
  createdBy?: string | null;
}

export interface RecordPaymentWithAccountingOk {
  paymentId: string;
  journalEntryId: string;
  referenceNumber: string;
}

export async function resolveBranchIdForPaymentRpc(
  companyId: string,
  branchId: string | null | undefined
): Promise<string> {
  const b = branchId && branchId !== 'all' && branchId !== 'default' ? String(branchId).trim() : '';
  if (b) return b;
  const { data, error } = await supabase
    .from('branches')
    .select('id')
    .eq('company_id', companyId)
    .limit(1)
    .maybeSingle();
  if (error || !(data as { id?: string })?.id) {
    throw new Error('No branch set up. Add a branch in Settings to record payments.');
  }
  return String((data as { id: string }).id);
}

/**
 * Calls `record_payment_with_accounting` with server-side PAY allocation (`p_reference_number` null).
 */
export async function recordPaymentWithAccounting(
  args: RecordPaymentWithAccountingArgs
): Promise<RecordPaymentWithAccountingOk> {
  const {
    companyId,
    branchId,
    paymentType,
    referenceType,
    referenceId,
    amount,
    paymentMethod,
    paymentDate,
    paymentAccountId,
    notes,
    bankTraceId,
    createdBy,
  } = args;

  if (!companyId || !referenceId || amount <= 0 || !paymentAccountId) {
    throw new Error('companyId, referenceId, amount, and paymentAccountId are required.');
  }

  const branch = await resolveBranchIdForPaymentRpc(companyId, branchId);
  const dateVal = String(paymentDate || new Date().toISOString().split('T')[0]).slice(0, 10);
  const composedNotes = composePaymentRpcNotes(notes, bankTraceId);
  const enumMethod = normalizePaymentMethodForRpc(paymentMethod);

  const { data, error } = await supabase.rpc('record_payment_with_accounting', {
    p_company_id: companyId,
    p_branch_id: branch,
    p_payment_type: paymentType,
    p_reference_type: referenceType,
    p_reference_id: referenceId,
    p_amount: amount,
    p_payment_method: enumMethod,
    p_payment_date: dateVal,
    p_payment_account_id: paymentAccountId,
    p_reference_number: null,
    p_notes: composedNotes,
    p_created_by: createdBy ?? null,
  });

  if (error) {
    throw new Error(error.message || 'record_payment_with_accounting failed');
  }

  const res = data as {
    success?: boolean;
    payment_id?: string;
    journal_entry_id?: string;
    reference_number?: string;
    error?: string;
  };

  if (res?.success && res.payment_id && res.journal_entry_id) {
    return {
      paymentId: res.payment_id,
      journalEntryId: res.journal_entry_id,
      referenceNumber: String(res.reference_number ?? ''),
    };
  }

  const msg = typeof res?.error === 'string' ? res.error : 'Payment failed.';
  throw new Error(msg);
}
