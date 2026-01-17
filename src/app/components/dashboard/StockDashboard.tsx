import React from 'react';
import { DollarSign, Package, TrendingUp, AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from "../ui/button";

const slowMovingItems = [
  { id: 1, name: 'Patterned Silk Scarf', sku: 'SCF-009', days: 120, stock: 45, value: 22500 },
  { id: 2, name: 'Linen Trousers (Beige, XL)', sku: 'TR-LN-004', days: 95, stock: 12, value: 18000 },
  { id: 3, name: 'Embroidered Kurta (Green, S)', sku: 'KRT-EM-021', days: 92, stock: 8, value: 28000 },
];

export const StockDashboard = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Stock Management</h2>
          <p className="text-gray-500 dark:text-gray-400">Overview of inventory value and health.</p>
        </div>
        <Button variant="outline" className="border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200">
          Stock Adjustment
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StockCard 
          title="Inventory Value (Cost)" 
          value="$50,000" 
          icon={Package} 
          color="text-blue-500" 
          bg="bg-blue-500/10"
        />
        <StockCard 
          title="Inventory Value (Sale)" 
          value="$80,000" 
          icon={DollarSign} 
          color="text-purple-500" 
          bg="bg-purple-500/10"
        />
        <StockCard 
          title="Potential Profit" 
          value="$30,000" 
          icon={TrendingUp} 
          color="text-green-500" 
          bg="bg-green-500/10"
        />
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="text-orange-500" size={20} />
            Slow Moving Items
            <span className="text-sm font-normal text-gray-500 ml-2">(Not sold in 90+ days)</span>
          </h3>
          <Button variant="ghost" size="sm" className="text-blue-500 hover:text-blue-400">View All <ArrowRight size={16} className="ml-1" /></Button>
        </div>
        
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
            <tr>
              <th className="px-6 py-4 font-semibold text-gray-900 dark:text-gray-200">Product Name</th>
              <th className="px-6 py-4 font-semibold text-gray-900 dark:text-gray-200">SKU</th>
              <th className="px-6 py-4 font-semibold text-gray-900 dark:text-gray-200">Days Unsold</th>
              <th className="px-6 py-4 font-semibold text-gray-900 dark:text-gray-200 text-center">Stock Qty</th>
              <th className="px-6 py-4 font-semibold text-gray-900 dark:text-gray-200 text-right">Value Locked</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {slowMovingItems.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{item.name}</td>
                <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-xs font-mono">{item.sku}</td>
                <td className="px-6 py-4">
                  <span className="bg-orange-100 dark:bg-orange-500/10 text-orange-700 dark:text-orange-500 px-2 py-1 rounded-full text-xs font-medium border border-orange-200 dark:border-orange-500/20">
                    {item.days} Days
                  </span>
                </td>
                <td className="px-6 py-4 text-center text-gray-900 dark:text-white">{item.stock}</td>
                <td className="px-6 py-4 text-right font-bold text-gray-900 dark:text-white">${item.value.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const StockCard = ({ title, value, icon: Icon, color, bg }: any) => (
  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-xl flex items-center gap-4">
    <div className={`p-4 rounded-xl ${bg} ${color}`}>
      <Icon size={24} />
    </div>
    <div>
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
      <h3 className={`text-2xl font-bold mt-1 ${title.includes('Profit') ? 'text-green-500' : 'text-gray-900 dark:text-white'}`}>{value}</h3>
    </div>
  </div>
);
