import React, { useState } from 'react';
import { 
  Download, 
  Printer, 
  FileText, 
  FileSpreadsheet, 
  ChevronDown, 
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  EyeOff
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
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";

// Mock Data
const trendData = [
  { value: 4000 }, { value: 3000 }, { value: 5000 }, { value: 2780 }, 
  { value: 1890 }, { value: 2390 }, { value: 3490 }, { value: 5000 },
  { value: 4500 }, { value: 6000 }, { value: 5500 }, { value: 7000 },
];

const breakdownData = {
  costs: [
    { label: 'Opening Stock', value: 1200000 },
    { label: 'Total Purchases', value: 3500000 },
    { label: 'Shipping & Expenses', value: 150000 },
    { label: 'Returns Out', value: -50000 },
    { label: 'Damaged Goods', value: 0 }, // For zero toggle test
  ],
  revenue: [
    { label: 'Total Sales', value: 8900000 },
    { label: 'Closing Stock', value: 1800000 },
    { label: 'Recovered Amounts', value: 120000 },
    { label: 'Discounts Given', value: -450000 },
    { label: 'Other Income', value: 0 }, // For zero toggle test
  ]
};

const productPerformanceData = [
  { id: 1, name: 'Bridal Maxi Red (SKU-101)', sold: 45, avgPrice: 120000, revenue: 5400000, profit: 1800000 },
  { id: 2, name: 'Embroidered Lawn Suit (Vol 1)', sold: 120, avgPrice: 8500, revenue: 1020000, profit: 340000 },
  { id: 3, name: 'Gold Clutch', sold: 0, avgPrice: 0, revenue: 0, profit: 0 }, // Zero value row
  { id: 4, name: 'Mens Sherwani (Black)', sold: 15, avgPrice: 45000, revenue: 675000, profit: 225000 },
  { id: 5, name: 'Velvet Shawl', sold: 0, avgPrice: 5000, revenue: 0, profit: 0 }, // Zero value row
  { id: 6, name: 'Pearl Necklace Set', sold: 25, avgPrice: 12000, revenue: 300000, profit: 120000 },
];

export const ProfitLossStatement = () => {
  const [drillDownTab, setDrillDownTab] = useState('product');
  const [showZeroValues, setShowZeroValues] = useState(false);

  const calculateTotal = (items: { value: number }[]) => items.reduce((acc, curr) => acc + curr.value, 0);
  const totalCost = calculateTotal(breakdownData.costs);
  const totalRevenue = calculateTotal(breakdownData.revenue);
  const grossProfit = totalRevenue - totalCost; // Simplified logic for demo
  const netProfit = 5869893; // Hardcoded from prompt requirements

  const filteredProducts = showZeroValues 
    ? productPerformanceData 
    : productPerformanceData.filter(p => p.revenue > 0);

  const totalSold = filteredProducts.reduce((acc, curr) => acc + curr.sold, 0);
  const totalProductRevenue = filteredProducts.reduce((acc, curr) => acc + curr.revenue, 0);
  const totalProductProfit = filteredProducts.reduce((acc, curr) => acc + curr.profit, 0);

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-300">
      
      {/* 1. Header Area */}
      <div 
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 rounded-xl border"
        style={{
          backgroundColor: 'rgba(17, 24, 39, 0.5)',
          borderColor: 'var(--color-border-primary)',
          borderRadius: 'var(--radius-xl)'
        }}
      >
        <div>
          <h2 
            className="text-2xl font-bold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Profit & Loss Statement
          </h2>
          <p 
            className="text-sm mt-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Detailed financial performance report
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <Select defaultValue="main_branch">
            <SelectTrigger 
              className="w-[160px] h-9 rounded-full"
              style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                borderColor: 'var(--color-border-secondary)',
                color: 'var(--color-text-primary)'
              }}
            >
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent
              style={{
                backgroundColor: 'var(--color-bg-card)',
                borderColor: 'var(--color-border-primary)',
                color: 'var(--color-text-primary)'
              }}
            >
              <SelectItem value="main_branch">Main Branch</SelectItem>
              <SelectItem value="warehouse">Warehouse</SelectItem>
            </SelectContent>
          </Select>

          <Select defaultValue="this_month">
            <SelectTrigger 
              className="w-[160px] h-9 rounded-full"
              style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                borderColor: 'var(--color-border-secondary)',
                color: 'var(--color-text-primary)'
              }}
            >
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent
              style={{
                backgroundColor: 'var(--color-bg-card)',
                borderColor: 'var(--color-border-primary)',
                color: 'var(--color-text-primary)'
              }}
            >
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="this_year">This Year</SelectItem>
            </SelectContent>
          </Select>

          <div 
            className="flex items-center gap-1 ml-2 border-l pl-3"
            style={{ borderLeftColor: 'var(--color-border-secondary)' }}
          >
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9 rounded-full"
              style={{ color: 'var(--color-text-secondary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--color-text-primary)';
                e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--color-text-secondary)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title="Export PDF"
            >
              <FileText size={18} />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9 rounded-full"
              style={{ color: 'var(--color-text-secondary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--color-text-primary)';
                e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--color-text-secondary)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title="Export Excel"
            >
              <FileSpreadsheet size={18} />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9 rounded-full"
              style={{ color: 'var(--color-text-secondary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--color-text-primary)';
                e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--color-text-secondary)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title="Print"
            >
              <Printer size={18} />
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Hero Section (The "Bottom Line") */}
      <div 
        className="relative overflow-hidden rounded-2xl border p-8 shadow-2xl min-h-[200px]"
        style={{
          background: 'linear-gradient(to right, var(--color-bg-card), var(--color-bg-card), var(--color-bg-card))',
          borderColor: 'var(--color-border-secondary)',
          borderRadius: 'var(--radius-2xl)'
        }}
      >
        {/* Background Trend Line */}
        <div className="absolute inset-0 w-full h-full opacity-10 pointer-events-none">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart data={trendData}>
              <Area type="monotone" dataKey="value" stroke="#4ade80" fill="#4ade80" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-center md:text-left">
            <p 
              className="font-medium mb-1 uppercase tracking-wider text-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Gross Profit
            </p>
            <h3 
              className="text-4xl font-bold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Rs {(grossProfit/1000000).toFixed(1)}M
            </h3>
          </div>
          
          <div 
            className="h-px w-full md:w-px md:h-16"
            style={{ backgroundColor: 'var(--color-border-secondary)' }}
          ></div>

          <div className="text-center md:text-right">
            <p 
              className="font-medium mb-1 uppercase tracking-wider text-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Net Profit
            </p>
            <h3 
              className="text-5xl md:text-6xl font-black"
              style={{
                color: 'var(--color-success)',
                textShadow: '0 0 15px rgba(16, 185, 129, 0.3)'
              }}
            >
              Rs {netProfit.toLocaleString()}
            </h3>
          </div>
        </div>
      </div>

      {/* 3. The Breakdown (Split View) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Costs & Expenses */}
        <div 
          className="border rounded-xl overflow-hidden flex flex-col"
          style={{
            backgroundColor: 'rgba(17, 24, 39, 0.5)',
            borderColor: 'var(--color-border-primary)',
            borderRadius: 'var(--radius-xl)'
          }}
        >
          <div 
            className="p-4 border-b flex justify-between items-center"
            style={{
              borderBottomColor: 'var(--color-border-primary)',
              backgroundColor: 'rgba(127, 29, 29, 0.1)'
            }}
          >
             <h3 
               className="font-bold"
               style={{ color: 'var(--color-text-primary)' }}
             >
               Costs & Expenses
             </h3>
             <span 
               className="text-xs font-bold px-2 py-1 rounded border"
               style={{
                 color: 'var(--color-error)',
                 backgroundColor: 'rgba(239, 68, 68, 0.1)',
                 borderColor: 'rgba(239, 68, 68, 0.2)',
                 borderRadius: 'var(--radius-sm)'
               }}
             >
               Money Out
             </span>
          </div>
          <div className="p-6 space-y-4 flex-1">
             <div 
               className="text-sm font-medium mb-2"
               style={{ color: 'var(--color-text-tertiary)' }}
             >
               Cost of Goods Sold (COGS)
             </div>
             {breakdownData.costs.filter(i => showZeroValues || i.value !== 0).map((item, idx) => (
               <div 
                 key={idx} 
                 className="flex justify-between items-center group"
                 onMouseEnter={(e) => {
                   e.currentTarget.querySelector('span:first-child')!.style.color = 'var(--color-text-primary)';
                 }}
                 onMouseLeave={(e) => {
                   e.currentTarget.querySelector('span:first-child')!.style.color = 'var(--color-text-primary)';
                 }}
               >
                 <span 
                   className="transition-colors"
                   style={{ color: 'var(--color-text-primary)' }}
                 >
                   {item.label}
                 </span>
                 <span 
                   className="font-mono"
                   style={{ color: 'var(--color-text-primary)' }}
                 >
                   Rs {Math.abs(item.value).toLocaleString()}
                 </span>
               </div>
             ))}
          </div>
          <div 
            className="p-4 border-t flex justify-between items-center"
            style={{
              borderTopColor: 'var(--color-border-primary)',
              backgroundColor: 'var(--color-bg-card)'
            }}
          >
             <span 
               className="font-bold"
               style={{ color: 'var(--color-text-secondary)' }}
             >
               Total Cost
             </span>
             <span 
               className="font-bold text-xl"
               style={{ color: 'var(--color-text-primary)' }}
             >
               Rs {totalCost.toLocaleString()}
             </span>
          </div>
        </div>

        {/* Revenue & Stock */}
        <div 
          className="border rounded-xl overflow-hidden flex flex-col"
          style={{
            backgroundColor: 'rgba(17, 24, 39, 0.5)',
            borderColor: 'var(--color-border-primary)',
            borderRadius: 'var(--radius-xl)'
          }}
        >
          <div 
            className="p-4 border-b flex justify-between items-center"
            style={{
              borderBottomColor: 'var(--color-border-primary)',
              backgroundColor: 'rgba(5, 150, 105, 0.1)'
            }}
          >
             <h3 
               className="font-bold"
               style={{ color: 'var(--color-text-primary)' }}
             >
               Revenue & Stock
             </h3>
             <span 
               className="text-xs font-bold px-2 py-1 rounded border"
               style={{
                 color: 'var(--color-success)',
                 backgroundColor: 'rgba(16, 185, 129, 0.1)',
                 borderColor: 'rgba(16, 185, 129, 0.2)',
                 borderRadius: 'var(--radius-sm)'
               }}
             >
               Money In
             </span>
          </div>
          <div className="p-6 space-y-4 flex-1">
             <div 
               className="text-sm font-medium mb-2"
               style={{ color: 'var(--color-text-tertiary)' }}
             >
               Sales & Inventory
             </div>
             {breakdownData.revenue.filter(i => showZeroValues || i.value !== 0).map((item, idx) => (
               <div 
                 key={idx} 
                 className="flex justify-between items-center group"
                 onMouseEnter={(e) => {
                   e.currentTarget.querySelector('span:first-child')!.style.color = 'var(--color-text-primary)';
                 }}
                 onMouseLeave={(e) => {
                   e.currentTarget.querySelector('span:first-child')!.style.color = 'var(--color-text-primary)';
                 }}
               >
                 <span 
                   className="transition-colors"
                   style={{ color: 'var(--color-text-primary)' }}
                 >
                   {item.label}
                 </span>
                 <span 
                   className="font-mono"
                   style={{ color: 'var(--color-text-primary)' }}
                 >
                   Rs {Math.abs(item.value).toLocaleString()}
                 </span>
               </div>
             ))}
          </div>
          <div 
            className="p-4 border-t flex justify-between items-center"
            style={{
              borderTopColor: 'var(--color-border-primary)',
              backgroundColor: 'var(--color-bg-card)'
            }}
          >
             <span 
               className="font-bold"
               style={{ color: 'var(--color-text-secondary)' }}
             >
               Total Revenue
             </span>
             <span 
               className="font-bold text-xl"
               style={{ color: 'var(--color-text-primary)' }}
             >
               Rs {totalRevenue.toLocaleString()}
             </span>
          </div>
        </div>
      </div>

      {/* 4. Detailed Drill-Down */}
      <div className="space-y-4">
        {/* Navigation & Controls */}
        <div 
          className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 border-b pb-2"
          style={{ borderBottomColor: 'var(--color-border-primary)' }}
        >
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto">
            {['product', 'brand', 'customer', 'invoice', 'date'].map((tab) => (
              <button
                key={tab}
                onClick={() => setDrillDownTab(tab)}
                className="px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap"
                style={{
                  backgroundColor: drillDownTab === tab 
                    ? 'var(--color-primary)' 
                    : 'var(--color-bg-card)',
                  color: drillDownTab === tab 
                    ? 'var(--color-text-primary)' 
                    : 'var(--color-text-secondary)',
                  borderRadius: 'var(--radius-full)',
                  boxShadow: drillDownTab === tab 
                    ? '0 10px 15px -3px rgba(59, 130, 246, 0.2)' 
                    : 'none'
                }}
                onMouseEnter={(e) => {
                  if (drillDownTab !== tab) {
                    e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                    e.currentTarget.style.color = 'var(--color-text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (drillDownTab !== tab) {
                    e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
                    e.currentTarget.style.color = 'var(--color-text-secondary)';
                  }
                }}
              >
                By {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          
          <div 
            className="flex items-center space-x-2 p-2 rounded-lg border"
            style={{
              backgroundColor: 'var(--color-bg-card)',
              borderColor: 'var(--color-border-primary)',
              borderRadius: 'var(--radius-lg)'
            }}
          >
            <Switch 
              id="show-zero" 
              checked={showZeroValues}
              onCheckedChange={setShowZeroValues}
            />
            <Label 
              htmlFor="show-zero" 
              className="text-sm cursor-pointer select-none flex items-center gap-2"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {showZeroValues ? <Eye size={14} /> : <EyeOff size={14} />}
              Show Zero Values
            </Label>
          </div>
        </div>

        {/* Data Table */}
        <div 
          className="border rounded-xl overflow-hidden shadow-sm"
          style={{
            backgroundColor: 'rgba(17, 24, 39, 0.5)',
            borderColor: 'var(--color-border-primary)',
            borderRadius: 'var(--radius-xl)'
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead
                style={{
                  backgroundColor: 'rgba(17, 24, 39, 0.8)',
                  borderBottomColor: 'var(--color-border-primary)'
                }}
                className="font-medium border-b"
              >
                <tr>
                  <th 
                    className="px-6 py-4"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Product Name
                  </th>
                  <th 
                    className="px-6 py-4 text-center"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Units Sold
                  </th>
                  <th 
                    className="px-6 py-4 text-right"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Avg Sale Price
                  </th>
                  <th 
                    className="px-6 py-4 text-right"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Total Revenue
                  </th>
                  <th 
                    className="px-6 py-4 text-right"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Gross Profit
                  </th>
                </tr>
              </thead>
              <tbody
                style={{
                  borderColor: 'var(--color-border-primary)'
                }}
                className="divide-y"
              >
                {filteredProducts.map((row) => (
                  <tr 
                    key={row.id}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <td 
                      className="px-6 py-4 font-medium"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {row.name}
                    </td>
                    <td 
                      className="px-6 py-4 text-center"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {row.sold}
                    </td>
                    <td 
                      className="px-6 py-4 text-right font-mono"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Rs {row.avgPrice.toLocaleString()}
                    </td>
                    <td 
                      className="px-6 py-4 text-right font-mono font-medium"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Rs {row.revenue.toLocaleString()}
                    </td>
                    <td 
                      className="px-6 py-4 text-right font-mono font-bold"
                      style={{
                        color: 'var(--color-success)',
                        backgroundColor: 'rgba(5, 150, 105, 0.05)'
                      }}
                    >
                      Rs {row.profit.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot
                style={{
                  backgroundColor: 'var(--color-bg-tertiary)',
                  borderTopColor: 'var(--color-border-primary)'
                }}
                className="border-t"
              >
                 <tr>
                    <td 
                      className="px-6 py-4 font-bold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      TOTAL
                    </td>
                    <td 
                      className="px-6 py-4 text-center font-bold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {totalSold}
                    </td>
                    <td 
                      className="px-6 py-4 text-right"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
                      -
                    </td>
                    <td 
                      className="px-6 py-4 text-right font-bold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Rs {totalProductRevenue.toLocaleString()}
                    </td>
                    <td 
                      className="px-6 py-4 text-right font-bold"
                      style={{ color: 'var(--color-success)' }}
                    >
                      Rs {totalProductProfit.toLocaleString()}
                    </td>
                 </tr>
              </tfoot>
            </table>
          </div>
          {filteredProducts.length === 0 && (
            <div 
              className="p-8 text-center"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              No data available for the selected filters.
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
