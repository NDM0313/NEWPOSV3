import { useState, useCallback, useRef } from 'react';
import { recordManualSupplierPayment } from '../api/accounts';

export interface RecordOnAccountSupplierPaymentParams {
  companyId: string;
  branchId: string | null;
  supplierContactId: string;
  supplierName: string;
  amount: number;
  accountId: string;
  paymentMethod: string;
  paymentDate: string;
  paymentAt?: string | null;
  notes?: string | null;
  bankTraceId?: string | null;
  userId?: string | null;
  attachments?: { url: string; name: string }[] | null;
}

interface UseRecordOnAccountSupplierPaymentResult {
  isSubmitting: boolean;
  submit: (params: RecordOnAccountSupplierPaymentParams) => Promise<{
    success: boolean;
    error?: string;
    paymentId?: string;
    referenceNumber?: string | null;
  }>;
}

/** Hook for on-account supplier payment (manual_payment + FIFO bill allocation). */
export function useRecordOnAccountSupplierPayment(): UseRecordOnAccountSupplierPaymentResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  const submit = useCallback(async (params: RecordOnAccountSupplierPaymentParams) => {
    if (isSubmittingRef.current) {
      return { success: false, error: 'Payment already in progress.' };
    }
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      const method = params.paymentMethod as 'cash' | 'bank' | 'card' | 'other' | 'wallet';
      const { data, error } = await recordManualSupplierPayment({
        companyId: params.companyId,
        branchId: params.branchId,
        supplierContactId: params.supplierContactId,
        supplierName: params.supplierName,
        amount: params.amount,
        paymentAccountId: params.accountId,
        paymentMethod: method,
        paymentDate: params.paymentDate,
        paymentAt: params.paymentAt,
        reference: params.bankTraceId ?? undefined,
        notes: params.notes ?? undefined,
        userId: params.userId ?? null,
        attachments: params.attachments ?? null,
      });
      if (error && !data?.payment_id) return { success: false, error };
      if (data?.payment_id) {
        return {
          success: true,
          paymentId: data.payment_id,
          referenceNumber: data.reference_number ?? null,
          error: error ?? undefined,
        };
      }
      return { success: false, error: error ?? 'Payment failed.' };
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, []);

  return { isSubmitting, submit };
}
