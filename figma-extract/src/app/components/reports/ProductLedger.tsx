import React, { useState } from 'react';
import { 
  Calendar as CalendarIcon, 
  Search, 
  ArrowUpRight, 
  ArrowDownRight, 
  CornerUpLeft, 
  RefreshCw 
} from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { ReportActions } from './ReportActions';
import { cn } from "../ui/utils";

// Mock Data
const ledgerData = [
  { id: 1, date: '2023-12-01', type: 'Purchase', party: 'Silk Traders Ltd', qty: 10, price: 40000, profit: 0, balance: 10 },
  { id: 2, date: '2023-12-05', type: 'Sale', party: 'Mrs. Saad', qty: -1, price: 120000, profit: 80000, balance: 9 },
  { id: 3, date: '2023-12-10', type: 'Return', party: 'Mrs. Saad', qty: 1, price: 120000, profit: -80000, balance: 10 },
  { id: 4, date: '2023-12-12', type: 'Sale', party: 'Bridal Boutique', qty: -5, price: 110000, profit: 350000, balance: 5 },
  { id: 5, date: '2023-12-28', type: 'Adjustment', party: 'Stock Audit', qty: -1, price: 40000, profit: 0, balance: 4 },
];

export const ProductLedger = () => {
  const [selectedProduct, setSelectedProduct] = useState('p1');

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'Purchase':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-green-500/10 text-green-400 border border-green-500/20"><ArrowDownRight size={12} /> Purchase</span>;
      case 'Sale':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20"><ArrowUpRight size={12} /> Sale</span>;
      case 'Return':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20"><CornerUpLeft size={12} /> Return</span>;
      case 'Adjustment':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20"><RefreshCw size={12} /> Adjustment</span>;
      default:
        return <span className="text-gray-400">{type}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
      <ReportActions title="Product Ledger (Item History)" />

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 bg-gray-900/50 p-4 rounded-xl border border-gray-800">
        <div className="flex-1">
          <label className="text-xs text-gray-500 mb-1 block">Select Product</label>
          <Select value={selectedProduct} onValueChange={setSelectedProduct}>
            <SelectTrigger className="w-full bg-gray-950 border-gray-700 text-white h-10">
              <SelectValue placeholder="Search product..." />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-800 text-white">
              <div className="p-2 sticky top-0 bg-gray-900 z-10 border-b border-gray-800 mb-2">
                 <div className="relative">
                   <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-500" />
                   <Input placeholder="Search..." className="h-8 pl-8 bg-gray-800 border-gray-700 text-xs" />
                 </div>
              </div>
              <SelectItem value="p1">Bridal Maxi Red (SKU-101)</SelectItem>
              <SelectItem value="p2">Embroidered Lawn Suit (Vol 1)</SelectItem>
              <SelectItem value="p3">Gold Clutch</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full md:w-[200px]">
          <label className="text-xs text-gray-500 mb-1 block">Date Range</label>
          <Button variant="outline" className="w-full justify-start text-left font-normal bg-gray-950 border-gray-700 text-white h-10">
            <CalendarIcon className="mr-2 h-4 w-4" />
            <span>Dec 2023</span>
          </Button>
        </div>
      </div>

      {/* Header Card */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 border border-gray-700 p-6 rounded-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Bridal Maxi Red</h2>
            <p className="text-gray-400 font-mono text-sm mt-1">SKU-101 • Category: Bridal</p>
          </div>
          <div className="flex items-center gap-8">
            <div className="text-right">
              <p className="text-gray-400 text-xs uppercase tracking-wider">Current Stock</p>
              <p className="text-3xl font-bold text-white">5 <span className="text-sm font-normal text-gray-500">Units</span></p>
            </div>
            <div className="h-10 w-px bg-gray-700 hidden md:block"></div>
            <div className="text-right">
              <p className="text-gray-400 text-xs uppercase tracking-wider">Avg Cost</p>
              <p className="text-xl font-bold text-white">Rs 40,000</p>
            </div>
            <div className="text-right">
              <p className="text-gray-400 text-xs uppercase tracking-wider">Avg Sale</p>
              <p className="text-xl font-bold text-green-400">Rs 120,000</p>
            </div>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-950/80 text-gray-400 font-medium border-b border-gray-800">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Party Name</th>
                <th className="px-6 py-4 text-center">Qty Change</th>
                <th className="px-6 py-4 text-right">Unit Price</th>
                <th className="px-6 py-4 text-right">Profit</th>
                <th className="px-6 py-4 text-right">Stock Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {ledgerData.map((row) => (
                <tr key={row.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-6 py-4 text-gray-300 whitespace-nowrap">{row.date}</td>
                  <td className="px-6 py-4">{getTypeBadge(row.type)}</td>
                  <td className="px-6 py-4 text-white font-medium">{row.party}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn(
                      "font-mono font-bold",
                      row.qty > 0 ? "text-green-500" : "text-red-500"
                    )}>
                      {row.qty > 0 ? '+' : ''}{row.qty}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-gray-300 font-mono">
                    Rs {row.price.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right font-mono">
                    {row.profit !== 0 ? (
                      <span className={row.profit > 0 ? "text-green-500 font-bold" : "text-red-400 font-bold"}>
                        {row.profit > 0 ? '+' : ''}Rs {Math.abs(row.profit).toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-gray-600">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right text-white font-bold font-mono bg-gray-900/30">
                    {row.balance}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
