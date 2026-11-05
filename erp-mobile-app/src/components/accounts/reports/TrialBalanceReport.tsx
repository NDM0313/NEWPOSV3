import { useEffect, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { usePermissions } from '../../../context/PermissionContext';
import { ReportHeader } from './_shared/ReportHeader';
import { DateRangeBar, makeInitialRange, type DateRangeValue } from './_shared/DateRangeBar';
import { ReportShell, ReportCard, ReportSectionTitle } from './_shared/ReportShell';
import { formatAmount, dateRangeLabel } from './_shared/format';
import { LoaderSourceBadge } from './_shared/LoaderSourceBadge';
import { loadMobileTrialBalance } from '../../../api/unifiedReports';
import type { TrialBalanceResult, TrialBalanceRow } from '../../../types/unifiedReports';

interface TrialBalanceReportProps {
  onBack: () => void;
  companyId: string | null;
  branchId?: string | null;
  reportRefreshEpoch?: number;
  onViewLedger?: (accountId: string) => void;
}

function TrialBalanceListRow({
  row,
  canViewBalances,
  onViewLedger,
}: {
  row: TrialBalanceRow;
  canViewBalances: boolean;
  onViewLedger?: (accountId: string) => void;
}) {
  const showDrCr = canViewBalances && (row.debit !== 0 || row.credit !== 0);
  const balanceColor = row.balance >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]';

  const inner = (
    <div className="flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">
          {row.account_code ? (
            <span className="font-mono text-[11px] text-[#9CA3AF] mr-2">{row.account_code}</span>
          ) : null}
          {row.account_name}
        </p>
        {showDrCr ? (
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
            <p className="text-[11px] text-[#BBF7D0]">Debit Rs. {formatAmount(row.debit, 0)}</p>
            <p className="text-[11px] text-[#FCA5A5]">Credit Rs. {formatAmount(row.credit, 0)}</p>
          </div>
        ) : !canViewBalances ? (
          <p className="mt-1 text-[11px] text-[#6B7280]">—</p>
        ) : null}
      </div>
      <div className="text-right shrink-0">
        <p className={`text-sm font-bold ${canViewBalances ? balanceColor : 'text-[#9CA3AF]'}`}>
          {canViewBalances ? `Rs. ${formatAmount(row.balance, 0)}` : '****'}
        </p>
        <p className="text-[10px] text-[#9CA3AF]">Current</p>
      </div>
      {onViewLedger ? <ChevronRight className="w-4 h-4 text-[#6B7280] shrink-0 self-center" /> : null}
    </div>
  );

  if (onViewLedger) {
    return (
      <li>
        <button
          type="button"
          onClick={() => onViewLedger(row.account_id)}
          className="w-full px-4 py-3 text-left hover:bg-[#243044] transition-colors"
        >
          {inner}
        </button>
      </li>
    );
  }

  return <li className="px-4 py-3">{inner}</li>;
}

export function TrialBalanceReport({
  onBack,
  companyId,
  branchId,
  reportRefreshEpoch = 0,
  onViewLedger,
}: TrialBalanceReportProps) {
  const { canViewBalances } = usePermissions();
  const [range, setRange] = useState<DateRangeValue>(() => makeInitialRange());
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

  const rows = data?.rows.slice(0, 80) ?? [];

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <ReportHeader
        onBack={onBack}
        title="Trial Balance"
        subtitle={dateRangeLabel(range.from, range.to)}
        stats={loading ? undefined : stats}
        rightExtras={<LoaderSourceBadge source={loaderSource} hidden={!canViewBalances} />}
      >
        <DateRangeBar value={range} onChange={setRange} companyId={companyId} branchId={branchId} />
      </ReportHeader>
      <ReportShell loading={loading} error={error} empty={!data?.rows.length && !error}>
        {data && (
          <ReportCard className="overflow-hidden">
            <ReportSectionTitle title="Accounts" right={`${rows.length}`} />
            <ul className="divide-y divide-[#374151]">
              {rows.map((r) => (
                <TrialBalanceListRow
                  key={r.account_id}
                  row={r}
                  canViewBalances={canViewBalances}
                  onViewLedger={onViewLedger}
                />
              ))}
            </ul>
            {canViewBalances && (
              <div className="border-t border-[#374151] px-4 py-3 bg-[#111827]/40">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF] mb-2">Totals</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-[10px] text-[#6B7280]">Debit</p>
                    <p className="font-mono text-[#BBF7D0]">Rs. {formatAmount(data.totalDebit, 0)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#6B7280]">Credit</p>
                    <p className="font-mono text-[#FCA5A5]">Rs. {formatAmount(data.totalCredit, 0)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#6B7280]">Difference</p>
                    <p
                      className={`font-mono font-semibold ${
                        data.difference === 0 ? 'text-[#BBF7D0]' : 'text-[#FCA5A5]'
                      }`}
                    >
                      Rs. {formatAmount(data.difference, 0)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </ReportCard>
        )}
      </ReportShell>
    </div>
  );
}
