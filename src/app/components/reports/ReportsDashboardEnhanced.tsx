// ============================================
// 🎯 ENHANCED REPORTS DASHBOARD
// ============================================
// Complete reports with real data from contexts

import React, { useState, useMemo, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Package,
  ShoppingBag,
  Calendar,
  Download,
  FileText,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  ChevronDown,
  Users,
  Loader2,
  BookOpen,
  Home,
} from 'lucide-react';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import type { Sale } from '@/app/context/SalesContext';
import { convertFromSupabaseSale } from '@/app/context/SalesContext';
import { usePurchases } from '@/app/context/PurchaseContext';
import { useExpenses } from '@/app/context/ExpenseContext';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { ChartContainer } from '@/app/components/ui/chart';
import { exportToCSV, exportToExcel, exportToPDF } from '@/app/utils/exportUtils';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { useFormatDate } from '@/app/hooks/useFormatDate';
import { useCheckPermission } from '@/app/hooks/useCheckPermission';
import { useSupabase } from '@/app/context/SupabaseContext';
import { expenseService } from '@/app/services/expenseService';
import { saleService } from '@/app/services/saleService';
import { supabase } from '@/lib/supabase';
import {
  filterSalesByLifecycle,
  salesForOperationalMetrics,
  orderPipelineSales,
  isStudioSale,
  type SalesLifecycleFilter,
} from '@/app/services/reportsSalesLogic';
import { getEffectiveSaleStatus, getSaleStatusBadgeConfig } from '@/app/utils/statusHelpers';
import { cn } from '@/app/components/ui/utils';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { useGlobalFilter } from '@/app/context/GlobalFilterContext';
import { useNavigation } from '@/app/context/NavigationContext';
import { BranchSelector } from '@/app/components/layout/BranchSelector';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { TrialBalancePage } from './TrialBalancePage';
import { ProfitLossPage } from './ProfitLossPage';
import { BalanceSheetPage } from './BalanceSheetPage';
import { SalesProfitPage } from './SalesProfitPage';
import { InventoryValuationPage } from './InventoryValuationPage';
import { CommissionReportPage } from './CommissionReportPage';
import { ProductLedger } from './ProductLedger';
import { ProductSellReportPage } from './ProductSellReportPage';
import { LedgerStatementCenterV2Page } from '@/app/features/ledger-statement-center-v2/LedgerStatementCenterV2Page';
import { RemainingBalanceReport } from './RemainingBalanceReport';
import { CustomersSuppliersReportPage } from './CustomersSuppliersReportPage';
import { BalanceBasisGuidePage } from './BalanceBasisGuidePage';
import type { FinancialReportType } from '@/app/lib/navDeepLinks';
import {
  accountingReportsService,
  type ProfitLossResult,
} from '@/app/services/accountingReportsService';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getDateRangeBounds(dateRange: string): { start: Date | null; end: Date } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  if (dateRange === 'all') return { start: null, end };
  const days = parseInt(dateRange, 10) || 30;
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

function isInRange(dateStr: string | undefined, start: Date | null, end: Date): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (start && d < start) return false;
  if (d > end) return false;
  return true;
}

export type ReportsDashboardReportType =
  | 'overview'
  | 'sales'
  | 'purchases'
  | 'expenses'
  | 'financial'
  | 'commission'
  | 'product-ledger'
  | 'product-sell'
  | 'ledger-v2';

export const ReportsDashboardEnhanced = ({
  initialReportType = 'overview',
  initialFinancialReportType,
}: {
  initialReportType?: ReportsDashboardReportType;
  initialFinancialReportType?: FinancialReportType;
}) => {
  const purchases = usePurchases();
  const expenses = useExpenses();
  const { formatCurrency } = useFormatCurrency();
  const { formatDate } = useFormatDate();
  const { canViewReports } = useCheckPermission();
  const { branchId, companyId } = useSupabase();
  const globalFilter = useGlobalFilter();
  const { ledgerV2Initial, setLedgerV2Initial } = useNavigation();
  const { startDate: globalStart, endDate: globalEnd, setCurrentModule, getDateRangeLabel } = globalFilter;
  const dateRangeLabel = getDateRangeLabel();

  React.useEffect(() => {
    if (ledgerV2Initial) {
      setReportType('financial');
      setFinancialReportType('ledger-statement-v2');
    }
  }, [ledgerV2Initial]);

  React.useEffect(() => {
    setCurrentModule('reports');
  }, [setCurrentModule]);

  const [reportType, setReportType] = useState<ReportsDashboardReportType>(initialReportType);
  /** Overview tab: operational document flow vs canonical GL snapshot (same period as global filter). */
  const [overviewBasis, setOverviewBasis] = useState<'operational' | 'financial_gl'>('operational');
  const [glOverviewLoading, setGlOverviewLoading] = useState(false);
  const [glFinancialOverview, setGlFinancialOverview] = useState<{
    pl: ProfitLossResult | null;
    arDrMinusCr: number | null;
    apCrMinusDr: number | null;
    wpCrMinusDr: number | null;
    cashBankDrMinusCr: number | null;
  } | null>(null);
  const [financialReportType, setFinancialReportType] = useState<
    | 'trial-balance'
    | 'profit-loss'
    | 'customers-suppliers'
    | 'balance-basis-guide'
    | 'balance-sheet'
    | 'sales-profit'
    | 'inventory-valuation'
    | 'ledger-statement-v2'
    | 'remaining-balance'
  >(initialFinancialReportType ?? 'trial-balance');
  /** Expenses whose original expense JE has a correction_reversal — hidden from reports by default. */
  const [reversedExpenseIds, setReversedExpenseIds] = useState<Set<string>>(() => new Set());
  const [showReversedExpenses, setShowReversedExpenses] = useState(false);

  /** Period sales from dedicated report fetch (not paginated SalesContext). */
  const [reportSales, setReportSales] = useState<Sale[]>([]);
  const [reportSalesLoading, setReportSalesLoading] = useState(false);
  const [reportSalesTruncated, setReportSalesTruncated] = useState(false);
  const [salesLifecycleFilter, setSalesLifecycleFilter] = useState<SalesLifecycleFilter>('operational');
  const [showNonOperationalSales, setShowNonOperationalSales] = useState(false);
  const [includeOrdersInCharts, setIncludeOrdersInCharts] = useState(false);
  const [salePaymentsInPeriod, setSalePaymentsInPeriod] = useState<number | null>(null);
  const [rentalGl4200, setRentalGl4200] = useState<number | null>(null);
  const [rentalBookingStats, setRentalBookingStats] = useState<{
    total: number;
    active: number;
    returned: number;
    cancelled: number;
    bookingTotal: number;
  } | null>(null);
  const [purchaseLifecycleFilter, setPurchaseLifecycleFilter] = useState<'operational' | 'all' | 'cancelled'>('operational');

  const reportStartDate = globalStart ? globalStart.slice(0, 10) : '1900-01-01';
  const reportEndDate = globalEnd ? globalEnd.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const rangeStart = globalStart ? new Date(globalStart) : null;
  const rangeEnd = globalEnd ? new Date(globalEnd) : new Date();
  const filterByRange = useCallback(
    (dateStr: string | undefined) => isInRange(dateStr, rangeStart, rangeEnd),
    [rangeStart, rangeEnd]
  );

  React.useEffect(() => {
    if (reportType !== 'overview') setOverviewBasis('operational');
  }, [reportType]);

  React.useEffect(() => {
    if (!companyId || expenses.expenses.length === 0) {
      setReversedExpenseIds(new Set());
      return;
    }
    const ids = expenses.expenses.map((e) => e.id);
    expenseService
      .getReversedExpenseIds(companyId, ids)
      .then(setReversedExpenseIds)
      .catch(() => setReversedExpenseIds(new Set()));
  }, [companyId, expenses.expenses]);

  React.useEffect(() => {
    if (!companyId) {
      setReportSales([]);
      setReportSalesTruncated(false);
      return;
    }
    let cancelled = false;
    setReportSalesLoading(true);
    const b = branchId === 'all' || !branchId ? undefined : branchId;
    saleService
      .getSalesForReports(companyId, reportStartDate, reportEndDate, b)
      .then(({ data, truncated }) => {
        if (cancelled) return;
        setReportSales((data || []).map((row) => convertFromSupabaseSale({ ...row, items: row.items || [] })));
        setReportSalesTruncated(truncated);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[Reports] getSalesForReports failed', err);
          toast.error('Could not load sales for report period');
          setReportSales([]);
          setReportSalesTruncated(false);
        }
      })
      .finally(() => {
        if (!cancelled) setReportSalesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, reportStartDate, reportEndDate, branchId]);

  React.useEffect(() => {
    if (!companyId || reportType !== 'sales') {
      setSalePaymentsInPeriod(null);
      setRentalGl4200(null);
      setRentalBookingStats(null);
      return;
    }
    let cancelled = false;
    const b = branchId === 'all' || !branchId ? undefined : branchId;
    Promise.all([
      saleService.getSalePaymentsTotalInPeriod(companyId, reportStartDate, reportEndDate, b),
      accountingReportsService.getProfitLoss(companyId, reportStartDate, reportEndDate, b),
      supabase
        .from('rentals')
        .select('id, status, total_amount, booking_date, branch_id')
        .eq('company_id', companyId)
        .gte('booking_date', reportStartDate)
        .lte('booking_date', reportEndDate)
        .then(({ data, error }) => {
          if (error) throw error;
          const rows = data || [];
          const branchFiltered =
            b != null
              ? rows.filter((r: { branch_id?: string }) => !r.branch_id || r.branch_id === b)
              : rows;
          let active = 0;
          let returned = 0;
          let cancelledCount = 0;
          let bookingTotal = 0;
          for (const r of branchFiltered as { status?: string; total_amount?: number }[]) {
            const st = String(r.status || '').toLowerCase();
            bookingTotal += Number(r.total_amount) || 0;
            if (st === 'cancelled') cancelledCount++;
            else if (st === 'returned' || st === 'completed') returned++;
            else active++;
          }
          return {
            total: branchFiltered.length,
            active,
            returned,
            cancelled: cancelledCount,
            bookingTotal,
          };
        }),
    ])
      .then(([paymentsTotal, pl, rentalStats]) => {
        if (cancelled) return;
        setSalePaymentsInPeriod(paymentsTotal);
        const rentalLine = pl.revenue.items.find((i) => String(i.code || '').trim() === '4200');
        setRentalGl4200(rentalLine?.amount ?? 0);
        setRentalBookingStats(rentalStats);
      })
      .catch(() => {
        if (!cancelled) {
          setSalePaymentsInPeriod(null);
          setRentalGl4200(null);
          setRentalBookingStats(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, reportType, reportStartDate, reportEndDate, branchId]);

  // Period sales from dedicated fetch (already scoped by invoice_date on server)
  const filteredSales = useMemo(() => reportSales, [reportSales]);

  const finalSales = useMemo(() => salesForOperationalMetrics(filteredSales), [filteredSales]);
  const orderPipeline = useMemo(() => orderPipelineSales(filteredSales), [filteredSales]);

  const salesListDisplay = useMemo(
    () => filterSalesByLifecycle(filteredSales, salesLifecycleFilter, showNonOperationalSales),
    [filteredSales, salesLifecycleFilter, showNonOperationalSales]
  );

  const chartSalesSource = useMemo(() => {
    const base = includeOrdersInCharts
      ? filterSalesByLifecycle(filteredSales, 'operational', showNonOperationalSales)
      : finalSales;
    return base.filter((s) => s.type === 'invoice' || getEffectiveSaleStatus(s) === 'final');
  }, [filteredSales, finalSales, includeOrdersInCharts, showNonOperationalSales]);

  const studioFinalTotal = useMemo(
    () => finalSales.filter(isStudioSale).reduce((sum, s) => sum + (s.total ?? 0), 0),
    [finalSales]
  );
  const merchandiseFinalTotal = useMemo(
    () => finalSales.filter((s) => !isStudioSale(s)).reduce((sum, s) => sum + (s.total ?? 0), 0),
    [finalSales]
  );
  const orderPipelineTotal = useMemo(
    () => orderPipeline.reduce((sum, s) => sum + (s.total ?? 0), 0),
    [orderPipeline]
  );

  const filteredPurchases = useMemo(() => {
    const inRange = purchases.purchases.filter((p) => filterByRange(p.date));
    if (purchaseLifecycleFilter === 'all') return inRange;
    if (purchaseLifecycleFilter === 'cancelled') {
      return inRange.filter((p) => String((p as { status?: string }).status || '').toLowerCase() === 'cancelled');
    }
    return inRange.filter((p) => {
      const st = String((p as { status?: string }).status || '').toLowerCase();
      return st !== 'cancelled' && st !== 'draft';
    });
  }, [purchases.purchases, filterByRange, purchaseLifecycleFilter]);
  const filteredExpenses = useMemo(
    () => expenses.expenses.filter((e) => filterByRange(e.date)),
    [expenses.expenses, filterByRange]
  );

  const reportableExpenses = useMemo(() => {
    if (showReversedExpenses) return filteredExpenses;
    return filteredExpenses.filter((e) => !reversedExpenseIds.has(e.id));
  }, [filteredExpenses, reversedExpenseIds, showReversedExpenses]);

  // ============================================
  // METRICS (from filtered data) – ERP golden rule: only FINAL/posted
  // ============================================
  const finalPurchases = useMemo(() => filteredPurchases.filter((p) => (p as any).status === 'final' || (p as any).status === 'received'), [filteredPurchases]);

  const metrics = useMemo(() => {
    const totalSales = finalSales.reduce((sum, sale) => sum + (sale.total ?? 0), 0);
    const totalPurchases = finalPurchases.reduce((sum, p) => sum + (p.total ?? 0), 0);
    const totalExpenses = reportableExpenses
      .filter((e) => e.status === 'paid')
      .reduce((sum, e) => sum + e.amount, 0);
    const totalReceivables = finalSales.reduce((sum, s) => sum + (s.due ?? 0), 0);
    const totalPayables = finalPurchases.reduce((sum, p) => sum + (p.due ?? 0), 0);
    const profit = totalSales - totalPurchases - totalExpenses;
    const profitMargin = totalSales > 0 ? (profit / totalSales) * 100 : 0;

    return {
      totalSales,
      totalPurchases,
      totalExpenses,
      totalReceivables,
      totalPayables,
      profit,
      profitMargin,
      salesCount: finalSales.length,
      purchasesCount: finalPurchases.length,
      expensesCount: reportableExpenses.filter((e) => e.status === 'paid').length,
    };
  }, [finalSales, finalPurchases, reportableExpenses]);

  React.useEffect(() => {
    if (!companyId || reportType !== 'overview' || overviewBasis !== 'financial_gl') {
      if (reportType !== 'overview' || overviewBasis !== 'financial_gl') setGlFinancialOverview(null);
      return;
    }
    let cancelled = false;
    setGlOverviewLoading(true);
    const b = branchId === 'all' || !branchId ? undefined : branchId;
    Promise.all([
      accountingReportsService.getProfitLoss(companyId, reportStartDate, reportEndDate, b),
      accountingReportsService.getArApGlSnapshot(companyId, reportEndDate, b),
    ])
      .then(([pl, snap]) => {
        if (cancelled) return;
        setGlFinancialOverview({
          pl,
          arDrMinusCr: snap.ar != null ? snap.ar.balance : null,
          apCrMinusDr: snap.apNetCredit,
          wpCrMinusDr: snap.wpNetCredit,
          cashBankDrMinusCr: snap.cashBankNetDrMinusCr,
        });
      })
      .catch(() => {
        if (!cancelled) setGlFinancialOverview(null);
      })
      .finally(() => {
        if (!cancelled) setGlOverviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, reportType, overviewBasis, reportStartDate, reportEndDate, branchId]);

  const salesByStatus = useMemo(() => {
    const paid = finalSales.filter((s) => s.paymentStatus === 'paid').length;
    const partial = finalSales.filter((s) => s.paymentStatus === 'partial').length;
    const unpaid = finalSales.filter((s) => s.paymentStatus === 'unpaid').length;
    return [
      { name: 'Paid', value: paid, color: '#10B981' },
      { name: 'Partial', value: partial, color: '#F59E0B' },
      { name: 'Unpaid', value: unpaid, color: '#EF4444' },
    ];
  }, [finalSales]);

  const expensesByCategory = useMemo(() => {
    const paidExpenses = reportableExpenses.filter((e) => e.status === 'paid');
    const byCat: Record<string, number> = {};
    paidExpenses.forEach((e) => {
      const cat = e.category || 'Other';
      byCat[cat] = (byCat[cat] || 0) + (e.amount || 0);
    });
    return Object.entries(byCat).map(([name], i) => ({
      name,
      amount: byCat[name],
      color: COLORS[i % COLORS.length],
    })).filter((item) => item.amount > 0);
  }, [reportableExpenses]);

  // Monthly trend from real data (last 6 months)
  const monthlyTrend = useMemo(() => {
    const result: { month: string; sales: number; purchases: number; expenses: number; profit: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const monthLabel = MONTH_NAMES[d.getMonth()] + ' ' + d.getFullYear().toString().slice(2);

      const monthSales = chartSalesSource
        .filter((s) => {
          if (!s.date) return false;
          const sd = new Date(s.date);
          return sd >= monthStart && sd <= monthEnd;
        })
        .reduce((sum, s) => sum + s.total, 0);
      const monthPurchases = filteredPurchases
        .filter((p) => p.date && new Date(p.date) >= monthStart && new Date(p.date) <= monthEnd)
        .reduce((sum, p) => sum + p.total, 0);
      const monthExpenses = reportableExpenses
        .filter((e) => e.status === 'paid' && e.date && new Date(e.date) >= monthStart && new Date(e.date) <= monthEnd)
        .reduce((sum, e) => sum + (e.amount || 0), 0);
      result.push({
        month: monthLabel,
        sales: monthSales,
        purchases: monthPurchases,
        expenses: monthExpenses,
        profit: monthSales - monthPurchases - monthExpenses,
      });
    }
    return result;
  }, [chartSalesSource, filteredPurchases, reportableExpenses]);

  // Export data for current report type
  const getExportData = useCallback((): { headers: string[]; rows: (string | number)[][]; title: string } => {
    const scopeNote = `Scope: ${dateRangeLabel}; branch: ${branchId === 'all' || !branchId ? 'all' : branchId}`;
    const title = `Reports - ${reportType} - ${dateRangeLabel}`;
    switch (reportType) {
      case 'overview':
        if (overviewBasis === 'financial_gl' && glFinancialOverview?.pl) {
          const pl = glFinancialOverview.pl;
          return {
            title: `Reports — Overview — Financial GL (journal) — ${dateRangeLabel}`,
            headers: ['Metric', 'Value'],
            rows: [
              ['Basis', 'GL — canonical P&L + control balances (see banner)'],
              [scopeNote, ''],
              ['Total revenue (GL)', formatCurrency(pl.revenue.total)],
              ['Total cost of sales (GL)', formatCurrency(pl.costOfSales.total)],
              ['Total expenses (GL)', formatCurrency(pl.expenses.total)],
              ['Net profit (GL)', formatCurrency(pl.netProfit)],
              ['AR control 1100 (Dr−Cr, position)', glFinancialOverview.arDrMinusCr != null ? formatCurrency(glFinancialOverview.arDrMinusCr) : '—'],
              ['AP control 2000 (Cr−Dr)', glFinancialOverview.apCrMinusDr != null ? formatCurrency(glFinancialOverview.apCrMinusDr) : '—'],
              ['Worker Payable 2010 (Cr−Dr)', glFinancialOverview.wpCrMinusDr != null ? formatCurrency(glFinancialOverview.wpCrMinusDr) : '—'],
              ['Cash & bank (GL position)', glFinancialOverview.cashBankDrMinusCr != null ? formatCurrency(glFinancialOverview.cashBankDrMinusCr) : '—'],
            ],
          };
        }
        return {
          title: `Reports — Overview — Operational flow — ${dateRangeLabel}`,
          headers: ['Metric', 'Value'],
          rows: [
            ['Basis', 'Operational — documents in period (not GL TB/P&L)'],
            [scopeNote, ''],
            ['Total Sales', formatCurrency(metrics.totalSales)],
            ['Total Purchases', formatCurrency(metrics.totalPurchases)],
            ['Total Expenses (paid)', formatCurrency(metrics.totalExpenses)],
            ['Net result (operational flow)', formatCurrency(metrics.profit)],
            ['Margin on operational sales', `${metrics.profitMargin.toFixed(1)}%`],
            ['Document receivables (due)', formatCurrency(metrics.totalReceivables)],
            ['Document payables (due)', formatCurrency(metrics.totalPayables)],
            ['Invoices', metrics.salesCount],
            ['Purchase Orders', metrics.purchasesCount],
            ['Expenses Paid', metrics.expensesCount],
          ],
        };
      case 'sales':
        return {
          title,
          headers: ['Date', 'Invoice #', 'Customer', 'Lifecycle', 'Category', 'Total', 'Paid', 'Due', 'Payment'],
          rows: salesListDisplay.map((s) => {
            const life = getSaleStatusBadgeConfig(s);
            return [
              s.date || '',
              s.invoiceNo || '',
              s.customerName || '',
              life.label,
              isStudioSale(s) ? 'Studio' : 'Merchandise',
              s.total ?? 0,
              s.paid ?? 0,
              s.due ?? 0,
              s.paymentStatus || '',
            ];
          }),
        };
      case 'purchases':
        return {
          title,
          headers: ['Date', 'PO #', 'Supplier', 'Total', 'Paid', 'Due', 'Status'],
          rows: filteredPurchases.map((p) => [
            p.date || '',
            p.purchaseNo || '',
            p.supplierName || '',
            p.total ?? 0,
            p.paid ?? 0,
            p.due ?? 0,
            p.status || '',
          ]),
        };
      case 'expenses':
        return {
          title,
          headers: ['Date', 'Ref #', 'Category', 'Description', 'Amount', 'Payment', 'Status'],
          rows: reportableExpenses.map((e) => [
            e.date || '',
            e.expenseNo || '',
            e.category || '',
            e.description || '',
            e.amount ?? 0,
            e.paymentMethod || '',
            e.status || '',
          ]),
        };
      case 'financial':
        return {
          title,
          headers: ['Item', 'Amount'],
          rows: [
            ['Total Revenue', metrics.totalSales],
            ['Total Purchases', metrics.totalPurchases],
            ['Total Expenses', metrics.totalExpenses],
            ['Net Profit/Loss (operational)', metrics.profit],
            ['Accounts Receivable', metrics.totalReceivables],
            ['Accounts Payable', metrics.totalPayables],
          ],
        };
      default:
        return { title, headers: [], rows: [] };
    }
  }, [reportType, dateRangeLabel, metrics, salesListDisplay, filteredPurchases, reportableExpenses, overviewBasis, glFinancialOverview, branchId]);

  const handleExportPDF = () => {
    const data = getExportData();
    exportToPDF(data, `Report_${reportType}`);
  };
  const handleExportCSV = () => {
    const data = getExportData();
    exportToCSV(data, `Report_${reportType}`);
  };
  const handleExportExcel = () => {
    const data = getExportData();
    exportToExcel(data, `Report_${reportType}`);
  };

  // ============================================
  // RENDER
  // ============================================

  if (!canViewReports) {
    return (
      <div className="h-full w-full bg-gray-950 text-white flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400">You do not have permission to view financial reports.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full min-h-full bg-[#0B0F19] text-white overflow-auto">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <BarChart3 className="text-blue-400" size={28} />
                Reports & Analytics
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                Comprehensive business insights and financial reports
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Date range controlled by TopHeader global filter — no local dropdown */}

              {/* Branch — global rule: only visible when multiple branches */}
              <BranchSelector variant="header" showAllBranchesOption className="flex-shrink-0" />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2">
                    <Download size={16} />
                    Export
                    <ChevronDown size={14} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-gray-900 border-gray-700">
                  <DropdownMenuItem onClick={handleExportPDF} className="text-white focus:bg-gray-800">
                    Export PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportCSV} className="text-white focus:bg-gray-800">
                    Export CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportExcel} className="text-white focus:bg-gray-800">
                    Export Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Report Type Tabs: Overview, Sales, Purchases, Expenses, Financial */}
          <div className="flex items-center gap-2 mt-4">
            {[
              { key: 'overview', label: 'Overview', icon: Activity },
              { key: 'sales', label: 'Sales', icon: TrendingUp },
              { key: 'purchases', label: 'Purchases', icon: ShoppingCart },
              { key: 'expenses', label: 'Expenses', icon: DollarSign },
              { key: 'financial', label: 'Financial', icon: FileText },
              { key: 'commission', label: 'Commission', icon: Users },
              { key: 'product-ledger', label: 'Product Ledger', icon: Package },
              { key: 'product-sell', label: 'Product Sell', icon: ShoppingBag },
              { key: 'ledger-v2', label: 'Ledger Center V2', icon: BookOpen },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setReportType(tab.key as any)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
                  reportType === tab.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content – tab-specific (Overview, Sales, Purchases, Expenses only) */}
      <div className="p-6 space-y-6">
        {reportType !== 'ledger-v2' && (
          <div className="text-xs text-gray-500 mb-2">Period: {dateRangeLabel}</div>
        )}

        {/* Overview Tab — split: Operational flow vs Financial GL */}
        {reportType === 'overview' && (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {[
                { key: 'operational' as const, label: 'Operational Overview' },
                { key: 'financial_gl' as const, label: 'Financial GL Overview' },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setOverviewBasis(t.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    overviewBasis === t.key ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {overviewBasis === 'operational' ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2 text-xs text-amber-100/95 mb-4">
                <strong className="font-semibold">Basis: Operational</strong> — final sales, final/received purchases, paid expenses, document due balances in this period.{' '}
                <span className="text-amber-200/90">Not canonical GL net income.</span> Switch to <strong>Financial GL Overview</strong> for journal P&amp;L and control accounts.
              </div>
            ) : (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.07] px-3 py-2 text-xs text-emerald-100/95 mb-4">
                <strong className="font-semibold">Basis: GL (journal)</strong> — Profit &amp; Loss for the selected period matches Financial → P&amp;L; AR/AP/WP/cash-bank are <strong>control positions</strong> (life-to-date to period end, branch-scoped).{' '}
                <span className="text-emerald-200/85">Do not compare these numbers to Operational Overview without labeling.</span>
              </div>
            )}

            {overviewBasis === 'operational' && (
            <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <MetricCard title="Total Sales (operational)" value={formatCurrency(metrics.totalSales)} change={`${metrics.salesCount} invoices`} trend="up" icon={TrendingUp} iconColor="text-green-400" iconBg="bg-green-400/10" />
              <MetricCard title="Total Purchases (operational)" value={formatCurrency(metrics.totalPurchases)} change={`${metrics.purchasesCount} POs`} trend="up" icon={ShoppingCart} iconColor="text-blue-400" iconBg="bg-blue-400/10" />
              <MetricCard title="Total Expenses (paid)" value={formatCurrency(metrics.totalExpenses)} change={`${metrics.expensesCount} paid`} trend="up" icon={DollarSign} iconColor="text-orange-400" iconBg="bg-orange-400/10" />
              <MetricCard title="Receivables (document due)" value={formatCurrency(metrics.totalReceivables)} change="final sales due" trend="up" icon={DollarSign} iconColor="text-cyan-400" iconBg="bg-cyan-400/10" />
              <MetricCard title="Payables (document due)" value={formatCurrency(metrics.totalPayables)} change="PO due" trend="up" icon={Package} iconColor="text-amber-400" iconBg="bg-amber-400/10" />
              <MetricCard title="Net result (operational flow)" value={formatCurrency(metrics.profit)} change={`${metrics.profitMargin.toFixed(1)}% on sales · not GL`} trend={metrics.profit > 0 ? 'up' : 'down'} icon={Activity} iconColor={metrics.profit > 0 ? 'text-green-400' : 'text-red-400'} iconBg={metrics.profit > 0 ? 'bg-green-400/10' : 'bg-red-400/10'} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-gray-900 border-gray-800 p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><BarChart3 size={20} className="text-blue-400" /> Monthly Performance Trend</h3>
                <ChartContainer className="h-[300px]">
                  <LineChart data={monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="month" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }} labelStyle={{ color: '#F9FAFB' }} />
                    <Legend />
                    <Line type="monotone" dataKey="sales" stroke="#3B82F6" name="Sales" strokeWidth={2} />
                    <Line type="monotone" dataKey="purchases" stroke="#10B981" name="Purchases" strokeWidth={2} />
                    <Line type="monotone" dataKey="profit" stroke="#F59E0B" name="Net result (operational flow)" strokeWidth={2} />
                  </LineChart>
                </ChartContainer>
              </Card>
              <Card className="bg-gray-900 border-gray-800 p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><PieChartIcon size={20} className="text-green-400" /> Sales Payment Status</h3>
                <ChartContainer className="h-[300px]">
                  <PieChart>
                    <Pie data={salesByStatus} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} outerRadius={80} fill="#8884d8" dataKey="value">
                      {salesByStatus.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }} />
                  </PieChart>
                </ChartContainer>
              </Card>
              <Card className="bg-gray-900 border-gray-800 p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><DollarSign size={20} className="text-orange-400" /> Expenses by Category</h3>
                <ChartContainer className="h-[300px]">
                  <BarChart data={expensesByCategory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }} />
                    <Bar dataKey="amount" fill="#F59E0B" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </Card>
              <Card className="bg-gray-900 border-gray-800 p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><FileText size={20} className="text-purple-400" /> Operational summary</h3>
                <p className="text-[10px] text-gray-500 mb-3">Document-level totals in period — not GL TB/P&amp;L.</p>
                <div className="space-y-4">
                  <SummaryRow label="Sales (operational)" value={metrics.totalSales} color="text-green-400" />
                  <SummaryRow label="Purchases + paid expenses" value={metrics.totalPurchases + metrics.totalExpenses} color="text-red-400" />
                  <div className="border-t border-gray-800 pt-3"><SummaryRow label="Net result (operational flow)" value={metrics.profit} color={metrics.profit > 0 ? 'text-green-400' : 'text-red-400'} bold /></div>
                  <div className="border-t border-gray-800 pt-3">
                    <SummaryRow label="Receivables (document due)" value={metrics.totalReceivables} color="text-blue-400" />
                    <SummaryRow label="Payables (document due)" value={metrics.totalPayables} color="text-orange-400" />
                  </div>
                </div>
              </Card>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard icon={ShoppingCart} label="Total Invoices" value={metrics.salesCount} color="bg-blue-500/10 text-blue-400" />
              <StatCard icon={Package} label="Total Purchase Orders" value={metrics.purchasesCount} color="bg-green-500/10 text-green-400" />
              <StatCard icon={DollarSign} label="Total Expenses Paid" value={metrics.expensesCount} color="bg-orange-500/10 text-orange-400" />
            </div>
          </>
            )}

            {overviewBasis === 'financial_gl' && (
              <div className="space-y-4">
                {glOverviewLoading && (
                  <div className="flex items-center justify-center gap-2 text-gray-400 py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                    <span>Loading Financial GL overview…</span>
                  </div>
                )}
                {!glOverviewLoading && glFinancialOverview?.pl && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <MetricCard
                        title="Revenue (GL · P&L period)"
                        value={formatCurrency(glFinancialOverview.pl.revenue.total)}
                        change="journal"
                        trend="up"
                        icon={TrendingUp}
                        iconColor="text-green-400"
                        iconBg="bg-green-400/10"
                      />
                      <MetricCard
                        title="Expenses (GL · P&L period)"
                        value={formatCurrency(glFinancialOverview.pl.expenses.total)}
                        change="journal"
                        trend="up"
                        icon={DollarSign}
                        iconColor="text-orange-400"
                        iconBg="bg-orange-400/10"
                      />
                      <MetricCard
                        title="Net profit (GL)"
                        value={formatCurrency(glFinancialOverview.pl.netProfit)}
                        change="canonical · Financial → P&L"
                        trend={glFinancialOverview.pl.netProfit >= 0 ? 'up' : 'down'}
                        icon={Activity}
                        iconColor={glFinancialOverview.pl.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}
                        iconBg={glFinancialOverview.pl.netProfit >= 0 ? 'bg-green-400/10' : 'bg-red-400/10'}
                      />
                      <MetricCard
                        title="Cash & bank (GL position)"
                        value={
                          glFinancialOverview.cashBankDrMinusCr != null
                            ? formatCurrency(glFinancialOverview.cashBankDrMinusCr)
                            : '—'
                        }
                        change="Dr−Cr · life-to-date"
                        trend="up"
                        icon={DollarSign}
                        iconColor="text-cyan-400"
                        iconBg="bg-cyan-400/10"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <MetricCard
                        title="AR control 1100 (GL)"
                        value={
                          glFinancialOverview.arDrMinusCr != null
                            ? formatCurrency(glFinancialOverview.arDrMinusCr)
                            : '—'
                        }
                        change="Dr−Cr · position"
                        trend="up"
                        icon={Users}
                        iconColor="text-blue-400"
                        iconBg="bg-blue-400/10"
                      />
                      <MetricCard
                        title="AP control 2000 (GL)"
                        value={
                          glFinancialOverview.apCrMinusDr != null
                            ? formatCurrency(glFinancialOverview.apCrMinusDr)
                            : '—'
                        }
                        change="Cr−Dr · supplier AP only"
                        trend="up"
                        icon={ShoppingCart}
                        iconColor="text-rose-400"
                        iconBg="bg-rose-400/10"
                      />
                      <MetricCard
                        title="Worker Payable 2010 (GL)"
                        value={
                          glFinancialOverview.wpCrMinusDr != null
                            ? formatCurrency(glFinancialOverview.wpCrMinusDr)
                            : '—'
                        }
                        change="Cr−Dr · not mixed with AP"
                        trend="up"
                        icon={Users}
                        iconColor="text-violet-400"
                        iconBg="bg-violet-400/10"
                      />
                    </div>
                    <p className="text-[11px] text-gray-500 px-1">
                      Control balances are journal positions to period end ({reportEndDate}); P&amp;L lines are activity in [{reportStartDate} … {reportEndDate}]. Use Financial tab for full TB/BS/P&amp;L drill-down.
                    </p>
                  </>
                )}
                {!glOverviewLoading && !glFinancialOverview?.pl && companyId && (
                  <p className="text-center text-gray-500 py-12">Could not load GL overview. Open Financial → Profit &amp; Loss.</p>
                )}
              </div>
            )}
          </>
        )}

        {/* Sales Tab */}
        {reportType === 'sales' && (
          <>
            {reportSalesLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-400 px-1">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading sales for {dateRangeLabel}…
              </div>
            )}
            {reportSalesTruncated && (
              <p className="text-xs text-amber-400/90 px-1">
                Showing first 5,000 invoices in this period — narrow the date range for a complete list.
              </p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard title="Total Sales (final)" value={formatCurrency(metrics.totalSales)} change={`${metrics.salesCount} invoices`} trend="up" icon={TrendingUp} iconColor="text-green-400" iconBg="bg-green-400/10" />
              <MetricCard title="Receivables (final due)" value={formatCurrency(metrics.totalReceivables)} change="Outstanding on final invoices" trend="up" icon={DollarSign} iconColor="text-blue-400" iconBg="bg-blue-400/10" />
              <StatCard icon={ShoppingCart} label="Final invoices" value={metrics.salesCount} color="bg-green-500/10 text-green-400" />
            </div>
            <p className="text-[11px] text-gray-500 px-1">
              Total Sales = final invoices in period (document flow). Cash/bank GL includes rentals, refunds, and non-sales receipts — use Overview → Financial GL or Roznamcha for cash tie-out.
              {salePaymentsInPeriod != null && (
                <> Diagnostic: cash collected on sales (payments) in period: <strong className="text-gray-400">{formatCurrency(salePaymentsInPeriod)}</strong>.</>
              )}
            </p>
            {orderPipelineTotal > 0 && (
              <p className="text-[11px] text-purple-300/80 px-1">
                Orders pipeline (unfinalized): {formatCurrency(orderPipelineTotal)} · {orderPipeline.length} order(s) — not included in Total Sales until final.
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card className="bg-gray-900/80 border-gray-800 p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Merchandise (4000)</p>
                <p className="text-lg font-semibold text-green-400 mt-1">{formatCurrency(merchandiseFinalTotal)}</p>
                <p className="text-[10px] text-gray-600 mt-1">Final non-studio sales</p>
              </Card>
              <Card className="bg-gray-900/80 border-gray-800 p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Studio service (4010)</p>
                <p className="text-lg font-semibold text-violet-400 mt-1">{formatCurrency(studioFinalTotal)}</p>
                <p className="text-[10px] text-gray-600 mt-1">Final studio-flagged sales</p>
              </Card>
              <Card className="bg-gray-900/80 border-gray-800 p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
                  <Home className="w-3 h-3" /> Rental income (GL 4200)
                </p>
                <p className="text-lg font-semibold text-pink-400 mt-1">
                  {rentalGl4200 != null ? formatCurrency(rentalGl4200) : '—'}
                </p>
                <p className="text-[10px] text-gray-600 mt-1">
                  {rentalBookingStats
                    ? `${rentalBookingStats.total} booking(s) · ${rentalBookingStats.returned} returned · ${rentalBookingStats.cancelled} cancelled`
                    : 'Not in Sales List — see Rentals module'}
                </p>
              </Card>
            </div>
            <div className="flex flex-wrap items-center gap-3 px-1">
              <Select value={salesLifecycleFilter} onValueChange={(v) => setSalesLifecycleFilter(v as SalesLifecycleFilter)}>
                <SelectTrigger className="w-[200px] bg-gray-900 border-gray-700 text-sm h-9">
                  <SelectValue placeholder="Lifecycle filter" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700">
                  <SelectItem value="operational">Operational (final + orders)</SelectItem>
                  <SelectItem value="final_only">Final only</SelectItem>
                  <SelectItem value="orders_pipeline">Orders pipeline</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="all">All statuses</SelectItem>
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showNonOperationalSales}
                  onChange={(e) => setShowNonOperationalSales(e.target.checked)}
                  className="rounded border-gray-600"
                />
                Show draft / quotation
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeOrdersInCharts}
                  onChange={(e) => setIncludeOrdersInCharts(e.target.checked)}
                  className="rounded border-gray-600"
                />
                Include orders in charts
              </label>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-gray-900 border-gray-800 p-6">
                <h3 className="text-lg font-bold text-white mb-4">Sales by Payment Status (final)</h3>
                <ChartContainer className="h-[260px]">
                  <PieChart>
                    <Pie data={salesByStatus} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${value}`} outerRadius={80} dataKey="value">
                      {salesByStatus.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }} />
                  </PieChart>
                </ChartContainer>
              </Card>
              <Card className="bg-gray-900 border-gray-800 p-6">
                <h3 className="text-lg font-bold text-white mb-4">Monthly Sales {includeOrdersInCharts ? '(operational)' : '(final)'}</h3>
                <ChartContainer className="h-[260px]">
                  <BarChart data={monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="month" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }} />
                    <Bar dataKey="sales" fill="#10B981" radius={[8, 8, 0, 0]} name="Sales" />
                  </BarChart>
                </ChartContainer>
              </Card>
            </div>
            <Card className="bg-gray-900 border-gray-800 p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h3 className="text-lg font-bold text-white">Sales List</h3>
                <span className="text-xs text-gray-500">{salesListDisplay.length} row(s) · filter: {salesLifecycleFilter.replace('_', ' ')}</span>
              </div>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-base text-left leading-snug">
                  <thead className="text-gray-500 uppercase border-b border-gray-800 sticky top-0 bg-gray-900 text-sm">
                    <tr>
                      <th className="py-2 pr-4">Date</th>
                      <th className="py-2 pr-4">Invoice #</th>
                      <th className="py-2 pr-4">Customer</th>
                      <th className="py-2 pr-4">Category</th>
                      <th className="py-2 pr-4">Total</th>
                      <th className="py-2 pr-4">Paid</th>
                      <th className="py-2 pr-4">Due</th>
                      <th className="py-2 pr-4">Lifecycle</th>
                      <th className="py-2 pr-4">Payment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {reportSalesLoading ? (
                      <tr><td colSpan={9} className="py-8 text-center text-gray-500"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</td></tr>
                    ) : salesListDisplay.length === 0 ? (
                      <tr><td colSpan={9} className="py-8 text-center text-gray-500">No sales match filter in selected period</td></tr>
                    ) : (
                      salesListDisplay.map((s) => {
                        const life = getSaleStatusBadgeConfig(s);
                        const cancelled = getEffectiveSaleStatus(s) === 'cancelled';
                        return (
                          <tr key={s.id} className={cn('text-gray-300', cancelled && 'opacity-60')}>
                            <td className={cn('py-2 pr-4', cancelled && 'line-through')}>{s.date ? formatDate(new Date(s.date)) : '—'}</td>
                            <td className={cn('py-2 pr-4 font-mono', cancelled && 'line-through')}>{s.invoiceNo || s.orderNo || '—'}</td>
                            <td className="py-2 pr-4">{s.customerName || '—'}</td>
                            <td className="py-2 pr-4 text-xs">{isStudioSale(s) ? <span className="text-violet-400">Studio</span> : <span className="text-gray-400">Merchandise</span>}</td>
                            <td className={cn('py-2 pr-4', cancelled && 'line-through')}>{formatCurrency(s.total ?? 0)}</td>
                            <td className="py-2 pr-4">{formatCurrency(s.paid ?? 0)}</td>
                            <td className="py-2 pr-4">{formatCurrency(s.due ?? 0)}</td>
                            <td className="py-2 pr-4">
                              <Badge variant="outline" className={cn('text-xs border', life.bg, life.text, life.border)}>{life.label}</Badge>
                            </td>
                            <td className="py-2 pr-4">
                              <Badge variant="outline" className="text-xs capitalize">{s.paymentStatus || '—'}</Badge>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}

        {/* Purchases Tab */}
        {reportType === 'purchases' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard title="Total Purchases" value={formatCurrency(metrics.totalPurchases)} change={`${metrics.purchasesCount} POs`} trend="up" icon={ShoppingCart} iconColor="text-blue-400" iconBg="bg-blue-400/10" />
              <MetricCard title="Payables" value={formatCurrency(metrics.totalPayables)} change="Outstanding" trend="up" icon={DollarSign} iconColor="text-orange-400" iconBg="bg-orange-400/10" />
              <StatCard icon={Package} label="Purchase Orders" value={metrics.purchasesCount} color="bg-blue-500/10 text-blue-400" />
            </div>
            <div className="flex flex-wrap items-center gap-3 px-1 mb-2">
              <Select value={purchaseLifecycleFilter} onValueChange={(v) => setPurchaseLifecycleFilter(v as typeof purchaseLifecycleFilter)}>
                <SelectTrigger className="w-[180px] bg-gray-900 border-gray-700 text-sm h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700">
                  <SelectItem value="operational">Operational (excl. draft/cancelled)</SelectItem>
                  <SelectItem value="cancelled">Cancelled only</SelectItem>
                  <SelectItem value="all">All statuses</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Card className="bg-gray-900 border-gray-800 p-6">
              <h3 className="text-lg font-bold text-white mb-4">Monthly Purchases</h3>
              <ChartContainer className="h-[280px] mb-6">
                <BarChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }} />
                  <Bar dataKey="purchases" fill="#3B82F6" radius={[8, 8, 0, 0]} name="Purchases" />
                </BarChart>
              </ChartContainer>
              <h3 className="text-lg font-bold text-white mb-4">Purchases List</h3>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-base text-left leading-snug">
                  <thead className="text-gray-500 uppercase border-b border-gray-800 sticky top-0 bg-gray-900 text-sm">
                    <tr><th className="py-2 pr-4">Date</th><th className="py-2 pr-4">PO #</th><th className="py-2 pr-4">Supplier</th><th className="py-2 pr-4">Total</th><th className="py-2 pr-4">Paid</th><th className="py-2 pr-4">Due</th><th className="py-2 pr-4">Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {filteredPurchases.length === 0 ? (
                      <tr><td colSpan={7} className="py-8 text-center text-gray-500">No purchases in selected period</td></tr>
                    ) : (
                      filteredPurchases.map((p) => {
                        const st = String((p as { status?: string }).status || '—');
                        const isCancelled = st.toLowerCase() === 'cancelled';
                        return (
                        <tr key={p.id} className={cn('text-gray-300', isCancelled && 'opacity-60')}>
                          <td className="py-2 pr-4">{p.date ? formatDate(new Date(p.date)) : '—'}</td>
                          <td className="py-2 pr-4 font-mono">{p.purchaseNo || '—'}</td>
                          <td className="py-2 pr-4">{p.supplierName || '—'}</td>
                          <td className="py-2 pr-4">{formatCurrency(p.total ?? 0)}</td>
                          <td className="py-2 pr-4">{formatCurrency(p.paid ?? 0)}</td>
                          <td className="py-2 pr-4">{formatCurrency(p.due ?? 0)}</td>
                          <td className="py-2 pr-4"><Badge variant="outline" className="text-xs capitalize">{st}</Badge></td>
                        </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}

        {/* Expenses Tab */}
        {reportType === 'expenses' && (
          <>
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={showReversedExpenses}
                onChange={(e) => setShowReversedExpenses(e.target.checked)}
                className="rounded border-gray-600 bg-gray-950"
              />
              Show reversed expenses (offset in GL)
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard title="Total Expenses" value={formatCurrency(metrics.totalExpenses)} change={`${metrics.expensesCount} paid`} trend="up" icon={DollarSign} iconColor="text-orange-400" iconBg="bg-orange-400/10" />
              <StatCard icon={DollarSign} label="Paid Expenses" value={metrics.expensesCount} color="bg-orange-500/10 text-orange-400" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-gray-900 border-gray-800 p-6">
                <h3 className="text-lg font-bold text-white mb-4">Expenses by Category</h3>
                <ChartContainer className="h-[300px]">
                  <BarChart data={expensesByCategory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }} />
                    <Bar dataKey="amount" fill="#F59E0B" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </Card>
              <Card className="bg-gray-900 border-gray-800 p-6">
                <h3 className="text-lg font-bold text-white mb-4">Monthly Expenses</h3>
                <ChartContainer className="h-[300px]">
                  <BarChart data={monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="month" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }} />
                    <Bar dataKey="expenses" fill="#F59E0B" radius={[8, 8, 0, 0]} name="Expenses" />
                  </BarChart>
                </ChartContainer>
              </Card>
            </div>
            <Card className="bg-gray-900 border-gray-800 p-6">
              <h3 className="text-lg font-bold text-white mb-4">Expenses List</h3>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-base text-left leading-snug">
                  <thead className="text-gray-500 uppercase border-b border-gray-800 sticky top-0 bg-gray-900 text-sm">
                    <tr><th className="py-2 pr-4">Date</th><th className="py-2 pr-4">Ref #</th><th className="py-2 pr-4">Category</th><th className="py-2 pr-4">Description</th><th className="py-2 pr-4">Amount</th><th className="py-2 pr-4">Payment</th><th className="py-2 pr-4">Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {reportableExpenses.length === 0 ? (
                      <tr><td colSpan={7} className="py-8 text-center text-gray-500">No expenses in selected period</td></tr>
                    ) : (
                      reportableExpenses.map((e) => (
                        <tr key={e.id} className="text-gray-300">
                          <td className="py-2 pr-4">{e.date ? formatDate(new Date(e.date)) : '—'}</td>
                          <td className="py-2 pr-4 font-mono">{e.expenseNo || '—'}</td>
                          <td className="py-2 pr-4">{e.category || '—'}</td>
                          <td className="py-2 pr-4">{e.description || '—'}</td>
                          <td className="py-2 pr-4 text-red-400">{formatCurrency(e.amount ?? 0)}</td>
                          <td className="py-2 pr-4">{e.paymentMethod || '—'}</td>
                          <td className="py-2 pr-4"><Badge variant="outline" className="text-sm">{e.status || '—'}</Badge></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}

        {/* Financial Tab – Trial Balance, P&L, Balance Sheet, Sales Profit, Inventory Valuation */}
        {reportType === 'financial' && (
          <>
            {financialReportType !== 'customers-suppliers' &&
              financialReportType !== 'remaining-balance' &&
              financialReportType !== 'balance-basis-guide' && (
              <div className="rounded-lg border border-sky-500/25 bg-sky-950/30 px-3 py-2 text-[11px] text-sky-100/90 mb-2">
                These reports are <strong className="text-sky-200">canonical GL</strong> (journal). Overview → Operational uses documents — compare only after reading basis labels on both.
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {[
                { key: 'trial-balance', label: 'Trial Balance' },
                { key: 'profit-loss', label: 'Profit & Loss' },
                { key: 'customers-suppliers', label: 'Customers & Suppliers' },
                { key: 'balance-basis-guide', label: 'Balance Basis Guide' },
                { key: 'balance-sheet', label: 'Balance Sheet' },
                { key: 'sales-profit', label: 'Sales Profit' },
                { key: 'inventory-valuation', label: 'Inventory Valuation' },
                { key: 'ledger-statement-v2', label: 'Statements / Ledgers V2' },
                { key: 'remaining-balance', label: 'Remaining Balance' },
              ].map((sub) => (
                <button
                  key={sub.key}
                  onClick={() => setFinancialReportType(sub.key as any)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    financialReportType === sub.key
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
            {financialReportType !== 'ledger-statement-v2' &&
              financialReportType !== 'remaining-balance' &&
              financialReportType !== 'balance-basis-guide' && (
              <div className="text-xs text-gray-500 mb-2">Period: {dateRangeLabel}</div>
            )}
            {financialReportType === 'balance-basis-guide' && (
              <div className="text-xs text-gray-500 mb-2">As of: {reportEndDate}</div>
            )}
            {financialReportType === 'trial-balance' && (
              <TrialBalancePage startDate={reportStartDate} endDate={reportEndDate} branchId={branchId} />
            )}
            {financialReportType === 'profit-loss' && (
              <ProfitLossPage startDate={reportStartDate} endDate={reportEndDate} branchId={branchId} />
            )}
            {financialReportType === 'customers-suppliers' && (
              <CustomersSuppliersReportPage
                startDate={reportStartDate}
                endDate={reportEndDate}
                branchId={branchId}
              />
            )}
            {financialReportType === 'balance-basis-guide' && (
              <BalanceBasisGuidePage asOfDate={reportEndDate} branchId={branchId} />
            )}
            {financialReportType === 'balance-sheet' && (
              <BalanceSheetPage asOfDate={reportEndDate} branchId={branchId} />
            )}
            {financialReportType === 'sales-profit' && (
              <SalesProfitPage startDate={reportStartDate} endDate={reportEndDate} branchId={branchId} />
            )}
            {financialReportType === 'inventory-valuation' && (
              <InventoryValuationPage asOfDate={reportEndDate} branchId={branchId} />
            )}
            {financialReportType === 'ledger-statement-v2' && (
              <LedgerStatementCenterV2Page
                embedded
                initialLedgerEntity={ledgerV2Initial}
                onInitialLedgerConsumed={() => setLedgerV2Initial(null)}
              />
            )}
            {financialReportType === 'remaining-balance' && (
              <RemainingBalanceReport branchId={branchId === 'all' ? null : branchId} />
            )}
          </>
        )}

        {reportType === 'ledger-v2' && (
          <LedgerStatementCenterV2Page
            embedded
            initialLedgerEntity={ledgerV2Initial}
            onInitialLedgerConsumed={() => setLedgerV2Initial(null)}
          />
        )}

        {reportType === 'commission' && (
          <CommissionReportPage
            startDate={reportStartDate}
            endDate={reportEndDate}
            branchId={branchId === 'all' ? null : branchId}
          />
        )}

        {reportType === 'product-ledger' && (
          <ProductLedger />
        )}

        {reportType === 'product-sell' && (
          <ProductSellReportPage
            startDate={reportStartDate}
            endDate={reportEndDate}
            branchId={branchId && branchId !== 'all' ? branchId : undefined}
          />
        )}

      </div>
    </div>
  );
};

// ============================================
// HELPER COMPONENTS
// ============================================

const MetricCard = ({ title, value, change, trend, icon: Icon, iconColor, iconBg }: any) => (
  <Card className="bg-gray-900 border-gray-800 p-6 hover:bg-gray-800/50 transition-colors">
    <div className="flex items-center justify-between mb-3">
      <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center`}>
        <Icon className={iconColor} size={24} />
      </div>
      <Badge variant={trend === 'up' ? 'default' : 'destructive'} className="text-xs">
        {change}
      </Badge>
    </div>
    <h3 className="text-sm text-gray-400 font-medium">{title}</h3>
    <p className="text-2xl font-bold text-white mt-1">{value}</p>
  </Card>
);

const SummaryRow = ({ label, value, color, bold }: { label: string; value: string; color: string; bold?: boolean }) => (
  <div className="flex items-center justify-between">
    <span className={`text-sm ${bold ? 'font-bold text-white' : 'text-gray-400'}`}>{label}</span>
    <span className={`text-sm font-semibold ${color}`}>{value}</span>
  </div>
);

const StatCard = ({ icon: Icon, label, value, color }: any) => (
  <Card className="bg-gray-900 border-gray-800 p-6">
    <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center mb-3`}>
      <Icon size={24} />
    </div>
    <h3 className="text-sm text-gray-400 font-medium">{label}</h3>
    <p className="text-3xl font-bold text-white mt-1">{value}</p>
  </Card>
);
