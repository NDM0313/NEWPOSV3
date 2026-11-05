import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from 'lucide-react';
import type { TransactionRow } from '../../../../api/transactions';
import { resolveTimelinePresentation } from '../../../../lib/transactionTimelinePresentation';
import { formatAmount } from './format';

export interface TransactionActivityRowProps {
  tx: TransactionRow;
  amountDecimals?: number;
  timeLabel?: string;
  showFromTo?: boolean;
  attachmentSlot?: React.ReactNode;
  trailingSlot?: React.ReactNode;
  className?: string;
}

export function TransactionActivityRow({
  tx,
  amountDecimals = 0,
  timeLabel,
  showFromTo = true,
  attachmentSlot,
  trailingSlot,
  className = '',
}: TransactionActivityRowProps) {
  const pres = resolveTimelinePresentation(tx);
  const Icon = pres.variant === 'transfer' ? ArrowLeftRight : pres.isReceived ? ArrowDownLeft : ArrowUpRight;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${pres.pillClass}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{pres.title}</p>
        {showFromTo ? (
          <p className="text-[11px] text-[#9CA3AF] truncate">
            {pres.from} → {pres.to}
          </p>
        ) : null}
      </div>
      <div className="text-right shrink-0">
        <div className="flex items-center justify-end gap-0.5">
          {attachmentSlot}
          <p className={`text-sm font-bold ${pres.amountClass}`}>
            {pres.signPrefix} Rs. {formatAmount(tx.amount, amountDecimals)}
          </p>
        </div>
        {timeLabel ? <p className="text-[11px] text-[#9CA3AF]">{timeLabel}</p> : null}
        {trailingSlot}
      </div>
    </div>
  );
}

export function useTransactionTimelinePresentation(tx: TransactionRow) {
  return resolveTimelinePresentation(tx);
}
