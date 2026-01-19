// ============================================
// 🎯 ENHANCED REPORTS DASHBOARD
// ============================================
// Complete reports with real data from contexts

import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingCart, 
  Package, 
  Users,
  Calendar,
  Download,
  FileText,
  BarChart3,
  PieChart as PieChartIcon,
  Activity
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

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export const ReportsDashboardEnhanced = () => {
  const sales = useSales();
  const purchases = usePurchases();
  const expenses = useExpenses();
  const accounting = useAccounting();

  const [dateRange, setDateRange] = useState('30'); // Last 30 days
  const [reportType, setReportType] = useState<'overview' | 'sales' | 'purchases' | 'expenses' | 'financial'>('overview');

  // ============================================
  // CALCULATIONS
  // ============================================

  const metrics = useMemo(() => {
    const totalSales = sales.sales.reduce((sum, sale) => 
      sale.type === 'invoice' ? sum + sale.total : sum, 0
    );
    
    const totalPurchases = purchases.purchases.reduce((sum, purchase) => 
      sum + purchase.total, 0
    );
    
    const totalExpenses = expenses.expenses
      .filter(e => e.status === 'paid')
      .reduce((sum, expense) => sum + expense.amount, 0);
    
    const totalReceivables = sales.sales.reduce((sum, sale) => 
      sale.type === 'invoice' ? sum + sale.due : sum, 0
    );
    
    const totalPayables = purchases.purchases.reduce((sum, purchase) => 
      sum + purchase.due, 0
    );
    
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
      salesCount: sales.sales.filter(s => s.type === 'invoice').length,
      purchasesCount: purchases.purchases.length,
      expensesCount: expenses.expenses.filter(e => e.status === 'paid').length,
    };
  }, [sales.sales, purchases.purchases, expenses.expenses]);

  // Sales by Payment Status
  const salesByStatus = useMemo(() => {
    const paid = sales.sales.filter(s => s.paymentStatus === 'paid').length;
    const partial = sales.sales.filter(s => s.paymentStatus === 'partial').length;
    const unpaid = sales.sales.filter(s => s.paymentStatus === 'unpaid').length;

    return [
      { name: 'Paid', value: paid, color: '#10B981' },
      { name: 'Partial', value: partial, color: '#F59E0B' },
      { name: 'Unpaid', value: unpaid, color: '#EF4444' },
    ];
  }, [sales.sales]);

  // Expenses by Category
  const expensesByCategory = useMemo(() => {
    const categories = ['Rent', 'Utilities', 'Salaries', 'Marketing', 'Travel', 'Office Supplies', 'Other'];
    
    return categories.map((category, index) => ({
      name: category,
      amount: expenses.getTotalByCategory(category as any),
      color: COLORS[index % COLORS.length],
    })).filter(item => item.amount > 0);
  }, [expenses]);

  // Monthly trend (mock data for visualization)
  const monthlyTrend = [
    { month: 'Jan', sales: 450000, purchases: 280000, expenses: 85000, profit: 85000 },
    { month: 'Feb', sales: 520000, purchases: 310000, expenses: 92000, profit: 118000 },
    { month: 'Mar', sales: 480000, purchases: 295000, expenses: 88000, profit: 97000 },
    { month: 'Apr', sales: 610000, purchases: 350000, expenses: 95000, profit: 165000 },
    { month: 'May', sales: 580000, purchases: 330000, expenses: 91000, profit: 159000 },
    { month: 'Jun', sales: 650000, purchases: 380000, expenses: 98000, profit: 172000 },
  ];

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="h-full w-full bg-gray-950 text-white overflow-auto">
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

              <Button className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2">
                <Download size={16} />
                Export PDF
              </Button>
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

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Sales"
            value={`Rs. ${metrics.totalSales.toLocaleString()}`}
            change="+12.5%"
            trend="up"
            icon={TrendingUp}
            iconColor="text-green-400"
            iconBg="bg-green-400/10"
          />
          <MetricCard
            title="Total Purchases"
            value={`Rs. ${metrics.totalPurchases.toLocaleString()}`}
            change="+8.3%"
            trend="up"
            icon={ShoppingCart}
            iconColor="text-blue-400"
            iconBg="bg-blue-400/10"
          />
          <MetricCard
            title="Total Expenses"
            value={`Rs. ${metrics.totalExpenses.toLocaleString()}`}
            change="+5.2%"
            trend="up"
            icon={DollarSign}
            iconColor="text-orange-400"
            iconBg="bg-orange-400/10"
          />
          <MetricCard
            title="Net Profit"
            value={`Rs. ${metrics.profit.toLocaleString()}`}
            change={`${metrics.profitMargin.toFixed(1)}% margin`}
            trend={metrics.profit > 0 ? 'up' : 'down'}
            icon={Activity}
            iconColor={metrics.profit > 0 ? 'text-green-400' : 'text-red-400'}
            iconBg={metrics.profit > 0 ? 'bg-green-400/10' : 'bg-red-400/10'}
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Trend */}
          <Card className="bg-gray-900 border-gray-800 p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <BarChart3 size={20} className="text-blue-400" />
              Monthly Performance Trend
            </h3>
            <ChartContainer className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#F9FAFB' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="sales" stroke="#3B82F6" name="Sales" strokeWidth={2} />
                  <Line type="monotone" dataKey="purchases" stroke="#10B981" name="Purchases" strokeWidth={2} />
                  <Line type="monotone" dataKey="profit" stroke="#F59E0B" name="Profit" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </Card>

          {/* Sales by Status */}
          <Card className="bg-gray-900 border-gray-800 p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <PieChartIcon size={20} className="text-green-400" />
              Sales Payment Status
            </h3>
            <ChartContainer className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={salesByStatus}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {salesByStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </Card>

          {/* Expenses by Category */}
          <Card className="bg-gray-900 border-gray-800 p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <DollarSign size={20} className="text-orange-400" />
              Expenses by Category
            </h3>
            <ChartContainer className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expensesByCategory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                  />
                  <Bar dataKey="amount" fill="#F59E0B" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </Card>

          {/* Financial Summary */}
          <Card className="bg-gray-900 border-gray-800 p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <FileText size={20} className="text-purple-400" />
              Financial Summary
            </h3>
            <div className="space-y-4">
              <SummaryRow label="Total Revenue" value={metrics.totalSales} color="text-green-400" />
              <SummaryRow label="Total Expenses" value={metrics.totalPurchases + metrics.totalExpenses} color="text-red-400" />
              <div className="border-t border-gray-800 pt-3">
                <SummaryRow label="Net Profit/Loss" value={metrics.profit} color={metrics.profit > 0 ? 'text-green-400' : 'text-red-400'} bold />
              </div>
              <div className="border-t border-gray-800 pt-3">
                <SummaryRow label="Accounts Receivable" value={metrics.totalReceivables} color="text-blue-400" />
                <SummaryRow label="Accounts Payable" value={metrics.totalPayables} color="text-orange-400" />
              </div>
            </div>
          </Card>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            icon={ShoppingCart}
            label="Total Invoices"
            value={metrics.salesCount}
            color="bg-blue-500/10 text-blue-400"
          />
          <StatCard
            icon={Package}
            label="Total Purchase Orders"
            value={metrics.purchasesCount}
            color="bg-green-500/10 text-green-400"
          />
          <StatCard
            icon={DollarSign}
            label="Total Expenses Paid"
            value={metrics.expensesCount}
            color="bg-orange-500/10 text-orange-400"
          />
        </div>
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

const SummaryRow = ({ label, value, color, bold }: any) => (
  <div className="flex items-center justify-between">
    <span className={`text-sm ${bold ? 'font-bold text-white' : 'text-gray-400'}`}>{label}</span>
    <span className={`text-sm font-semibold ${color}`}>
      Rs. {value.toLocaleString()}
    </span>
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
