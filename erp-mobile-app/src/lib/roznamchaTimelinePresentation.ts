import type { RoznamchaRowWithBalance } from '../api/roznamcha';
import { isGenericRoznamchaPartyLabel } from './roznamchaCounterpartyLabel';
import {
  isLiquidityBackedPayment,
  resolveTimelinePresentation,
  type TimelinePresentation,
  type TransactionRowLike,
} from './transactionTimelinePresentation';

export interface RoznamchaRowPresentation extends TimelinePresentation {
  useLiquidityPresentation: boolean;
  fallbackTitle: string;
}

function inferReferenceType(row: RoznamchaRowWithBalance): string {
  const type = String(row.type || '').toLowerCase();
  if (type.includes('manual receipt') || type === 'customer receipt') return 'manual_receipt';
  if (type.includes('manual payment')) return 'manual_payment';
  if (type.includes('transfer') || type.includes('general') || type.includes('journal')) return 'transfer';
  if (row.direction === 'IN') return 'manual_receipt';
  if (row.direction === 'OUT') return 'manual_payment';
  return 'payment';
}

function isCustomerPartyRow(row: RoznamchaRowWithBalance): boolean {
  const type = String(row.type || '').toLowerCase();
  return (
    type.includes('customer receipt') ||
    type.includes('customer payment') ||
    type.includes('cash sale') ||
    type === 'payment'
  );
}

function mapRoznamchaToTransactionRow(row: RoznamchaRowWithBalance): TransactionRowLike {
  const referenceType = inferReferenceType(row);
  const details = String(row.details || '').trim();
  const partyLine = String(row.partyLine || '').trim();
  const partyName =
    details && !isGenericRoznamchaPartyLabel(details) && isCustomerPartyRow(row) ? details : null;
  const counterpartyAccount =
    !partyName && details && !isGenericRoznamchaPartyLabel(details)
      ? details
      : partyLine && !isGenericRoznamchaPartyLabel(partyLine)
        ? partyLine
        : null;

  return {
    direction: row.direction === 'IN' ? 'received' : 'paid',
    referenceType,
    paymentAccountId: row.paymentAccountId ?? null,
    paymentAccountName: row.accountName ?? null,
    paymentAccountType: row.accountType ?? null,
    partyAccountId: null,
    partyAccountName: counterpartyAccount ?? null,
    partyName,
    notes: row.referenceDisplay ?? null,
  };
}

export function resolveRoznamchaRowPresentation(row: RoznamchaRowWithBalance): RoznamchaRowPresentation {
  const fallbackTitle = String(row.details || row.type || 'Payment').trim() || 'Payment';
  const tx = mapRoznamchaToTransactionRow(row);
  const liquidityBacked = isLiquidityBackedPayment(tx.referenceType);

  if (!liquidityBacked) {
    const isIn = row.direction === 'IN';
    return {
      variant: 'party',
      isReceived: isIn,
      title: fallbackTitle,
      from: row.accountName?.trim() || row.accountLabel || '—',
      to: fallbackTitle,
      amountClass: isIn ? 'text-[#10B981]' : 'text-[#EF4444]',
      pillClass: isIn
        ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30'
        : 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30',
      signPrefix: isIn ? '+' : '−',
      useLiquidityPresentation: false,
      fallbackTitle,
    };
  }

  const pres = resolveTimelinePresentation(tx);
  return {
    ...pres,
    useLiquidityPresentation: true,
    fallbackTitle,
  };
}
