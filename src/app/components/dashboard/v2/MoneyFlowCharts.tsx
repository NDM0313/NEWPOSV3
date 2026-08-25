import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { DashboardV2Snapshot } from '@/app/lib/dashboardV2Mappers';

interface Props {
  charts: DashboardV2Snapshot['charts'];
  formatCurrency: (n: number) => string;
  showMoney: boolean;
}

export const MoneyFlowCharts: React.FC<Props> = ({ charts, formatCurrency, showMoney }) => {
  if (!showMoney) return null;

  const trendData = charts.salesTrend.map((s, i) => ({
    date: s.date.slice(5),
    sales: s.value,
    spend: charts.purchasesExpensesTrend[i]?.purchases ?? 0,
    profit: charts.profitTrend[i]?.value ?? 0,
  }));

  const paymentData = charts.paymentMethodBreakdown.filter((p) => p.amount > 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-foreground font-semibold mb-3 text-sm">Sales & Spend Trend</h3>
        {trendData.length ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData}>
              <CartesianGrid stroke="#374151" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151' }}
                formatter={(v: number) => formatCurrency(v)}
              />
              <Legend />
              <Line type="monotone" dataKey="sales" stroke="#3B82F6" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="spend" stroke="#F59E0B" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="profit" stroke="#10B981" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-[#6B7280] text-sm py-8 text-center">No trend data for selected period.</p>
        )}
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-foreground font-semibold mb-3 text-sm">Payment Methods</h3>
        {paymentData.length ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={paymentData}>
              <CartesianGrid stroke="#374151" strokeDasharray="3 3" />
              <XAxis dataKey="method" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151' }}
                formatter={(v: number) => formatCurrency(v)}
              />
              <Bar dataKey="amount" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-[#6B7280] text-sm py-8 text-center">No payments in selected period.</p>
        )}
      </div>
    </div>
  );
};
