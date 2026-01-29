import { TrendingUp, TrendingDown, DollarSign, Calendar, PieChart, BarChart3, Activity } from 'lucide-react';
import type { Transaction } from '@/app/services/customerLedgerTypes';

interface TransactionAnalyticsProps {
  transactions: Transaction[];
  stats: {
    totalDebit: number;
    totalCredit: number;
    netBalance: number;
    salesCount: number;
    paymentsCount: number;
    discountsCount: number;
    avgTransaction: number;
    highestTransaction: number;
    lowestTransaction: number;
  };
}

export function TransactionAnalytics({ transactions, stats }: TransactionAnalyticsProps) {
  // Exclude Opening Balance from charts so period stats and distributions are correct
  const periodTransactions = transactions.filter(t => t.documentType !== 'Opening Balance');

  const dayWiseData = periodTransactions.reduce((acc, t) => {
    const day = new Date(t.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    if (!acc[day]) acc[day] = { debit: 0, credit: 0, count: 0 };
    acc[day].debit += t.debit;
    acc[day].credit += t.credit;
    acc[day].count += 1;
    return acc;
  }, {} as Record<string, { debit: number; credit: number; count: number }>);

  const totalTransactions = periodTransactions.length;
  const salesPercentage = totalTransactions > 0 ? (stats.salesCount / totalTransactions * 100).toFixed(1) : '0';
  const paymentsPercentage = totalTransactions > 0 ? (stats.paymentsCount / totalTransactions * 100).toFixed(1) : '0';
  const discountsPercentage = totalTransactions > 0 ? (stats.discountsCount / totalTransactions * 100).toFixed(1) : '0';

  const amountDistribution = [
    { range: '0 - 10,000', count: periodTransactions.filter(t => (t.debit || t.credit) <= 10000).length },
    { range: '10,000 - 30,000', count: periodTransactions.filter(t => (t.debit || t.credit) > 10000 && (t.debit || t.credit) <= 30000).length },
    { range: '30,000 - 50,000', count: periodTransactions.filter(t => (t.debit || t.credit) > 30000 && (t.debit || t.credit) <= 50000).length },
    { range: '50,000+', count: periodTransactions.filter(t => (t.debit || t.credit) > 50000).length },
  ];

  const maxDayAmount = Math.max(1, ...Object.values(dayWiseData).map(d => Math.max(d.debit, d.credit)));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Transaction Volume</p>
              <p className="text-2xl font-bold text-white mt-1">{totalTransactions}</p>
              <p className="text-xs text-gray-500 mt-1">Total entries</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Activity className="w-6 h-6 text-blue-500" />
            </div>
          </div>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Highest Transaction</p>
              <p className="text-2xl font-bold text-yellow-400 mt-1">Rs {stats.highestTransaction.toLocaleString('en-PK')}</p>
              <p className="text-xs text-gray-500 mt-1">Peak value</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-yellow-500" />
            </div>
          </div>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Lowest Transaction</p>
              <p className="text-2xl font-bold text-white mt-1">Rs {stats.lowestTransaction.toLocaleString('en-PK')}</p>
              <p className="text-xs text-gray-500 mt-1">Min value</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-gray-500/10 flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-gray-500" />
            </div>
          </div>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Average Value</p>
              <p className="text-2xl font-bold text-white mt-1">Rs {stats.avgTransaction.toLocaleString('en-PK', { maximumFractionDigits: 0 })}</p>
              <p className="text-xs text-gray-500 mt-1">Per transaction</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-blue-500" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/10">
              <PieChart className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Transaction Type Distribution</h3>
              <p className="text-xs text-gray-500">Breakdown by document type</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Sales</span>
                <span className="text-sm font-bold text-blue-500">{salesPercentage}%</span>
              </div>
              <div className="h-3 rounded-full overflow-hidden bg-gray-800">
                <div className="h-full bg-blue-600 rounded-full" style={{ width: `${salesPercentage}%` }} />
              </div>
              <div className="text-xs text-gray-500 mt-1">{stats.salesCount} transactions</div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Payments</span>
                <span className="text-sm font-bold text-green-500">{paymentsPercentage}%</span>
              </div>
              <div className="h-3 rounded-full overflow-hidden bg-gray-800">
                <div className="h-full bg-green-600 rounded-full" style={{ width: `${paymentsPercentage}%` }} />
              </div>
              <div className="text-xs text-gray-500 mt-1">{stats.paymentsCount} transactions</div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Discounts</span>
                <span className="text-sm font-bold text-purple-500">{discountsPercentage}%</span>
              </div>
              <div className="h-3 rounded-full overflow-hidden bg-gray-800">
                <div className="h-full bg-purple-600 rounded-full" style={{ width: `${discountsPercentage}%` }} />
              </div>
              <div className="text-xs text-gray-500 mt-1">{stats.discountsCount} transactions</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/10">
              <BarChart3 className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Amount Distribution</h3>
              <p className="text-xs text-gray-500">Transaction value ranges</p>
            </div>
          </div>
          <div className="space-y-4">
            {amountDistribution.map((dist, index) => {
              const percentage = totalTransactions > 0 ? (dist.count / totalTransactions * 100).toFixed(1) : '0';
              return (
                <div key={index}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">Rs {dist.range}</span>
                    <span className="text-sm font-bold text-blue-500">{dist.count}</span>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden bg-gray-800">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: `${percentage}%` }} />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{percentage}% of total</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-500/10">
            <Calendar className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Daily Transaction Activity</h3>
            <p className="text-xs text-gray-500">Debit vs Credit by day</p>
          </div>
        </div>
        <div className="space-y-4">
          {Object.entries(dayWiseData).map(([day, data]) => (
            <div key={day} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">{day}</span>
                <span className="text-xs text-gray-500">{data.count} transactions</span>
              </div>
              <div className="flex gap-2 items-center">
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-xs text-yellow-500 w-12 text-right tabular-nums">{data.debit.toLocaleString('en-PK', { notation: 'compact' })}</span>
                  <div className="flex-1 h-8 rounded-lg overflow-hidden bg-gray-800 flex items-center">
                    <div className="h-full bg-yellow-600 rounded-lg" style={{ width: `${(data.debit / maxDayAmount) * 100}%` }} />
                  </div>
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 h-8 rounded-lg overflow-hidden bg-gray-800 flex items-center justify-end">
                    <div className="h-full bg-green-600 rounded-lg" style={{ width: `${(data.credit / maxDayAmount) * 100}%` }} />
                  </div>
                  <span className="text-xs text-green-500 w-12 tabular-nums">{data.credit.toLocaleString('en-PK', { notation: 'compact' })}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-8 mt-6 pt-6 border-t border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-600 rounded" />
            <span className="text-sm text-gray-500">Debit</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-600 rounded" />
            <span className="text-sm text-gray-500">Credit</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Total Debit</p>
          <p className="text-2xl font-bold text-yellow-400 mt-1">Rs {stats.totalDebit.toLocaleString('en-PK')}</p>
          <p className="text-xs text-gray-500 mt-1">Outgoing</p>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Total Credit</p>
          <p className="text-2xl font-bold text-green-400 mt-1">Rs {stats.totalCredit.toLocaleString('en-PK')}</p>
          <p className="text-xs text-gray-500 mt-1">Incoming</p>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Net Balance</p>
          <p className={`text-2xl font-bold mt-1 ${stats.netBalance >= 0 ? 'text-blue-400' : 'text-red-400'}`}>Rs {Math.abs(stats.netBalance).toLocaleString('en-PK')}</p>
          <p className="text-xs text-gray-500 mt-1">{stats.netBalance >= 0 ? 'Receivable' : 'Payable'}</p>
        </div>
      </div>
    </div>
  );
}
