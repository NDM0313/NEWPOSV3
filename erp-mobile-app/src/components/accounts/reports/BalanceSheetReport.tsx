import { useEffect, useMemo, useState } from 'react';
import { usePermissions } from '../../../context/PermissionContext';
import { ReportHeader } from './_shared/ReportHeader';
import { ReportShell, ReportCard, ReportSectionTitle } from './_shared/ReportShell';
import { formatAmount } from './_shared/format';
import { LoaderSourceBadge } from './_shared/LoaderSourceBadge';
import { loadMobileBalanceSheet } from '../../../api/unifiedReports';
import type { BalanceSheetResult } from '../../../types/unifiedReports';

interface BalanceSheetReportProps {
  onBack: () => void;
  companyId: string | null;
  branchId?: string | null;
  reportRefreshEpoch?: number;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function BalanceSheetReport({
  onBack,
  companyId,
  branchId,
  reportRefreshEpoch = 0,
}: BalanceSheetReportProps) {
  const { canViewBalances } = usePermissions();
  const [asOf, setAsOf] = useState(todayIso());
  const [data, setData] = useState<BalanceSheetResult | null>(null);
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
    loadMobileBalanceSheet({ companyId, asOfDate: asOf, branchId }).then((res) => {
      if (cancelled) return;
      setData(res.data);
      setLoaderSource(res.loaderSource);
      setError(res.error);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId, asOf, branchId, reportRefreshEpoch]);

  const stats = useMemo(() => {
    if (!data || !canViewBalances) return [];
    return [
      { label: 'Total Assets', value: `Rs. ${formatAmount(data.totalAssets, 2)}` },
      { label: 'L+E', value: `Rs. ${formatAmount(data.totalLiabilitiesAndEquity, 2)}` },
    ];
  }, [data, canViewBalances]);

  const renderSection = (
    title: string,
    items: { name: string; amount: number; code?: string }[],
    total: number,
  ) => (
    <div>
      <ReportSectionTitle title={title} right={canViewBalances ? `Rs. ${formatAmount(total, 2)}` : '****'} />
      <ReportCard className="divide-y divide-[#374151]">
        {items.slice(0, 50).map((item, i) => (
          <div key={`${item.code}-${i}`} className="px-3 py-2.5 flex justify-between gap-2 text-sm">
            <span className="text-[#E5E7EB] truncate">{item.name}</span>
            <span className="text-[#9CA3AF] shrink-0 font-mono text-xs">
              {canViewBalances ? formatAmount(item.amount, 2) : '****'}
            </span>
          </div>
        ))}
        {items.length > 50 && (
          <p className="px-3 py-2 text-xs text-[#6B7280]">+{items.length - 50} more lines</p>
        )}
      </ReportCard>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <ReportHeader
        onBack={onBack}
        title="Balance Sheet"
        subtitle={`As of ${asOf}`}
        stats={loading ? undefined : stats}
        rightExtras={<LoaderSourceBadge source={loaderSource} hidden={!canViewBalances} />}
      />
      <div className="px-4 pb-2">
        <label className="text-xs text-[#9CA3AF] block mb-1">As of date</label>
        <input
          type="date"
          value={asOf}
          onChange={(e) => setAsOf(e.target.value)}
          className="w-full bg-[#1F2937] border border-[#374151] rounded-lg px-3 py-2 text-sm text-white"
        />
      </div>
      <ReportShell loading={loading} error={error} empty={!data && !error} emptyLabel="No balance sheet data.">
        {data && (
          <div className="space-y-4">
            {renderSection('Assets', data.assets.items, data.assets.total)}
            {renderSection('Liabilities', data.liabilities.items, data.liabilities.total)}
            {renderSection('Equity', data.equity.items, data.equity.total)}
          </div>
        )}
      </ReportShell>
    </div>
  );
}
