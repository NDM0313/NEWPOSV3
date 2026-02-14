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
  Calendar,
  Download,
  FileText,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  ChevronDown
} from 'lucide-react';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { useSales } from '@/app/context/SalesContext';
import { usePurchases } from '@/app/context/PurchaseContext';
import { useExpenses } from '@/app/context/ExpenseContext';
import { useAccounting } from '@/app/context/AccountingContext';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChartContainer } from '@/app/components/ui/chart';
import { exportToCSV, exportToExcel, exportToPDF } from '@/app/utils/exportUtils';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { useFormatDate } from '@/app/hooks/useFormatDate';
import { useCheckPermission } from '@/app/hooks/useCheckPermission';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';

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

export const ReportsDashboardEnhanced = () => {
  const sales = useSales();
  const purchases = usePurchases();
  const expenses = useExpenses();
  const accounting = useAccounting();
  const { formatCurrency } = useFormatCurrency();
  const { formatDate } = useFormatDate();
  const { canViewReports } = useCheckPermission();

  const [dateRange, setDateRange] = useState('30');
  const [reportType, setReportType] = useState<'overview' | 'sales' | 'purchases' | 'expenses' | 'financial'>('overview');

  const { start: rangeStart, end: rangeEnd } = useMemo(() => getDateRangeBounds(dateRange), [dateRange]);
  const filterByRange = useCallback(
    (dateStr: string | undefined) => isInRange(dateStr, rangeStart, rangeEnd),
    [rangeStart, rangeEnd]
  );

  // Filtered data by date range
  const filteredSales = useMemo(
    () => sales.sales.filter((s) => filterByRange(s.date)),
    [sales.sales, filterByRange]
  );
  const filteredPurchases = useMemo(
    () => purchases.purchases.filter((p) => filterByRange(p.date)),
    [purchases.purchases, filterByRange]
  );
  const filteredExpenses = useMemo(
    () => expenses.expenses.filter((e) => filterByRange(e.date)),
    [expenses.expenses, filterByRange]
  );

  // ============================================
  // METRICS (from filtered data)
  // ============================================

  const metrics = useMemo(() => {
    const totalSales = filteredSales.reduce((sum, sale) => 
      sale.type === 'invoice' ? sum + sale.total : sum, 0
    );
    const totalPurchases = filteredPurchases.reduce((sum, p) => sum + p.total, 0);
    const totalExpenses = filteredExpenses
      .filter((e) => e.status === 'paid')
      .reduce((sum, e) => sum + e.amount, 0);
    const totalReceivables = filteredSales.reduce((sum, s) => 
      s.type === 'invoice' ? sum + s.due : sum, 0
    );
    const totalPayables = filteredPurchases.reduce((sum, p) => sum + p.due, 0);
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
      salesCount: filteredSales.filter((s) => s.type === 'invoice').length,
      purchasesCount: filteredPurchases.length,
      expensesCount: filteredExpenses.filter((e) => e.status === 'paid').length,
    };
  }, [filteredSales, filteredPurchases, filteredExpenses]);

  const salesByStatus = useMemo(() => {
    const paid = filteredSales.filter((s) => s.paymentStatus === 'paid').length;
    const partial = filteredSales.filter((s) => s.paymentStatus === 'partial').length;
    const unpaid = filteredSales.filter((s) => s.paymentStatus === 'unpaid').length;
    return [
      { name: 'Paid', value: paid, color: '#10B981' },
      { name: 'Partial', value: partial, color: '#F59E0B' },
      { name: 'Unpaid', value: unpaid, color: '#EF4444' },
    ];
  }, [filteredSales]);

  const expensesByCategory = useMemo(() => {
    const paidExpenses = filteredExpenses.filter((e) => e.status === 'paid');
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
  }, [filteredExpenses]);

  // Monthly trend from real data (last 6 months)
  const monthlyTrend = useMemo(() => {
    const result: { month: string; sales: number; purchases: number; expenses: number; profit: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const monthLabel = MONTH_NAMES[d.getMonth()] + ' ' + d.getFullYear().toString().slice(2);

      const monthSales = filteredSales
        .filter((s) => {
          if (s.type !== 'invoice' || !s.date) return false;
          const sd = new Date(s.date);
          return sd >= monthStart && sd <= monthEnd;
        })
        .reduce((sum, s) => sum + s.total, 0);
      const monthPurchases = filteredPurchases
        .filter((p) => p.date && new Date(p.date) >= monthStart && new Date(p.date) <= monthEnd)
        .reduce((sum, p) => sum + p.total, 0);
      const monthExpenses = filteredExpenses
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
  }, [filteredSales, filteredPurchases, filteredExpenses]);

  const dateRangeLabel = useMemo(() => {
    if (dateRange === 'all') return 'All time';
    const n = parseInt(dateRange, 10);
    if (n === 7) return 'Last 7 days';
    if (n === 30) return 'Last 30 days';
    if (n === 90) return 'Last 90 days';
    if (n === 365) return 'Last year';
    return `Last ${dateRange} days`;
  }, [dateRange]);

  // Export data for current report type
  const getExportData = useCallback((): { headers: string[]; rows: (string | number)[][]; title: string } => {
    const title = `Reports - ${reportType} - ${dateRangeLabel}`;
    switch (reportType) {
      case 'overview':
        return {
          title,
          headers: ['Metric', 'Value'],
          rows: [
            ['Total Sales', formatCurrency(metrics.totalSales)],
            ['Total Purchases', formatCurrency(metrics.totalPurchases)],
            ['Total Expenses', formatCurrency(metrics.totalExpenses)],
            ['Net Profit', formatCurrency(metrics.profit)],
            ['Profit Margin', `${metrics.profitMargin.toFixed(1)}%`],
            ['Invoices', metrics.salesCount],
            ['Purchase Orders', metrics.purchasesCount],
            ['Expenses Paid', metrics.expensesCount],
          ],
        };
      case 'sales':
        return {
          title,
          headers: ['Date', 'Invoice #', 'Customer', 'Type', 'Total', 'Paid', 'Due', 'Status'],
          rows: filteredSales.map((s) => [
            s.date || '',
            s.invoiceNo || '',
            s.customerName || '',
            s.type || '',
            s.total ?? 0,
            s.paid ?? 0,
            s.due ?? 0,
            s.paymentStatus || '',
          ]),
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
          rows: filteredExpenses.map((e) => [
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
            ['Net Profit/Loss', metrics.profit],
            ['Accounts Receivable', metrics.totalReceivables],
            ['Accounts Payable', metrics.totalPayables],
          ],
        };
      default:
        return { title, headers: [], rows: [] };
    }
  }, [reportType, dateRangeLabel, metrics, filteredSales, filteredPurchases, filteredExpenses]);

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
    <div className="h-full w-full bg-gray-950 text-white overflow-auto">
      {/* Header */}
      <div className="border-b border-gray-800/80 bg-gray-900/98 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
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
              {/* Date Range Filter */}
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="365">Last year</option>
                <option value="all">All time</option>
              </select>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2 rounded-lg shadow-md">
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

          {/* Report Type Tabs */}
          <div className="flex items-center gap-2 mt-4">
            {[
              { key: 'overview', label: 'Overview', icon: Activity },
              { key: 'sales', label: 'Sales', icon: TrendingUp },
              { key: 'purchases', label: 'Purchases', icon: ShoppingCart },
              { key: 'expenses', label: 'Expenses', icon: DollarSign },
              { key: 'financial', label: 'Financial', icon: FileText },
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

      {/* Content – tab-specific */}
      <div className="p-6 space-y-6">
        <div className="text-xs text-gray-500 mb-2">Period: {dateRangeLabel}</div>

        {/* Overview Tab */}
        {reportType === 'overview' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard title="Total Sales" value={formatCurrency(metrics.totalSales)} change={`${metrics.salesCount} invoices`} trend="up" icon={TrendingUp} iconColor="text-green-400" iconBg="bg-green-400/10" />
              <MetricCard title="Total Purchases" value={formatCurrency(metrics.totalPurchases)} change={`${metrics.purchasesCount} POs`} trend="up" icon={ShoppingCart} iconColor="text-blue-400" iconBg="bg-blue-400/10" />
              <MetricCard title="Total Expenses" value={formatCurrency(metrics.totalExpenses)} change={`${metrics.expensesCount} paid`} trend="up" icon={DollarSign} iconColor="text-orange-400" iconBg="bg-orange-400/10" />
              <MetricCard title="Net Profit" value={formatCurrency(metrics.profit)} change={`${metrics.profitMargin.toFixed(1)}% margin`} trend={metrics.profit > 0 ? 'up' : 'down'} icon={Activity} iconColor={metrics.profit > 0 ? 'text-green-400' : 'text-red-400'} iconBg={metrics.profit > 0 ? 'bg-green-400/10' : 'bg-red-400/10'} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-gray-900/80 border border-gray-800 rounded-2xl shadow-sm p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><BarChart3 size={20} className="text-blue-400" /> Monthly Performance Trend</h3>
                <ChartContainer className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="month" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" />
                      <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }} labelStyle={{ color: '#F9FAFB' }} />
                      <Legend />
                      <Line type="monotone" dataKey="sales" stroke="#3B82F6" name="Sales" strokeWidth={2} />
                      <Line type="monotone" dataKey="purchases" stroke="#10B981" name="Purchases" strokeWidth={2} />
                      <Line type="monotone" dataKey="profit" stroke="#F59E0B" name="Profit" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </Card>
              <Card className="bg-gray-900/80 border border-gray-800 rounded-2xl shadow-sm p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><PieChartIcon size={20} className="text-green-400" /> Sales Payment Status</h3>
                <ChartContainer className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={salesByStatus} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} outerRadius={80} fill="#8884d8" dataKey="value">
                        {salesByStatus.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </Card>
              <Card className="bg-gray-900/80 border border-gray-800 rounded-2xl shadow-sm p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><DollarSign size={20} className="text-orange-400" /> Expenses by Category</h3>
                <ChartContainer className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={expensesByCategory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="name" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" />
                      <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }} />
                      <Bar dataKey="amount" fill="#F59E0B" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </Card>
              <Card className="bg-gray-900/80 border border-gray-800 rounded-2xl shadow-sm p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><FileText size={20} className="text-purple-400" /> Financial Summary</h3>
                <div className="space-y-4">
                  <SummaryRow label="Total Revenue" value={metrics.totalSales} color="text-green-400" />
                  <SummaryRow label="Total Expenses" value={metrics.totalPurchases + metrics.totalExpenses} color="text-red-400" />
                  <div className="border-t border-gray-800 pt-3"><SummaryRow label="Net Profit/Loss" value={metrics.profit} color={metrics.profit > 0 ? 'text-green-400' : 'text-red-400'} bold /></div>
                  <div className="border-t border-gray-800 pt-3">
                    <SummaryRow label="Accounts Receivable" value={metrics.totalReceivables} color="text-blue-400" />
                    <SummaryRow label="Accounts Payable" value={metrics.totalPayables} color="text-orange-400" />
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

        {/* Sales Tab */}
        {reportType === 'sales' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard title="Total Sales" value={formatCurrency(metrics.totalSales)} change={`${metrics.salesCount} invoices`} trend="up" icon={TrendingUp} iconColor="text-green-400" iconBg="bg-green-400/10" />
              <MetricCard title="Receivables" value={formatCurrency(metrics.totalReceivables)} change="Outstanding" trend="up" icon={DollarSign} iconColor="text-blue-400" iconBg="bg-blue-400/10" />
              <StatCard icon={ShoppingCart} label="Invoices" value={metrics.salesCount} color="bg-green-500/10 text-green-400" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-gray-900/80 border border-gray-800 rounded-2xl shadow-sm p-6">
                <h3 className="text-lg font-bold text-white mb-4">Sales by Payment Status</h3>
                <ChartContainer className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={salesByStatus} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${value}`} outerRadius={80} dataKey="value">
                        {salesByStatus.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </Card>
              <Card className="bg-gray-900/80 border border-gray-800 rounded-2xl shadow-sm p-6">
                <h3 className="text-lg font-bold text-white mb-4">Monthly Sales</h3>
                <ChartContainer className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="month" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" />
                      <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }} />
                      <Bar dataKey="sales" fill="#10B981" radius={[8, 8, 0, 0]} name="Sales" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </Card>
            </div>
            <Card className="bg-gray-900/80 border border-gray-800 rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-bold text-white mb-4">Sales List</h3>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-gray-500 uppercase border-b border-gray-800 sticky top-0 bg-gray-900">
                    <tr><th className="py-2 pr-4">Date</th><th className="py-2 pr-4">Invoice #</th><th className="py-2 pr-4">Customer</th><th className="py-2 pr-4">Total</th><th className="py-2 pr-4">Paid</th><th className="py-2 pr-4">Due</th><th className="py-2 pr-4">Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {filteredSales.length === 0 ? (
                      <tr><td colSpan={7} className="py-8 text-center text-gray-500">No sales in selected period</td></tr>
                    ) : (
                      filteredSales.map((s) => (
                        <tr key={s.id} className="text-gray-300">
                          <td className="py-2 pr-4">{s.date ? formatDate(new Date(s.date)) : '—'}</td>
                          <td className="py-2 pr-4 font-mono">{s.invoiceNo || '—'}</td>
                          <td className="py-2 pr-4">{s.customerName || '—'}</td>
                          <td className="py-2 pr-4">{formatCurrency(s.total ?? 0)}</td>
                          <td className="py-2 pr-4">{formatCurrency(s.paid ?? 0)}</td>
                          <td className="py-2 pr-4">{formatCurrency(s.due ?? 0)}</td>
                          <td className="py-2 pr-4"><Badge variant="outline" className="text-xs">{s.paymentStatus || '—'}</Badge></td>
                        </tr>
                      ))
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
            <Card className="bg-gray-900/80 border border-gray-800 rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-bold text-white mb-4">Monthly Purchases</h3>
              <ChartContainer className="h-[280px] mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="month" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }} />
                    <Bar dataKey="purchases" fill="#3B82F6" radius={[8, 8, 0, 0]} name="Purchases" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
              <h3 className="text-lg font-bold text-white mb-4">Purchases List</h3>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-gray-500 uppercase border-b border-gray-800 sticky top-0 bg-gray-900">
                    <tr><th className="py-2 pr-4">Date</th><th className="py-2 pr-4">PO #</th><th className="py-2 pr-4">Supplier</th><th className="py-2 pr-4">Total</th><th className="py-2 pr-4">Paid</th><th className="py-2 pr-4">Due</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {filteredPurchases.length === 0 ? (
                      <tr><td colSpan={6} className="py-8 text-center text-gray-500">No purchases in selected period</td></tr>
                    ) : (
                      filteredPurchases.map((p) => (
                        <tr key={p.id} className="text-gray-300">
                          <td className="py-2 pr-4">{p.date ? formatDate(new Date(p.date)) : '—'}</td>
                          <td className="py-2 pr-4 font-mono">{p.purchaseNo || '—'}</td>
                          <td className="py-2 pr-4">{p.supplierName || '—'}</td>
                          <td className="py-2 pr-4">{formatCurrency(p.total ?? 0)}</td>
                          <td className="py-2 pr-4">{formatCurrency(p.paid ?? 0)}</td>
                          <td className="py-2 pr-4">{formatCurrency(p.due ?? 0)}</td>
                        </tr>
                      ))
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard title="Total Expenses" value={formatCurrency(metrics.totalExpenses)} change={`${metrics.expensesCount} paid`} trend="up" icon={DollarSign} iconColor="text-orange-400" iconBg="bg-orange-400/10" />
              <StatCard icon={DollarSign} label="Paid Expenses" value={metrics.expensesCount} color="bg-orange-500/10 text-orange-400" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-gray-900/80 border border-gray-800 rounded-2xl shadow-sm p-6">
                <h3 className="text-lg font-bold text-white mb-4">Expenses by Category</h3>
                <ChartContainer className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={expensesByCategory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="name" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" />
                      <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }} />
                      <Bar dataKey="amount" fill="#F59E0B" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </Card>
              <Card className="bg-gray-900/80 border border-gray-800 rounded-2xl shadow-sm p-6">
                <h3 className="text-lg font-bold text-white mb-4">Monthly Expenses</h3>
                <ChartContainer className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="month" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" />
                      <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }} />
                      <Bar dataKey="expenses" fill="#F59E0B" radius={[8, 8, 0, 0]} name="Expenses" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </Card>
            </div>
            <Card className="bg-gray-900/80 border border-gray-800 rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-bold text-white mb-4">Expenses List</h3>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-gray-500 uppercase border-b border-gray-800 sticky top-0 bg-gray-900">
                    <tr><th className="py-2 pr-4">Date</th><th className="py-2 pr-4">Ref #</th><th className="py-2 pr-4">Category</th><th className="py-2 pr-4">Description</th><th className="py-2 pr-4">Amount</th><th className="py-2 pr-4">Payment</th><th className="py-2 pr-4">Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {filteredExpenses.length === 0 ? (
                      <tr><td colSpan={7} className="py-8 text-center text-gray-500">No expenses in selected period</td></tr>
                    ) : (
                      filteredExpenses.map((e) => (
                        <tr key={e.id} className="text-gray-300">
                          <td className="py-2 pr-4">{e.date ? formatDate(new Date(e.date)) : '—'}</td>
                          <td className="py-2 pr-4 font-mono">{e.expenseNo || '—'}</td>
                          <td className="py-2 pr-4">{e.category || '—'}</td>
                          <td className="py-2 pr-4">{e.description || '—'}</td>
                          <td className="py-2 pr-4 text-red-400">{formatCurrency(e.amount ?? 0)}</td>
                          <td className="py-2 pr-4">{e.paymentMethod || '—'}</td>
                          <td className="py-2 pr-4"><Badge variant="outline" className="text-xs">{e.status || '—'}</Badge></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}

        {/* Financial Tab */}
        {reportType === 'financial' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard title="Total Revenue" value={formatCurrency(metrics.totalSales)} change={`${metrics.salesCount} invoices`} trend="up" icon={TrendingUp} iconColor="text-green-400" iconBg="bg-green-400/10" />
              <MetricCard title="Total Outflows" value={formatCurrency(metrics.totalPurchases + metrics.totalExpenses)} change="Purchases + Expenses" trend="up" icon={TrendingDown} iconColor="text-red-400" iconBg="bg-red-400/10" />
              <MetricCard title="Net Profit" value={formatCurrency(metrics.profit)} change={`${metrics.profitMargin.toFixed(1)}% margin`} trend={metrics.profit > 0 ? 'up' : 'down'} icon={Activity} iconColor={metrics.profit > 0 ? 'text-green-400' : 'text-red-400'} iconBg={metrics.profit > 0 ? 'bg-green-400/10' : 'bg-red-400/10'} />
              <StatCard icon={FileText} label="Receivables" value={formatCurrency(metrics.totalReceivables)} color="bg-blue-500/10 text-blue-400" />
            </div>
            <Card className="bg-gray-900/80 border border-gray-800 rounded-2xl shadow-sm p-6 max-w-2xl">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><FileText size={20} className="text-purple-400" /> Financial Summary</h3>
              <div className="space-y-4">
                <SummaryRow label="Total Revenue" value={formatCurrency(metrics.totalSales)} color="text-green-400" />
                <SummaryRow label="Total Purchases" value={formatCurrency(metrics.totalPurchases)} color="text-orange-400" />
                <SummaryRow label="Total Expenses" value={formatCurrency(metrics.totalExpenses)} color="text-orange-400" />
                <div className="border-t border-gray-800 pt-3">
                  <SummaryRow label="Net Profit/Loss" value={formatCurrency(metrics.profit)} color={metrics.profit > 0 ? 'text-green-400' : 'text-red-400'} bold />
                </div>
                <div className="border-t border-gray-800 pt-3">
                  <SummaryRow label="Accounts Receivable" value={formatCurrency(metrics.totalReceivables)} color="text-blue-400" />
                  <SummaryRow label="Accounts Payable" value={formatCurrency(metrics.totalPayables)} color="text-orange-400" />
                </div>
              </div>
            </Card>
            <Card className="bg-gray-900/80 border border-gray-800 rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-bold text-white mb-4">Profit by Month</h3>
              <ChartContainer className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="month" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }} />
                    <Line type="monotone" dataKey="profit" stroke="#10B981" name="Profit" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

// ============================================
// HELPER COMPONENTS
// ============================================

const MetricCard = ({ title, value, change, trend, icon: Icon, iconColor, iconBg }: any) => (
  <Card className="bg-gray-900/80 border border-gray-800 rounded-2xl shadow-sm p-6 hover:bg-gray-800/50 transition-colors">
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
  <Card className="bg-gray-900/80 border border-gray-800 rounded-2xl shadow-sm p-6">
    <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center mb-3`}>
      <Icon size={24} />
    </div>
    <h3 className="text-sm text-gray-400 font-medium">{label}</h3>
    <p className="text-3xl font-bold text-white mt-1">{value}</p>
  </Card>
);
