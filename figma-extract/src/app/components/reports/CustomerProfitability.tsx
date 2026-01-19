import React from 'react';
import { 
  TrendingUp,
  Search,
  Users
} from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ReportActions } from './ReportActions';
import { cn } from "../ui/utils";

// Mock Data
const customerData = [
  { id: 1, name: 'Bridal Boutique Lahore', items: 45, revenue: 2100000, cost: 1450000, profit: 650000, margin: 30.9 },
  { id: 2, name: 'Karachi Fabrics', items: 28, revenue: 1800000, cost: 1350000, profit: 450000, margin: 25.0 },
  { id: 3, name: 'Mrs. Saad', items: 5, revenue: 450000, cost: 200000, profit: 250000, margin: 55.5 },
  { id: 4, name: 'Ali Textiles', items: 12, revenue: 950000, cost: 800000, profit: 150000, margin: 15.8 },
  { id: 5, name: 'Zara Ahmed', items: 3, revenue: 120000, cost: 80000, profit: 40000, margin: 33.3 },
  { id: 6, name: 'Fatima & Co.', items: 8, revenue: 320000, cost: 250000, profit: 70000, margin: 21.9 },
];

export const CustomerProfitabilityReport = () => {
  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
      <ReportActions title="Customer Profitability Report" />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-gray-900 to-green-900/20 border border-green-900/30 p-6 rounded-xl relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-gray-400 font-medium text-sm">Most Profitable Customer</p>
            <h3 className="text-xl font-bold text-white mt-1">Bridal Boutique Lahore</h3>
            <p className="text-green-400 text-sm mt-2 font-mono font-bold">+Rs 650,000 Profit</p>
          </div>
          <Users className="absolute right-4 top-4 text-green-500/10" size={64} />
        </div>
        
        <div className="bg-gradient-to-br from-gray-900 to-blue-900/20 border border-blue-900/30 p-6 rounded-xl relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-gray-400 font-medium text-sm">Highest Margin (Retail)</p>
            <h3 className="text-xl font-bold text-white mt-1">Mrs. Saad</h3>
            <p className="text-blue-400 text-sm mt-2 font-mono font-bold">55.5% Margin</p>
          </div>
          <TrendingUp className="absolute right-4 top-4 text-blue-500/10" size={64} />
        </div>
        
        <div className="bg-gray-900/50 border border-gray-800 p-6 rounded-xl flex flex-col justify-center">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input 
              placeholder="Search customers..." 
              className="pl-10 bg-gray-950 border-gray-700 text-white h-12 w-full"
            />
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-950/80 text-gray-400 font-medium border-b border-gray-800">
              <tr>
                <th className="px-6 py-4">Customer Name</th>
                <th className="px-6 py-4 text-center">Total Items</th>
                <th className="px-6 py-4 text-right">Total Revenue</th>
                <th className="px-6 py-4 text-right">Total Cost (COGS)</th>
                <th className="px-6 py-4 text-right">Net Profit</th>
                <th className="px-6 py-4 text-right">Profit Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {customerData.map((row) => (
                <tr key={row.id} className="hover:bg-gray-800/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-400 group-hover:bg-blue-900/50 group-hover:text-blue-400 transition-colors">
                        {row.name.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="text-white font-medium">{row.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center text-gray-300">
                    {row.items}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-300 font-mono">
                    Rs {row.revenue.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-400 font-mono">
                    Rs {row.cost.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-green-400 bg-green-900/5">
                    Rs {row.profit.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right font-mono">
                    <span className={cn(
                      "px-2 py-1 rounded text-xs font-bold",
                      row.margin >= 30 ? "bg-green-500/20 text-green-400" : 
                      row.margin >= 20 ? "bg-blue-500/20 text-blue-400" :
                      "bg-yellow-500/20 text-yellow-400"
                    )}>
                      {row.margin}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-gray-800 bg-gray-900/80 text-center">
          <p className="text-gray-500 text-sm">Showing top 6 customers based on profitability</p>
        </div>
      </div>
    </div>
  );
};
