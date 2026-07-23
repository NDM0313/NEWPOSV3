import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import type { DashboardV2Snapshot } from '@/app/lib/dashboardV2Mappers';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4'];

interface Props {
  charts: DashboardV2Snapshot['charts'];
  formatCurrency: (n: number) => string;
  showMoney: boolean;
}

export const TopEntitiesCharts: React.FC<Props> = ({ charts, formatCurrency, showMoney }) => {
  if (!showMoney) return null;

  const categories = charts.salesByCategory.filter((c) => c.total > 0).slice(0, 6);
  const customers = charts.topCustomers.filter((c) => c.total > 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-foreground font-semibold mb-3 text-sm">Sales by Category</h3>
        {categories.length ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={categories} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid stroke="#374151" strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <YAxis type="category" dataKey="categoryName" width={100} tick={{ fill: '#9CA3AF', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151' }}
                formatter={(v: number) => formatCurrency(v)}
              />
              <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                {categories.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-[#6B7280] text-sm py-8 text-center">No category sales in period.</p>
        )}
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-foreground font-semibold mb-3 text-sm">Top Customers</h3>
        {customers.length ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={customers}>
              <CartesianGrid stroke="#374151" strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
              <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151' }}
                formatter={(v: number) => formatCurrency(v)}
              />
              <Bar dataKey="total" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-[#6B7280] text-sm py-8 text-center">No customer sales in period.</p>
        )}
      </div>
    </div>
  );
};
