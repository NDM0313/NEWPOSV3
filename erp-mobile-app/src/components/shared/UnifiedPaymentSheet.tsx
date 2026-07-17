import { useRecordCustomerPayment } from '../../hooks/useRecordCustomerPayment';
import { finalizePaymentAttachments } from '../../lib/finalizePaymentAttachments';
import { addRentalPayment } from '../../api/rentals';
import { recordSupplierPayment } from '../../api/accounts';
import {
  MobilePaymentSheet,
  type MobilePaymentSheetSubmitPayload,
  type MobilePaymentSheetSubmitResult,
  type PaymentSheetMode,
} from './MobilePaymentSheet';

/**
 * Unified payment capture sheet used across sales, purchases, rentals, worker
 * payments and expenses. Replaces the three older wrapper components
 * (MobileReceivePayment, SupplierPaymentFlow's inline sheet, RentalAddPaymentModal)
 * with a single `kind` prop that selects the correct service call.
 *
 * Per-kind extras (attachments for sales, damageDeduction for rentals, etc.)
 * stay available via optional props without duplicating the sheet UI.
 */
export type UnifiedPaymentKind = 'sale' | 'purchase' | 'rental' | 'expense' | 'worker';

const KIND_TO_MODE: Record<UnifiedPaymentKind, PaymentSheetMode> = {
  sale: 'receive',
  purchase: 'pay-supplier',
  rental: 'rental',
  expense: 'expense',
  worker: 'pay-worker',
};

export interface UnifiedPaymentSheetProps {
  kind: UnifiedPaymentKind;
  /** Primary entity id (sale id / purchase id / rental id). */
  referenceId: string;
  /** Display reference number (invoice no, PO no, booking no). */
  referenceNo?: string | null;
  companyId: string;
  branchId: string | null;
  userId?: string | null;
  userRole?: string;
  profileId?: string | null;
  documentBranchId?: string | null;

  /** Counter-party name. For 'expense' this may be the category. */
  partyName: string | null;
  /** Customer / supplier / worker id — needed for accounting posting. */
  partyId?: string | null;
  /** Party phone/mobile for WhatsApp on payment receipt preview. */
  partyPhone?: string | null;

  totalAmount?: number | null;
  alreadyPaid?: number | null;
  /** Amount due = what the user should pay by default. Required. */
  outstandingAmount: number;

  /** Rental returns — penalty deduction pre-filled (display only). */
  damageDeduction?: number | null;
  /** Customer bill book / REF # for sale receive-payment auto description. */
  customerBillRef?: string | null;
  defaultPaymentNotes?: string | null;
  initialAmount?: number;
  initialReference?: string | null;
  initialPaymentDate?: string | null;
  initialPaymentTime?: string | null;
  initialAttachmentFiles?: File[] | null;

  onClose: () => void;
  onSuccess: () => void;
  onViewLedger?: (info: { paymentId: string | null; partyName: string | null }) => void;
}

export function UnifiedPaymentSheet({
  kind,
  referenceId,
  referenceNo,
  companyId,
  branchId,
  userId,
  userRole,
  profileId,
  documentBranchId,
  partyName,
  partyId,
  partyPhone,
  totalAmount,
  alreadyPaid,
  outstandingAmount,
  damageDeduction,
  customerBillRef,
  defaultPaymentNotes,
  initialAmount,
  initialReference,
  initialPaymentDate,
  initialPaymentTime,
  initialAttachmentFiles,
  onClose,
  onSuccess,
  onViewLedger,
}: UnifiedPaymentSheetProps) {
  const { submit: submitCustomer } = useRecordCustomerPayment();

  const handleSubmit = async (
    payload: MobilePaymentSheetSubmitPayload,
  ): Promise<MobilePaymentSheetSubmitResult> => {
    if (kind === 'sale') {
      const { success, error, paymentId, referenceNumber } = await submitCustomer({
        companyId,
        branchId: payload.branchId ?? branchId,
        customerId: partyId ?? null,
        referenceId,
        amount: payload.amount,
        accountId: payload.accountId,
        paymentMethod: payload.method === 'wallet' ? 'wallet' : payload.method,
        paymentDate: payload.paymentDate,
        paymentAt: payload.paymentAt,
        notes: payload.notes || undefined,
        referenceNumber: payload.reference?.trim() ? payload.reference.trim() : null,
        createdBy: userId ?? null,
      });
      let attachmentWarning: string | null = null;
      if (success && paymentId && payload.attachments.length > 0) {
        const fin = await finalizePaymentAttachments({
          companyId,
          storageSegment: referenceId,
          paymentId,
          files: payload.attachments,
        });
        attachmentWarning = fin.attachmentWarning;
      }
      return {
        success,
        error: error ?? null,
        paymentId: paymentId ?? null,
        referenceNumber: referenceNumber ?? null,
        partyAccountName: partyName ? `Receivable — ${partyName}` : null,
        attachmentWarning,
      };
    }

    if (kind === 'rental') {
      const { error, paymentId, referenceNumber } = await addRentalPayment({
        rentalId: referenceId,
        companyId,
        branchId: payload.branchId ?? branchId,
        amount: payload.amount,
        method: payload.method,
        paymentAccountId: payload.accountId,
        paymentDate: payload.paymentDate,
        paymentAt: payload.paymentAt,
        reference: payload.reference || undefined,
        notes: payload.notes || undefined,
        userId: userId ?? null,
      });
      let attachmentWarning: string | null = null;
      if (!error && paymentId && payload.attachments.length > 0) {
        const fin = await finalizePaymentAttachments({
          companyId,
          storageSegment: referenceId,
          paymentId,
          files: payload.attachments,
        });
        attachmentWarning = fin.attachmentWarning;
      }
      return {
        success: !error,
        error: error ?? null,
        paymentId: paymentId ?? null,
        referenceNumber: referenceNumber ?? null,
        partyAccountName: partyName ? `Receivable — ${partyName}` : null,
        attachmentWarning,
      };
    }

    if (kind === 'purchase') {
      const payBranchId = payload.branchId ?? branchId;
      if (!payBranchId) return { success: false, error: 'Branch required for supplier payment.' };
      const methodForRpc: 'cash' | 'bank' | 'card' | 'other' = payload.method === 'wallet' ? 'other' : payload.method;
      const { data, error } = await recordSupplierPayment({
        companyId,
        branchId: payBranchId,
        purchaseId: referenceId,
        amount: payload.amount,
        paymentDate: payload.paymentDate,
        paymentAt: payload.paymentAt,
        paymentAccountId: payload.accountId,
        paymentMethod: methodForRpc,
        reference: payload.reference || undefined,
        notes: payload.notes || undefined,
        userId: userId ?? undefined,
      });
      let attachmentWarning: string | null = null;
      if (data?.payment_id && payload.attachments.length > 0) {
        const fin = await finalizePaymentAttachments({
          companyId,
          storageSegment: referenceId,
          paymentId: data.payment_id,
          files: payload.attachments,
        });
        attachmentWarning = fin.attachmentWarning;
      }
      return {
        success: !error,
        error: error ?? null,
        paymentId: data?.payment_id ?? null,
        referenceNumber: data?.reference_number ?? null,
        partyAccountName: partyName ? `Payable — ${partyName}` : null,
        attachmentWarning,
      };
    }

    // worker / expense callers should provide a custom submit — these kinds
    // currently have bespoke flows (StudioWorkerPaymentView, expense module).
    return { success: false, error: `Unsupported payment kind: ${kind}` };
  };

  const mode = KIND_TO_MODE[kind];
  const subtitleBits: string[] = [];
  if (referenceNo) subtitleBits.push(`Ref: ${referenceNo}`);
  if (damageDeduction && damageDeduction > 0) subtitleBits.push(`Includes penalty Rs. ${damageDeduction.toLocaleString()}`);

  return (
    <MobilePaymentSheet
      mode={mode}
      companyId={companyId}
      branchId={branchId}
      userId={userId}
      userRole={userRole}
      profileId={profileId}
      documentBranchId={documentBranchId}
      partyName={partyName}
      partyPhone={partyPhone}
      referenceNo={referenceNo ?? null}
      totalAmount={totalAmount ?? null}
      alreadyPaid={alreadyPaid ?? null}
      outstandingAmount={outstandingAmount}
      subtitle={subtitleBits.length > 0 ? subtitleBits.join(' · ') : undefined}
      customerBillRef={kind === 'sale' ? customerBillRef : undefined}
      defaultPaymentNotes={defaultPaymentNotes}
      initialAmount={initialAmount}
      initialReference={initialReference}
      initialPaymentDate={initialPaymentDate}
      initialPaymentTime={initialPaymentTime}
      initialAttachmentFiles={initialAttachmentFiles}
      onClose={onClose}
      onSuccess={onSuccess}
      onSubmit={handleSubmit}
      onViewLedger={onViewLedger}
    />
  );
}
