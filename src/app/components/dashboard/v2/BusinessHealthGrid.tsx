import React from 'react';
import {
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Wallet,
  Building2,
  ArrowDownRight,
  ArrowUpRight,
  Receipt,
} from 'lucide-react';
import type { DashboardV2Snapshot } from '@/app/lib/dashboardV2Mappers';

interface Props {
  snapshot: DashboardV2Snapshot;
  formatCurrency: (n: number) => string;
  showMoney: boolean;
}

function TrendBadge({ pct }: { pct: number | null | undefined }) {
  if (pct == null) return null;
  const up = pct >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center text-xs font-medium ${up ? 'text-emerald-400' : 'text-red-400'}`}>
      <Icon className="w-3 h-3 mr-0.5" />
      {Math.abs(pct)}%
    </span>
  );
}

function Card({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  accent,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  trend?: number | null;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-[#374151] bg-[#1F2937] p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <span className="text-[#9CA3AF] text-sm">{title}</span>
        <div className={`p-2 rounded-lg ${accent ?? 'bg-[#111827]'}`}>
          <Icon className="w-4 h-4 text-[#9CA3AF]" />
        </div>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="flex items-center justify-between text-xs text-[#6B7280]">
        <span>{subtitle}</span>
        <TrendBadge pct={trend} />
      </div>
    </div>
  );
}

export const BusinessHealthGrid: React.FC<Props> = ({ snapshot, formatCurrency, showMoney }) => {
  const { summary, meta } = snapshot;
  const period = meta.periodLabel;

  if (!showMoney) {
    return (
      <div className="rounded-xl border border-[#374151] bg-[#1F2937] p-6 text-[#9CA3AF] text-sm">
        Operational alerts and stock are shown below. Financial summary requires admin or owner access.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <Card
        title="Period Sales"
        value={formatCurrency(summary.periodSales)}
        subtitle={period}
        icon={DollarSign}
        trend={summary.priorPeriod?.salesTrendPct}
        accent="bg-blue-500/10"
      />
      <Card
        title="Net Profit (est.)"
        value={formatCurrency(summary.netProfit)}
        subtitle="Operational — see P&L for GL"
        icon={TrendingUp}
        trend={summary.priorPeriod?.profitTrendPct}
        accent="bg-emerald-500/10"
      />
      <Card
        title="Purchases"
        value={formatCurrency(summary.periodPurchases)}
        subtitle="Final / received"
        icon={ShoppingBag}
        accent="bg-amber-500/10"
      />
      <Card
        title="Operating Expenses"
        value={formatCurrency(summary.periodOperatingExpenses)}
        subtitle="Paid expenses only"
        icon={Receipt}
        accent="bg-purple-500/10"
      />
      <Card
        title="Cash"
        value={formatCurrency(summary.cashBalance)}
        subtitle="Company-wide GL"
        icon={Wallet}
        accent={summary.cashBalance < 0 ? 'bg-red-500/10' : 'bg-[#111827]'}
      />
      <Card
        title="Bank"
        value={formatCurrency(summary.bankBalance)}
        subtitle="Company-wide GL"
        icon={Building2}
        accent={summary.bankBalance < 0 ? 'bg-red-500/10' : 'bg-[#111827]'}
      />
      <Card
        title="Receivables"
        value={formatCurrency(summary.receivables)}
        subtitle={meta.arApBasis ?? 'Contact balances'}
        icon={ArrowUpRight}
        accent="bg-cyan-500/10"
      />
      <Card
        title="Payables"
        value={formatCurrency(summary.payables)}
        subtitle={meta.arApBasis ?? 'Contact balances'}
        icon={ArrowDownRight}
        accent="bg-orange-500/10"
      />
    </div>
  );
};
