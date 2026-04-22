import { UnifiedPaymentSheet } from '../shared/UnifiedPaymentSheet';

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

/**
 * Thin compatibility wrapper around UnifiedPaymentSheet (kind='sale').
 * Preserved so existing callers do not need to change their import path.
 */
export function MobileReceivePayment(props: MobileReceivePaymentProps) {
  return (
    <UnifiedPaymentSheet
      kind="sale"
      referenceId={props.referenceId}
      referenceNo={props.referenceNo}
      companyId={props.companyId}
      branchId={props.branchId}
      userId={props.userId}
      partyName={props.customerName}
      partyId={props.customerId}
      totalAmount={props.totalAmount}
      alreadyPaid={props.alreadyPaid}
      outstandingAmount={props.outstandingAmount}
      onClose={props.onClose}
      onSuccess={props.onSuccess}
      onViewLedger={props.onViewLedger}
    />
  );
}
