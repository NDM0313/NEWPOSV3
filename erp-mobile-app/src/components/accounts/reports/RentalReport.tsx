import { useEffect, useMemo, useState } from 'react';
import { Shirt } from 'lucide-react';
import type { User } from '../../../types';
import { getRentalsInRange, type RentalReportRow } from '../../../api/reports';
import { ReportHeader } from './_shared/ReportHeader';
import { DateRangeBar, makeInitialRange, type DateRangeValue } from './_shared/DateRangeBar';
import { ReportShell, ReportCard, ReportSectionTitle } from './_shared/ReportShell';
import { formatAmount, formatDate, dateRangeLabel } from './_shared/format';
import { PdfPreviewModal } from '../../shared/PdfPreviewModal';
import { LedgerPreviewPdf } from '../../shared/LedgerPreviewPdf';
import { usePdfPreview } from '../../shared/usePdfPreview';
import { TransactionDetailSheet } from './_shared/TransactionDetailSheet';

interface RentalReportProps {
  onBack: () => void;
  companyId: string | null;
  user: User;
}

const STATUS_COLOR: Record<string, string> = {
  booked: 'text-[#3B82F6] bg-[#3B82F6]/10 border-[#3B82F6]/40',
  picked_up: 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/40',
  active: 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/40',
  rented: 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/40',
  returned: 'text-[#10B981] bg-[#10B981]/10 border-[#10B981]/40',
  closed: 'text-[#10B981] bg-[#10B981]/10 border-[#10B981]/40',
  overdue: 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/40',
  cancelled: 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/40',
};

export function RentalReport({ onBack, companyId, user }: RentalReportProps) {
  const [range, setRange] = useState<DateRangeValue>(() => makeInitialRange('month'));
  const [rows, setRows] = useState<RentalReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRow, setSelectedRow] = useState<RentalReportRow | null>(null);
  const preview = usePdfPreview(companyId);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getRentalsInRange(companyId, range.from || undefined, range.to || undefined).then(({ data }) => {
      if (cancelled) return;
      setRows(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId, range.from, range.to]);

  const totals = useMemo(() => {
    const total = rows.reduce((s, r) => s + r.total, 0);
    const paid = rows.reduce((s, r) => s + r.paid, 0);
    const due = rows.reduce((s, r) => s + r.due, 0);
    const penalty = rows.reduce((s, r) => s + r.penaltyAmount + r.damageAmount, 0);
    return { total, paid, due, penalty, count: rows.length };
  }, [rows]);

  const stats = [
    { label: 'Bookings', value: String(totals.count) },
    { label: 'Total', value: `Rs. ${formatAmount(totals.total, 0)}` },
    { label: 'Paid', value: `Rs. ${formatAmount(totals.paid, 0)}`, color: 'text-[#BBF7D0]' },
    { label: 'Due', value: `Rs. ${formatAmount(totals.due, 0)}`, color: 'text-[#FCA5A5]' },
  ];

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <ReportHeader
        onBack={onBack}
        title="Rental Report"
        subtitle="Bookings · pickup / return / payments"
        stats={stats}
        onShare={preview.openPreview}
        sharing={preview.loading}
        gradient="amber"
      >
        <DateRangeBar value={range} onChange={setRange} />
      </ReportHeader>

      <ReportShell loading={loading} empty={!loading && rows.length === 0} emptyLabel="No rental bookings in this range.">
        <ReportCard>
          <ReportSectionTitle title="Bookings" right={`${rows.length}`} />
          <ul className="divide-y divide-[#374151]">
            {rows.map((r) => {
              const color = STATUS_COLOR[r.status] ?? 'text-[#9CA3AF] bg-[#374151]/30 border-[#374151]';
              const penaltyTotal = r.penaltyAmount + r.damageAmount;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedRow(r)}
                    className="w-full text-left px-4 py-3 hover:bg-[#111827]/60 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#111827] border border-[#374151] flex items-center justify-center shrink-0">
                        <Shirt className="w-4 h-4 text-[#9CA3AF]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          {r.bookingNo} · {r.customerName}
                        </p>
                        <p className="text-[11px] text-[#9CA3AF] truncate">
                          {r.pickupDate ? `Pickup ${formatDate(r.pickupDate)}` : formatDate(r.date)}
                          {r.returnDate ? ` → ${formatDate(r.returnDate)}` : ''}
                          {r.actualReturnDate ? ` · Returned ${formatDate(r.actualReturnDate)}` : ''}
                        </p>
                        {r.itemsSummary && (
                          <p className="text-[11px] text-[#6B7280] truncate">{r.itemsSummary}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wide ${color}`}>
                            {r.status.replace('_', ' ')}
                          </span>
                          {r.itemCount > 0 && (
                            <span className="text-[10px] text-[#9CA3AF]">{r.itemCount} item{r.itemCount === 1 ? '' : 's'}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0 space-y-0.5">
                        <p className="text-sm font-bold text-white">Rs. {formatAmount(r.total, 0)}</p>
                        {r.due > 0 && <p className="text-[11px] text-[#FCA5A5]">Due Rs. {formatAmount(r.due, 0)}</p>}
                        {penaltyTotal > 0 && (
                          <p className="text-[11px] text-[#F59E0B]">Penalty Rs. {formatAmount(penaltyTotal, 0)}</p>
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
          title="Rental Report"
          filename={`Rental_Report_${range.from || 'all'}_${range.to || 'now'}.pdf`}
          onClose={preview.close}
          whatsAppFallbackText={`Rental Report · ${dateRangeLabel(range.from, range.to)}`}
        >
          <LedgerPreviewPdf
            brand={preview.brand}
            title="Rental Report"
            subtitle={dateRangeLabel(range.from, range.to)}
            partyName={`${totals.count} bookings`}
            partyMeta={`Paid: Rs. ${formatAmount(totals.paid, 0)} · Due: Rs. ${formatAmount(totals.due, 0)}`}
            openingBalance={0}
            closingBalance={totals.due}
            totals={{ debit: totals.total, credit: totals.paid }}
            rows={rows.map((r) => ({
              date: r.date,
              reference: r.bookingNo,
              description: `${r.customerName} — ${r.status}${r.itemsSummary ? ` · ${r.itemsSummary}` : ''}`,
              debit: r.total,
              credit: r.paid,
              balance: r.due,
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
          referenceType="rental"
          referenceId={selectedRow.id}
          fallbackTitle={`Rental · ${selectedRow.bookingNo}`}
        />
      )}
    </div>
  );
}
