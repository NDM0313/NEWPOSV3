import { useEffect, useMemo, useState, useCallback } from 'react';
import { usePermissions } from '../../../context/PermissionContext';
import { ReportHeader } from './_shared/ReportHeader';
import { DateRangeBar, makeInitialRange, type DateRangeValue } from './_shared/DateRangeBar';
import { ReportShell, ReportCard } from './_shared/ReportShell';
import { formatAmount, dateRangeLabel, formatDate } from './_shared/format';
import { LoaderSourceBadge } from './_shared/LoaderSourceBadge';
import { loadMobileCashFlow } from '../../../api/unifiedReports';
import type { CashFlowResult } from '../../../types/unifiedReports';
import { AttachmentIndicatorButton } from '../../shared/AttachmentIndicatorButton';
import { useAttachmentPreview } from '../../../hooks/useAttachmentPreview';
import { loadRowAttachmentsLazy } from '../../../lib/roznamchaAttachments';

interface CashFlowReportProps {
  onBack: () => void;
  companyId: string | null;
  branchId?: string | null;
  reportRefreshEpoch?: number;
}

export function CashFlowReport({
  onBack,
  companyId,
  branchId,
  reportRefreshEpoch = 0,
}: CashFlowReportProps) {
  const { canViewBalances } = usePermissions();
  const [range, setRange] = useState<DateRangeValue>(() => makeInitialRange('month'));
  const [data, setData] = useState<CashFlowResult | null>(null);
  const [loaderSource, setLoaderSource] = useState<'legacy' | 'unified' | 'unavailable'>('unavailable');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { openAttachmentPreview, AttachmentPreviewPortal } = useAttachmentPreview();

  const openRowAttachments = useCallback(
    async (row: CashFlowResult['rows'][number]) => {
      if (!companyId) return;
      if (row.attachments?.length) {
        openAttachmentPreview(row.attachments, 0);
        return;
      }
      const loaded = await loadRowAttachmentsLazy(companyId, {
        sourcePaymentId: row.sourcePaymentId,
        sourceJournalEntryId: row.sourceJournalEntryId,
        referenceType: row.referenceType,
      });
      if (loaded.length) openAttachmentPreview(loaded, 0);
    },
    [companyId, openAttachmentPreview],
  );

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    loadMobileCashFlow({
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
      { label: 'Cash In', value: `Rs. ${formatAmount(data.totalCashIn, 0)}`, color: 'text-[#BBF7D0]' },
      { label: 'Cash Out', value: `Rs. ${formatAmount(data.totalCashOut, 0)}`, color: 'text-[#FCA5A5]' },
      { label: 'Closing', value: `Rs. ${formatAmount(data.closingBalance, 0)}` },
    ];
  }, [data, canViewBalances]);

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <ReportHeader
        onBack={onBack}
        title="Cash Flow"
        subtitle={dateRangeLabel(range.from, range.to)}
        stats={loading ? undefined : stats}
        rightExtras={<LoaderSourceBadge source={loaderSource} hidden={!canViewBalances} />}
      >
        <DateRangeBar value={range} onChange={setRange} />
      </ReportHeader>
      <ReportShell loading={loading} error={error} empty={!data?.rows.length && !error}>
        {data && (
          <ReportCard className="divide-y divide-[#374151]">
            {data.rows.slice(0, 100).map((r) => (
              <div key={r.id} className="px-3 py-2.5">
                <div className="flex justify-between text-sm gap-2">
                  <span className="text-[#E5E7EB] min-w-0 flex-1">
                    <span className="inline-flex items-start gap-1 max-w-full">
                      <span className="truncate">{formatDate(r.date)} · {r.reference}</span>
                      {(r.attachments?.length ?? 0) > 0 ? (
                        <AttachmentIndicatorButton
                          size="sm"
                          onClick={() => void openRowAttachments(r)}
                        />
                      ) : null}
                    </span>
                  </span>
                  {canViewBalances && (
                    <span className="text-[#9CA3AF] font-mono text-xs shrink-0">
                      {r.cashIn > 0 ? `+${formatAmount(r.cashIn, 0)}` : r.cashOut > 0 ? `-${formatAmount(r.cashOut, 0)}` : '—'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#6B7280] truncate mt-0.5">{r.details}</p>
              </div>
            ))}
          </ReportCard>
        )}
      </ReportShell>
      {AttachmentPreviewPortal}
    </div>
  );
}
