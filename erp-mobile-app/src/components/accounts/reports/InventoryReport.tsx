import { useEffect, useMemo, useState } from 'react';
import { Package, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import type { User } from '../../../types';
import { getStockMovements, type StockMovementRow } from '../../../api/reports';
import { ReportHeader } from './_shared/ReportHeader';
import { DateRangeBar, makeInitialRange, type DateRangeValue } from './_shared/DateRangeBar';
import { ReportShell, ReportCard, ReportSectionTitle } from './_shared/ReportShell';
import { formatAmount, formatDate, dateRangeLabel } from './_shared/format';
import { PdfPreviewModal } from '../../shared/PdfPreviewModal';
import { LedgerPreviewPdf } from '../../shared/LedgerPreviewPdf';
import { usePdfPreview } from '../../shared/usePdfPreview';

interface InventoryReportProps {
  onBack: () => void;
  companyId: string | null;
  user: User;
}

export function InventoryReport({ onBack, companyId, user }: InventoryReportProps) {
  const [range, setRange] = useState<DateRangeValue>(() => makeInitialRange('month'));
  const [rows, setRows] = useState<StockMovementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'in' | 'out'>('all');
  const preview = usePdfPreview(companyId);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getStockMovements(companyId, range.from || undefined, range.to || undefined).then(({ data }) => {
      if (cancelled) return;
      setRows(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId, range.from, range.to]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter === 'in') return r.quantity > 0;
      if (filter === 'out') return r.quantity < 0;
      return true;
    });
  }, [rows, filter]);

  const stats = useMemo(() => {
    const inQty = rows.filter((r) => r.quantity > 0).reduce((s, r) => s + r.quantity, 0);
    const outQty = Math.abs(rows.filter((r) => r.quantity < 0).reduce((s, r) => s + r.quantity, 0));
    const valueIn = rows.filter((r) => r.quantity > 0).reduce((s, r) => s + Math.abs(r.totalCost), 0);
    const valueOut = rows.filter((r) => r.quantity < 0).reduce((s, r) => s + Math.abs(r.totalCost), 0);
    return [
      { label: 'In units', value: formatAmount(inQty, 0), color: 'text-[#BBF7D0]' },
      { label: 'Out units', value: formatAmount(outQty, 0), color: 'text-[#FCA5A5]' },
      { label: 'In value', value: `Rs. ${formatAmount(valueIn, 0)}` },
      { label: 'Out value', value: `Rs. ${formatAmount(valueOut, 0)}` },
    ];
  }, [rows]);

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <ReportHeader
        onBack={onBack}
        title="Inventory Report"
        subtitle="Stock movements (in / out)"
        stats={stats}
        onShare={preview.openPreview}
        sharing={preview.loading}
        gradient="slate"
      >
        <DateRangeBar value={range} onChange={setRange} />
        <div className="flex gap-1.5 mt-2">
          {(['all', 'in', 'out'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === f ? 'bg-white text-[#1E293B]' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {f === 'all' ? 'All' : f === 'in' ? 'Stock in' : 'Stock out'}
            </button>
          ))}
        </div>
      </ReportHeader>

      <ReportShell loading={loading} empty={!loading && filtered.length === 0} emptyLabel="No stock movements in this range.">
        <ReportCard>
          <ReportSectionTitle title="Movements" right={`${filtered.length}`} />
          <ul className="divide-y divide-[#374151]">
            {filtered.map((r) => {
              const isIn = r.quantity > 0;
              return (
                <li key={r.id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                        isIn ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-[#EF4444]/10 text-[#EF4444]'
                      }`}
                    >
                      {isIn ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{r.productName}</p>
                      <p className="text-[11px] text-[#9CA3AF] truncate">
                        {formatDate(r.date)} · {r.movementType} · {r.referenceType}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold ${isIn ? 'text-[#10B981]' : 'text-[#EF4444]'} flex items-center gap-1 justify-end`}>
                        <Package className="w-3.5 h-3.5" />
                        {isIn ? '+' : '−'}
                        {formatAmount(Math.abs(r.quantity), 0)}
                      </p>
                      <p className="text-[11px] text-[#9CA3AF]">Rs. {formatAmount(Math.abs(r.totalCost), 0)}</p>
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
          title="Inventory Report"
          filename={`Inventory_Report_${range.from || 'all'}_${range.to || 'now'}.pdf`}
          onClose={preview.close}
          whatsAppFallbackText={`Inventory Report · ${dateRangeLabel(range.from, range.to)}`}
        >
          <LedgerPreviewPdf
            brand={preview.brand}
            title="Inventory Report"
            subtitle={dateRangeLabel(range.from, range.to)}
            partyName={`${filtered.length} movements`}
            openingBalance={0}
            closingBalance={0}
            totals={{ debit: 0, credit: 0 }}
            rows={filtered.map((r) => ({
              date: r.date,
              reference: r.movementType,
              description: `${r.productName} · ${r.referenceType}`,
              debit: r.quantity > 0 ? r.quantity : 0,
              credit: r.quantity < 0 ? Math.abs(r.quantity) : 0,
              balance: r.totalCost,
            }))}
            generatedBy={user.name || user.email || 'User'}
            generatedAt={new Date().toLocaleString('en-PK')}
          />
        </PdfPreviewModal>
      )}
    </div>
  );
}
