import React, { useState } from 'react';
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

// --- Mock Data ---

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

const MetricCard = ({ title, value, subtext, trend, trendValue, icon: Icon, colorClass }: any) => {
  const bgGradient = colorClass?.includes('green') 
    ? 'linear-gradient(to bottom right, var(--color-bg-primary), rgba(5, 150, 105, 0.2))'
    : colorClass?.includes('blue')
    ? 'linear-gradient(to bottom right, var(--color-bg-primary), rgba(30, 58, 138, 0.2))'
    : colorClass?.includes('orange')
    ? 'linear-gradient(to bottom right, var(--color-bg-primary), rgba(154, 52, 18, 0.2))'
    : 'var(--color-bg-primary)';
  
  const borderColor = colorClass?.includes('green')
    ? 'rgba(5, 150, 105, 0.3)'
    : colorClass?.includes('blue')
    ? 'rgba(30, 58, 138, 0.3)'
    : colorClass?.includes('orange')
    ? 'rgba(154, 52, 18, 0.3)'
    : 'var(--color-border-primary)';
  
  return (
    <div 
      className="p-6 rounded-xl border relative overflow-hidden"
      style={{
        background: bgGradient,
        borderColor: borderColor,
        borderRadius: 'var(--radius-xl)'
      }}
    >
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <Icon size={64} style={{ color: 'var(--color-text-primary)' }} />
      </div>
      <div className="relative z-10">
        <p 
          className="font-medium text-sm"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {title}
        </p>
        <h3 
          className="text-3xl font-bold mt-2"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {value}
        </h3>
        <div className="flex items-center mt-4 gap-2">
          {trend === 'up' ? (
            <span 
              className="text-xs font-bold px-2 py-1 rounded flex items-center"
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                color: 'var(--color-success)',
                borderRadius: 'var(--radius-sm)'
              }}
            >
              <TrendingUp size={12} className="mr-1" /> {trendValue}
            </span>
          ) : trend === 'down' ? (
            <span 
              className="text-xs font-bold px-2 py-1 rounded flex items-center"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                color: 'var(--color-error)',
                borderRadius: 'var(--radius-sm)'
              }}
            >
              <TrendingDown size={12} className="mr-1" /> {trendValue}
            </span>
          ) : null}
          <span 
            className="text-xs"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {subtext}
          </span>
        </div>
      </div>
    </div>
  );
};

const CalendarHeatmap = () => {
  // Generate a mock heatmap grid (7 days x 5 weeks approx)
  const days = Array.from({ length: 35 }, (_, i) => {
    const intensity = Math.floor(Math.random() * 4); // 0-3
    return { id: i, intensity };
  });

  const getIntensityColor = (level: number) => {
    switch (level) {
      case 0: return { backgroundColor: 'rgba(31, 41, 55, 0.5)' };
      case 1: return { backgroundColor: 'rgba(131, 24, 67, 0.4)' };
      case 2: return { backgroundColor: 'rgba(190, 24, 93, 0.6)' };
      case 3: return { backgroundColor: 'rgba(236, 72, 153, 1)' };
      default: return { backgroundColor: 'var(--color-bg-card)' };
    }
  };

  return (
    <div 
      className="border p-6 rounded-xl"
      style={{
        backgroundColor: 'rgba(17, 24, 39, 0.5)',
        borderColor: 'var(--color-border-primary)',
        borderRadius: 'var(--radius-xl)'
      }}
    >
      <div className="flex justify-between items-center mb-6">
        <h3 
          className="text-lg font-bold flex items-center gap-2"
          style={{ color: 'var(--color-text-primary)' }}
        >
          <CalendarIcon size={18} style={{ color: 'rgba(236, 72, 153, 1)' }} />
          Booking Density
        </h3>
        <div 
          className="flex items-center gap-2 text-xs"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          <span>Less</span>
          <div className="flex gap-1">
            <div 
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: 'rgba(31, 41, 55, 0.5)', borderRadius: 'var(--radius-sm)' }}
            ></div>
            <div 
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: 'rgba(131, 24, 67, 0.4)', borderRadius: 'var(--radius-sm)' }}
            ></div>
            <div 
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: 'rgba(190, 24, 93, 0.6)', borderRadius: 'var(--radius-sm)' }}
            ></div>
            <div 
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: 'rgba(236, 72, 153, 1)', borderRadius: 'var(--radius-sm)' }}
            ></div>
          </div>
          <span>More</span>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2">
         {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
           <div 
             key={i} 
             className="text-center text-xs font-medium mb-1"
             style={{ color: 'var(--color-text-tertiary)' }}
           >
             {d}
           </div>
         ))}
         {days.map((day) => (
           <div 
             key={day.id} 
             className="aspect-square rounded-md transition-all cursor-pointer"
             style={{
               ...getIntensityColor(day.intensity),
               borderRadius: 'var(--radius-md)'
             }}
             onMouseEnter={(e) => {
               e.currentTarget.style.boxShadow = '0 0 0 2px rgba(255, 255, 255, 0.2)';
             }}
             onMouseLeave={(e) => {
               e.currentTarget.style.boxShadow = 'none';
             }}
             title={`${day.intensity} Bookings`}
           />
         ))}
      </div>
    </div>
  );
};

import { ItemLifecycleReport } from './ItemLifecycleReport';

export const ReportsDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
            {/* Hero Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <MetricCard 
                title="Total Revenue" 
                value="$1,240,500" 
                trend="up" 
                trendValue="+14.5%" 
                subtext="vs last month"
                icon={DollarSign}
                colorClass="bg-gradient-to-br from-gray-900 to-green-900/20 border-green-900/30"
              />
              <MetricCard 
                title="Net Profit" 
                value="$342,000" 
                trend="up" 
                trendValue="+8.2%" 
                subtext="after expenses"
                icon={Activity}
                colorClass="bg-gradient-to-br from-gray-900 to-blue-900/20 border-blue-900/30"
              />
              <MetricCard 
                title="Expense Ratio" 
                value="27.5%" 
                trend="down" 
                trendValue="-2.1%" 
                subtext="of total revenue"
                icon={Percent}
                colorClass="bg-gradient-to-br from-gray-900 to-orange-900/20 border-orange-900/30"
              />
            </div>

            {/* Income vs Expense Chart */}
            <div 
              className="border p-6 rounded-xl"
              style={{
                backgroundColor: 'rgba(17, 24, 39, 0.5)',
                borderColor: 'var(--color-border-primary)',
                borderRadius: 'var(--radius-xl)'
              }}
            >
              <h3 
                className="text-lg font-bold mb-6"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Income vs Expenses
              </h3>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <AreaChart data={incomeExpenseData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-error)" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="var(--color-error)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" stroke="var(--color-text-tertiary)" />
                    <YAxis stroke="var(--color-text-tertiary)" />
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-primary)" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'var(--color-bg-card)', 
                        borderColor: 'var(--color-border-primary)', 
                        color: 'var(--color-text-primary)', 
                        borderRadius: 'var(--radius-md)' 
                      }}
                      itemStyle={{ color: 'var(--color-text-primary)' }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="income" stroke="var(--color-success)" fillOpacity={1} fill="url(#colorIncome)" />
                    <Area type="monotone" dataKey="expense" stroke="var(--color-error)" fillOpacity={1} fill="url(#colorExpense)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        );

      case 'sales':
        return (
          <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sales Chart */}
                <div 
                  className="lg:col-span-2 border p-6 rounded-xl"
                  style={{
                    backgroundColor: 'rgba(17, 24, 39, 0.5)',
                    borderColor: 'var(--color-border-primary)',
                    borderRadius: 'var(--radius-xl)'
                  }}
                >
                   <h3 
                     className="text-lg font-bold mb-6"
                     style={{ color: 'var(--color-text-primary)' }}
                   >
                     Retail vs Wholesale Performance
                   </h3>
                   <div className="h-[400px] w-full">
                      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <BarChart data={salesData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-primary)" vertical={false} />
                          <XAxis dataKey="name" stroke="var(--color-text-tertiary)" />
                          <YAxis stroke="var(--color-text-tertiary)" />
                          <Tooltip 
                            cursor={{fill: 'rgba(255,255,255,0.05)'}}
                            contentStyle={{ 
                              backgroundColor: 'var(--color-bg-card)', 
                              borderColor: 'var(--color-border-primary)', 
                              color: 'var(--color-text-primary)', 
                              borderRadius: 'var(--radius-md)' 
                            }}
                          />
                          <Legend />
                          <Bar dataKey="retail" stackId="a" fill="var(--color-primary)" name="Retail Sales" />
                          <Bar dataKey="wholesale" stackId="a" fill="var(--color-wholesale)" name="Wholesale Sales" />
                        </BarChart>
                      </ResponsiveContainer>
                   </div>
                </div>

                {/* Top Customers Table */}
                <div 
                  className="border rounded-xl overflow-hidden flex flex-col"
                  style={{
                    backgroundColor: 'rgba(17, 24, 39, 0.5)',
                    borderColor: 'var(--color-border-primary)',
                    borderRadius: 'var(--radius-xl)'
                  }}
                >
                   <div 
                     className="p-6 border-b"
                     style={{ borderColor: 'var(--color-border-primary)' }}
                   >
                      <h3 
                        className="text-lg font-bold"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        Top Receivables
                      </h3>
                      <p 
                        className="text-sm"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        Outstanding payments by customer
                      </p>
                   </div>
                   <div className="flex-1 overflow-auto">
                      <table className="w-full text-left text-sm">
                         <thead 
                           className="font-medium border-b"
                           style={{
                             backgroundColor: 'rgba(3, 7, 18, 0.5)',
                             color: 'var(--color-text-tertiary)',
                             borderColor: 'var(--color-border-primary)'
                           }}
                         >
                            <tr>
                               <th className="px-4 py-3">Customer</th>
                               <th className="px-4 py-3 text-right">Balance</th>
                            </tr>
                         </thead>
                         <tbody 
                           className="divide-y"
                           style={{ borderColor: 'var(--color-border-primary)' }}
                         >
                            {topCustomers.map(customer => (
                               <tr 
                                  key={customer.id} 
                                  className="transition-colors"
                                  style={{ backgroundColor: 'transparent' }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(31, 41, 55, 0.3)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                  }}
                                >
                                  <td className="px-4 py-3">
                                     <div 
                                       className="font-medium"
                                       style={{ color: 'var(--color-text-primary)' }}
                                     >
                                       {customer.name}
                                     </div>
                                     <div 
                                       className="text-xs"
                                       style={{ color: 'var(--color-text-tertiary)' }}
                                     >
                                       {customer.type}
                                     </div>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                     {customer.balance > 0 ? (
                                        <span 
                                          className="font-bold px-2 py-1 rounded"
                                          style={{
                                            color: 'var(--color-error)',
                                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                            borderRadius: 'var(--radius-sm)'
                                          }}
                                        >
                                           ${customer.balance.toLocaleString()}
                                        </span>
                                     ) : (
                                        <span 
                                          className="font-medium"
                                          style={{ color: 'var(--color-success)' }}
                                        >
                                          Paid
                                        </span>
                                     )}
                                  </td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                   <div 
                     className="p-4 border-t"
                     style={{
                       borderColor: 'var(--color-border-primary)',
                       backgroundColor: 'rgba(17, 24, 39, 0.8)'
                     }}
                   >
                      <Button 
                        variant="ghost" 
                        className="w-full text-sm"
                        style={{ color: 'var(--color-primary)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--color-primary)';
                          e.currentTarget.style.opacity = '0.8';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--color-primary)';
                          e.currentTarget.style.opacity = '1';
                        }}
                      >
                        View All Customers
                      </Button>
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
                <div 
                  className="border p-6 rounded-xl flex flex-col"
                  style={{
                    backgroundColor: 'rgba(17, 24, 39, 0.5)',
                    borderColor: 'var(--color-border-primary)',
                    borderRadius: 'var(--radius-xl)'
                  }}
                >
                   <h3 
                     className="text-lg font-bold mb-4"
                     style={{ color: 'var(--color-text-primary)' }}
                   >
                     Stock Valuation
                   </h3>
                   <div className="flex-1 min-h-[300px] w-full relative">
                      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
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
                             contentStyle={{ 
                               backgroundColor: 'var(--color-bg-card)', 
                               borderColor: 'var(--color-border-primary)', 
                               color: 'var(--color-text-primary)' 
                             }}
                             itemStyle={{ color: 'var(--color-text-primary)' }}
                          />
                          <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] text-center">
                         <p 
                           className="text-xs"
                           style={{ color: 'var(--color-text-tertiary)' }}
                         >
                           Total Value
                         </p>
                         <p 
                           className="text-xl font-bold"
                           style={{ color: 'var(--color-text-primary)' }}
                         >
                           $1.2M
                         </p>
                      </div>
                   </div>
                </div>

                {/* Low Stock Alert List */}
                <div 
                  className="md:col-span-2 border rounded-xl overflow-hidden"
                  style={{
                    backgroundColor: 'rgba(17, 24, 39, 0.5)',
                    borderColor: 'var(--color-border-primary)',
                    borderRadius: 'var(--radius-xl)'
                  }}
                >
                   <div 
                     className="p-6 border-b flex justify-between items-center"
                     style={{ borderColor: 'var(--color-border-primary)' }}
                   >
                      <div>
                         <h3 
                           className="text-lg font-bold flex items-center gap-2"
                           style={{ color: 'var(--color-text-primary)' }}
                         >
                           <AlertTriangle style={{ color: 'var(--color-warning)' }} size={20} />
                           Low Stock Alerts
                         </h3>
                         <p 
                           className="text-sm"
                           style={{ color: 'var(--color-text-secondary)' }}
                         >
                           Items below re-order level
                         </p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-secondary)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--color-text-primary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--color-text-secondary)';
                        }}
                      >
                        Order Stock
                      </Button>
                   </div>
                   <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                         <thead 
                           className="border-b"
                           style={{
                             backgroundColor: 'rgba(3, 7, 18, 0.5)',
                             color: 'var(--color-text-tertiary)',
                             borderColor: 'var(--color-border-primary)'
                           }}
                         >
                            <tr>
                               <th className="px-6 py-3 font-medium">Item Name</th>
                               <th className="px-6 py-3 font-medium">Category</th>
                               <th className="px-6 py-3 font-medium text-center">Stock</th>
                               <th className="px-6 py-3 font-medium text-center">Status</th>
                            </tr>
                         </thead>
                         <tbody 
                           className="divide-y"
                           style={{ borderColor: 'var(--color-border-primary)' }}
                         >
                            {lowStockItems.map((item) => (
                               <tr 
                                 key={item.id}
                                 style={{ backgroundColor: 'transparent' }}
                                 onMouseEnter={(e) => {
                                   e.currentTarget.style.backgroundColor = 'rgba(31, 41, 55, 0.3)';
                                 }}
                                 onMouseLeave={(e) => {
                                   e.currentTarget.style.backgroundColor = 'transparent';
                                 }}
                               >
                                  <td 
                                    className="px-6 py-4 font-medium"
                                    style={{ color: 'var(--color-text-primary)' }}
                                  >
                                    {item.name}
                                  </td>
                                  <td 
                                    className="px-6 py-4"
                                    style={{ color: 'var(--color-text-secondary)' }}
                                  >
                                    {item.category}
                                  </td>
                                  <td 
                                    className="px-6 py-4 text-center font-mono"
                                    style={{ color: 'var(--color-text-primary)' }}
                                  >
                                    {item.stock}
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                     <span 
                                       className="px-2 py-1 rounded-full text-xs font-bold border"
                                       style={{
                                         backgroundColor: item.alert === 'Critical' 
                                           ? 'rgba(239, 68, 68, 0.1)' 
                                           : 'rgba(234, 179, 8, 0.1)',
                                         color: item.alert === 'Critical' 
                                           ? 'var(--color-error)' 
                                           : 'var(--color-warning)',
                                         borderColor: item.alert === 'Critical' 
                                           ? 'rgba(239, 68, 68, 0.2)' 
                                           : 'rgba(234, 179, 8, 0.2)',
                                         borderRadius: 'var(--radius-full)'
                                       }}
                                     >
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
             <div 
               className="border rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-6"
               style={{
                 backgroundColor: 'rgba(67, 56, 202, 0.2)',
                 borderColor: 'rgba(99, 102, 241, 0.2)',
                 borderRadius: 'var(--radius-xl)'
               }}
             >
                <div className="flex items-center gap-4">
                   <div 
                     className="p-4 rounded-full"
                     style={{
                       backgroundColor: 'rgba(99, 102, 241, 0.2)',
                       borderRadius: 'var(--radius-full)',
                       color: 'rgba(129, 140, 248, 1)'
                     }}
                   >
                      <DollarSign size={32} />
                   </div>
                   <div>
                      <h4 
                        className="text-xl font-bold"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        Estimated Profit Potential
                      </h4>
                      <p style={{ color: 'rgba(129, 140, 248, 0.8)' }}>
                        Difference between Cost Price and Selling Price of current stock.
                      </p>
                   </div>
                </div>
                <div className="text-right">
                   <p 
                     className="text-3xl font-bold"
                     style={{ color: 'var(--color-text-primary)' }}
                   >
                     $450,000
                   </p>
                   <p 
                     className="text-sm"
                     style={{ color: 'rgba(129, 140, 248, 1)' }}
                   >
                     Potential Gross Profit
                   </p>
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
                   <div 
                     className="border p-6 rounded-xl"
                     style={{
                       backgroundColor: 'rgba(17, 24, 39, 0.5)',
                       borderColor: 'var(--color-border-primary)',
                       borderRadius: 'var(--radius-xl)'
                     }}
                   >
                      <div className="flex justify-between items-start">
                         <div>
                            <p 
                              className="text-sm"
                              style={{ color: 'var(--color-text-secondary)' }}
                            >
                              Active Rentals
                            </p>
                            <h3 
                              className="text-2xl font-bold mt-1"
                              style={{ color: 'var(--color-text-primary)' }}
                            >
                              24
                            </h3>
                         </div>
                         <ShoppingBag style={{ color: 'var(--color-primary)' }} />
                      </div>
                      <div 
                        className="mt-4 text-xs inline-block px-2 py-1 rounded"
                        style={{
                          color: 'var(--color-primary)',
                          backgroundColor: 'rgba(30, 58, 138, 0.2)',
                          borderRadius: 'var(--radius-sm)'
                        }}
                      >
                        Out with customers
                      </div>
                   </div>

                   <div 
                     className="border p-6 rounded-xl"
                     style={{
                       backgroundColor: 'rgba(17, 24, 39, 0.5)',
                       borderColor: 'var(--color-border-primary)',
                       borderRadius: 'var(--radius-xl)'
                     }}
                   >
                      <div className="flex justify-between items-start">
                         <div>
                            <p 
                              className="text-sm"
                              style={{ color: 'var(--color-text-secondary)' }}
                            >
                              Overdue Returns
                            </p>
                            <h3 
                              className="text-2xl font-bold mt-1"
                              style={{ color: 'var(--color-text-primary)' }}
                            >
                              3
                            </h3>
                         </div>
                         <AlertTriangle style={{ color: 'var(--color-error)' }} />
                      </div>
                      <div 
                        className="mt-4 text-xs inline-block px-2 py-1 rounded"
                        style={{
                          color: 'var(--color-error)',
                          backgroundColor: 'rgba(239, 68, 68, 0.2)',
                          borderRadius: 'var(--radius-sm)'
                        }}
                      >
                        Action required
                      </div>
                   </div>

                   <div 
                     className="border p-6 rounded-xl"
                     style={{
                       backgroundColor: 'rgba(17, 24, 39, 0.5)',
                       borderColor: 'var(--color-border-primary)',
                       borderRadius: 'var(--radius-xl)'
                     }}
                   >
                      <div className="flex justify-between items-start">
                         <div>
                            <p 
                              className="text-sm"
                              style={{ color: 'var(--color-text-secondary)' }}
                            >
                              Security Held
                            </p>
                            <h3 
                              className="text-2xl font-bold mt-1"
                              style={{ color: 'var(--color-text-primary)' }}
                            >
                              $45k
                            </h3>
                         </div>
                         <CreditCard style={{ color: 'var(--color-wholesale)' }} />
                      </div>
                      <div 
                        className="mt-4 text-xs inline-block px-2 py-1 rounded"
                        style={{
                          color: 'var(--color-wholesale)',
                          backgroundColor: 'rgba(147, 51, 234, 0.2)',
                          borderRadius: 'var(--radius-sm)'
                        }}
                      >
                        Cash & ID Cards
                      </div>
                   </div>
                </div>

                {/* Heatmap */}
                <div className="md:col-span-2 space-y-6">
                   <CalendarHeatmap />
                   
                   <div 
                     className="border p-6 rounded-xl"
                     style={{
                       backgroundColor: 'rgba(17, 24, 39, 0.5)',
                       borderColor: 'var(--color-border-primary)',
                       borderRadius: 'var(--radius-xl)'
                     }}
                   >
                      <h3 
                        className="text-lg font-bold mb-4"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        Upcoming Returns (Next 3 Days)
                      </h3>
                      <div className="space-y-4">
                         {[1, 2, 3].map((i) => (
                            <div 
                              key={i} 
                              className="flex items-center justify-between p-4 rounded-lg border"
                              style={{
                                backgroundColor: 'rgba(3, 7, 18, 0.5)',
                                borderColor: 'var(--color-border-primary)',
                                borderRadius: 'var(--radius-lg)'
                              }}
                            >
                               <div className="flex items-center gap-4">
                                  <div 
                                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold"
                                    style={{
                                      backgroundColor: 'var(--color-bg-card)',
                                      borderRadius: 'var(--radius-full)',
                                      color: 'var(--color-text-secondary)'
                                    }}
                                  >
                                     {i}
                                  </div>
                                  <div>
                                     <p 
                                       className="font-medium"
                                       style={{ color: 'var(--color-text-primary)' }}
                                     >
                                       Bridal Set #{100+i}
                                     </p>
                                     <p 
                                       className="text-sm"
                                       style={{ color: 'var(--color-text-tertiary)' }}
                                     >
                                       Mrs. Khan • Due Tomorrow
                                     </p>
                                  </div>
                               </div>
                               <Button 
                                 size="sm" 
                                 variant="outline"
                                 style={{
                                   borderColor: 'var(--color-border-secondary)',
                                   color: 'var(--color-text-secondary)'
                                 }}
                                 onMouseEnter={(e) => {
                                   e.currentTarget.style.color = 'var(--color-text-primary)';
                                 }}
                                 onMouseLeave={(e) => {
                                   e.currentTarget.style.color = 'var(--color-text-secondary)';
                                 }}
                               >
                                 View Details
                               </Button>
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
                <div 
                  className="border p-8 rounded-xl flex flex-col items-center justify-center min-h-[400px]"
                  style={{
                    backgroundColor: 'rgba(17, 24, 39, 0.5)',
                    borderColor: 'var(--color-border-primary)',
                    borderRadius: 'var(--radius-xl)'
                  }}
                >
                   <h3 
                     className="text-lg font-bold mb-2 self-start w-full"
                     style={{ color: 'var(--color-text-primary)' }}
                   >
                     Expense Breakdown
                   </h3>
                   <div className="h-[300px] w-full max-w-lg relative">
                      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
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
                            contentStyle={{ 
                              backgroundColor: 'var(--color-bg-card)', 
                              borderColor: 'var(--color-border-primary)', 
                              color: 'var(--color-text-primary)', 
                              borderRadius: 'var(--radius-md)' 
                            }}
                            itemStyle={{ color: 'var(--color-text-primary)' }}
                            formatter={(value: number) => `$${value.toLocaleString()}`}
                          />
                          <Legend 
                             verticalAlign="bottom" 
                             height={36} 
                             iconType="circle"
                             formatter={(value) => (
                               <span 
                                 className="ml-1"
                                 style={{ color: 'var(--color-text-secondary)' }}
                               >
                                 {value}
                               </span>
                             )}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] text-center pointer-events-none">
                         <p 
                           className="text-sm"
                           style={{ color: 'var(--color-text-tertiary)' }}
                         >
                           Total
                         </p>
                         <p 
                           className="text-3xl font-bold"
                           style={{ color: 'var(--color-text-primary)' }}
                         >
                           $100k
                         </p>
                      </div>
                   </div>
                </div>

                <div className="space-y-6">
                   <div 
                     className="border p-6 rounded-xl"
                     style={{
                       backgroundColor: 'rgba(17, 24, 39, 0.5)',
                       borderColor: 'var(--color-border-primary)',
                       borderRadius: 'var(--radius-xl)'
                     }}
                   >
                      <h3 
                        className="text-lg font-bold mb-4"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        Quick Financial Health
                      </h3>
                      <div className="space-y-4">
                         <div 
                           className="flex justify-between items-center p-4 rounded-lg border"
                           style={{
                             backgroundColor: 'rgba(16, 185, 129, 0.1)',
                             borderColor: 'rgba(16, 185, 129, 0.2)',
                             borderRadius: 'var(--radius-lg)'
                           }}
                         >
                            <div>
                               <p 
                                 className="font-medium"
                                 style={{ color: 'var(--color-success)' }}
                               >
                                 Profit Margin
                               </p>
                               <p 
                                 className="text-2xl font-bold mt-1"
                                 style={{ color: 'var(--color-text-primary)' }}
                               >
                                 27.5%
                               </p>
                            </div>
                            <ArrowUpRight style={{ color: 'var(--color-success)' }} size={32} />
                         </div>
                         <div 
                           className="flex justify-between items-center p-4 rounded-lg border"
                           style={{
                             backgroundColor: 'rgba(234, 179, 8, 0.1)',
                             borderColor: 'rgba(234, 179, 8, 0.2)',
                             borderRadius: 'var(--radius-lg)'
                           }}
                         >
                            <div>
                               <p 
                                 className="font-medium"
                                 style={{ color: 'var(--color-warning)' }}
                               >
                                 Overhead Ratio
                               </p>
                               <p 
                                 className="text-2xl font-bold mt-1"
                                 style={{ color: 'var(--color-text-primary)' }}
                               >
                                 12.1%
                               </p>
                            </div>
                            <ArrowDownRight style={{ color: 'var(--color-warning)' }} size={32} />
                         </div>
                      </div>
                   </div>

                   <div 
                     className="border p-6 rounded-xl"
                     style={{
                       backgroundColor: 'rgba(17, 24, 39, 0.5)',
                       borderColor: 'var(--color-border-primary)',
                       borderRadius: 'var(--radius-xl)'
                     }}
                   >
                      <h3 
                        className="text-lg font-bold mb-4"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        Recent Large Expenses
                      </h3>
                      <div className="space-y-3">
                         {[
                            { name: 'Shop Monthly Rent', amount: '40,000', date: 'Oct 24' },
                            { name: 'Staff Salaries', amount: '30,000', date: 'Oct 22' },
                            { name: 'Fabric Stitching', amount: '20,000', date: 'Oct 20' }
                         ].map((exp, i) => (
                            <div 
                              key={i} 
                              className="flex justify-between items-center text-sm border-b pb-3 last:border-0 last:pb-0"
                              style={{ borderColor: 'var(--color-border-primary)' }}
                            >
                               <div>
                                  <p 
                                    className="font-medium"
                                    style={{ color: 'var(--color-text-primary)' }}
                                  >
                                    {exp.name}
                                  </p>
                                  <p 
                                    className="text-xs"
                                    style={{ color: 'var(--color-text-tertiary)' }}
                                  >
                                    {exp.date}
                                  </p>
                                </div>
                               <span 
                                 className="font-bold"
                                 style={{ color: 'var(--color-error)' }}
                               >
                                 -${exp.amount}
                               </span>
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
           <h2 
             className="text-3xl font-bold tracking-tight"
             style={{ color: 'var(--color-text-primary)' }}
           >
             Reports & Analytics
           </h2>
           <p 
             className="mt-1"
             style={{ color: 'var(--color-text-secondary)' }}
           >
             Deep dive into your business performance.
           </p>
        </div>
        
        <div className="flex flex-wrap gap-3">
           <Select defaultValue="30days">
             <SelectTrigger 
               className="w-[180px]"
               style={{
                 backgroundColor: 'var(--color-bg-card)',
                 borderColor: 'var(--color-border-secondary)',
                 color: 'var(--color-text-primary)'
               }}
             >
               <CalendarIcon className="mr-2 h-4 w-4" />
               <SelectValue placeholder="Date Range" />
             </SelectTrigger>
             <SelectContent 
               style={{
                 backgroundColor: 'var(--color-bg-card)',
                 borderColor: 'var(--color-border-primary)',
                 color: 'var(--color-text-primary)'
               }}
             >
               <SelectItem value="30days">Last 30 Days</SelectItem>
               <SelectItem value="thismonth">This Month</SelectItem>
               <SelectItem value="lastmonth">Last Month</SelectItem>
               <SelectItem value="custom">Custom Range</SelectItem>
             </SelectContent>
           </Select>
           
           <DropdownMenu>
             <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  className="gap-2"
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-primary)'
                  }}
                >
                   <Download size={16} /> Export
                   <ChevronDown 
                     size={14} 
                     style={{ color: 'var(--color-text-tertiary)' }}
                   />
                </Button>
             </DropdownMenuTrigger>
             <DropdownMenuContent 
               style={{
                 backgroundColor: 'var(--color-bg-card)',
                 borderColor: 'var(--color-border-primary)',
                 color: 'var(--color-text-primary)'
               }}
             >
                <DropdownMenuItem 
                  className="cursor-pointer"
                  style={{ backgroundColor: 'transparent' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  Export as PDF
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="cursor-pointer"
                  style={{ backgroundColor: 'transparent' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  Export as Excel
                </DropdownMenuItem>
             </DropdownMenuContent>
           </DropdownMenu>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div 
        className="border-b overflow-x-auto"
        style={{ borderColor: 'var(--color-border-primary)' }}
      >
         <div className="flex gap-8 min-w-max">
            {['overview', 'sales', 'inventory', 'rentals', 'finance', 'pnl', 'ledger', 'item-lifecycle', 'profitability'].map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="pb-3 text-sm font-medium transition-all relative capitalize"
                  style={{
                    color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = 'var(--color-text-primary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = 'var(--color-text-secondary)';
                    }
                  }}
                >
                  {tab === 'ledger' ? 'Product Ledger' : 
                   tab === 'profitability' ? 'Customer Profitability' : 
                   tab === 'pnl' ? 'P&L Statement' : 
                   tab === 'item-lifecycle' ? 'Item Lifecycle' : tab}
                  {isActive && (
                     <span 
                       className="absolute bottom-0 left-0 w-full h-0.5 rounded-full"
                       style={{
                         backgroundColor: 'var(--color-primary)',
                         borderRadius: 'var(--radius-full)'
                       }}
                     />
                  )}
                </button>
              );
            })}
         </div>
      </div>

      {/* Main Content */}
      <div className="min-h-[500px]">
         {renderTabContent()}
      </div>
    </div>
  );
};
