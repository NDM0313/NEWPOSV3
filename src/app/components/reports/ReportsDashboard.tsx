import React, { useState, useMemo, useCallback } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { 
  Download, 
  Calendar as CalendarIcon, 
  ChevronDown, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Percent, 
  Package, 
  AlertTriangle, 
  CreditCard,
  Users,
  ShoppingBag,
  Activity,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { Button } from "../ui/button";
import { cn } from "../ui/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

import { ProductLedger } from './ProductLedger';
import { CustomerProfitabilityReport } from './CustomerProfitability';
import { ProfitLossStatement } from './ProfitLossStatement';
import { useSales } from '@/app/context/SalesContext';
import { usePurchases } from '@/app/context/PurchaseContext';
import { useExpenses } from '@/app/context/ExpenseContext';
import { useAccounting } from '@/app/context/AccountingContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useDateRange } from '@/app/context/DateRangeContext';
import { productService } from '@/app/services/productService';
import { exportToCSV, exportToExcel, exportToPDF, prepareExportData } from '@/app/utils/exportUtils';

// --- Mock Data (Fallback) ---

// Overview: Income vs Expense
const incomeExpenseData = [
  { name: 'Jan', income: 4000, expense: 2400 },
  { name: 'Feb', income: 3000, expense: 1398 },
  { name: 'Mar', income: 2000, expense: 9800 },
  { name: 'Apr', income: 2780, expense: 3908 },
  { name: 'May', income: 1890, expense: 4800 },
  { name: 'Jun', income: 2390, expense: 3800 },
  { name: 'Jul', income: 3490, expense: 4300 },
];

// Sales: Retail vs Wholesale
const salesData = [
  { name: 'Mon', retail: 4000, wholesale: 2400 },
  { name: 'Tue', retail: 3000, wholesale: 1398 },
  { name: 'Wed', retail: 2000, wholesale: 9800 },
  { name: 'Thu', retail: 2780, wholesale: 3908 },
  { name: 'Fri', retail: 1890, wholesale: 4800 },
  { name: 'Sat', retail: 2390, wholesale: 3800 },
  { name: 'Sun', retail: 3490, wholesale: 4300 },
];

// Inventory: Stock Value by Category
const inventoryData = [
  { name: 'Bridal', value: 400, color: '#ec4899' }, // Pink
  { name: 'Lawn', value: 300, color: '#10b981' },   // Green
  { name: 'Accessories', value: 300, color: '#f59e0b' }, // Amber
  { name: 'Footwear', value: 200, color: '#6366f1' }, // Indigo
];

// Finance: Expense Breakdown
const expenseData = [
  { name: 'Rent', value: 40000, color: '#3B82F6' },
  { name: 'Salaries', value: 30000, color: '#8B5CF6' },
  { name: 'Stitching', value: 20000, color: '#F97316' },
  { name: 'Bills', value: 10000, color: '#9CA3AF' },
];

// Top Customers
const topCustomers = [
  { id: 1, name: 'Bridal Boutique Lahore', type: 'Wholesale', total: 1250000, balance: 450000 },
  { id: 2, name: 'Mrs. Saad', type: 'Retail', total: 85000, balance: 12000 },
  { id: 3, name: 'Karachi Fabrics', type: 'Wholesale', total: 2100000, balance: 890000 },
  { id: 4, name: 'Ali Textiles', type: 'Wholesale', total: 950000, balance: 0 },
  { id: 5, name: 'Zara Ahmed', type: 'Retail', total: 120000, balance: 45000 },
];

// Low Stock Items
const lowStockItems = [
  { id: 1, name: 'Red Velvet Bridal Lehenga', category: 'Bridal', stock: 1, alert: 'Critical' },
  { id: 2, name: 'Gold Clutch', category: 'Accessories', stock: 3, alert: 'Low' },
  { id: 3, name: 'Embroidered Lawn Suit (Vol 1)', category: 'Lawn', stock: 5, alert: 'Low' },
  { id: 4, name: 'Pearl Necklace Set', category: 'Jewelry', stock: 2, alert: 'Critical' },
  { id: 5, name: 'Mens Sherwani (Black)', category: 'Groom', stock: 1, alert: 'Critical' },
];

// --- Components ---

const MetricCard = ({ title, value, subtext, trend, trendValue, icon: Icon, colorClass }: any) => (
  <div className={cn("p-6 rounded-xl border border-gray-800 relative overflow-hidden", colorClass)}>
    <div className="absolute top-0 right-0 p-4 opacity-10">
      <Icon size={64} />
    </div>
    <div className="relative z-10">
      <p className="text-gray-300 font-medium text-sm">{title}</p>
      <h3 className="text-3xl font-bold text-white mt-2">{value}</h3>
      <div className="flex items-center mt-4 gap-2">
        {trend === 'up' ? (
          <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-1 rounded flex items-center">
            <TrendingUp size={12} className="mr-1" /> {trendValue}
          </span>
        ) : trend === 'down' ? (
          <span className="bg-red-500/20 text-red-400 text-xs font-bold px-2 py-1 rounded flex items-center">
            <TrendingDown size={12} className="mr-1" /> {trendValue}
          </span>
        ) : null}
        <span className="text-gray-400 text-xs">{subtext}</span>
      </div>
    </div>
  </div>
);

const CalendarHeatmap = () => {
  // Generate a mock heatmap grid (7 days x 5 weeks approx)
  const days = Array.from({ length: 35 }, (_, i) => {
    const intensity = Math.floor(Math.random() * 4); // 0-3
    return { id: i, intensity };
  });

  const getIntensityColor = (level: number) => {
    switch (level) {
      case 0: return 'bg-gray-800/50';
      case 1: return 'bg-pink-900/40';
      case 2: return 'bg-pink-700/60';
      case 3: return 'bg-pink-500';
      default: return 'bg-gray-800';
    }
  };

  return (
    <div className="bg-gray-900/50 border border-gray-800 p-6 rounded-xl">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <CalendarIcon size={18} className="text-pink-500" />
          Booking Density
        </h3>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>Less</span>
          <div className="flex gap-1">
            <div className="w-3 h-3 bg-gray-800/50 rounded-sm"></div>
            <div className="w-3 h-3 bg-pink-900/40 rounded-sm"></div>
            <div className="w-3 h-3 bg-pink-700/60 rounded-sm"></div>
            <div className="w-3 h-3 bg-pink-500 rounded-sm"></div>
          </div>
          <span>More</span>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2">
         {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
           <div key={i} className="text-center text-xs text-gray-500 font-medium mb-1">{d}</div>
         ))}
         {days.map((day) => (
           <div 
             key={day.id} 
             className={cn("aspect-square rounded-md transition-all hover:ring-2 ring-white/20 cursor-pointer", getIntensityColor(day.intensity))}
             title={`${day.intensity} Bookings`}
           />
         ))}
      </div>
    </div>
  );
};

import { ItemLifecycleReport } from './ItemLifecycleReport';
import { DayBookReport } from './DayBookReport';

export const ReportsDashboard = () => {
  const sales = useSales();
  const purchases = usePurchases();
  const expenses = useExpenses();
  const accounting = useAccounting();
  const { companyId } = useSupabase();
  const { startDate, endDate } = useDateRange();
  const [activeTab, setActiveTab] = useState('overview');
  const [products, setProducts] = useState<any[]>([]);

  // Filter data by date range
  const filterByDateRange = useCallback((dateStr: string | undefined): boolean => {
    if (!startDate && !endDate) return true;
    if (!dateStr) return false;
    
    const date = new Date(dateStr);
    if (startDate && date < new Date(startDate)) return false;
    if (endDate && date > new Date(endDate + 'T23:59:59')) return false;
    return true;
  }, [startDate, endDate]);

  // Load products for inventory reports
  React.useEffect(() => {
    if (companyId) {
      productService.getAllProducts(companyId).then(setProducts).catch(console.error);
    }
  }, [companyId]);

  // Calculate real metrics (filtered by date range)
  const metrics = useMemo(() => {
    const filteredSales = sales.sales.filter(sale => filterByDateRange(sale.date));
    const filteredPurchases = purchases.purchases.filter(purchase => filterByDateRange(purchase.poDate));
    const filteredExpenses = expenses.expenses.filter(expense => filterByDateRange(expense.expenseDate));

    const totalSales = filteredSales.reduce((sum, sale) => 
      sale.type === 'invoice' ? sum + sale.total : sum, 0
    );
    
    const totalPurchases = filteredPurchases.reduce((sum, purchase) => 
      sum + purchase.total, 0
    );
    
    const totalExpenses = filteredExpenses
      .filter(e => e.status === 'paid')
      .reduce((sum, expense) => sum + expense.amount, 0);
    
    const netProfit = totalSales - totalPurchases - totalExpenses;
    const expenseRatio = totalSales > 0 ? (totalExpenses / totalSales) * 100 : 0;

    return {
      totalSales,
      totalPurchases,
      totalExpenses,
      netProfit,
      expenseRatio,
      salesCount: filteredSales.filter(s => s.type === 'invoice').length
    };
  }, [sales.sales, purchases.purchases, expenses.expenses, filterByDateRange]);

  // Generate income vs expense chart data (last 7 months)
  const incomeExpenseData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
    return months.map((month, index) => {
      const monthDate = new Date();
      monthDate.setMonth(monthDate.getMonth() - (6 - index));
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

      const income = sales.sales
        .filter(s => {
          if (!filterByDateRange(s.date)) return false;
          const saleDate = new Date(s.date);
          return saleDate >= monthStart && saleDate <= monthEnd && s.type === 'invoice';
        })
        .reduce((sum, s) => sum + s.total, 0);

      const expense = expenses.expenses
        .filter(e => {
          if (!filterByDateRange(e.expenseDate)) return false;
          const expenseDate = new Date(e.expenseDate);
          return expenseDate >= monthStart && expenseDate <= monthEnd && e.status === 'paid';
        })
        .reduce((sum, e) => sum + e.amount, 0);

      return { name: month, income, expense };
    });
  }, [sales.sales, expenses.expenses, filterByDateRange]);

  // Top customers with receivables (filtered by date range)
  const topCustomers = useMemo(() => {
    const customerMap = new Map<string, { name: string; type: string; total: number; balance: number }>();
    
    sales.sales
      .filter(sale => filterByDateRange(sale.date))
      .forEach(sale => {
        if (sale.type === 'invoice' && sale.customerId) {
          const existing = customerMap.get(sale.customerId) || { name: sale.customerName || 'Unknown', type: 'Retail', total: 0, balance: 0 };
          existing.total += sale.total;
          existing.balance += sale.due;
          customerMap.set(sale.customerId, existing);
        }
      });

    return Array.from(customerMap.values())
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 5)
      .map((c, i) => ({ id: i + 1, ...c }));
  }, [sales.sales, filterByDateRange]);

  // Low stock items
  const lowStockItems = useMemo(() => {
    return products
      .filter(p => p.stock <= (p.reorderLevel || 10))
      .slice(0, 5)
      .map((p, i) => ({
        id: i + 1,
        name: p.name,
        category: p.category || 'Uncategorized',
        stock: p.stock || 0,
        alert: p.stock <= (p.reorderLevel || 10) / 2 ? 'Critical' : 'Low'
      }));
  }, [products]);

  // Export handlers
  const handleExportPDF = () => {
    const exportData = getCurrentReportData();
    exportToPDF(exportData, `Reports_${activeTab}`);
  };

  const handleExportExcel = () => {
    const exportData = getCurrentReportData();
    exportToExcel(exportData, `Reports_${activeTab}`);
  };

  const handleExportCSV = () => {
    const exportData = getCurrentReportData();
    exportToCSV(exportData, `Reports_${activeTab}`);
  };

  // Get current report data based on active tab
  const getCurrentReportData = (): { headers: string[]; rows: (string | number)[][]; title?: string } => {
    const dateRange = startDate && endDate 
      ? `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`
      : 'All Time';

    switch (activeTab) {
      case 'daybook':
        return { title: '', headers: [], rows: [] };

      case 'overview':
        return {
          title: `Reports Overview - ${dateRange}`,
          headers: ['Metric', 'Value'],
          rows: [
            ['Total Sales', `₨${metrics.totalSales.toLocaleString()}`],
            ['Total Purchases', `₨${metrics.totalPurchases.toLocaleString()}`],
            ['Total Expenses', `₨${metrics.totalExpenses.toLocaleString()}`],
            ['Net Profit', `₨${metrics.netProfit.toLocaleString()}`],
            ['Expense Ratio', `${metrics.expenseRatio.toFixed(1)}%`],
            ['Sales Count', metrics.salesCount.toString()],
          ]
        };

      case 'sales':
        const filteredSales = sales.sales.filter(sale => filterByDateRange(sale.date));
        return {
          title: `Sales Report - ${dateRange}`,
          headers: ['Date', 'Invoice No', 'Customer', 'Type', 'Total', 'Paid', 'Due', 'Status'],
          rows: filteredSales.map(sale => [
            sale.date || '',
            sale.invoiceNo || '',
            sale.customerName || '',
            sale.type || '',
            sale.total || 0,
            sale.paid || 0,
            sale.due || 0,
            sale.status || ''
          ])
        };

      case 'inventory':
        return {
          title: `Inventory Report - ${dateRange}`,
          headers: ['Product', 'Category', 'Stock', 'Alert Level'],
          rows: lowStockItems.map(item => [
            item.name,
            item.category,
            item.stock,
            item.alert
          ])
        };

      case 'finance':
        const filteredExpenses = expenses.expenses.filter(expense => filterByDateRange(expense.expenseDate));
        return {
          title: `Finance Report - ${dateRange}`,
          headers: ['Date', 'Category', 'Amount', 'Status', 'Payment Method', 'Notes'],
          rows: filteredExpenses.map(expense => [
            expense.expenseDate || '',
            expense.category || '',
            expense.amount || 0,
            expense.status || '',
            expense.paymentMethod || '',
            expense.notes || ''
          ])
        };

      default:
        return {
          title: `Report - ${activeTab} - ${dateRange}`,
          headers: ['Data'],
          rows: [['No data available for export']]
        };
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
            {/* Hero Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <MetricCard 
                title="Total Revenue" 
                value={`₨${metrics.totalSales.toLocaleString()}`}
                trend="up" 
                trendValue=""
                subtext={`${metrics.salesCount} sales`}
                icon={DollarSign}
                colorClass="bg-gradient-to-br from-gray-900 to-green-900/20 border-green-900/30"
              />
              <MetricCard 
                title="Net Profit" 
                value={`₨${metrics.netProfit.toLocaleString()}`}
                trend={metrics.netProfit >= 0 ? "up" : "down"}
                trendValue=""
                subtext="after expenses"
                icon={Activity}
                colorClass="bg-gradient-to-br from-gray-900 to-blue-900/20 border-blue-900/30"
              />
              <MetricCard 
                title="Expense Ratio" 
                value={`${metrics.expenseRatio.toFixed(1)}%`}
                trend="down" 
                trendValue=""
                subtext="of total revenue"
                icon={Percent}
                colorClass="bg-gradient-to-br from-gray-900 to-orange-900/20 border-orange-900/30"
              />
            </div>

            {/* Income vs Expense Chart */}
            <div className="bg-gray-900/50 border border-gray-800 p-6 rounded-xl">
              <h3 className="text-lg font-bold text-white mb-6">Income vs Expenses</h3>
              <div className="h-[400px] w-full min-h-[400px]">
                <ResponsiveContainer width="100%" height={400} minWidth={0} minHeight={400}>
                  <AreaChart data={incomeExpenseData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" stroke="#6B7280" />
                    <YAxis stroke="#6B7280" />
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6', borderRadius: '8px' }}
                      itemStyle={{ color: '#F3F4F6' }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="income" stroke="#10B981" fillOpacity={1} fill="url(#colorIncome)" />
                    <Area type="monotone" dataKey="expense" stroke="#EF4444" fillOpacity={1} fill="url(#colorExpense)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        );

      case 'daybook':
        return <DayBookReport />;

      case 'sales':
        return (
          <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sales Chart */}
                <div className="lg:col-span-2 bg-gray-900/50 border border-gray-800 p-6 rounded-xl">
                   <h3 className="text-lg font-bold text-white mb-6">Retail vs Wholesale Performance</h3>
                   <div className="h-[400px] w-full min-h-[400px]">
                      <ResponsiveContainer width="100%" height={400} minWidth={0} minHeight={400}>
                        <BarChart data={salesData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                          <XAxis dataKey="name" stroke="#9CA3AF" />
                          <YAxis stroke="#9CA3AF" />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                            labelStyle={{ color: '#F9FAFB' }}
                          />
                          <Legend />
                          <Bar dataKey="retail" stackId="a" fill="#3B82F6" name="Retail Sales" />
                          <Bar dataKey="wholesale" stackId="a" fill="#8B5CF6" name="Wholesale Sales" />
                        </BarChart>
                      </ResponsiveContainer>
                   </div>
                </div>

                {/* Top Customers Table */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden flex flex-col">
                   <div className="p-6 border-b border-gray-800">
                      <h3 className="text-lg font-bold text-white">Top Receivables</h3>
                      <p className="text-sm text-gray-400">Outstanding payments by customer</p>
                   </div>
                   <div className="flex-1 overflow-auto">
                      <table className="w-full text-left text-sm">
                         <thead className="bg-gray-950/50 text-gray-500 font-medium border-b border-gray-800">
                            <tr>
                               <th className="px-4 py-3">Customer</th>
                               <th className="px-4 py-3 text-right">Balance</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-gray-800">
                            {topCustomers.map(customer => (
                               <tr key={customer.id} className="hover:bg-gray-800/30 transition-colors">
                                  <td className="px-4 py-3">
                                     <div className="font-medium text-gray-200">{customer.name}</div>
                                     <div className="text-xs text-gray-500">{customer.type}</div>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                     {customer.balance > 0 ? (
                                        <span className="text-red-400 font-bold bg-red-900/10 px-2 py-1 rounded">
                                           ₨{customer.balance.toLocaleString()}
                                        </span>
                                     ) : (
                                        <span className="text-green-500 font-medium">Paid</span>
                                     )}
                                  </td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                   <div className="p-4 border-t border-gray-800 bg-gray-900/80">
                      <Button variant="ghost" className="w-full text-blue-400 text-sm hover:text-blue-300">View All Customers</Button>
                   </div>
                </div>
             </div>
          </div>
        );

      case 'inventory':
        return (
          <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Stock Value Pie */}
                <div className="bg-gray-900/50 border border-gray-800 p-6 rounded-xl flex flex-col">
                   <h3 className="text-lg font-bold text-white mb-4">Stock Valuation</h3>
                   <div className="flex-1 min-h-[300px] w-full relative">
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300}>
                        <PieChart>
                          <Pie
                            data={inventoryData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {inventoryData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                            ))}
                          </Pie>
                          <Tooltip 
                             contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6' }}
                             itemStyle={{ color: '#F3F4F6' }}
                          />
                          <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] text-center">
                         <p className="text-gray-500 text-xs">Total Value</p>
                         <p className="text-xl font-bold text-white">$1.2M</p>
                      </div>
                   </div>
                </div>

                {/* Low Stock Alert List */}
                <div className="md:col-span-2 bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
                   <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                      <div>
                         <h3 className="text-lg font-bold text-white flex items-center gap-2">
                           <AlertTriangle className="text-yellow-500" size={20} />
                           Low Stock Alerts
                         </h3>
                         <p className="text-sm text-gray-400">Items below re-order level</p>
                      </div>
                      <Button variant="outline" size="sm" className="border-gray-700 text-gray-300 hover:text-white">Order Stock</Button>
                   </div>
                   <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                         <thead className="bg-gray-950/50 text-gray-500 border-b border-gray-800">
                            <tr>
                               <th className="px-6 py-3 font-medium">Item Name</th>
                               <th className="px-6 py-3 font-medium">Category</th>
                               <th className="px-6 py-3 font-medium text-center">Stock</th>
                               <th className="px-6 py-3 font-medium text-center">Status</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-gray-800">
                            {lowStockItems.map((item) => (
                               <tr key={item.id} className="hover:bg-gray-800/30">
                                  <td className="px-6 py-4 font-medium text-white">{item.name}</td>
                                  <td className="px-6 py-4 text-gray-400">{item.category}</td>
                                  <td className="px-6 py-4 text-center text-white font-mono">{item.stock}</td>
                                  <td className="px-6 py-4 text-center">
                                     <span className={cn(
                                        "px-2 py-1 rounded-full text-xs font-bold border",
                                        item.alert === 'Critical' 
                                          ? "bg-red-500/10 text-red-400 border-red-500/20" 
                                          : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                                     )}>
                                        {item.alert}
                                     </span>
                                  </td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                </div>
             </div>
             
             {/* Valuation Metric */}
             <div className="bg-indigo-900/20 border border-indigo-500/20 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                   <div className="p-4 bg-indigo-500/20 rounded-full text-indigo-400">
                      <DollarSign size={32} />
                   </div>
                   <div>
                      <h4 className="text-xl font-bold text-white">Estimated Profit Potential</h4>
                      <p className="text-indigo-300/80">Difference between Cost Price and Selling Price of current stock.</p>
                   </div>
                </div>
                <div className="text-right">
                   <p className="text-3xl font-bold text-white">$450,000</p>
                   <p className="text-sm text-indigo-300">Potential Gross Profit</p>
                </div>
             </div>
          </div>
        );

      case 'rentals':
        return (
          <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Status Cards */}
                <div className="space-y-6">
                   <div className="bg-gray-900/50 border border-gray-800 p-6 rounded-xl">
                      <div className="flex justify-between items-start">
                         <div>
                            <p className="text-gray-400 text-sm">Active Rentals</p>
                            <h3 className="text-2xl font-bold text-white mt-1">24</h3>
                         </div>
                         <ShoppingBag className="text-blue-500" />
                      </div>
                      <div className="mt-4 text-xs text-blue-400 bg-blue-900/20 inline-block px-2 py-1 rounded">Out with customers</div>
                   </div>

                   <div className="bg-gray-900/50 border border-gray-800 p-6 rounded-xl">
                      <div className="flex justify-between items-start">
                         <div>
                            <p className="text-gray-400 text-sm">Overdue Returns</p>
                            <h3 className="text-2xl font-bold text-white mt-1">3</h3>
                         </div>
                         <AlertTriangle className="text-red-500" />
                      </div>
                      <div className="mt-4 text-xs text-red-400 bg-red-900/20 inline-block px-2 py-1 rounded">Action required</div>
                   </div>

                   <div className="bg-gray-900/50 border border-gray-800 p-6 rounded-xl">
                      <div className="flex justify-between items-start">
                         <div>
                            <p className="text-gray-400 text-sm">Security Held</p>
                            <h3 className="text-2xl font-bold text-white mt-1">$45k</h3>
                         </div>
                         <CreditCard className="text-purple-500" />
                      </div>
                      <div className="mt-4 text-xs text-purple-400 bg-purple-900/20 inline-block px-2 py-1 rounded">Cash & ID Cards</div>
                   </div>
                </div>

                {/* Heatmap */}
                <div className="md:col-span-2 space-y-6">
                   <CalendarHeatmap />
                   
                   <div className="bg-gray-900/50 border border-gray-800 p-6 rounded-xl">
                      <h3 className="text-lg font-bold text-white mb-4">Upcoming Returns (Next 3 Days)</h3>
                      <div className="space-y-4">
                         {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-gray-950/50 rounded-lg border border-gray-800">
                               <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center font-bold text-gray-400">
                                     {i}
                                  </div>
                                  <div>
                                     <p className="font-medium text-white">Bridal Set #{100+i}</p>
                                     <p className="text-sm text-gray-500">Mrs. Khan • Due Tomorrow</p>
                                  </div>
                               </div>
                               <Button size="sm" variant="outline" className="border-gray-700 text-gray-300">View Details</Button>
                            </div>
                         ))}
                      </div>
                   </div>
                </div>
             </div>
          </div>
        );

      case 'finance':
        return (
          <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-900/50 border border-gray-800 p-8 rounded-xl flex flex-col items-center justify-center min-h-[400px]">
                   <h3 className="text-lg font-bold text-white mb-2 self-start w-full">Expense Breakdown</h3>
                   <div className="h-[300px] w-full max-w-lg relative">
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300}>
                        <PieChart>
                          <Pie
                            data={expenseData}
                            cx="50%"
                            cy="50%"
                            innerRadius={80}
                            outerRadius={110}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {expenseData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6', borderRadius: '8px' }}
                            itemStyle={{ color: '#F3F4F6' }}
                            formatter={(value: number) => `$${value.toLocaleString()}`}
                          />
                          <Legend 
                             verticalAlign="bottom" 
                             height={36} 
                             iconType="circle"
                             formatter={(value) => <span className="text-gray-400 ml-1">{value}</span>}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] text-center pointer-events-none">
                         <p className="text-gray-500 text-sm">Total</p>
                         <p className="text-3xl font-bold text-white">$100k</p>
                      </div>
                   </div>
                </div>

                <div className="space-y-6">
                   <div className="bg-gray-900/50 border border-gray-800 p-6 rounded-xl">
                      <h3 className="text-lg font-bold text-white mb-4">Quick Financial Health</h3>
                      <div className="space-y-4">
                         <div className="flex justify-between items-center p-4 bg-green-900/10 border border-green-900/20 rounded-lg">
                            <div>
                               <p className="text-green-400 font-medium">Profit Margin</p>
                               <p className="text-2xl font-bold text-white mt-1">27.5%</p>
                            </div>
                            <ArrowUpRight className="text-green-500" size={32} />
                         </div>
                         <div className="flex justify-between items-center p-4 bg-orange-900/10 border border-orange-900/20 rounded-lg">
                            <div>
                               <p className="text-orange-400 font-medium">Overhead Ratio</p>
                               <p className="text-2xl font-bold text-white mt-1">12.1%</p>
                            </div>
                            <ArrowDownRight className="text-orange-500" size={32} />
                         </div>
                      </div>
                   </div>

                   <div className="bg-gray-900/50 border border-gray-800 p-6 rounded-xl">
                      <h3 className="text-lg font-bold text-white mb-4">Recent Large Expenses</h3>
                      <div className="space-y-3">
                         {[
                            { name: 'Shop Monthly Rent', amount: '40,000', date: 'Oct 24' },
                            { name: 'Staff Salaries', amount: '30,000', date: 'Oct 22' },
                            { name: 'Fabric Stitching', amount: '20,000', date: 'Oct 20' }
                         ].map((exp, i) => (
                            <div key={i} className="flex justify-between items-center text-sm border-b border-gray-800 pb-3 last:border-0 last:pb-0">
                               <div>
                                  <p className="text-white font-medium">{exp.name}</p>
                                  <p className="text-gray-500 text-xs">{exp.date}</p>
                                </div>
                               <span className="text-red-400 font-bold">-${exp.amount}</span>
                            </div>
                         ))}
                      </div>
                   </div>
                </div>
             </div>
          </div>
        );

      case 'pnl':
        return <ProfitLossStatement />;

      case 'ledger':
        return <ProductLedger />;

      case 'item-lifecycle':
        return <ItemLifecycleReport />;
      
      case 'profitability':
        return <CustomerProfitabilityReport />;

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-2">
        <div>
           <h2 className="text-3xl font-bold text-white tracking-tight">Reports & Analytics</h2>
           <p className="text-gray-400 mt-1">Deep dive into your business performance.</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
           <Select defaultValue="30days">
             <SelectTrigger className="w-[180px] bg-gray-900 border-gray-700 text-white">
               <CalendarIcon className="mr-2 h-4 w-4" />
               <SelectValue placeholder="Date Range" />
             </SelectTrigger>
             <SelectContent className="bg-gray-900 border-gray-800 text-white">
               <SelectItem value="30days">Last 30 Days</SelectItem>
               <SelectItem value="thismonth">This Month</SelectItem>
               <SelectItem value="lastmonth">Last Month</SelectItem>
               <SelectItem value="custom">Custom Range</SelectItem>
             </SelectContent>
           </Select>
           
           <DropdownMenu>
             <DropdownMenuTrigger asChild>
                <Button variant="outline" className="bg-gray-900 border-gray-700 text-white gap-2">
                   <Download size={16} /> Export
                   <ChevronDown size={14} className="text-gray-500" />
                </Button>
             </DropdownMenuTrigger>
             <DropdownMenuContent className="bg-gray-900 border-gray-800 text-white">
                <DropdownMenuItem 
                  className="cursor-pointer hover:bg-gray-800"
                  onClick={handleExportPDF}
                >
                  Export as PDF
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="cursor-pointer hover:bg-gray-800"
                  onClick={handleExportExcel}
                >
                  Export as Excel
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="cursor-pointer hover:bg-gray-800"
                  onClick={handleExportCSV}
                >
                  Export as CSV
                </DropdownMenuItem>
             </DropdownMenuContent>
           </DropdownMenu>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-800 overflow-x-auto">
         <div className="flex gap-8 min-w-max">
            {['overview', 'daybook', 'sales', 'inventory', 'rentals', 'finance', 'pnl', 'ledger', 'item-lifecycle', 'profitability'].map((tab) => (
               <button
                 key={tab}
                 onClick={() => setActiveTab(tab)}
                 className={cn(
                    "pb-3 text-sm font-medium transition-all relative capitalize",
                    activeTab === tab 
                      ? "text-blue-400" 
                      : "text-gray-400 hover:text-gray-200"
                 )}
               >
                 {tab === 'daybook' ? 'Roznamcha (Day Book)' :
                  tab === 'ledger' ? 'Product Ledger' : 
                  tab === 'profitability' ? 'Customer Profitability' : 
                  tab === 'pnl' ? 'P&L Statement' : 
                  tab === 'item-lifecycle' ? 'Item Lifecycle' : tab}
                 {activeTab === tab && (
                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 rounded-full" />
                 )}
               </button>
            ))}
         </div>
      </div>

      {/* Main Content */}
      <div className="min-h-[500px]">
         {renderTabContent()}
      </div>
    </div>
  );
};