import { useRecordCustomerPayment } from '../../hooks/useRecordCustomerPayment';
import { uploadPaymentAttachments, updatePaymentAttachments } from '../../api/paymentAttachments';
import {
  MobilePaymentSheet,
  type MobilePaymentSheetSubmitPayload,
  type MobilePaymentSheetSubmitResult,
} from '../shared/MobilePaymentSheet';

export interface MobileReceivePaymentProps {
  onClose: () => void;
  onSuccess: () => void;
  companyId: string;
  branchId: string | null;
  userId?: string | null;
  /** Sale (invoice) id */
  referenceId: string;
  referenceNo: string;
  customerName: string;
  customerId: string | null;
  totalAmount: number;
  alreadyPaid: number;
  outstandingAmount: number;
  onViewLedger?: (info: { paymentId: string | null; partyName: string | null }) => void;
}

export function MobileReceivePayment({
  onClose,
  onSuccess,
  companyId,
  branchId,
  userId,
  referenceId,
  referenceNo,
  customerName,
  customerId,
  totalAmount,
  alreadyPaid,
  outstandingAmount,
  onViewLedger,
}: MobileReceivePaymentProps) {
  const { submit } = useRecordCustomerPayment();

  const handleSubmit = async (payload: MobilePaymentSheetSubmitPayload): Promise<MobilePaymentSheetSubmitResult> => {
    const methodStr = payload.method === 'wallet' ? 'wallet' : payload.method;
    const { success, error, paymentId, referenceNumber } = await submit({
      companyId,
      customerId,
      referenceId,
      amount: payload.amount,
      accountId: payload.accountId,
      paymentMethod: methodStr,
      paymentDate: payload.paymentDate,
      notes: payload.notes || null,
      createdBy: userId ?? null,
    });

    if (success && paymentId && payload.attachments.length > 0) {
      try {
        const uploaded = await uploadPaymentAttachments(companyId, referenceId, paymentId, payload.attachments);
        if (uploaded.length > 0) {
          await updatePaymentAttachments(paymentId, uploaded);
        }
      } catch (_e) {
        // non-fatal — payment saved, attachments failed to link
      }
    }

    return {
      success,
      error: error ?? null,
      paymentId: paymentId ?? null,
      referenceNumber: referenceNumber ?? null,
      partyAccountName: customerName ? `Receivable — ${customerName}` : null,
    };
  };

  return (
    <MobilePaymentSheet
      mode="receive"
      companyId={companyId}
      branchId={branchId}
      userId={userId}
      partyName={customerName}
      referenceNo={referenceNo}
      totalAmount={totalAmount}
      alreadyPaid={alreadyPaid}
      outstandingAmount={outstandingAmount}
      onClose={onClose}
      onSuccess={onSuccess}
      onSubmit={handleSubmit}
      onViewLedger={onViewLedger}
    />
  );
}
