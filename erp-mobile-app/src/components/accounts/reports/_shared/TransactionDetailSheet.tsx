import { useEffect, useState } from 'react';
import { X, Loader2, FileText } from 'lucide-react';
import {
  getTransactionDetail,
  type TransactionDetail,
  type TransactionReferenceType,
} from '../../../../api/transactionDetail';
import { formatAmount, formatDate } from './format';

interface TransactionDetailSheetProps {
  open: boolean;
  onClose: () => void;
  companyId: string | null;
  referenceType: TransactionReferenceType;
  referenceId: string | null;
  /** Optional fallback title (e.g. "Sale SAL-0012") shown while loading. */
  fallbackTitle?: string;
}

const TYPE_LABEL: Record<string, string> = {
  sale: 'Sale',
  purchase: 'Purchase',
  payment: 'Payment',
  expense: 'Expense',
  expense_payment: 'Expense Payment',
  rental: 'Rental',
  journal: 'Journal Entry',
  on_account: 'On-Account',
  worker_payment: 'Worker Payment',
  stock_movement: 'Stock Movement',
  studio: 'Studio Order',
};

function fmtHeaderValue(value: string | number | null): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return `Rs. ${formatAmount(value, 0)}`;
  return String(value);
}

export function TransactionDetailSheet({
  open,
  onClose,
  companyId,
  referenceType,
  referenceId,
  fallbackTitle,
}: TransactionDetailSheetProps) {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !companyId || !referenceId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);
    getTransactionDetail(companyId, referenceType, referenceId).then(({ data, error }) => {
      if (cancelled) return;
      if (error) setError(error);
      setDetail(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, companyId, referenceType, referenceId]);

  if (!open) return null;

  const title = detail?.entryNo ? `${TYPE_LABEL[referenceType] ?? 'Transaction'} · ${detail.entryNo}` : fallbackTitle || TYPE_LABEL[referenceType] || 'Transaction';

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4">
      <div className="w-full sm:max-w-lg bg-[#1F2937] sm:rounded-xl rounded-t-2xl border border-[#374151] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#374151]">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#111827] border border-[#374151] flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-[#9CA3AF]" />
            </div>
            <h3 className="text-sm font-semibold text-white truncate">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-[#374151] rounded-lg text-[#9CA3AF]"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[#6B7280]" />
            </div>
          )}
          {error && !loading && (
            <p className="text-sm text-red-400 text-center py-4">{error}</p>
          )}
          {detail && !loading && (
            <>
              {detail.date && (
                <p className="text-xs text-[#9CA3AF]">
                  {formatDate(detail.date)}
                  {detail.createdAt && (
                    <span className="ml-2">
                      · {new Date(detail.createdAt).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </p>
              )}

              {Object.keys(detail.headerMeta).length > 0 && (
                <div className="bg-[#111827] border border-[#374151] rounded-lg p-3">
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
                    {Object.entries(detail.headerMeta).map(([k, v]) => (
                      <div key={k} className="min-w-0">
                        <dt className="text-[10px] uppercase tracking-wide text-[#6B7280]">{k}</dt>
                        <dd className="text-xs text-white truncate">{fmtHeaderValue(v)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              {detail.description && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-[#6B7280] mb-1">Description</p>
                  <p className="text-sm text-white">{detail.description}</p>
                </div>
              )}

              {detail.lines.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-[#6B7280] mb-2">Journal Lines</p>
                  <div className="bg-[#111827] border border-[#374151] rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-[#0F172A] text-[#9CA3AF]">
                        <tr>
                          <th className="px-2 py-2 text-left font-medium">Account</th>
                          <th className="px-2 py-2 text-right font-medium">Debit</th>
                          <th className="px-2 py-2 text-right font-medium">Credit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1F2937]">
                        {detail.lines.map((l, i) => (
                          <tr key={i}>
                            <td className="px-2 py-2 text-white">
                              <div className="font-medium truncate">{l.accountName || '—'}</div>
                              {l.description && (
                                <div className="text-[10px] text-[#6B7280] truncate">{l.description}</div>
                              )}
                            </td>
                            <td className="px-2 py-2 text-right text-[#10B981] font-mono">
                              {l.debit > 0 ? formatAmount(l.debit, 0) : '—'}
                            </td>
                            <td className="px-2 py-2 text-right text-[#EF4444] font-mono">
                              {l.credit > 0 ? formatAmount(l.credit, 0) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-[#0F172A]">
                        <tr>
                          <td className="px-2 py-2 font-semibold text-white">Total</td>
                          <td className="px-2 py-2 text-right font-semibold text-[#10B981] font-mono">
                            {formatAmount(detail.totals.debit, 0)}
                          </td>
                          <td className="px-2 py-2 text-right font-semibold text-[#EF4444] font-mono">
                            {formatAmount(detail.totals.credit, 0)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {!detail.lines.length && Object.keys(detail.headerMeta).length === 0 && (
                <p className="text-sm text-[#9CA3AF] text-center py-4">No details available.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
