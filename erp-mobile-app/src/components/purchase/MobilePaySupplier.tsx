import { recordSupplierPayment } from '../../api/accounts';
import { finalizePaymentAttachments } from '../../lib/finalizePaymentAttachments';
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
  supplierPhone?: string | null;
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
  supplierPhone,
  totalAmount,
  paidAmount,
  dueAmount,
  onViewLedger,
}: MobilePaySupplierProps) {
  const handleSubmit = async (payload: MobilePaymentSheetSubmitPayload): Promise<MobilePaymentSheetSubmitResult> => {
    const methodForRpc =
      payload.method === 'wallet' ? 'other' : payload.method === 'card' ? 'card' : payload.method;
    const payBranchId = payload.branchId ?? branchId;
    const { data, error } = await recordSupplierPayment({
      companyId,
      branchId: payBranchId,
      purchaseId,
      amount: payload.amount,
      paymentDate: payload.paymentDate,
      paymentAt: payload.paymentAt,
      paymentAccountId: payload.accountId,
      paymentMethod: methodForRpc,
      userId: userId ?? undefined,
      reference: payload.reference || undefined,
      notes: payload.notes || undefined,
    });

    let attachmentWarning: string | null = null;
    if (data?.payment_id && payload.attachments.length > 0) {
      const fin = await finalizePaymentAttachments({
        companyId,
        storageSegment: purchaseId,
        paymentId: data.payment_id,
        files: payload.attachments,
      });
      attachmentWarning = fin.attachmentWarning;
    }

    return {
      success: !!data,
      error: error ?? null,
      paymentId: data?.payment_id ?? null,
      referenceNumber: data?.reference_number ?? null,
      partyAccountName: supplierName ? `Payable — ${supplierName}` : null,
      attachmentWarning,
    };
  };

  return (
    <MobilePaymentSheet
      mode="pay-supplier"
      companyId={companyId}
      branchId={branchId}
      userId={userId}
      partyName={supplierName}
      partyPhone={supplierPhone}
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
