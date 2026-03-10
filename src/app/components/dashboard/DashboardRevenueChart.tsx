/**
 * Lazy-loaded Revenue & Profit chart. Keeps recharts out of initial dashboard bundle for faster first paint.
 */
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ChartPoint {
  name: string;
  sales: number;
  profit: number;
}

interface DashboardRevenueChartProps {
  data: ChartPoint[];
  formatCurrency: (n: number) => string;
  emptyMessage: string;
}

export function DashboardRevenueChart({ data, formatCurrency, emptyMessage }: DashboardRevenueChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-[#9CA3AF]">
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }
  return (
    <div className="w-full h-[320px] min-h-[320px]">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={320}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
          <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fontSize: 12 }} />
          <YAxis stroke="#9CA3AF" tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6' }}
            itemStyle={{ color: '#F3F4F6' }}
            formatter={(value: number) => formatCurrency(value)}
            labelFormatter={(label) => `Date: ${label}`}
          />
          <Area type="monotone" dataKey="sales" name="Revenue" stroke="#3B82F6" fillOpacity={1} fill="url(#colorSales)" />
          <Area type="monotone" dataKey="profit" name="Profit" stroke="#10B981" fillOpacity={1} fill="url(#colorProfit)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
