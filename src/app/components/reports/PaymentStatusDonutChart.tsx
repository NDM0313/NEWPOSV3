import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { ChartContainer } from '@/app/components/ui/chart';

export type PaymentStatusSlice = {
  name: string;
  value: number;
  amount: number;
  color: string;
};

type Props = {
  data: PaymentStatusSlice[];
  formatCurrency: (n: number) => string;
  className?: string;
  heightClass?: string;
};

export function PaymentStatusDonutChart({
  data,
  formatCurrency,
  className,
  heightClass = 'h-[360px]',
}: Props) {
  const totalAmount = useMemo(() => data.reduce((s, d) => s + (d.amount || 0), 0), [data]);
  const totalCount = useMemo(() => data.reduce((s, d) => s + (d.value || 0), 0), [data]);

  if (totalCount === 0) {
    return (
      <div className={`flex items-center justify-center text-sm text-muted-foreground ${heightClass}`}>
        No payment data in period
      </div>
    );
  }

  return (
    <div className={`relative ${heightClass} w-full ${className ?? ''}`}>
      <ChartContainer className={`min-h-[280px] w-full ${heightClass}`}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
            dataKey="amount"
            nameKey="name"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
            ))}
          </Pie>
          <Tooltip
            formatter={(v: number, _name, item) => {
              const payload = item?.payload as PaymentStatusSlice | undefined;
              const count = payload?.value ?? 0;
              return [`${formatCurrency(v)} (${count} inv.)`, payload?.name ?? 'Amount'];
            }}
            contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
          />
          <Legend
            verticalAlign="bottom"
            height={48}
            formatter={(value, entry) => {
              const payload = entry.payload as PaymentStatusSlice | undefined;
              const count = payload?.value ?? 0;
              return `${value} (${count})`;
            }}
          />
        </PieChart>
      </ChartContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-10">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</p>
        <p className="text-lg font-bold text-foreground tabular-nums">{formatCurrency(totalAmount)}</p>
        <p className="text-[10px] text-muted-foreground">{totalCount} invoice(s)</p>
      </div>
    </div>
  );
}
