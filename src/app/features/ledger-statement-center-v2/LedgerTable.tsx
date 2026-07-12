import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { useFormatDate } from '@/app/hooks/useFormatDate';
import { shortenLedgerPaymentLabel } from '@/app/lib/ledgerStatementV2Enrichment';
import type { LedgerStatementV2Row } from './types';
import { LedgerReferenceCell, LedgerAttachmentIcon } from './LedgerReferenceCell';
import { TransactionShareActions } from './TransactionShareActions';

interface LedgerTableProps {
  rows: LedgerStatementV2Row[];
  loading: boolean;
  rowActionsDisabled?: boolean;
  /** When a key is false, that data column is hidden. Att. / Actions always shown. */
  visibleColumns?: Record<string, boolean>;
  onOpenRow: (row: LedgerStatementV2Row) => void;
  onWhatsAppRow: (row: LedgerStatementV2Row) => void;
  onPreviewAttachments: (row: LedgerStatementV2Row) => void;
}

export function LedgerTable({
  rows,
  loading,
  rowActionsDisabled,
  visibleColumns,
  onOpenRow,
  onWhatsAppRow,
  onPreviewAttachments,
}: LedgerTableProps) {
  const { formatCurrency } = useFormatCurrency();
  const { formatDate } = useFormatDate();
  const show = (key: string) => visibleColumns?.[key] !== false;

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
        Loading statement…
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
        No transactions for the selected filters.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground bg-muted/40">
              {show('date') ? <th className="px-3 py-3 font-medium">Date</th> : null}
              {show('reference') ? <th className="px-3 py-3 font-medium">Reference</th> : null}
              {show('type') ? <th className="px-3 py-3 font-medium">Type</th> : null}
              {show('description') ? (
                <th className="px-3 py-3 font-medium min-w-[160px]">Description</th>
              ) : null}
              {show('branch') ? <th className="px-3 py-3 font-medium">Branch</th> : null}
              {show('debit') ? <th className="px-3 py-3 font-medium text-right">Debit</th> : null}
              {show('credit') ? <th className="px-3 py-3 font-medium text-right">Credit</th> : null}
              {show('balance') ? <th className="px-3 py-3 font-medium text-right">Balance</th> : null}
              {show('payment') ? <th className="px-3 py-3 font-medium">Payment</th> : null}
              {show('createdBy') ? <th className="px-3 py-3 font-medium">Created by</th> : null}
              <th className="px-3 py-3 font-medium text-center">Att.</th>
              <th className="px-3 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const paymentFull = row.paymentMethod;
              const paymentShort = shortenLedgerPaymentLabel(paymentFull);
              const paymentTitle = paymentShort !== paymentFull ? paymentFull : paymentShort;

              return (
                <tr key={row.id} className="border-b border-border hover:bg-accent/50">
                  {show('date') ? (
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                      {row.date ? formatDate(row.date) : '—'}
                    </td>
                  ) : null}
                  {show('reference') ? (
                    <td className="px-3 py-2.5">
                      <LedgerReferenceCell row={row} onOpen={onOpenRow} disabled={rowActionsDisabled} />
                    </td>
                  ) : null}
                  {show('type') ? (
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                      {row.transactionType}
                    </td>
                  ) : null}
                  {show('description') ? (
                    <td className="px-3 py-2.5 text-foreground max-w-xs truncate" title={row.description}>
                      {row.description || '—'}
                    </td>
                  ) : null}
                  {show('branch') ? (
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{row.branch}</td>
                  ) : null}
                  {show('debit') ? (
                    <td className="px-3 py-2.5 text-right tabular-nums text-foreground">
                      {row.debit ? formatCurrency(row.debit) : '—'}
                    </td>
                  ) : null}
                  {show('credit') ? (
                    <td className="px-3 py-2.5 text-right tabular-nums text-foreground">
                      {row.credit ? formatCurrency(row.credit) : '—'}
                    </td>
                  ) : null}
                  {show('balance') ? (
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium text-foreground">
                      {formatCurrency(row.runningBalance)}
                    </td>
                  ) : null}
                  {show('payment') ? (
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                      {row.paymentId && paymentFull !== '—' ? (
                        <button
                          type="button"
                          onClick={() => onOpenRow(row)}
                          disabled={rowActionsDisabled}
                          title={paymentTitle}
                          className="text-blue-400 hover:text-blue-300 hover:underline text-left disabled:opacity-40 disabled:pointer-events-none"
                        >
                          {paymentShort}
                        </button>
                      ) : (
                        <span title={paymentFull !== '—' ? paymentTitle : undefined}>{paymentShort}</span>
                      )}
                    </td>
                  ) : null}
                  {show('createdBy') ? (
                    <td
                      className="px-3 py-2.5 text-muted-foreground whitespace-nowrap"
                      title={row.createdBy !== '—' ? row.createdBy : undefined}
                    >
                      {row.createdBy}
                    </td>
                  ) : null}
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
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
