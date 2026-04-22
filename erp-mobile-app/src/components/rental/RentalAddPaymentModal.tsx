import { UnifiedPaymentSheet } from '../shared/UnifiedPaymentSheet';

export interface RentalAddPaymentModalProps {
  rentalId: string;
  companyId: string;
  branchId: string | null;
  userId?: string | null;
  bookingNo?: string | null;
  customerName?: string | null;
  customerId?: string | null;
  totalAmount?: number;
  paidAmount?: number;
  dueAmount: number;
  /** When opened from the Return flow with an outstanding penalty. */
  damageDeduction?: number | null;
  onClose: () => void;
  onSuccess: () => void;
  onViewLedger?: (info: { paymentId: string | null; partyName: string | null }) => void;
}

/**
 * Thin compatibility wrapper around UnifiedPaymentSheet (kind='rental').
 * Preserved so existing callers do not need to change their import path.
 */
export function RentalAddPaymentModal(props: RentalAddPaymentModalProps) {
  return (
    <UnifiedPaymentSheet
      kind="rental"
      referenceId={props.rentalId}
      referenceNo={props.bookingNo ?? null}
      companyId={props.companyId}
      branchId={props.branchId}
      userId={props.userId}
      partyName={props.customerName ?? null}
      partyId={props.customerId ?? null}
      totalAmount={props.totalAmount ?? null}
      alreadyPaid={props.paidAmount ?? null}
      outstandingAmount={props.dueAmount}
      damageDeduction={props.damageDeduction ?? null}
      onClose={props.onClose}
      onSuccess={props.onSuccess}
      onViewLedger={props.onViewLedger}
    />
  );
}
