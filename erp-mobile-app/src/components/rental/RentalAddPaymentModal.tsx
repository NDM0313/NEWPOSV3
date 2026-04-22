import { addRentalPayment } from '../../api/rentals';
import {
  MobilePaymentSheet,
  type MobilePaymentSheetSubmitPayload,
  type MobilePaymentSheetSubmitResult,
} from '../shared/MobilePaymentSheet';

export interface RentalAddPaymentModalProps {
  rentalId: string;
  companyId: string;
  branchId: string | null;
  userId?: string | null;
  bookingNo?: string | null;
  customerName?: string | null;
  totalAmount?: number;
  paidAmount?: number;
  dueAmount: number;
  onClose: () => void;
  onSuccess: () => void;
  onViewLedger?: (info: { paymentId: string | null; partyName: string | null }) => void;
}

export function RentalAddPaymentModal({
  rentalId,
  companyId,
  branchId,
  userId,
  bookingNo,
  customerName,
  totalAmount,
  paidAmount,
  dueAmount,
  onClose,
  onSuccess,
  onViewLedger,
}: RentalAddPaymentModalProps) {
  const handleSubmit = async (payload: MobilePaymentSheetSubmitPayload): Promise<MobilePaymentSheetSubmitResult> => {
    const { error, paymentId, referenceNumber } = await addRentalPayment({
      rentalId,
      companyId,
      branchId,
      amount: payload.amount,
      method: payload.method,
      paymentAccountId: payload.accountId,
      paymentDate: payload.paymentDate,
      reference: payload.reference || undefined,
      notes: payload.notes || undefined,
      userId: userId ?? null,
    });
    return {
      success: !error,
      error: error ?? null,
      paymentId: paymentId ?? null,
      referenceNumber: referenceNumber ?? null,
      partyAccountName: customerName ? `Receivable — ${customerName}` : null,
    };
  };

  return (
    <MobilePaymentSheet
      mode="rental"
      companyId={companyId}
      branchId={branchId}
      userId={userId}
      partyName={customerName ?? null}
      referenceNo={bookingNo ?? null}
      totalAmount={totalAmount ?? null}
      alreadyPaid={paidAmount ?? null}
      outstandingAmount={dueAmount}
      onClose={onClose}
      onSuccess={onSuccess}
      onSubmit={handleSubmit}
      onViewLedger={onViewLedger}
    />
  );
}
