import { useEffect, useMemo, useState } from 'react';
import { usePermissions } from '../../../context/PermissionContext';
import { ReportHeader } from './_shared/ReportHeader';
import { DateRangeBar, makeInitialRange, type DateRangeValue } from './_shared/DateRangeBar';
import { ReportShell, ReportCard } from './_shared/ReportShell';
import { formatAmount, dateRangeLabel } from './_shared/format';
import { LoaderSourceBadge } from './_shared/LoaderSourceBadge';
import { loadMobileTrialBalance } from '../../../api/unifiedReports';
import type { TrialBalanceResult } from '../../../types/unifiedReports';

interface TrialBalanceReportProps {
  onBack: () => void;
  companyId: string | null;
  branchId?: string | null;
  reportRefreshEpoch?: number;
}

export function TrialBalanceReport({
  onBack,
  companyId,
  branchId,
  reportRefreshEpoch = 0,
}: TrialBalanceReportProps) {
  const { canViewBalances } = usePermissions();
  const [range, setRange] = useState<DateRangeValue>(() => makeInitialRange('month'));
  const [data, setData] = useState<TrialBalanceResult | null>(null);
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
    loadMobileTrialBalance({
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
      { label: 'Debit', value: `Rs. ${formatAmount(data.totalDebit, 2)}` },
      { label: 'Credit', value: `Rs. ${formatAmount(data.totalCredit, 2)}` },
      {
        label: 'Diff',
        value: `Rs. ${formatAmount(data.difference, 2)}`,
        color: data.difference === 0 ? 'text-[#BBF7D0]' : 'text-[#FCA5A5]',
      },
    ];
  }, [data, canViewBalances]);

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <ReportHeader
        onBack={onBack}
        title="Trial Balance"
        subtitle={dateRangeLabel(range.from, range.to)}
        stats={loading ? undefined : stats}
        rightExtras={<LoaderSourceBadge source={loaderSource} hidden={!canViewBalances} />}
      >
        <DateRangeBar value={range} onChange={setRange} />
      </ReportHeader>
      <ReportShell loading={loading} error={error} empty={!data?.rows.length && !error}>
        {data && (
          <ReportCard className="overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-3 py-2 text-[10px] uppercase text-[#6B7280] border-b border-[#374151]">
              <span>Account</span>
              <span>Dr</span>
              <span>Cr</span>
              <span>Bal</span>
            </div>
            {data.rows.slice(0, 80).map((r) => (
              <div
                key={r.account_id}
                className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-3 py-2 text-xs border-b border-[#374151]/60"
              >
                <span className="text-[#E5E7EB] truncate">{r.account_name}</span>
                <span className="text-[#9CA3AF] font-mono">{canViewBalances ? formatAmount(r.debit, 0) : '****'}</span>
                <span className="text-[#9CA3AF] font-mono">{canViewBalances ? formatAmount(r.credit, 0) : '****'}</span>
                <span className="text-[#9CA3AF] font-mono">{canViewBalances ? formatAmount(r.balance, 0) : '****'}</span>
              </div>
            ))}
          </ReportCard>
        )}
      </ReportShell>
    </div>
  );
}
