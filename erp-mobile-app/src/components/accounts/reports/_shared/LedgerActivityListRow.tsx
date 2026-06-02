import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import type { LedgerLine } from '../../../../api/reports';
import { AttachmentIndicatorButton } from '../../../shared/AttachmentIndicatorButton';
import { formatAmount, formatDate } from './format';

export interface LedgerActivityListRowProps {
  line: LedgerLine;
  displayReference: (entryNo: string, referenceType: string) => string;
  onRowClick?: () => void;
  onAttachmentClick?: () => void;
}

export function LedgerActivityListRow({
  line: l,
  displayReference,
  onRowClick,
  onAttachmentClick,
}: LedgerActivityListRowProps) {
  const isDebit = l.debit > 0;
  const amount = isDebit ? l.debit : l.credit;
  const time = l.createdAt
    ? new Date(l.createdAt).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })
    : '';
  const refLabel = displayReference(l.entryNo, l.referenceType);

  const inner = (
    <div className="flex items-start gap-3">
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
          isDebit ? 'bg-[#F59E0B]/15 text-[#F59E0B]' : 'bg-[#10B981]/15 text-[#10B981]'
        }`}
      >
        {isDebit ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{l.description || '—'}</p>
        <p className="text-[11px] text-[#9CA3AF] truncate">
          {formatDate(l.date)}
          {time ? ` · ${time}` : ''} · {refLabel}
        </p>
      </div>
      <div className="text-right shrink-0">
        <div className="flex items-center justify-end gap-0.5">
          {l.hasAttachments && onAttachmentClick ? (
            <AttachmentIndicatorButton onClick={() => onAttachmentClick()} size="sm" />
          ) : null}
          <p className={`text-sm font-bold ${isDebit ? 'text-[#F59E0B]' : 'text-[#10B981]'}`}>
            {isDebit ? '+' : '−'} Rs. {formatAmount(amount, 0)}
          </p>
        </div>
        <p className="text-[10px] text-[#9CA3AF]">Bal Rs. {formatAmount(l.runningBalance, 0)}</p>
      </div>
    </div>
  );

  if (onRowClick) {
    return (
      <li>
        <button
          type="button"
          onClick={onRowClick}
          className="w-full text-left px-4 py-3 hover:bg-[#111827]/60 transition-colors"
        >
          {inner}
        </button>
      </li>
    );
  }

  return (
    <li className="px-4 py-3">
      {inner}
    </li>
  );
}
