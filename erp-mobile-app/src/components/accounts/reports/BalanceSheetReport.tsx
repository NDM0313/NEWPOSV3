import { useEffect, useMemo, useState } from 'react';
import type { User } from '../../../types';
import { usePermissions } from '../../../context/PermissionContext';
import { ReportHeader, type ReportHeaderStat } from './_shared/ReportHeader';
import { ReportShell } from './_shared/ReportShell';
import { formatAmount } from './_shared/format';
import { LoaderSourceBadge } from './_shared/LoaderSourceBadge';
import {
  FinancialSectionCard,
  FinancialTotalsFooter,
} from './_shared/FinancialStatementRows';
import { loadMobileBalanceSheet } from '../../../api/unifiedReports';
import type { BalanceSheetResult } from '../../../types/unifiedReports';
import {
  groupMobileBalanceSheetAssets,
  groupMobileBalanceSheetLiabilities,
} from '../../../lib/mobileBalanceSheetGrouping';
import { PdfPreviewModal } from '../../shared/PdfPreviewModal';
import { FinancialStatementPreviewPdf } from '../../shared/FinancialStatementPreviewPdf';
import { usePdfPreview } from '../../shared/usePdfPreview';

interface BalanceSheetReportProps {
  onBack: () => void;
  companyId: string | null;
  branchId?: string | null;
  reportRefreshEpoch?: number;
  user: User;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function BalanceSheetReport({
  onBack,
  companyId,
  branchId,
  reportRefreshEpoch = 0,
  user,
}: BalanceSheetReportProps) {
  const { canViewBalances } = usePermissions();
  const preview = usePdfPreview(companyId);
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

  const assetGroups = useMemo(
    () => (data ? groupMobileBalanceSheetAssets(data.assets.items) : []),
    [data],
  );
  const liabilityGroups = useMemo(
    () => (data ? groupMobileBalanceSheetLiabilities(data.liabilities.items) : []),
    [data],
  );

  const stats = useMemo((): ReportHeaderStat[] => {
    if (!data || !canViewBalances) return [];
    const chips: ReportHeaderStat[] = [
      { label: 'Total Assets', value: `Rs. ${formatAmount(data.totalAssets, 2)}` },
      { label: 'L+E', value: `Rs. ${formatAmount(data.totalLiabilitiesAndEquity, 2)}` },
    ];
    if (data.difference !== 0) {
      chips.push({
        label: 'Diff',
        value: `Rs. ${formatAmount(data.difference, 2)}`,
        color: data.difference === 0 ? 'text-[#BBF7D0]' : 'text-[#FCA5A5]',
      });
    }
    return chips;
  }, [data, canViewBalances]);

  const pdfSections = useMemo(() => {
    if (!data) return [];
    return [
      {
        label: 'Assets',
        items: data.assets.items,
        total: data.assets.total,
        subgroups: assetGroups,
      },
      {
        label: 'Liabilities',
        items: data.liabilities.items,
        total: data.liabilities.total,
        subgroups: liabilityGroups,
      },
      {
        label: 'Equity',
        items: data.equity.items,
        total: data.equity.total,
      },
    ];
  }, [data, assetGroups, liabilityGroups]);

  const pdfFooterRows = useMemo(() => {
    if (!data || !canViewBalances) return [];
    return [
      { label: 'Total Assets', value: `Rs. ${formatAmount(data.totalAssets, 2)}`, emphasize: true },
      {
        label: 'Total Liabilities + Equity',
        value: `Rs. ${formatAmount(data.totalLiabilitiesAndEquity, 2)}`,
        emphasize: true,
      },
      ...(data.difference !== 0
        ? [{ label: 'Difference', value: `Rs. ${formatAmount(data.difference, 2)}`, emphasize: true }]
        : []),
    ];
  }, [data, canViewBalances]);

  const generatedBy = user.name || user.email || 'User';
  const generatedAt = new Date().toLocaleString('en-PK');

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <ReportHeader
        onBack={onBack}
        title="Balance Sheet"
        subtitle={`As of ${asOf}`}
        stats={loading ? undefined : stats}
        rightExtras={<LoaderSourceBadge source={loaderSource} hidden={!canViewBalances} />}
        onShare={canViewBalances ? preview.openPreview : undefined}
        sharing={preview.loading}
      >
        <label className="block">
          <span className="sr-only">As of date</span>
          <input
            type="date"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white"
          />
        </label>
      </ReportHeader>
      <ReportShell loading={loading} error={error} empty={!data && !error} emptyLabel="No balance sheet data.">
        {data && (
          <div className="space-y-4">
            <FinancialSectionCard
              title="Assets"
              subgroups={assetGroups}
              total={data.assets.total}
              canViewBalances={canViewBalances}
            />
            <FinancialSectionCard
              title="Liabilities"
              subgroups={liabilityGroups}
              total={data.liabilities.total}
              canViewBalances={canViewBalances}
            />
            <FinancialSectionCard
              title="Equity"
              items={data.equity.items}
              total={data.equity.total}
              canViewBalances={canViewBalances}
            />
            {canViewBalances && (
              <FinancialTotalsFooter
                title="Balance check"
                cells={[
                  { label: 'Total Assets', value: `Rs. ${formatAmount(data.totalAssets, 0)}` },
                  {
                    label: 'Liabilities + Equity',
                    value: `Rs. ${formatAmount(data.totalLiabilitiesAndEquity, 0)}`,
                  },
                  {
                    label: 'Difference',
                    value: `Rs. ${formatAmount(data.difference, 0)}`,
                    color: data.difference === 0 ? 'text-[#BBF7D0]' : 'text-[#FCA5A5]',
                  },
                ]}
              />
            )}
          </div>
        )}
      </ReportShell>

      {preview.brand && data && (
        <PdfPreviewModal
          open={preview.open}
          title="Balance Sheet"
          filename={`Balance_Sheet_${asOf}.pdf`}
          onClose={preview.close}
          whatsAppFallbackText={`Balance Sheet · As of ${asOf}`}
        >
          <FinancialStatementPreviewPdf
            brand={preview.brand}
            title="Balance Sheet"
            periodLabel={`As of ${asOf}`}
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
