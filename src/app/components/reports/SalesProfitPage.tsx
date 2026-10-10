import React, { useState, useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { FinancialReportPrintShell } from './shared/FinancialReportPrintShell';
import { shareViaWhatsApp } from '@/app/services/documentShareService';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { accountingReportsService, SalesProfitResult } from '@/app/services/accountingReportsService';
import { branchService } from '@/app/services/branchService';
import { exportToExcel, ExportData } from '@/app/utils/exportUtils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Label } from '@/app/components/ui/label';
import { Switch } from '@/app/components/ui/switch';

const toExport = (r: SalesProfitResult, formatCurrency: (n: number) => string): ExportData => ({
  title: `Sales Profit Report (${r.startDate} to ${r.endDate})`,
  headers: ['Invoice', 'Date', 'Branch', 'Customer', 'Revenue', 'Cost', 'Profit', 'Margin %'],
  rows: [
    ...r.rows.map((row) => [
      row.invoice_no,
      row.sale_date,
      row.branch_name,
      row.customer_name,
      formatCurrency(row.revenue),
      formatCurrency(row.cost),
      formatCurrency(row.profit),
      `${row.margin_pct.toFixed(1)}%`,
    ]),
    [],
    ['Total', '', '', '', formatCurrency(r.totalRevenue), formatCurrency(r.totalCost), formatCurrency(r.totalProfit), ''],
  ],
});

export const SalesProfitPage: React.FC<{
  startDate: string;
  endDate: string;
  branchId?: string;
  customerId?: string;
}> = ({ startDate, endDate, branchId: globalBranchId, customerId }) => {
  const { companyId } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const [data, setData] = useState<SalesProfitResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [overrideBranch, setOverrideBranch] = useState(false);
  const [branchOverride, setBranchOverride] = useState<string>('all');
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);

  const effectiveBranchId = overrideBranch
    ? branchOverride === 'all'
      ? undefined
      : branchOverride
    : globalBranchId && globalBranchId !== 'all'
      ? globalBranchId
      : undefined;

  useEffect(() => {
    if (!companyId) return;
    branchService.getBranchesCached(companyId).then((list) => {
      setBranches(list.map((b) => ({ id: b.id, name: b.name || b.code || b.id })));
    });
  }, [companyId]);

  useEffect(() => {
    if (!overrideBranch && globalBranchId && globalBranchId !== 'all') {
      setBranchOverride(globalBranchId);
    }
  }, [globalBranchId, overrideBranch]);

  useEffect(() => {
    if (!companyId || !startDate || !endDate) {
      if (!companyId) setLoading(true);
      return;
    }
    setLoading(true);
    accountingReportsService
      .getSalesProfit(companyId, startDate, endDate, effectiveBranchId, customerId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [companyId, startDate, endDate, effectiveBranchId, customerId]);

  const branchLabel =
    effectiveBranchId != null
      ? branches.find((b) => b.id === effectiveBranchId)?.name || 'Branch scope'
      : 'All branches';
  const exportPayload = useMemo(() => (data ? toExport(data, formatCurrency) : null), [data, formatCurrency]);

  const handleExportExcel = () => {
    if (!exportPayload) return;
    exportToExcel(exportPayload, 'Sales_Profit');
  };
  const handleWhatsApp = () => {
    if (!data) return;
    void shareViaWhatsApp(
      `Sales Profit Report\n${data.startDate} to ${data.endDate}\nRevenue: ${formatCurrency(data.totalRevenue)}\nProfit: ${formatCurrency(data.totalProfit)}`
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="rounded-xl border border-border bg-muted/40 p-6 text-center text-muted-foreground">
        <p className="font-medium">No data for the selected period</p>
        <p className="text-sm text-muted-foreground mt-1">Adjust the date range or ensure sales exist.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-end gap-4">
        <FinancialReportPrintShell
          companyId={companyId}
          actionsTitle="Sales Profit Report"
          reportTitle="Sales Profit Report"
          periodLabel={`${data.startDate} to ${data.endDate}`}
          branchLabel={branchLabel}
          previewReference={`sales-profit-${data.startDate}-${data.endDate}`}
          exportPayload={exportPayload}
          onExcel={handleExportExcel}
          onWhatsapp={handleWhatsApp}
        />
      </div>
      <div className="no-print flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <Switch checked={overrideBranch} onCheckedChange={setOverrideBranch} id="sp-override-branch" />
          <Label htmlFor="sp-override-branch" className="text-xs text-muted-foreground cursor-pointer">
            Override header branch
          </Label>
        </div>
        {overrideBranch ? (
          <Select value={branchOverride} onValueChange={setBranchOverride}>
            <SelectTrigger className="w-[200px] bg-input-background border-border h-9">
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">All branches</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-sm text-muted-foreground">Branch: {branchLabel}</span>
        )}
      </div>
      <p className="no-print text-sm text-muted-foreground">
        Period: {data.startDate} to {data.endDate} • Branch: {branchLabel} • Total Revenue: {formatCurrency(data.totalRevenue)} • Total Profit: {formatCurrency(data.totalProfit)}
      </p>
      <div className="overflow-auto rounded-xl border border-border bg-muted/40 no-print">
        <table className="w-full text-base leading-snug">
          <thead className="border-b border-border bg-muted/50">
            <tr>
              <th className="p-3 text-left font-medium text-muted-foreground">Invoice</th>
              <th className="p-3 text-left font-medium text-muted-foreground">Date</th>
              <th className="p-3 text-left font-medium text-muted-foreground">Branch</th>
              <th className="p-3 text-left font-medium text-muted-foreground">Customer</th>
              <th className="p-3 text-right font-medium text-muted-foreground">Revenue</th>
              <th className="p-3 text-right font-medium text-muted-foreground">Cost</th>
              <th className="p-3 text-right font-medium text-muted-foreground">Profit</th>
              <th className="p-3 text-right font-medium text-muted-foreground">Margin %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted-foreground">
                  No sales in this period.
                </td>
              </tr>
            ) : (
              data.rows.map((row) => (
                <tr key={row.sale_id} className="hover:bg-accent/30">
                  <td className="p-3 font-mono text-foreground">{row.invoice_no}</td>
                  <td className="p-3 text-muted-foreground">{row.sale_date}</td>
                  <td className="p-3 text-muted-foreground">{row.branch_name || '—'}</td>
                  <td className="p-3 text-muted-foreground">{row.customer_name}</td>
                  <td className="p-3 text-right text-foreground tabular-nums">{formatCurrency(row.revenue)}</td>
                  <td className="p-3 text-right text-muted-foreground tabular-nums">{formatCurrency(row.cost)}</td>
                  <td className="p-3 text-right text-[var(--erp-money-positive)] tabular-nums">{formatCurrency(row.profit)}</td>
                  <td className="p-3 text-right text-muted-foreground tabular-nums">{row.margin_pct.toFixed(1)}%</td>
                </tr>
              ))
            )}
          </tbody>
          {data.rows.length > 0 && (
            <tfoot className="border-t-2 border-border bg-muted/50">
              <tr>
                <td colSpan={4} className="p-3 font-medium text-foreground">Total</td>
                <td className="p-3 text-right font-medium text-foreground tabular-nums">{formatCurrency(data.totalRevenue)}</td>
                <td className="p-3 text-right font-medium text-foreground tabular-nums">{formatCurrency(data.totalCost)}</td>
                <td className="p-3 text-right font-medium text-[var(--erp-money-positive)] tabular-nums">{formatCurrency(data.totalProfit)}</td>
                <td className="p-3 text-right font-medium text-foreground">—</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};
