import { useEffect, useMemo, useState } from 'react';
import { Receipt } from 'lucide-react';
import type { User } from '../../../types';
import { getSalesInRange, type SalesReportRow } from '../../../api/reports';
import { ReportHeader } from './_shared/ReportHeader';
import { DateRangeBar, makeInitialRange, type DateRangeValue } from './_shared/DateRangeBar';
import { ReportShell, ReportCard, ReportSectionTitle } from './_shared/ReportShell';
import { formatAmount, formatDate, dateRangeLabel } from './_shared/format';
import { PdfPreviewModal } from '../../shared/PdfPreviewModal';
import { LedgerPreviewPdf } from '../../shared/LedgerPreviewPdf';
import { usePdfPreview } from '../../shared/usePdfPreview';
import { TransactionDetailSheet } from './_shared/TransactionDetailSheet';

interface SalesReportProps {
  onBack: () => void;
  companyId: string | null;
  branchId?: string | null;
  user: User;
  isStudio?: boolean;
}

const STATUS_COLOR: Record<string, string> = {
  paid: 'text-[#10B981] bg-[#10B981]/10 border-[#10B981]/40',
  partial: 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/40',
  unpaid: 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/40',
};

export function SalesReport({ onBack, companyId, branchId, user, isStudio }: SalesReportProps) {
  const [range, setRange] = useState<DateRangeValue>(() => makeInitialRange('month'));
  const [rows, setRows] = useState<SalesReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRow, setSelectedRow] = useState<SalesReportRow | null>(null);
  const preview = usePdfPreview(companyId);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getSalesInRange(companyId, range.from || undefined, range.to || undefined, branchId ?? null, isStudio).then(
      ({ data }) => {
        if (cancelled) return;
        setRows(data);
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [companyId, branchId, range.from, range.to, isStudio]);

  const totals = useMemo(() => {
    const total = rows.reduce((s, r) => s + r.total, 0);
    const paid = rows.reduce((s, r) => s + r.paid, 0);
    const due = rows.reduce((s, r) => s + r.due, 0);
    return { total, paid, due, count: rows.length };
  }, [rows]);

  const title = isStudio ? 'Studio Sales Report' : 'Sales Report';

  const stats = [
    { label: 'Invoices', value: String(totals.count) },
    { label: 'Total', value: `Rs. ${formatAmount(totals.total, 0)}` },
    { label: 'Paid', value: `Rs. ${formatAmount(totals.paid, 0)}`, color: 'text-[#BBF7D0]' },
    { label: 'Due', value: `Rs. ${formatAmount(totals.due, 0)}`, color: 'text-[#FCA5A5]' },
  ];

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <ReportHeader
        onBack={onBack}
        title={title}
        subtitle={isStudio ? 'Studio / custom production' : 'POS & invoiced sales'}
        stats={stats}
        onShare={preview.openPreview}
        sharing={preview.loading}
        gradient="indigo"
      >
        <DateRangeBar value={range} onChange={setRange} />
      </ReportHeader>

      <ReportShell loading={loading} empty={!loading && rows.length === 0} emptyLabel="No sales in this range.">
        <ReportCard>
          <ReportSectionTitle title="Invoices" right={`${rows.length}`} />
          <ul className="divide-y divide-[#374151]">
            {rows.map((r) => {
              const color = STATUS_COLOR[r.paymentStatus] ?? 'text-[#9CA3AF] bg-[#374151]/30 border-[#374151]';
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedRow(r)}
                    className="w-full text-left px-4 py-3 hover:bg-[#111827]/60 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#111827] border border-[#374151] flex items-center justify-center shrink-0">
                        <Receipt className="w-4 h-4 text-[#9CA3AF]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          {r.invoiceNo} · {r.customerName}
                        </p>
                        <p className="text-[11px] text-[#9CA3AF] truncate">{formatDate(r.date)}</p>
                        <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wide ${color}`}>
                          {r.paymentStatus}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-white">Rs. {formatAmount(r.total, 0)}</p>
                        {r.due > 0 && <p className="text-[11px] text-[#FCA5A5]">Due Rs. {formatAmount(r.due, 0)}</p>}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </ReportCard>
      </ReportShell>

      {preview.brand && (
        <PdfPreviewModal
          open={preview.open}
          title={title}
          filename={`${title.replace(/\s+/g, '_')}_${range.from || 'all'}_${range.to || 'now'}.pdf`}
          onClose={preview.close}
          whatsAppFallbackText={`${title} · ${dateRangeLabel(range.from, range.to)}`}
        >
          <LedgerPreviewPdf
            brand={preview.brand}
            title={title}
            subtitle={dateRangeLabel(range.from, range.to)}
            partyName={`${totals.count} invoices`}
            partyMeta={isStudio ? 'Studio/custom orders' : 'All sales'}
            openingBalance={0}
            closingBalance={totals.due}
            totals={{ debit: totals.total, credit: totals.paid }}
            rows={rows.map((r) => ({
              date: r.date,
              reference: r.invoiceNo,
              description: `${r.customerName} — ${r.paymentStatus}`,
              debit: r.total,
              credit: r.paid,
              balance: r.due,
            }))}
            generatedBy={user.name || user.email || 'User'}
            generatedAt={new Date().toLocaleString('en-PK')}
          />
        </PdfPreviewModal>
      )}

      <TransactionDetailSheet
        open={!!selectedRow}
        onClose={() => setSelectedRow(null)}
        companyId={companyId}
        referenceType="sale"
        referenceId={selectedRow?.id ?? null}
        fallbackTitle={selectedRow ? `Sale · ${selectedRow.invoiceNo}` : undefined}
      />
    </div>
  );
}
