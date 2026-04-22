import { useEffect, useState } from 'react';
import {
  X,
  ArrowDownLeft,
  ArrowUpRight,
  Share2,
  BookOpen,
  Loader2,
  Paperclip,
} from 'lucide-react';
import {
  getTransactionDetail,
  type TransactionDetail,
} from '../../../api/transactions';
import { PdfPreviewModal } from '../../shared/PdfPreviewModal';
import { ReceiptPreviewPdf } from '../../shared/ReceiptPreviewPdf';
import { usePdfPreview } from '../../shared/usePdfPreview';

interface Props {
  paymentId: string;
  companyId: string;
  onClose: () => void;
  onViewLedger?: (info: { partyId?: string | null; partyName?: string | null; accountId?: string | null }) => void;
}

const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash',
  bank: 'Bank',
  card: 'Card',
  other: 'Other',
};

function formatDateTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })} · ${d.toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })}`;
}

export function TransactionDetailSheet({ paymentId, companyId, onClose, onViewLedger }: Props) {
  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const preview = usePdfPreview(companyId);

  useEffect(() => {
    setLoading(true);
    getTransactionDetail(companyId, paymentId)
      .then(({ data, error }) => {
        if (error) setError(error);
        setDetail(data);
      })
      .finally(() => setLoading(false));
  }, [companyId, paymentId]);

  const isReceived = detail?.direction === 'received';
  const amountColor = isReceived ? 'text-[#10B981]' : 'text-[#EF4444]';
  const Icon = isReceived ? ArrowDownLeft : ArrowUpRight;

  const handleShare = async () => {
    if (!detail) return;
    await preview.openPreview();
  };

  const handleLedger = () => {
    if (!detail) return;
    onViewLedger?.({
      partyId: detail.partyId,
      partyName: detail.partyName,
      accountId: detail.partyAccountId,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full md:w-[32rem] bg-[#111827] rounded-t-2xl md:rounded-2xl border border-[#374151] max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-[#111827] border-b border-[#1F2937] flex items-center justify-between px-4 py-3">
          <h2 className="text-base font-semibold text-white">Transaction</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-[#1F2937] rounded-lg text-[#9CA3AF]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading && (
          <div className="py-16 flex items-center justify-center text-[#9CA3AF]">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}
        {error && !loading && (
          <div className="m-4 p-3 bg-[#EF4444]/20 border border-[#EF4444] rounded-lg text-sm text-[#EF4444]">{error}</div>
        )}

        {detail && !loading && (
          <div className="p-4 space-y-4">
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center ${
                  isReceived ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#EF4444]/20 text-[#EF4444]'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs uppercase tracking-wide text-[#9CA3AF]">
                    {isReceived ? 'Payment Received' : 'Payment Paid'}
                  </p>
                  <p className="text-lg font-semibold text-white truncate">{detail.partyName ?? detail.partyAccountName ?? '—'}</p>
                  <p className="text-xs text-[#9CA3AF] mt-0.5">{formatDateTime(detail.createdAt || detail.paymentDate)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-lg font-bold ${amountColor}`}>
                    Rs. {detail.amount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[11px] text-[#9CA3AF] uppercase">{METHOD_LABEL[detail.method] ?? detail.method}</p>
                </div>
              </div>
            </div>

            <section className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <h3 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-3">Route</h3>
              <div className="space-y-2">
                <RouteRow label="From" value={isReceived ? detail.paymentAccountName : (detail.partyAccountName ?? detail.partyName ?? '—')} />
                <RouteRow label="To" value={isReceived ? (detail.partyAccountName ?? detail.partyName ?? '—') : detail.paymentAccountName} />
              </div>
            </section>

            <section className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <h3 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-3">Reference</h3>
              <dl className="grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-[#9CA3AF]">Reference #</dt>
                <dd className="text-white text-right">{detail.referenceNumber ?? detail.entryNo ?? '—'}</dd>
                <dt className="text-[#9CA3AF]">Type</dt>
                <dd className="text-white text-right capitalize">{detail.referenceType.replace('_', ' ')}</dd>
                {detail.branchName && (
                  <>
                    <dt className="text-[#9CA3AF]">Branch</dt>
                    <dd className="text-white text-right">{detail.branchName}</dd>
                  </>
                )}
                {detail.partyPhone && (
                  <>
                    <dt className="text-[#9CA3AF]">Phone</dt>
                    <dd className="text-white text-right">{detail.partyPhone}</dd>
                  </>
                )}
              </dl>
            </section>

            {detail.journalLines.length > 0 && (
              <section className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
                <h3 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-3">Journal Lines</h3>
                <div className="space-y-2">
                  {detail.journalLines.map((l) => (
                    <div key={l.id} className="flex items-start justify-between gap-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="text-white truncate">
                          {l.accountCode ? <span className="text-[#6366F1] mr-1">{l.accountCode}</span> : null}
                          {l.accountName ?? 'Unknown'}
                        </p>
                        {l.description && <p className="text-[11px] text-[#6B7280] truncate">{l.description}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        {l.debit > 0 && <p className="text-[#10B981] text-xs">Dr {l.debit.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</p>}
                        {l.credit > 0 && <p className="text-[#EF4444] text-xs">Cr {l.credit.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {detail.notes && (
              <section className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
                <h3 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-2">Notes</h3>
                <p className="text-sm text-white whitespace-pre-line">{detail.notes}</p>
              </section>
            )}

            {detail.attachments && detail.attachments.length > 0 && (
              <section className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
                <h3 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-3">Attachments</h3>
                <ul className="space-y-2">
                  {detail.attachments.map((a, idx) => (
                    <li key={idx}>
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 text-sm text-[#6366F1] hover:underline"
                      >
                        <Paperclip className="w-4 h-4" />
                        {a.name || `Attachment ${idx + 1}`}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={handleShare}
                className="flex items-center justify-center gap-2 py-3 bg-[#25D366] hover:bg-[#1FB058] rounded-lg text-white font-semibold text-sm"
              >
                <Share2 className="w-4 h-4" /> Share Receipt
              </button>
              <button
                onClick={handleLedger}
                className="flex items-center justify-center gap-2 py-3 bg-[#6366F1] hover:bg-[#4F46E5] rounded-lg text-white font-semibold text-sm"
              >
                <BookOpen className="w-4 h-4" /> View Ledger
              </button>
            </div>
          </div>
        )}
      </div>

      {preview.brand && detail && (
        <PdfPreviewModal
          open={preview.open}
          title={detail.direction === 'received' ? 'Payment Receipt' : 'Payment Voucher'}
          filename={`Receipt_${detail.referenceNumber ?? detail.entryNo ?? detail.id}.pdf`}
          onClose={preview.close}
          whatsAppFallbackText={`${detail.direction === 'received' ? 'Received' : 'Paid'} Rs. ${detail.amount.toLocaleString('en-PK')} — ${detail.partyName ?? detail.partyAccountName ?? ''}`}
        >
          <ReceiptPreviewPdf
            brand={preview.brand}
            heading={detail.direction === 'received' ? 'Payment Received' : 'Payment Paid'}
            partyName={detail.partyName ?? detail.partyAccountName ?? 'Customer'}
            amount={detail.amount}
            dateTime={detail.createdAt || detail.paymentDate}
            fromAccountName={detail.direction === 'received' ? detail.paymentAccountName : (detail.partyAccountName ?? detail.partyName ?? null)}
            toAccountName={detail.direction === 'received' ? (detail.partyAccountName ?? detail.partyName ?? null) : detail.paymentAccountName}
            referenceNumber={detail.referenceNumber ?? detail.entryNo ?? null}
            referenceType={detail.referenceType}
            method={METHOD_LABEL[detail.method] ?? detail.method}
            notes={detail.notes}
            branchName={detail.branchName}
            generatedBy="User"
          />
        </PdfPreviewModal>
      )}
    </div>
  );
}

function RouteRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-[#9CA3AF]">{label}</span>
      <span className="text-white text-right truncate max-w-[70%]">{value || '—'}</span>
    </div>
  );
}
