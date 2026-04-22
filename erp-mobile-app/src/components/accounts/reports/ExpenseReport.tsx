import { useEffect, useMemo, useState } from 'react';
import { TrendingDown } from 'lucide-react';
import type { User } from '../../../types';
import { getExpensesInRange, type ExpenseReportRow } from '../../../api/reports';
import { ReportHeader } from './_shared/ReportHeader';
import { DateRangeBar, makeInitialRange, type DateRangeValue } from './_shared/DateRangeBar';
import { ReportShell, ReportCard, ReportSectionTitle } from './_shared/ReportShell';
import { formatAmount, formatDate, dateRangeLabel } from './_shared/format';
import { PdfPreviewModal } from '../../shared/PdfPreviewModal';
import { LedgerPreviewPdf } from '../../shared/LedgerPreviewPdf';
import { usePdfPreview } from '../../shared/usePdfPreview';

interface ExpenseReportProps {
  onBack: () => void;
  companyId: string | null;
  branchId?: string | null;
  user: User;
}

export function ExpenseReport({ onBack, companyId, branchId, user }: ExpenseReportProps) {
  const [range, setRange] = useState<DateRangeValue>(() => makeInitialRange('month'));
  const [rows, setRows] = useState<ExpenseReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>('all');
  const preview = usePdfPreview(companyId);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getExpensesInRange(companyId, range.from || undefined, range.to || undefined, branchId ?? null).then(({ data }) => {
      if (cancelled) return;
      setRows(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId, branchId, range.from, range.to]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r.category));
    return Array.from(set);
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (category === 'all') return rows;
    return rows.filter((r) => r.category === category);
  }, [rows, category]);

  const totals = useMemo(() => {
    const sum = filteredRows.reduce((s, r) => s + r.amount, 0);
    const byCat: Record<string, number> = {};
    filteredRows.forEach((r) => {
      byCat[r.category] = (byCat[r.category] || 0) + r.amount;
    });
    return { sum, count: filteredRows.length, byCat };
  }, [filteredRows]);

  const stats = [
    { label: 'Count', value: String(totals.count) },
    { label: 'Total', value: `Rs. ${formatAmount(totals.sum, 0)}`, color: 'text-[#FCA5A5]' },
    { label: 'Categories', value: String(categories.length) },
  ];

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <ReportHeader
        onBack={onBack}
        title="Expense Report"
        subtitle="Operating expenses by category"
        stats={stats}
        onShare={preview.openPreview}
        sharing={preview.loading}
        gradient="rose"
      >
        <DateRangeBar value={range} onChange={setRange} />
        {categories.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 mt-2">
            <button
              onClick={() => setCategory('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                category === 'all' ? 'bg-white text-[#E11D48]' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  category === c ? 'bg-white text-[#E11D48]' : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </ReportHeader>

      <ReportShell loading={loading} empty={!loading && filteredRows.length === 0} emptyLabel="No expenses in this range.">
        {Object.keys(totals.byCat).length > 1 && category === 'all' && (
          <ReportCard>
            <ReportSectionTitle title="By category" />
            <ul className="divide-y divide-[#374151]">
              {Object.entries(totals.byCat)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, amt]) => (
                  <li key={cat} className="px-4 py-2.5 flex items-center justify-between">
                    <span className="text-sm text-white">{cat}</span>
                    <span className="text-sm font-bold text-[#FCA5A5]">Rs. {formatAmount(amt, 0)}</span>
                  </li>
                ))}
            </ul>
          </ReportCard>
        )}

        <ReportCard>
          <ReportSectionTitle title="Expenses" right={`${filteredRows.length}`} />
          <ul className="divide-y divide-[#374151]">
            {filteredRows.map((r) => (
              <li key={r.id} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#111827] border border-[#374151] flex items-center justify-center shrink-0">
                    <TrendingDown className="w-4 h-4 text-[#FCA5A5]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {r.expenseNo} · {r.category}
                    </p>
                    <p className="text-[11px] text-[#9CA3AF] truncate">
                      {formatDate(r.date)} · {r.method || 'cash'}
                    </p>
                    {r.description && <p className="text-[11px] text-[#6B7280] truncate mt-0.5">{r.description}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-[#FCA5A5]">− Rs. {formatAmount(r.amount, 0)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </ReportCard>
      </ReportShell>

      {preview.brand && (
        <PdfPreviewModal
          open={preview.open}
          title="Expense Report"
          filename={`Expense_Report_${range.from || 'all'}_${range.to || 'now'}.pdf`}
          onClose={preview.close}
          whatsAppFallbackText={`Expense Report · ${dateRangeLabel(range.from, range.to)}`}
        >
          <LedgerPreviewPdf
            brand={preview.brand}
            title="Expense Report"
            subtitle={dateRangeLabel(range.from, range.to)}
            partyName={`${totals.count} expenses`}
            partyMeta={category === 'all' ? 'All categories' : category}
            openingBalance={0}
            closingBalance={totals.sum}
            totals={{ debit: totals.sum, credit: 0 }}
            rows={filteredRows.map((r) => ({
              date: r.date,
              reference: r.expenseNo,
              description: `${r.category} — ${r.description || r.method}`,
              debit: r.amount,
              credit: 0,
              balance: r.amount,
            }))}
            generatedBy={user.name || user.email || 'User'}
            generatedAt={new Date().toLocaleString('en-PK')}
          />
        </PdfPreviewModal>
      )}
    </div>
  );
}
