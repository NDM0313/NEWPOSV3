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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-900/50 p-6 rounded-xl border border-gray-800">
        <div>
          <h2 className="text-2xl font-bold text-white">Profit & Loss Statement</h2>
          <p className="text-gray-400 text-sm mt-1">Detailed financial performance report</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <Select defaultValue="main_branch">
            <SelectTrigger className="w-[160px] h-9 bg-gray-950 border-gray-700 text-white rounded-full">
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-800 text-white">
              <SelectItem value="main_branch">Main Branch</SelectItem>
              <SelectItem value="warehouse">Warehouse</SelectItem>
            </SelectContent>
          </Select>

          <Select defaultValue="this_month">
            <SelectTrigger className="w-[160px] h-9 bg-gray-950 border-gray-700 text-white rounded-full">
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-800 text-white">
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="this_year">This Year</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1 ml-2 border-l border-gray-700 pl-3">
            <Button variant="ghost" size="icon" className="h-9 w-9 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full" title="Export PDF">
              <FileText size={18} />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full" title="Export Excel">
              <FileSpreadsheet size={18} />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full" title="Print">
              <Printer size={18} />
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Hero Section (The "Bottom Line") */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-gray-900 via-gray-900 to-gray-800 border border-gray-700 p-8 shadow-2xl h-[200px] min-h-[200px]">
        {/* Background Trend Line */}
        <div className="absolute inset-0 w-full h-full opacity-10 pointer-events-none">
          <ResponsiveContainer width="100%" height={200} minWidth={0} minHeight={200}>
            <AreaChart data={trendData}>
              <Area type="monotone" dataKey="value" stroke="#4ade80" fill="#4ade80" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-center md:text-left">
            <p className="text-gray-400 font-medium mb-1 uppercase tracking-wider text-sm">Gross Profit</p>
            <h3 className="text-4xl font-bold text-white">Rs {(grossProfit/1000000).toFixed(1)}M</h3>
          </div>
          
          <div className="h-px w-full md:w-px md:h-16 bg-gray-700"></div>

          <div className="text-center md:text-right">
            <p className="text-gray-400 font-medium mb-1 uppercase tracking-wider text-sm">Net Profit</p>
            <h3 className="text-5xl md:text-6xl font-black text-[#4ade80] drop-shadow-[0_0_15px_rgba(74,222,128,0.3)]">
              Rs {netProfit.toLocaleString()}
            </h3>
          </div>
        </div>
      </div>

      {/* 3. The Breakdown (Split View) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Costs & Expenses */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-800 bg-red-950/10 flex justify-between items-center">
             <h3 className="font-bold text-white">Costs & Expenses</h3>
             <span className="text-xs font-bold text-red-400 bg-red-500/10 px-2 py-1 rounded border border-red-500/20">Money Out</span>
          </div>
          <div className="p-6 space-y-4 flex-1">
             <div className="text-sm font-medium text-gray-500 mb-2">Cost of Goods Sold (COGS)</div>
             {breakdownData.costs.filter(i => showZeroValues || i.value !== 0).map((item, idx) => (
               <div key={idx} className="flex justify-between items-center group">
                 <span className="text-gray-300 group-hover:text-white transition-colors">{item.label}</span>
                 <span className="font-mono text-gray-200">Rs {Math.abs(item.value).toLocaleString()}</span>
               </div>
             ))}
          </div>
          <div className="p-4 border-t border-gray-800 bg-gray-900 flex justify-between items-center">
             <span className="font-bold text-gray-400">Total Cost</span>
             <span className="font-bold text-xl text-white">Rs {totalCost.toLocaleString()}</span>
          </div>
        </div>

        {/* Revenue & Stock */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-800 bg-green-950/10 flex justify-between items-center">
             <h3 className="font-bold text-white">Revenue & Stock</h3>
             <span className="text-xs font-bold text-green-400 bg-green-500/10 px-2 py-1 rounded border border-green-500/20">Money In</span>
          </div>
          <div className="p-6 space-y-4 flex-1">
             <div className="text-sm font-medium text-gray-500 mb-2">Sales & Inventory</div>
             {breakdownData.revenue.filter(i => showZeroValues || i.value !== 0).map((item, idx) => (
               <div key={idx} className="flex justify-between items-center group">
                 <span className="text-gray-300 group-hover:text-white transition-colors">{item.label}</span>
                 <span className="font-mono text-gray-200">Rs {Math.abs(item.value).toLocaleString()}</span>
               </div>
             ))}
          </div>
          <div className="p-4 border-t border-gray-800 bg-gray-900 flex justify-between items-center">
             <span className="font-bold text-gray-400">Total Revenue</span>
             <span className="font-bold text-xl text-white">Rs {totalRevenue.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* 4. Detailed Drill-Down */}
      <div className="space-y-4">
        {/* Navigation & Controls */}
        <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 border-b border-gray-800 pb-2">
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto">
            {['product', 'brand', 'customer', 'invoice', 'date'].map((tab) => (
              <button
                key={tab}
                onClick={() => setDrillDownTab(tab)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap",
                  drillDownTab === tab 
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" 
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                )}
              >
                By {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          
          <div className="flex items-center space-x-2 bg-gray-900 p-2 rounded-lg border border-gray-800">
            <Switch 
              id="show-zero" 
              checked={showZeroValues}
              onCheckedChange={setShowZeroValues}
              className="data-[state=checked]:bg-blue-600"
            />
            <Label htmlFor="show-zero" className="text-sm text-gray-400 cursor-pointer select-none flex items-center gap-2">
              {showZeroValues ? <Eye size={14} /> : <EyeOff size={14} />}
              Show Zero Values
            </Label>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-950/80 text-gray-400 font-medium border-b border-gray-800">
                <tr>
                  <th className="px-6 py-4">Product Name</th>
                  <th className="px-6 py-4 text-center">Units Sold</th>
                  <th className="px-6 py-4 text-right">Avg Sale Price</th>
                  <th className="px-6 py-4 text-right">Total Revenue</th>
                  <th className="px-6 py-4 text-right">Gross Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredProducts.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-white">{row.name}</td>
                    <td className="px-6 py-4 text-center text-gray-300">{row.sold}</td>
                    <td className="px-6 py-4 text-right text-gray-400 font-mono">
                      Rs {row.avgPrice.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-medium text-white">
                      Rs {row.revenue.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-green-400 bg-green-900/5">
                      Rs {row.profit.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-950 border-t border-gray-800">
                 <tr>
                    <td className="px-6 py-4 font-bold text-white">TOTAL</td>
                    <td className="px-6 py-4 text-center font-bold text-white">{totalSold}</td>
                    <td className="px-6 py-4 text-right text-gray-500">-</td>
                    <td className="px-6 py-4 text-right font-bold text-white">Rs {totalProductRevenue.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-bold text-green-400">Rs {totalProductProfit.toLocaleString()}</td>
                 </tr>
              </tfoot>
            </table>
          </div>
          {filteredProducts.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              No data available for the selected filters.
            </div>
          )}
        </div>
      </div>

    </div>
  );
};