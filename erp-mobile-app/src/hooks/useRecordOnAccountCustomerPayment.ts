import { useState, useCallback, useRef } from 'react';
import { recordOnAccountCustomerPayment } from '../api/sales';

export interface RecordOnAccountCustomerPaymentParams {
  companyId: string;
  branchId: string | null;
  contactId: string;
  contactName: string;
  amount: number;
  accountId: string;
  paymentMethod: string;
  paymentDate: string;
  notes?: string | null;
  bankTraceId?: string | null;
  createdBy?: string | null;
}

export interface UseRecordOnAccountCustomerPaymentResult {
  submit: (
    params: RecordOnAccountCustomerPaymentParams,
  ) => Promise<{ success: boolean; error?: string; paymentId?: string; referenceNumber?: string }>;
  isSubmitting: boolean;
}

/** Hook for on-account customer receipt (no sale invoice). */
export function useRecordOnAccountCustomerPayment(): UseRecordOnAccountCustomerPaymentResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  const submit = useCallback(
    async (
      params: RecordOnAccountCustomerPaymentParams,
    ): Promise<{ success: boolean; error?: string; paymentId?: string; referenceNumber?: string }> => {
      if (isSubmittingRef.current) return { success: false, error: 'Please wait.' };
      if (!params.companyId || !params.contactId?.trim() || params.amount <= 0 || !params.accountId) {
        return { success: false, error: 'Missing required fields.' };
      }

      isSubmittingRef.current = true;
      setIsSubmitting(true);
      try {
        const { data, error } = await recordOnAccountCustomerPayment(params);
        if (error) return { success: false, error };
        if (data?.payment_id) {
          return { success: true, paymentId: data.payment_id, referenceNumber: data.reference_number };
        }
        return { success: false, error: 'Payment failed.' };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : 'Payment failed.' };
      } finally {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [],
  );

  return { submit, isSubmitting };
}
