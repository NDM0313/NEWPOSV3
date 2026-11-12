/**
 * Commission Report – period-based summary from sales (sale-level capture).
 * Filters: salesman, branch, date range, status (pending/posted/all).
 * Summary: total sales, eligible, commission, posted, pending.
 * Detail: date, invoice, customer, branch, total, eligible base, %, commission, status, batch ref.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { useFormatDate } from '@/app/hooks/useFormatDate';
import {
  getCommissionReport,
  postCommissionBatch,
  recalculatePendingCommissions,
  type CommissionReportResult,
  type CommissionSummaryRow,
  type CommissionStatusFilter,
  type PaymentEligibilityFilter,
  type CommissionSourceFilter,
} from '@/app/services/commissionReportService';
import { Loader2, Users, FileText, Send, RefreshCw } from 'lucide-react';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { toast } from 'sonner';
import { DateTimeDisplay } from '@/app/components/ui/DateTimeDisplay';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Label } from '@/app/components/ui/label';
import { supabase } from '@/lib/supabase';
import { userService } from '@/app/services/userService';

export interface CommissionReportPageProps {
  startDate: string;
  endDate: string;
  /** Optional branch filter (e.g. from global header). 'all' = no filter */
  branchId?: string | null;
}

export const CommissionReportPage: React.FC<CommissionReportPageProps> = ({
  startDate,
  endDate,
  branchId: propBranchId,
}) => {
  const { companyId, branchId: globalBranchId, user } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const { formatDate } = useFormatDate();
  const [data, setData] = useState<CommissionReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [salesmanFilterId, setSalesmanFilterId] = useState<string | null>(null);
  const [branchFilterId, setBranchFilterId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<CommissionStatusFilter>('all');
  const [paymentEligibility, setPaymentEligibility] = useState<PaymentEligibilityFilter>('include_due');
  const [sourceFilter, setSourceFilter] = useState<CommissionSourceFilter>('all');
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [salesmenList, setSalesmenList] = useState<{ id: string; name: string }[]>([]);
  const [listPageSize, setListPageSize] = useState<number | 'all'>(25);

  const effectiveBranchId = propBranchId ?? branchFilterId ?? globalBranchId;

  useEffect(() => {
    if (!companyId) return;
    supabase
      .from('branches')
      .select('id, name')
      .eq('company_id', companyId)
      .order('name')
      .then(({ data: b }) => setBranches(b || []));
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    userService.getSalesmen(companyId).then((users: any[]) => {
      setSalesmenList((users || []).map((u: any) => ({ id: u.id, name: u.full_name || u.email || 'Unknown' })));
    }).catch(() => setSalesmenList([]));
  }, [companyId]);

  useEffect(() => {
    if (!companyId || !startDate || !endDate) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    getCommissionReport(companyId, startDate, endDate, {
      branchId: effectiveBranchId && effectiveBranchId !== 'all' ? effectiveBranchId : undefined,
      salesmanId: salesmanFilterId ?? undefined,
      status: statusFilter,
      paymentEligibility,
      sourceFilter,
    })
      .then(setData)
      .catch((e) => {
        setError(e?.message || 'Failed to load commission report');
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [companyId, startDate, endDate, effectiveBranchId, salesmanFilterId, statusFilter, paymentEligibility, sourceFilter]);

  const filteredSummary = useMemo((): CommissionSummaryRow[] => {
    if (!data?.summary) return [];
    if (!salesmanFilterId) return data.summary;
    return data.summary.filter((row) => row.salesman_id === salesmanFilterId);
  }, [data?.summary, salesmanFilterId]);

  const flatSalesWithSalesman = useMemo(() => {
    return filteredSummary.flatMap((row) =>
      row.sales.map((sale) => ({ sale, salesman_name: row.salesman_name }))
    );
  }, [filteredSummary]);

  const displayedRows = useMemo(() => {
    if (listPageSize === 'all') return flatSalesWithSalesman;
    return flatSalesWithSalesman.slice(0, listPageSize);
  }, [flatSalesWithSalesman, listPageSize]);

  const handlePostCommission = async () => {
    if (!companyId || !startDate || !endDate) return;
    if ((data?.totals.pending_commission ?? 0) <= 0) {
      toast.warning('No pending commission to post.');
      return;
    }
    setPosting(true);
    try {
      const result = await postCommissionBatch({
        companyId,
        branchId: effectiveBranchId && effectiveBranchId !== 'all' ? effectiveBranchId : null,
        salesmanId: salesmanFilterId ?? null,
        startDate,
        endDate,
        createdBy: (user as any)?.id ?? (user as any)?.auth_user_id ?? null,
        paymentEligibility,
        sourceFilter,
      });
      toast.success(`Posted commission batch ${result.batchNo}: ${formatCurrency(result.totalCommission)} (${result.saleCount} transaction(s))`);
      setStatusFilter('all');
      const next = await getCommissionReport(companyId, startDate, endDate, {
        branchId: effectiveBranchId && effectiveBranchId !== 'all' ? effectiveBranchId : undefined,
        salesmanId: salesmanFilterId ?? undefined,
        status: 'all',
        paymentEligibility,
        sourceFilter,
      });
      setData(next);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to post commission');
    } finally {
      setPosting(false);
    }
  };

  const handleRecalculatePending = async () => {
    if (!companyId || !startDate || !endDate) return;
    setRecalculating(true);
    try {
      const { updatedCount } = await recalculatePendingCommissions({
        companyId,
        startDate,
        endDate,
        branchId: effectiveBranchId && effectiveBranchId !== 'all' ? effectiveBranchId : undefined,
        salesmanId: salesmanFilterId ?? undefined,
      });
      toast.success(updatedCount > 0 ? `Updated commission for ${updatedCount} pending transaction(s).` : 'No pending transactions to update.');
      const next = await getCommissionReport(companyId, startDate, endDate, {
        branchId: effectiveBranchId && effectiveBranchId !== 'all' ? effectiveBranchId : undefined,
        salesmanId: salesmanFilterId ?? undefined,
        status: statusFilter,
        paymentEligibility,
        sourceFilter,
      });
      setData(next);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to recalculate pending commissions');
    } finally {
      setRecalculating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-card border-border p-6">
        <p className="text-red-400">{error}</p>
      </Card>
    );
  }

  const hasData = data && data.summary.length > 0;
  const periodLabel = startDate && endDate
    ? `${formatDate(new Date(startDate.slice(0, 10)))} – ${formatDate(new Date(endDate.slice(0, 10)))}`
    : '—';

  return (
    <div className="space-y-6">
      {/* Filters – always visible so user can change period (header), branch, salesman, status, payment eligibility */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-card border border-border rounded-xl">
        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Period:</span>
        <span className="text-foreground text-sm">{periodLabel}</span>
        <span className="text-xs text-muted-foreground">(Change period from the date filter above)</span>
        <div className="w-px h-8 bg-muted" />
        <Label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Salesperson</Label>
        <Select value={salesmanFilterId ?? 'all'} onValueChange={(v) => setSalesmanFilterId(v === 'all' ? null : v)}>
          <SelectTrigger className="w-[220px] bg-input-background border-border text-foreground">
            <SelectValue placeholder="All salesmen" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border text-popover-foreground">
            <SelectItem value="all" className="focus:bg-muted">All salesmen</SelectItem>
            {(hasData ? data!.summary : []).map((row) => (
              <SelectItem key={row.salesman_id} value={row.salesman_id} className="focus:bg-muted">
                {row.salesman_name}
              </SelectItem>
            ))}
            {!hasData && salesmenList.map((s) => (
              <SelectItem key={s.id} value={s.id} className="focus:bg-muted">{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Branch</Label>
        <Select value={branchFilterId ?? 'all'} onValueChange={(v) => setBranchFilterId(v === 'all' ? null : v)}>
          <SelectTrigger className="w-[180px] bg-input-background border-border text-foreground">
            <SelectValue placeholder="All branches" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border text-popover-foreground">
            <SelectItem value="all" className="focus:bg-muted">All branches</SelectItem>
            {branches.map((b) => (
              <SelectItem key={b.id} value={b.id} className="focus:bg-muted">{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Status</Label>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as CommissionStatusFilter)}>
          <SelectTrigger className="w-[140px] bg-input-background border-border text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border text-popover-foreground">
            <SelectItem value="all" className="focus:bg-muted">All</SelectItem>
            <SelectItem value="pending" className="focus:bg-muted">Pending</SelectItem>
            <SelectItem value="posted" className="focus:bg-muted">Posted</SelectItem>
          </SelectContent>
        </Select>
        <Label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Source</Label>
        <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as CommissionSourceFilter)}>
          <SelectTrigger className="w-[140px] bg-input-background border-border text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border text-popover-foreground">
            <SelectItem value="all" className="focus:bg-muted">All</SelectItem>
            <SelectItem value="sale" className="focus:bg-muted">Sales only</SelectItem>
            <SelectItem value="rental" className="focus:bg-muted">Rentals only</SelectItem>
          </SelectContent>
        </Select>
        <Label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Payment eligibility</Label>
        <Select value={paymentEligibility} onValueChange={(v) => setPaymentEligibility(v as PaymentEligibilityFilter)}>
          <SelectTrigger className="w-[180px] bg-input-background border-border text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border text-popover-foreground">
            <SelectItem value="fully_paid_only" className="focus:bg-muted">Fully paid only</SelectItem>
            <SelectItem value="include_due" className="focus:bg-muted">Include due sales</SelectItem>
          </SelectContent>
        </Select>
        <Button
          onClick={handleRecalculatePending}
          disabled={recalculating || !companyId || !startDate || !endDate}
          variant="outline"
          className="bg-muted hover:bg-muted border-gray-600 text-foreground flex items-center gap-2"
        >
          {recalculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw size={16} />}
          Recalculate Pending
        </Button>
        <Button
          onClick={handlePostCommission}
          disabled={posting || !hasData || (data?.totals.pending_commission ?? 0) <= 0}
          className="bg-green-600 hover:bg-green-700 flex items-center gap-2"
        >
          {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send size={16} />}
          Post Commission
        </Button>
      </div>

      {/* Empty state – when no commission data for selected filters */}
      {!hasData && (
        <Card className="bg-card border-border p-8 text-center">
          <Users className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">No commission data for this period.</p>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Use the filters above to change <strong>Branch</strong>, <strong>Salesperson</strong>, <strong>Status</strong>, or <strong>Payment eligibility</strong>. 
            Change the date range from the period selector at the top of Reports.
          </p>
          {paymentEligibility === 'fully_paid_only' && (
            <p className="text-sm text-amber-400/90 mt-2 max-w-md mx-auto">
              With <strong>Fully paid only</strong>, sales with a balance due are hidden. Try <strong>Include due sales</strong> to see all commission-eligible sales.
            </p>
          )}
          <p className="text-sm text-muted-foreground mt-2">
            To see data: create <strong>final</strong> sales with a <strong>salesman</strong> and <strong>commission % or amount</strong> in the selected period.
          </p>
        </Card>
      )}

      {/* Summary totals – only when we have data */}
      {hasData && (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-card border-border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total sales</p>
          <p className="text-lg font-semibold text-foreground mt-0.5">{formatCurrency(data!.totals.total_sales)}</p>
        </Card>
        <Card className="bg-card border-border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Eligible base</p>
          <p className="text-lg font-semibold text-foreground mt-0.5">{formatCurrency(data!.totals.total_eligible)}</p>
        </Card>
        <Card className="bg-card border-border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total commission</p>
          <p className="text-lg font-semibold text-[var(--erp-money-positive)] mt-0.5">{formatCurrency(data!.totals.total_commission)}</p>
        </Card>
        <Card className="bg-card border-border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Posted</p>
          <p className="text-lg font-semibold text-blue-400 mt-0.5">{formatCurrency(data!.totals.posted_commission)}</p>
        </Card>
        <Card className="bg-card border-border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Pending</p>
          <p className="text-lg font-semibold text-amber-400 mt-0.5">{formatCurrency(data!.totals.pending_commission)}</p>
        </Card>
      </div>
      )}

      {hasData && (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {filteredSummary.map((row) => (
          <Card key={row.salesman_id} className="bg-card border-border p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Users className="text-blue-400" size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{row.salesman_name}</h3>
                <p className="text-xs text-muted-foreground">{row.sale_count} sale(s)</p>
              </div>
            </div>
            <p className="text-2xl font-bold text-[var(--erp-money-positive)]">{formatCurrency(row.total_commission)}</p>
            <p className="text-sm text-muted-foreground mt-1">Commission · Sales: {formatCurrency(row.total_sales_amount)}</p>
          </Card>
        ))}
      </div>
      )}

      {hasData && (
      <Card className="bg-card border-border overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <FileText size={20} className="text-blue-400" />
                Commission by sale
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Period: {formatDate(new Date(data!.period_start))} – {formatDate(new Date(data!.period_end))}
                {salesmanFilterId && <span className="ml-2 text-blue-400">· Filtered by salesperson</span>}
                {statusFilter !== 'all' && <span className="ml-2 text-blue-400">· Status: {statusFilter}</span>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="commission-list-size" className="text-xs text-muted-foreground whitespace-nowrap">Show</Label>
              <Select
                value={String(listPageSize)}
                onValueChange={(v) => setListPageSize(v === 'all' ? 'all' : Number(v))}
              >
                <SelectTrigger id="commission-list-size" className="w-[72px] h-8 text-xs bg-input-background border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-input-background border-border text-foreground">
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="500">500</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">
                {listPageSize === 'all'
                  ? `(${flatSalesWithSalesman.length} rows)`
                  : `(${displayedRows.length} of ${flatSalesWithSalesman.length})`}
              </span>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-base leading-snug">
            <thead className="bg-input-background/80 text-muted-foreground border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Salesperson</th>
                <th className="px-4 py-3 text-left font-medium">Source</th>
                <th className="px-4 py-3 text-left font-medium">Ref #</th>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Customer</th>
                <th className="px-4 py-3 text-left font-medium">Branch</th>
                <th className="px-4 py-3 text-right font-medium">Total sale</th>
                <th className="px-4 py-3 text-right font-medium">Eligible base</th>
                <th className="px-4 py-3 text-right font-medium">%</th>
                <th className="px-4 py-3 text-right font-medium">Commission</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Batch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {displayedRows.map(({ sale, salesman_name }) => (
                <tr key={sale.id} className="hover:bg-accent/30">
                  <td className="px-4 py-3 text-muted-foreground">{salesman_name}</td>
                  <td className="px-4 py-3">
                    <span className={sale.source === 'rental' ? 'text-pink-400 text-xs font-medium' : 'text-blue-400 text-xs font-medium'}>
                      {sale.source === 'rental' ? 'Rental' : 'Sale'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{sale.invoice_no}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <DateTimeDisplay date={sale.invoice_date} dateOnly />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-[140px] truncate">{sale.customer_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{sale.branch_name ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(Number(sale.total))}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {sale.commission_eligible_amount != null ? formatCurrency(Number(sale.commission_eligible_amount)) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {sale.commission_percent != null ? `${Number(sale.commission_percent)}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-[var(--erp-money-positive)]">{formatCurrency(Number(sale.commission_amount))}</td>
                  <td className="px-4 py-3">
                    <span className={sale.commission_status === 'posted' ? 'text-blue-400' : 'text-amber-400'}>
                      {sale.commission_status === 'posted' ? 'Posted' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{sale.commission_batch_id ? 'Yes' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      )}
    </div>
  );
};
