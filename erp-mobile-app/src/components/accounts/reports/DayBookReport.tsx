import { useEffect, useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import type { User } from '../../../types';
import { getDayBook, type DayBookJournalEntry } from '../../../api/reports';
import { ReportHeader } from './_shared/ReportHeader';
import { DateRangeBar, makeInitialRange, type DateRangeValue } from './_shared/DateRangeBar';
import { ReportShell, ReportCard } from './_shared/ReportShell';
import { formatAmount, formatDate, dateRangeLabel } from './_shared/format';
import { PdfPreviewModal } from '../../shared/PdfPreviewModal';
import { TimelinePreviewPdf } from '../../shared/TimelinePreviewPdf';
import { usePdfPreview } from '../../shared/usePdfPreview';

interface DayBookReportProps {
  onBack: () => void;
  companyId: string | null;
  branchId?: string | null;
  user: User;
}

export function DayBookReport({ onBack, companyId, branchId, user }: DayBookReportProps) {
  const [range, setRange] = useState<DateRangeValue>(() => makeInitialRange('today'));
  const [entries, setEntries] = useState<DayBookJournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const preview = usePdfPreview(companyId);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const from = range.from || '1970-01-01';
    const to = range.to || new Date().toISOString().slice(0, 10);
    getDayBook(companyId, from, to, branchId ?? null).then(({ data, error }) => {
      if (cancelled) return;
      setEntries(data);
      setError(error);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId, branchId, range.from, range.to]);

  const groups = useMemo(() => {
    const map = new Map<string, DayBookJournalEntry[]>();
    for (const e of entries) {
      const key = e.date;
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [entries]);

  const totals = useMemo(() => {
    const debit = entries.reduce((s, e) => s + e.debit, 0);
    const credit = entries.reduce((s, e) => s + e.credit, 0);
    return { debit, credit, count: entries.length };
  }, [entries]);

  const pdfGroups = useMemo(
    () =>
      groups.map(([date, rows]) => ({
        date: formatDate(date),
        rows: rows.map((e) => ({
          time: new Date(e.createdAt).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' }),
          party: e.description || e.referenceType || '—',
          reference: e.entryNo,
          fromAccount: e.lines.find((l) => l.credit > 0)?.accountName,
          toAccount: e.lines.find((l) => l.debit > 0)?.accountName,
          amount: Math.max(e.debit, e.credit),
          direction: 'in' as const,
        })),
      })),
    [groups],
  );

  const stats = [
    { label: 'Entries', value: String(totals.count) },
    { label: 'Total Dr', value: `Rs. ${formatAmount(totals.debit, 0)}`, color: 'text-[#FDE68A]' },
    { label: 'Total Cr', value: `Rs. ${formatAmount(totals.credit, 0)}`, color: 'text-[#BBF7D0]' },
  ];

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <ReportHeader
        onBack={onBack}
        title="Day Book"
        subtitle="All journal entries, chronological"
        stats={stats}
        onShare={preview.openPreview}
        sharing={preview.loading}
      >
        <DateRangeBar value={range} onChange={setRange} />
      </ReportHeader>

      <ReportShell loading={loading} error={error} empty={!loading && entries.length === 0} emptyLabel="No journal entries in this range.">
        <div className="space-y-4">
          {groups.map(([date, rows]) => (
            <div key={date}>
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-xs font-semibold text-white uppercase tracking-wide">{formatDate(date)}</p>
                <p className="text-[10px] text-[#9CA3AF]">{rows.length} entries</p>
              </div>
              <ReportCard>
                <ul className="divide-y divide-[#374151]">
                  {rows.map((e) => (
                    <li key={e.id} className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[#111827] border border-[#374151] flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-[#9CA3AF]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{e.description || e.referenceType || '—'}</p>
                          <p className="text-[11px] text-[#9CA3AF] truncate">
                            {e.entryNo} · {e.referenceType || 'journal'}
                          </p>
                          <div className="mt-1 grid grid-cols-1 gap-0.5">
                            {e.lines.slice(0, 4).map((l, i) => (
                              <p key={i} className="text-[11px] text-[#6B7280] truncate">
                                {l.debit > 0 ? (
                                  <span>
                                    <span className="text-[#F59E0B]">Dr</span> {l.accountName}
                                  </span>
                                ) : (
                                  <span>
                                    <span className="text-[#10B981] ml-3">Cr</span> {l.accountName}
                                  </span>
                                )}{' '}
                                · Rs. {formatAmount(Math.max(l.debit, l.credit), 0)}
                              </p>
                            ))}
                            {e.lines.length > 4 && (
                              <p className="text-[10px] text-[#6B7280]">+ {e.lines.length - 4} more</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-white">Rs. {formatAmount(Math.max(e.debit, e.credit), 0)}</p>
                          <p className="text-[10px] text-[#9CA3AF]">
                            {new Date(e.createdAt).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </ReportCard>
            </div>
          ))}
        </div>
      </ReportShell>

      {preview.brand && (
        <PdfPreviewModal
          open={preview.open}
          title="Day Book"
          filename={`DayBook_${range.from || 'all'}_${range.to || 'now'}.pdf`}
          onClose={preview.close}
          whatsAppFallbackText={`Day Book · ${dateRangeLabel(range.from, range.to)}`}
        >
          <TimelinePreviewPdf
            brand={preview.brand}
            title="Day Book"
            subtitle={dateRangeLabel(range.from, range.to)}
            totals={{ inAmount: totals.credit, outAmount: totals.debit, net: totals.debit - totals.credit, count: totals.count }}
            groups={pdfGroups}
            generatedBy={user.name || user.email || 'User'}
            generatedAt={new Date().toLocaleString('en-PK')}
          />
        </PdfPreviewModal>
      )}
    </div>
  );
}

