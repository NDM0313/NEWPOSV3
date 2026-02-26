import { useState, useCallback } from 'react';
import { recordCustomerPayment } from '../api/sales';

export interface RecordCustomerPaymentParams {
  companyId: string;
  customerId: string | null;
  referenceId: string;
  amount: number;
  accountId: string;
  paymentMethod: string;
  paymentDate: string;
  notes?: string | null;
  createdBy?: string | null;
}

export interface UseRecordCustomerPaymentResult {
  submit: (params: RecordCustomerPaymentParams) => Promise<{ success: boolean; error?: string; paymentId?: string }>;
  isSubmitting: boolean;
}

/**
 * Hook for recording a customer payment via RPC.
 * Prevents duplicate submission, exposes loading state.
 */
export function useRecordCustomerPayment(): UseRecordCustomerPaymentResult {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = useCallback(async (params: RecordCustomerPaymentParams): Promise<{ success: boolean; error?: string; paymentId?: string }> => {
    if (isSubmitting) return { success: false, error: 'Please wait.' };
    if (!params.companyId || !params.referenceId || params.amount <= 0 || !params.accountId) {
      return { success: false, error: 'Missing required fields.' };
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await recordCustomerPayment({
        companyId: params.companyId,
        customerId: params.customerId,
        referenceId: params.referenceId,
        amount: params.amount,
        accountId: params.accountId,
        paymentMethod: params.paymentMethod,
        paymentDate: params.paymentDate,
        notes: params.notes,
        createdBy: params.createdBy,
      });
      if (error) return { success: false, error };
      if (data?.payment_id) return { success: true, paymentId: data.payment_id };
      return { success: false, error: 'Payment failed.' };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Payment failed.';
      return { success: false, error: message };
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting]);

  return { submit, isSubmitting };
}
