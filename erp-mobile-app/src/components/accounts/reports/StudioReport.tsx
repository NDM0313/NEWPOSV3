import { useEffect, useMemo, useState } from 'react';
import { Palette, Package } from 'lucide-react';
import type { User } from '../../../types';
import { getStudioProductions, type StudioProductionRow } from '../../../api/reports';
import { ReportHeader } from './_shared/ReportHeader';
import { DateRangeBar, makeInitialRange, type DateRangeValue } from './_shared/DateRangeBar';
import { ReportShell, ReportCard, ReportSectionTitle } from './_shared/ReportShell';
import { formatAmount, formatDate, dateRangeLabel } from './_shared/format';
import { PdfPreviewModal } from '../../shared/PdfPreviewModal';
import { LedgerPreviewPdf } from '../../shared/LedgerPreviewPdf';
import { usePdfPreview } from '../../shared/usePdfPreview';

interface StudioReportProps {
  onBack: () => void;
  companyId: string | null;
  user: User;
}

const STATUS_COLOR: Record<string, string> = {
  completed: 'text-[#10B981] bg-[#10B981]/10 border-[#10B981]/40',
  delivered: 'text-[#10B981] bg-[#10B981]/10 border-[#10B981]/40',
  in_progress: 'text-[#3B82F6] bg-[#3B82F6]/10 border-[#3B82F6]/40',
  pending: 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/40',
  cancelled: 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/40',
};

export function StudioReport({ onBack, companyId, user }: StudioReportProps) {
  const [range, setRange] = useState<DateRangeValue>(() => makeInitialRange('month'));
  const [rows, setRows] = useState<StudioProductionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const preview = usePdfPreview(companyId);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getStudioProductions(companyId, range.from || undefined, range.to || undefined).then(({ data }) => {
      if (cancelled) return;
      setRows(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId, range.from, range.to]);

  const stats = useMemo(() => {
    const totalQty = rows.reduce((s, r) => s + r.quantity, 0);
    const completed = rows.filter((r) => r.status === 'completed' || r.status === 'delivered').length;
    return [
      { label: 'Orders', value: String(rows.length) },
      { label: 'Units', value: formatAmount(totalQty, 0) },
      { label: 'Completed', value: String(completed) },
    ];
  }, [rows]);

  const totalQty = useMemo(() => rows.reduce((s, r) => s + r.quantity, 0), [rows]);

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <ReportHeader
        onBack={onBack}
        title="Studio Report"
        subtitle="Custom productions & artisan work"
        stats={stats}
        onShare={preview.openPreview}
        sharing={preview.loading}
        gradient="indigo"
      >
        <DateRangeBar value={range} onChange={setRange} />
      </ReportHeader>

      <ReportShell loading={loading} empty={!loading && rows.length === 0} emptyLabel="No studio productions in this range.">
        <ReportCard>
          <ReportSectionTitle title="Productions" right={`${rows.length}`} />
          <ul className="divide-y divide-[#374151]">
            {rows.map((r) => {
              const color = STATUS_COLOR[r.status] ?? 'text-[#9CA3AF] bg-[#374151]/30 border-[#374151]';
              return (
                <li key={r.id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#111827] border border-[#374151] flex items-center justify-center shrink-0">
                      <Palette className="w-4 h-4 text-[#9CA3AF]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {r.productionNo} · {r.productName}
                      </p>
                      <p className="text-[11px] text-[#9CA3AF] truncate">
                        {formatDate(r.date)} · {r.customerName || 'Stock'} {r.invoiceNo ? `· ${r.invoiceNo}` : ''}
                      </p>
                      <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wide ${color}`}>
                        {r.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-right shrink-0 flex items-center gap-1">
                      <Package className="w-3.5 h-3.5 text-[#6B7280]" />
                      <p className="text-sm font-bold text-white">{formatAmount(r.quantity, 0)}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </ReportCard>
      </ReportShell>

      {preview.brand && (
        <PdfPreviewModal
          open={preview.open}
          title="Studio Report"
          filename={`Studio_Report_${range.from || 'all'}_${range.to || 'now'}.pdf`}
          onClose={preview.close}
          whatsAppFallbackText={`Studio Report · ${dateRangeLabel(range.from, range.to)}`}
        >
          <LedgerPreviewPdf
            brand={preview.brand}
            title="Studio Report"
            subtitle={dateRangeLabel(range.from, range.to)}
            partyName={`${rows.length} productions`}
            openingBalance={0}
            closingBalance={totalQty}
            totals={{ debit: totalQty, credit: 0 }}
            rows={rows.map((r) => ({
              date: r.date,
              reference: r.productionNo,
              description: `${r.productName} — ${r.customerName || 'Stock'} — ${r.status}`,
              debit: r.quantity,
              credit: 0,
              balance: r.quantity,
            }))}
            generatedBy={user.name || user.email || 'User'}
            generatedAt={new Date().toLocaleString('en-PK')}
          />
        </PdfPreviewModal>
      )}
    </div>
  );
}
