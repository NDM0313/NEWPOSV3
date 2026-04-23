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
import { TransactionDetailSheet } from './_shared/TransactionDetailSheet';

interface StudioReportProps {
  onBack: () => void;
  companyId: string | null;
  user: User;
}

const STATUS_COLOR: Record<string, string> = {
  completed: 'text-[#10B981] bg-[#10B981]/10 border-[#10B981]/40',
  delivered: 'text-[#10B981] bg-[#10B981]/10 border-[#10B981]/40',
  in_progress: 'text-[#3B82F6] bg-[#3B82F6]/10 border-[#3B82F6]/40',
  draft: 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/40',
  pending: 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/40',
  cancelled: 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/40',
};

export function StudioReport({ onBack, companyId, user }: StudioReportProps) {
  const [range, setRange] = useState<DateRangeValue>(() => makeInitialRange('month'));
  const [rows, setRows] = useState<StudioProductionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<StudioProductionRow | null>(null);
  const preview = usePdfPreview(companyId);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getStudioProductions(companyId, range.from || undefined, range.to || undefined).then(({ data, error }) => {
      if (cancelled) return;
      setRows(data);
      setError(error);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId, range.from, range.to]);

  const totals = useMemo(() => {
    const units = rows.reduce((s, r) => s + r.quantity, 0);
    const cost = rows.reduce((s, r) => s + r.workerCost, 0);
    const charge = rows.reduce((s, r) => s + r.customerCharge, 0);
    const completed = rows.filter((r) => r.status === 'completed' || r.status === 'delivered').length;
    return { units, cost, charge, profit: charge - cost, completed };
  }, [rows]);

  const stats = [
    { label: 'Orders', value: String(rows.length) },
    { label: 'Units', value: formatAmount(totals.units, 0) },
    { label: 'Worker cost', value: `Rs. ${formatAmount(totals.cost, 0)}`, color: 'text-[#FCA5A5]' },
    { label: 'Profit', value: `Rs. ${formatAmount(totals.profit, 0)}`, color: 'text-[#BBF7D0]' },
  ];

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <ReportHeader
        onBack={onBack}
        title="Studio Report"
        subtitle="Custom productions · cost + profit"
        stats={stats}
        onShare={preview.openPreview}
        sharing={preview.loading}
        gradient="indigo"
      >
        <DateRangeBar value={range} onChange={setRange} />
      </ReportHeader>

      <ReportShell
        loading={loading}
        error={error}
        empty={!loading && !error && rows.length === 0}
        emptyLabel="No studio productions in this range."
      >
        <ReportCard>
          <ReportSectionTitle title="Productions" right={`${rows.length}`} />
          <ul className="divide-y divide-[#374151]">
            {rows.map((r) => {
              const color = STATUS_COLOR[r.status] ?? 'text-[#9CA3AF] bg-[#374151]/30 border-[#374151]';
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedRow(r)}
                    className="w-full text-left px-4 py-3 hover:bg-[#111827]/60 transition-colors"
                  >
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
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wide ${color}`}>
                            {r.status.replace('_', ' ')}
                          </span>
                          {r.stageCount > 0 && (
                            <span className="text-[10px] text-[#9CA3AF]">
                              {r.stagesCompleted}/{r.stageCount} stages
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0 space-y-0.5">
                        <div className="flex items-center justify-end gap-1">
                          <Package className="w-3.5 h-3.5 text-[#6B7280]" />
                          <p className="text-sm font-bold text-white">{formatAmount(r.quantity, 0)}</p>
                        </div>
                        {r.customerCharge > 0 && (
                          <p className="text-[11px] text-[#BBF7D0]">Rs. {formatAmount(r.customerCharge, 0)}</p>
                        )}
                        {r.workerCost > 0 && (
                          <p className="text-[11px] text-[#FCA5A5]">Cost Rs. {formatAmount(r.workerCost, 0)}</p>
                        )}
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
            partyMeta={`Units: ${formatAmount(totals.units, 0)} · Profit: Rs. ${formatAmount(totals.profit, 0)}`}
            openingBalance={0}
            closingBalance={totals.profit}
            totals={{ debit: totals.charge, credit: totals.cost }}
            rows={rows.map((r) => ({
              date: r.date,
              reference: r.productionNo,
              description: `${r.productName} — ${r.customerName || 'Stock'} — ${r.status} (${r.stagesCompleted}/${r.stageCount})`,
              debit: r.customerCharge,
              credit: r.workerCost,
              balance: r.profit,
            }))}
            generatedBy={user.name || user.email || 'User'}
            generatedAt={new Date().toLocaleString('en-PK')}
          />
        </PdfPreviewModal>
      )}

      {selectedRow && (
        <TransactionDetailSheet
          open
          onClose={() => setSelectedRow(null)}
          companyId={companyId}
          referenceType={selectedRow.saleId ? 'sale' : 'studio'}
          referenceId={selectedRow.saleId ?? selectedRow.id}
          fallbackTitle={`Studio · ${selectedRow.productionNo}`}
        />
      )}
    </div>
  );
}
