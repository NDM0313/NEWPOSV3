import { recordSupplierPayment } from '../../api/accounts';
import { uploadPaymentAttachments, updatePaymentAttachments } from '../../api/paymentAttachments';
import {
  MobilePaymentSheet,
  type MobilePaymentSheetSubmitPayload,
  type MobilePaymentSheetSubmitResult,
} from '../shared/MobilePaymentSheet';

export interface MobilePaySupplierProps {
  onClose: () => void;
  onSuccess: () => void;
  companyId: string;
  branchId: string;
  userId?: string | null;
  purchaseId: string;
  poNo: string;
  supplierName: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  onViewLedger?: (info: { paymentId: string | null; partyName: string | null }) => void;
}

export function MobilePaySupplier({
  onClose,
  onSuccess,
  companyId,
  branchId,
  userId,
  purchaseId,
  poNo,
  supplierName,
  totalAmount,
  paidAmount,
  dueAmount,
  onViewLedger,
}: MobilePaySupplierProps) {
  const handleSubmit = async (payload: MobilePaymentSheetSubmitPayload): Promise<MobilePaymentSheetSubmitResult> => {
    const methodForRpc =
      payload.method === 'wallet' ? 'other' : payload.method === 'card' ? 'card' : payload.method;

    const { data, error } = await recordSupplierPayment({
      companyId,
      branchId,
      purchaseId,
      amount: payload.amount,
      paymentDate: payload.paymentDate,
      paymentAccountId: payload.accountId,
      paymentMethod: methodForRpc,
      userId: userId ?? undefined,
      notes: payload.notes || undefined,
    });

    if (data?.payment_id && payload.attachments.length > 0) {
      try {
        const uploaded = await uploadPaymentAttachments(
          companyId,
          purchaseId,
          data.payment_id,
          payload.attachments,
        );
        if (uploaded.length > 0) {
          await updatePaymentAttachments(data.payment_id, uploaded);
        }
      } catch (_e) {
        // non-fatal
      }
    }

    return {
      success: !!data,
      error: error ?? null,
      paymentId: data?.payment_id ?? null,
      referenceNumber: data?.reference_number ?? null,
      partyAccountName: supplierName ? `Payable — ${supplierName}` : null,
    };
  };

  return (
    <MobilePaymentSheet
      mode="pay-supplier"
      companyId={companyId}
      branchId={branchId}
      userId={userId}
      partyName={supplierName}
      referenceNo={poNo}
      totalAmount={totalAmount}
      alreadyPaid={paidAmount}
      outstandingAmount={dueAmount}
      onClose={onClose}
      onSuccess={onSuccess}
      onSubmit={handleSubmit}
      onViewLedger={onViewLedger}
    />
  );
}
