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
      <div 
        className="border rounded-xl p-4 flex items-center justify-between"
        style={{
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderColor: 'rgba(239, 68, 68, 0.2)',
          borderRadius: 'var(--radius-xl)'
        }}
      >
        <div className="flex items-center gap-3">
          <div 
            className="p-2 rounded-lg"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              borderRadius: 'var(--radius-lg)',
              color: 'var(--color-error)'
            }}
          >
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 
              className="font-bold"
              style={{ color: 'var(--color-error)' }}
            >
              Low Stock Alert
            </h3>
            <p 
              className="text-sm"
              style={{ color: 'rgba(248, 113, 113, 1)' }}
            >
              {lowStockItems.length} items are below minimum stock level
            </p>
          </div>
        </div>
        <button 
          className="text-sm font-medium flex items-center gap-1"
          style={{ color: 'var(--color-error)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'rgba(248, 113, 113, 1)'; // red-400
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--color-error)';
          }}
        >
          View Inventory <ArrowRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Custom Studio Widget */}
        <div 
          className="border p-6 rounded-xl relative overflow-hidden group transition-all duration-300 cursor-pointer md:col-span-2 lg:col-span-1"
          style={{
            backgroundColor: 'var(--color-bg-primary)',
            borderColor: 'var(--color-border-primary)',
            borderRadius: 'var(--radius-xl)'
          }}
          onClick={() => setCurrentView('custom-pipeline' as any)}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border-primary)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div className="flex justify-between items-start mb-4">
            <div 
              className="p-2 rounded-lg"
              style={{
                backgroundColor: 'rgba(147, 51, 234, 0.1)',
                borderRadius: 'var(--radius-lg)',
                color: 'var(--color-wholesale)'
              }}
            >
              <Scissors size={20} />
            </div>
            <span 
              className="text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1"
              style={{
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                color: 'var(--color-primary)',
                borderRadius: '9999px'
              }}
            >
              View Board <ArrowRight size={12} />
            </span>
          </div>
          <h3 
            className="text-sm font-medium"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Production Status
          </h3>
          <div className="mt-3 space-y-1">
            <p 
              className="text-sm font-medium flex items-center gap-2"
              style={{ color: 'var(--color-text-primary)' }}
            >
              <span 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: 'var(--color-wholesale)', borderRadius: '50%' }}
              />
              5 Orders in Dyeing
            </p>
            <p 
              className="text-sm font-medium flex items-center gap-2"
              style={{ color: 'var(--color-text-primary)' }}
            >
              <span 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: 'var(--color-success)', borderRadius: '50%' }}
              />
              2 Ready for Dispatch
            </p>
          </div>
        </div>

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
        <div 
          className="lg:col-span-2 border p-6 rounded-xl min-h-[400px]"
          style={{
            backgroundColor: 'var(--color-bg-primary)',
            borderColor: 'var(--color-border-primary)',
            borderRadius: 'var(--radius-xl)'
          }}
        >
          <h3 
            className="text-lg font-bold mb-6"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Revenue & Profit
          </h3>
          <div className="h-80 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
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
          <div 
            className="border p-6 rounded-xl flex-1"
            style={{
              backgroundColor: 'var(--color-bg-primary)',
              borderColor: 'var(--color-border-primary)',
              borderRadius: 'var(--radius-xl)'
            }}
          >
            <h3 
              className="text-lg font-bold mb-4 flex items-center gap-2"
              style={{ color: 'var(--color-text-primary)' }}
            >
              <AlertTriangle 
                size={18}
                style={{ color: 'var(--color-error)' }}
              />
              Critical Stock
            </h3>
            <div className="space-y-4">
              {lowStockItems.map(item => (
                <div 
                  key={item.id} 
                  className="flex items-center justify-between p-3 rounded-lg border"
                  style={{
                    backgroundColor: 'rgba(17, 24, 39, 0.5)',
                    borderColor: 'var(--color-border-primary)',
                    borderRadius: 'var(--radius-lg)'
                  }}
                >
                  <div>
                    <p 
                      className="font-medium text-sm"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {item.name}
                    </p>
                    <p 
                      className="text-xs"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
                      SKU: {item.sku}
                    </p>
                  </div>
                  <div className="text-right">
                    <p 
                      className="font-bold"
                      style={{ color: 'var(--color-error)' }}
                    >
                      {item.stock}
                    </p>
                    <p 
                      className="text-xs"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
                      Min: {item.min}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <button 
              className="w-full mt-4 py-2 text-sm text-center"
              style={{ color: 'var(--color-primary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'rgba(96, 165, 250, 1)'; // blue-400
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--color-primary)';
              }}
            >
              View All Low Stock
            </button>
          </div>

          <div 
            className="border p-6 rounded-xl"
            style={{
              backgroundColor: 'var(--color-bg-primary)',
              borderColor: 'var(--color-border-primary)',
              borderRadius: 'var(--radius-xl)'
            }}
          >
             <h3 
               className="text-lg font-bold mb-6"
               style={{ color: 'var(--color-text-primary)' }}
             >
               Sales by Category
             </h3>
             {/* Simple Placeholder for another chart */}
             <div 
               className="h-40 flex items-center justify-center"
               style={{ color: 'var(--color-text-tertiary)' }}
             >
                <div className="flex gap-2">
                  <div 
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: 'var(--color-primary)', borderRadius: '50%' }}
                  />
                  <div 
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: 'var(--color-success)', borderRadius: '50%' }}
                  />
                  <div 
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: 'var(--color-warning)', borderRadius: '50%' }}
                  />
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, change, icon: Icon, trend, iconColor }: any) => {
  const getIconBgColor = () => {
    if (iconColor === 'text-blue-500') return 'rgba(59, 130, 246, 0.1)';
    if (iconColor === 'text-orange-500') return 'rgba(249, 115, 22, 0.1)';
    if (iconColor === 'text-green-500') return 'rgba(16, 185, 129, 0.1)';
    if (iconColor === 'text-purple-500') return 'rgba(147, 51, 234, 0.1)';
    return 'rgba(59, 130, 246, 0.1)';
  };
  
  const getIconColor = () => {
    if (iconColor === 'text-blue-500') return 'var(--color-primary)';
    if (iconColor === 'text-orange-500') return 'var(--color-warning)';
    if (iconColor === 'text-green-500') return 'var(--color-success)';
    if (iconColor === 'text-purple-500') return 'var(--color-wholesale)';
    return 'var(--color-primary)';
  };

  return (
    <div 
      className="border p-6 rounded-xl relative overflow-hidden group transition-all duration-300"
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        borderColor: 'var(--color-border-primary)',
        borderRadius: 'var(--radius-xl)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-border-primary)';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div 
        className="absolute right-0 top-0 w-24 h-24 rounded-bl-full -mr-4 -mt-4 transition-transform"
        style={{
          backgroundColor: 'rgba(59, 130, 246, 0.05)',
          borderRadius: '0 0 0 100%'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
      />
      <div className="flex justify-between items-start mb-4">
        <div 
          className="p-2 rounded-lg"
          style={{
            backgroundColor: getIconBgColor(),
            borderRadius: 'var(--radius-lg)',
            color: getIconColor()
          }}
        >
          <Icon size={20} style={{ color: getIconColor() }} />
        </div>
        <span 
          className="text-xs font-medium px-2 py-1 rounded-full"
          style={
            trend === 'up' 
              ? {
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  color: 'var(--color-success)',
                  borderRadius: '9999px'
                }
              : {
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: 'var(--color-error)',
                  borderRadius: '9999px'
                }
          }
        >
          {change}
        </span>
      </div>
      <h3 
        className="text-sm font-medium"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {title}
      </h3>
      <p 
        className="text-2xl font-bold mt-1"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {value}
      </p>
    </div>
  );
};