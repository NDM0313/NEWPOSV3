import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { DollarSign, ShoppingBag, TrendingUp, ArrowDownRight, ArrowUpRight, AlertTriangle, ArrowRight, Scissors } from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';

const data = [
  { name: 'Mon', sales: 4000, profit: 2400 },
  { name: 'Tue', sales: 3000, profit: 1398 },
  { name: 'Wed', sales: 2000, profit: 9800 },
  { name: 'Thu', sales: 2780, profit: 3908 },
  { name: 'Fri', sales: 1890, profit: 4800 },
  { name: 'Sat', sales: 2390, profit: 3800 },
  { name: 'Sun', sales: 3490, profit: 4300 },
];

const lowStockItems = [
  { id: 1, name: 'Wireless Mouse Gen 2', sku: 'WM-002', stock: 2, min: 10 },
  { id: 2, name: 'USB-C Cable 2m', sku: 'CB-005', stock: 5, min: 20 },
  { id: 3, name: 'Mechanical Keyboard Switch', sku: 'KB-SW-01', stock: 12, min: 50 },
];

export const Dashboard = () => {
  const { setCurrentView } = useNavigation();

  return (
    <div className="space-y-6">
      {/* Low Stock Alert Banner */}
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-500/20 rounded-lg text-red-500">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 className="text-red-500 font-bold">Low Stock Alert</h3>
            <p className="text-red-400 text-sm">{lowStockItems.length} items are below minimum stock level</p>
          </div>
        </div>
        <button className="text-sm font-medium text-red-500 hover:text-red-400 flex items-center gap-1">
          View Inventory <ArrowRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Due (Receivables)" 
          value="$12,450.00" 
          change="+4.5%" 
          icon={ArrowDownRight} 
          trend="up"
          iconColor="text-blue-500"
        />
        <StatCard 
          title="Supplier Due (Payables)" 
          value="$4,200.50" 
          change="-2.1%" 
          icon={ArrowUpRight} 
          trend="down"
          iconColor="text-orange-500"
        />
        <StatCard 
          title="Net Profit" 
          value="$48,200.00" 
          change="+14.2%" 
          icon={DollarSign} 
          trend="up"
          iconColor="text-green-500"
        />
        <StatCard 
          title="Total Sales" 
          value="$124,592.00" 
          change="+12.5%" 
          icon={ShoppingBag} 
          trend="up"
          iconColor="text-purple-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-xl">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Revenue & Profit</h3>
          <div className="w-full h-[320px] min-h-[320px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={320}>
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="name" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6' }}
                  itemStyle={{ color: '#F3F4F6' }}
                />
                <Area type="monotone" dataKey="sales" stroke="#3B82F6" fillOpacity={1} fill="url(#colorSales)" />
                <Area type="monotone" dataKey="profit" stroke="#10B981" fillOpacity={1} fill="url(#colorProfit)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-6">
           {/* Low Stock List */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-xl flex-1">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-500" />
              Critical Stock
            </h3>
            <div className="space-y-4">
              {lowStockItems.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">{item.name}</p>
                    <p className="text-xs text-gray-500">SKU: {item.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-red-500">{item.stock}</p>
                    <p className="text-xs text-gray-500">Min: {item.min}</p>
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-4 py-2 text-sm text-center text-blue-500 hover:text-blue-400">
              View All Low Stock
            </button>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-xl">
             <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Sales by Category</h3>
             {/* Simple Placeholder for another chart */}
             <div className="h-40 flex items-center justify-center text-gray-500">
                <div className="flex gap-2">
                  <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                  <div className="w-4 h-4 rounded-full bg-green-500"></div>
                  <div className="w-4 h-4 rounded-full bg-orange-500"></div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, change, icon: Icon, trend, iconColor }: any) => (
  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-xl relative overflow-hidden group hover:border-blue-500/50 hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
    <div className="absolute right-0 top-0 w-24 h-24 bg-blue-500/5 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110" />
    <div className="flex justify-between items-start mb-4">
      <div className={`p-2 rounded-lg ${iconColor ? iconColor.replace('text-', 'bg-').replace('500', '500/10') : 'bg-gray-100 dark:bg-gray-800'} ${iconColor || 'text-blue-500'}`}>
        <Icon size={20} className={iconColor} />
      </div>
      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
        trend === 'up' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
      }`}>
        {change}
      </span>
    </div>
    <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">{title}</h3>
    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
  </div>
);