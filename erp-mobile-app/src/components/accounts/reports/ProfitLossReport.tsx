import { useEffect, useMemo, useState } from 'react';
import { usePermissions } from '../../../context/PermissionContext';
import { ReportHeader } from './_shared/ReportHeader';
import { DateRangeBar, makeInitialRange, type DateRangeValue } from './_shared/DateRangeBar';
import { ReportShell, ReportCard, ReportSectionTitle } from './_shared/ReportShell';
import { formatAmount, dateRangeLabel } from './_shared/format';
import { LoaderSourceBadge } from './_shared/LoaderSourceBadge';
import { loadMobileProfitLoss } from '../../../api/unifiedReports';
import type { ProfitLossResult } from '../../../types/unifiedReports';

interface ProfitLossReportProps {
  onBack: () => void;
  companyId: string | null;
  branchId?: string | null;
  reportRefreshEpoch?: number;
}

export function ProfitLossReport({
  onBack,
  companyId,
  branchId,
  reportRefreshEpoch = 0,
}: ProfitLossReportProps) {
  const { canViewBalances } = usePermissions();
  const [range, setRange] = useState<DateRangeValue>(() => makeInitialRange('month'));
  const [data, setData] = useState<ProfitLossResult | null>(null);
  const [loaderSource, setLoaderSource] = useState<'legacy' | 'unified' | 'unavailable'>('unavailable');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    loadMobileProfitLoss({
      companyId,
      startDate: range.from,
      endDate: range.to,
      branchId,
    }).then((res) => {
      if (cancelled) return;
      setData(res.data);
      setLoaderSource(res.loaderSource);
      setError(res.error);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId, range.from, range.to, branchId, reportRefreshEpoch]);

  const stats = useMemo(() => {
    if (!data || !canViewBalances) return [];
    return [
      { label: 'Net Profit', value: `Rs. ${formatAmount(data.netProfit, 2)}`, color: data.netProfit >= 0 ? 'text-[#BBF7D0]' : 'text-[#FCA5A5]' },
      { label: 'Revenue', value: `Rs. ${formatAmount(data.revenue.total, 2)}` },
    ];
  }, [data, canViewBalances]);

  const section = (title: string, items: { name: string; amount: number }[], total: number) => (
    <div>
      <ReportSectionTitle title={title} right={canViewBalances ? `Rs. ${formatAmount(total, 2)}` : '****'} />
      <ReportCard className="divide-y divide-[#374151]">
        {items.slice(0, 40).map((item, i) => (
          <div key={`${item.name}-${i}`} className="px-3 py-2 flex justify-between text-sm">
            <span className="text-[#E5E7EB] truncate">{item.name}</span>
            <span className="text-[#9CA3AF] font-mono text-xs shrink-0">
              {canViewBalances ? formatAmount(item.amount, 2) : '****'}
            </span>
          </div>
        ))}
      </ReportCard>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <ReportHeader
        onBack={onBack}
        title="Profit & Loss"
        subtitle={dateRangeLabel(range.from, range.to)}
        stats={loading ? undefined : stats}
        rightExtras={<LoaderSourceBadge source={loaderSource} hidden={!canViewBalances} />}
      >
        <DateRangeBar value={range} onChange={setRange} />
      </ReportHeader>
      <ReportShell loading={loading} error={error} empty={!data && !error}>
        {data && (
          <div className="space-y-4">
            {section('Revenue', data.revenue.items, data.revenue.total)}
            {section('Cost of Sales', data.costOfSales.items, data.costOfSales.total)}
            {canViewBalances && (
              <ReportCard className="px-3 py-2 text-sm text-[#E5E7EB]">
                Gross profit: Rs. {formatAmount(data.grossProfit, 2)}
              </ReportCard>
            )}
            {section('Expenses', data.expenses.items, data.expenses.total)}
          </div>
        )}
      </ReportShell>
    </div>
  );
}
