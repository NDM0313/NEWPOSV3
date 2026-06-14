import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { useFormatDate } from '@/app/hooks/useFormatDate';
import type { LedgerStatementV2Row } from './types';
import { LedgerReferenceCell, LedgerAttachmentIcon } from './LedgerReferenceCell';
import { TransactionShareActions } from './TransactionShareActions';

interface LedgerTableProps {
  rows: LedgerStatementV2Row[];
  loading: boolean;
  rowActionsDisabled?: boolean;
  onOpenRow: (row: LedgerStatementV2Row) => void;
  onWhatsAppRow: (row: LedgerStatementV2Row) => void;
  onPreviewAttachments: (row: LedgerStatementV2Row) => void;
}

export function LedgerTable({
  rows,
  loading,
  rowActionsDisabled,
  onOpenRow,
  onWhatsAppRow,
  onPreviewAttachments,
}: LedgerTableProps) {
  const { formatCurrency } = useFormatCurrency();
  const { formatDate } = useFormatDate();

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-800 bg-[#0F1419] p-12 text-center text-gray-500">
        Loading statement…
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-gray-800 bg-[#0F1419] p-12 text-center text-gray-500">
        No transactions for the selected filters.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-[#0F1419] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-3 py-3 font-medium">Date</th>
              <th className="px-3 py-3 font-medium">Reference</th>
              <th className="px-3 py-3 font-medium">Type</th>
              <th className="px-3 py-3 font-medium min-w-[160px]">Description</th>
              <th className="px-3 py-3 font-medium">Branch</th>
              <th className="px-3 py-3 font-medium text-right">Debit</th>
              <th className="px-3 py-3 font-medium text-right">Credit</th>
              <th className="px-3 py-3 font-medium text-right">Balance</th>
              <th className="px-3 py-3 font-medium">Payment</th>
              <th className="px-3 py-3 font-medium">Created by</th>
              <th className="px-3 py-3 font-medium text-center">Att.</th>
              <th className="px-3 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-gray-800/80 hover:bg-gray-900/40">
                <td className="px-3 py-2.5 whitespace-nowrap text-gray-300">
                  {row.date ? formatDate(row.date) : '—'}
                </td>
                <td className="px-3 py-2.5">
                  <LedgerReferenceCell row={row} onOpen={onOpenRow} disabled={rowActionsDisabled} />
                </td>
                <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">{row.transactionType}</td>
                <td className="px-3 py-2.5 text-gray-300 max-w-xs truncate" title={row.description}>
                  {row.description || '—'}
                </td>
                <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">{row.branch}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-200">
                  {row.debit ? formatCurrency(row.debit) : '—'}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-200">
                  {row.credit ? formatCurrency(row.credit) : '—'}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums font-medium text-white">
                  {formatCurrency(row.runningBalance)}
                </td>
                <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">{row.paymentMethod}</td>
                <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{row.createdBy}</td>
                <td className="px-3 py-2.5 text-center">
                  <LedgerAttachmentIcon
                    row={row}
                    onPreview={onPreviewAttachments}
                    disabled={rowActionsDisabled}
                  />
                </td>
                <td className="px-3 py-2.5">
                  <TransactionShareActions
                    row={row}
                    onView={onOpenRow}
                    onWhatsApp={onWhatsAppRow}
                    disabled={rowActionsDisabled}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
