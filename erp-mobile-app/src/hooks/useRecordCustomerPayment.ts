import { useState, useCallback, useRef } from 'react';
import { recordCustomerPayment } from '../api/sales';

export interface RecordCustomerPaymentParams {
  companyId: string;
  branchId: string | null;
  customerId: string | null;
  referenceId: string;
  amount: number;
  accountId: string;
  paymentMethod: string;
  paymentDate: string;
  paymentAt?: string | null;
  notes?: string | null;
  /** Optional user reference (cheque / external doc no); server allocates if omitted. */
  referenceNumber?: string | null;
  createdBy?: string | null;
}

export interface UseRecordCustomerPaymentResult {
  submit: (params: RecordCustomerPaymentParams) => Promise<{ success: boolean; error?: string; paymentId?: string; referenceNumber?: string }>;
  isSubmitting: boolean;
}

/**
 * Hook for recording a customer payment via RPC.
 * Prevents duplicate submission, exposes loading state.
 */
export function useRecordCustomerPayment(): UseRecordCustomerPaymentResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  const submit = useCallback(async (params: RecordCustomerPaymentParams): Promise<{ success: boolean; error?: string; paymentId?: string; referenceNumber?: string }> => {
    if (isSubmittingRef.current) return { success: false, error: 'Please wait.' };
    if (!params.companyId || !params.referenceId || params.amount <= 0 || !params.accountId) {
      return { success: false, error: 'Missing required fields.' };
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      const { data, error } = await recordCustomerPayment({
        companyId: params.companyId,
        branchId: params.branchId,
        customerId: params.customerId,
        referenceId: params.referenceId,
        amount: params.amount,
        accountId: params.accountId,
        paymentMethod: params.paymentMethod,
        paymentDate: params.paymentDate,
        paymentAt: params.paymentAt,
        notes: params.notes,
        referenceNumber: params.referenceNumber,
        createdBy: params.createdBy,
      });
      if (error) return { success: false, error };
      if (data?.payment_id) {
        return { success: true, paymentId: data.payment_id, referenceNumber: data.reference_number };
      }
      return { success: false, error: 'Payment failed.' };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Payment failed.';
      return { success: false, error: message };
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, []);

  return { submit, isSubmitting };
}
