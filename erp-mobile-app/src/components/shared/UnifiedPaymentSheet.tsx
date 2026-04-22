import { useRecordCustomerPayment } from '../../hooks/useRecordCustomerPayment';
import { uploadPaymentAttachments, updatePaymentAttachments } from '../../api/paymentAttachments';
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

  /** Counter-party name. For 'expense' this may be the category. */
  partyName: string | null;
  /** Customer / supplier / worker id — needed for accounting posting. */
  partyId?: string | null;

  totalAmount?: number | null;
  alreadyPaid?: number | null;
  /** Amount due = what the user should pay by default. Required. */
  outstandingAmount: number;

  /** Rental returns — penalty deduction pre-filled (display only). */
  damageDeduction?: number | null;

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
  partyName,
  partyId,
  totalAmount,
  alreadyPaid,
  outstandingAmount,
  damageDeduction,
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
        customerId: partyId ?? null,
        referenceId,
        amount: payload.amount,
        accountId: payload.accountId,
        paymentMethod: payload.method === 'wallet' ? 'wallet' : payload.method,
        paymentDate: payload.paymentDate,
        notes: payload.notes || null,
        createdBy: userId ?? null,
      });
      if (success && paymentId && payload.attachments.length > 0) {
        try {
          const uploaded = await uploadPaymentAttachments(companyId, referenceId, paymentId, payload.attachments);
          if (uploaded.length > 0) await updatePaymentAttachments(paymentId, uploaded);
        } catch {
          // non-fatal
        }
      }
      return {
        success,
        error: error ?? null,
        paymentId: paymentId ?? null,
        referenceNumber: referenceNumber ?? null,
        partyAccountName: partyName ? `Receivable — ${partyName}` : null,
      };
    }

    if (kind === 'rental') {
      const { error, paymentId, referenceNumber } = await addRentalPayment({
        rentalId: referenceId,
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
        partyAccountName: partyName ? `Receivable — ${partyName}` : null,
      };
    }

    if (kind === 'purchase') {
      if (!branchId) return { success: false, error: 'Branch required for supplier payment.' };
      const methodForRpc: 'cash' | 'bank' | 'card' | 'other' = payload.method === 'wallet' ? 'other' : payload.method;
      const { data, error } = await recordSupplierPayment({
        companyId,
        branchId,
        purchaseId: referenceId,
        amount: payload.amount,
        paymentDate: payload.paymentDate,
        paymentAccountId: payload.accountId,
        paymentMethod: methodForRpc,
        reference: payload.reference || undefined,
        notes: payload.notes || undefined,
        userId: userId ?? undefined,
      });
      return {
        success: !error,
        error: error ?? null,
        paymentId: data?.payment_id ?? null,
        referenceNumber: data?.reference_number ?? null,
        partyAccountName: partyName ? `Payable — ${partyName}` : null,
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
      partyName={partyName}
      referenceNo={referenceNo ?? null}
      totalAmount={totalAmount ?? null}
      alreadyPaid={alreadyPaid ?? null}
      outstandingAmount={outstandingAmount}
      subtitle={subtitleBits.length > 0 ? subtitleBits.join(' · ') : undefined}
      onClose={onClose}
      onSuccess={onSuccess}
      onSubmit={handleSubmit}
      onViewLedger={onViewLedger}
    />
  );
}
