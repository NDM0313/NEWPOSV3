import { useEffect, useMemo, useState } from 'react';
import type { User } from '../../../types';
import { usePermissions } from '../../../context/PermissionContext';
import { ReportHeader } from './_shared/ReportHeader';
import { DateRangeBar, makeInitialRange, type DateRangeValue } from './_shared/DateRangeBar';
import { ReportShell } from './_shared/ReportShell';
import { formatAmount, dateRangeLabel } from './_shared/format';
import { LoaderSourceBadge } from './_shared/LoaderSourceBadge';
import {
  FinancialSectionCard,
  FinancialTotalsFooter,
} from './_shared/FinancialStatementRows';
import { loadMobileProfitLoss } from '../../../api/unifiedReports';
import type { ProfitLossResult } from '../../../types/unifiedReports';
import { PdfPreviewModal } from '../../shared/PdfPreviewModal';
import { FinancialStatementPreviewPdf } from '../../shared/FinancialStatementPreviewPdf';
import { usePdfPreview } from '../../shared/usePdfPreview';

interface ProfitLossReportProps {
  onBack: () => void;
  companyId: string | null;
  branchId?: string | null;
  reportRefreshEpoch?: number;
  user: User;
}

export function ProfitLossReport({
  onBack,
  companyId,
  branchId,
  reportRefreshEpoch = 0,
  user,
}: ProfitLossReportProps) {
  const { canViewBalances } = usePermissions();
  const preview = usePdfPreview(companyId);
  const [range, setRange] = useState<DateRangeValue>(() => makeInitialRange());
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
      {
        label: 'Net Profit',
        value: `Rs. ${formatAmount(data.netProfit, 2)}`,
        color: data.netProfit >= 0 ? 'text-[#BBF7D0]' : 'text-[#FCA5A5]',
      },
      { label: 'Revenue', value: `Rs. ${formatAmount(data.revenue.total, 2)}` },
      { label: 'Gross Profit', value: `Rs. ${formatAmount(data.grossProfit, 2)}` },
    ];
  }, [data, canViewBalances]);

  const periodLabel = dateRangeLabel(range.from, range.to);
  const generatedBy = user.name || user.email || 'User';
  const generatedAt = new Date().toLocaleString('en-PK');

  const pdfSections = useMemo(() => {
    if (!data) return [];
    return [
      { label: 'Revenue', items: data.revenue.items, total: data.revenue.total },
      { label: 'Cost of Sales', items: data.costOfSales.items, total: data.costOfSales.total },
      { label: 'Expenses', items: data.expenses.items, total: data.expenses.total },
    ];
  }, [data]);

  const pdfFooterRows = useMemo(() => {
    if (!data || !canViewBalances) return [];
    return [
      { label: 'Gross Profit', value: `Rs. ${formatAmount(data.grossProfit, 2)}` },
      {
        label: 'Net Profit',
        value: `Rs. ${formatAmount(data.netProfit, 2)}`,
        emphasize: true,
      },
    ];
  }, [data, canViewBalances]);

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <ReportHeader
        onBack={onBack}
        title="Profit & Loss"
        subtitle={periodLabel}
        stats={loading ? undefined : stats}
        rightExtras={<LoaderSourceBadge source={loaderSource} hidden={!canViewBalances} />}
        onShare={canViewBalances ? preview.openPreview : undefined}
        sharing={preview.loading}
      >
        <DateRangeBar value={range} onChange={setRange} companyId={companyId} branchId={branchId} />
      </ReportHeader>
      <ReportShell loading={loading} error={error} empty={!data && !error}>
        {data && (
          <div className="space-y-4">
            <FinancialSectionCard
              title="Revenue"
              items={data.revenue.items}
              total={data.revenue.total}
              canViewBalances={canViewBalances}
            />
            <FinancialSectionCard
              title="Cost of Sales"
              items={data.costOfSales.items}
              total={data.costOfSales.total}
              canViewBalances={canViewBalances}
            />
            <FinancialSectionCard
              title="Expenses"
              items={data.expenses.items}
              total={data.expenses.total}
              canViewBalances={canViewBalances}
            />
            {canViewBalances && (
              <FinancialTotalsFooter
                title="Profit summary"
                cells={[
                  { label: 'Revenue', value: `Rs. ${formatAmount(data.revenue.total, 0)}` },
                  { label: 'Cost of Sales', value: `Rs. ${formatAmount(data.costOfSales.total, 0)}` },
                  {
                    label: 'Gross Profit',
                    value: `Rs. ${formatAmount(data.grossProfit, 0)}`,
                    color: data.grossProfit >= 0 ? 'text-[#BBF7D0]' : 'text-[#FCA5A5]',
                  },
                ]}
              >
                <div className="mt-3 pt-3 border-t border-[#374151] flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Net Profit</p>
                  <p
                    className={`text-sm font-mono font-bold ${
                      data.netProfit >= 0 ? 'text-[#BBF7D0]' : 'text-[#FCA5A5]'
                    }`}
                  >
                    Rs. {formatAmount(data.netProfit, 0)}
                  </p>
                </div>
              </FinancialTotalsFooter>
            )}
          </div>
        )}
      </ReportShell>

      {preview.brand && data && (
        <PdfPreviewModal
          open={preview.open}
          title="Profit & Loss"
          filename={`Profit_Loss_${range.from || 'all'}_${range.to || 'now'}.pdf`}
          onClose={preview.close}
          whatsAppFallbackText={`Profit & Loss · ${periodLabel}`}
        >
          <FinancialStatementPreviewPdf
            brand={preview.brand}
            title="Profit & Loss"
            periodLabel={periodLabel}
            sections={pdfSections}
            footerRows={pdfFooterRows}
            generatedBy={generatedBy}
            generatedAt={generatedAt}
          />
        </PdfPreviewModal>
      )}
    </div>
  );
}
