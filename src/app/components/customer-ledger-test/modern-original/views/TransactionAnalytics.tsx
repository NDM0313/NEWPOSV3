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
  // Calculate day-wise breakdown
  const dayWiseData = transactions.reduce((acc, t) => {
    const day = new Date(t.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    if (!acc[day]) {
      acc[day] = { debit: 0, credit: 0, count: 0 };
    }
    acc[day].debit += t.debit;
    acc[day].credit += t.credit;
    acc[day].count += 1;
    return acc;
  }, {} as Record<string, { debit: number; credit: number; count: number }>);

  // Type breakdown percentages
  const totalTransactions = transactions.length;
  const salesPercentage = (stats.salesCount / totalTransactions * 100).toFixed(1);
  const paymentsPercentage = (stats.paymentsCount / totalTransactions * 100).toFixed(1);
  const discountsPercentage = (stats.discountsCount / totalTransactions * 100).toFixed(1);

  // Amount breakdown
  const amountDistribution = [
    { range: '0 - 10,000', count: transactions.filter(t => (t.debit || t.credit) <= 10000).length },
    { range: '10,000 - 30,000', count: transactions.filter(t => (t.debit || t.credit) > 10000 && (t.debit || t.credit) <= 30000).length },
    { range: '30,000 - 50,000', count: transactions.filter(t => (t.debit || t.credit) > 30000 && (t.debit || t.credit) <= 50000).length },
    { range: '50,000+', count: transactions.filter(t => (t.debit || t.credit) > 50000).length },
  ];

  const maxDayAmount = Math.max(...Object.values(dayWiseData).map(d => Math.max(d.debit, d.credit)));

  return (
    <div className="space-y-6">
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <Activity className="w-6 h-6" />
            </div>
            <div className="text-sm">Transaction Volume</div>
          </div>
          <div className="text-4xl font-bold mb-2">{totalTransactions}</div>
          <div className="text-sm text-blue-100">Total entries recorded</div>
        </div>

        <div 
          className="rounded-xl p-6 shadow-sm"
          style={{ 
            background: '#273548',
            border: '1px solid rgba(100, 116, 139, 0.3)'
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: 'rgba(249, 115, 22, 0.2)' }}>
              <TrendingUp className="w-6 h-6 text-orange-500" />
            </div>
            <div className="text-sm" style={{ color: '#94a3b8' }}>Highest Transaction</div>
          </div>
          <div className="text-3xl font-bold mb-2" style={{ color: '#e2e8f0' }}>Rs {stats.highestTransaction.toLocaleString('en-PK')}</div>
          <div className="text-xs" style={{ color: '#64748b' }}>Peak transaction value</div>
        </div>

        <div 
          className="rounded-xl p-6 shadow-sm"
          style={{ 
            background: '#273548',
            border: '1px solid rgba(100, 116, 139, 0.3)'
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16, 185, 129, 0.2)' }}>
              <TrendingDown className="w-6 h-6 text-emerald-500" />
            </div>
            <div className="text-sm" style={{ color: '#94a3b8' }}>Lowest Transaction</div>
          </div>
          <div className="text-3xl font-bold mb-2" style={{ color: '#e2e8f0' }}>Rs {stats.lowestTransaction.toLocaleString('en-PK')}</div>
          <div className="text-xs" style={{ color: '#64748b' }}>Minimum transaction value</div>
        </div>

        <div 
          className="rounded-xl p-6 shadow-sm"
          style={{ 
            background: '#273548',
            border: '1px solid rgba(100, 116, 139, 0.3)'
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: 'rgba(168, 85, 247, 0.2)' }}>
              <DollarSign className="w-6 h-6 text-purple-500" />
            </div>
            <div className="text-sm" style={{ color: '#94a3b8' }}>Average Value</div>
          </div>
          <div className="text-3xl font-bold mb-2" style={{ color: '#e2e8f0' }}>Rs {stats.avgTransaction.toLocaleString('en-PK', { maximumFractionDigits: 0 })}</div>
          <div className="text-xs" style={{ color: '#64748b' }}>Per transaction average</div>
        </div>
      </div>

      {/* Type Distribution */}
      <div className="grid grid-cols-2 gap-6">
        <div 
          className="rounded-xl p-6 shadow-sm"
          style={{ 
            background: '#273548',
            border: '1px solid rgba(100, 116, 139, 0.3)'
          }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(59, 130, 246, 0.2)' }}>
              <PieChart className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="text-base font-semibold" style={{ color: '#e2e8f0' }}>Transaction Type Distribution</h3>
              <p className="text-xs" style={{ color: '#64748b' }}>Breakdown by document type</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: '#cbd5e1' }}>Sales</span>
                <span className="text-sm font-bold text-blue-500">{salesPercentage}%</span>
              </div>
              <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(100, 116, 139, 0.2)' }}>
                <div 
                  className="h-full bg-blue-600 rounded-full"
                  style={{ width: `${salesPercentage}%` }}
                ></div>
              </div>
              <div className="text-xs mt-1" style={{ color: '#64748b' }}>{stats.salesCount} transactions</div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: '#cbd5e1' }}>Payments</span>
                <span className="text-sm font-bold text-emerald-500">{paymentsPercentage}%</span>
              </div>
              <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(100, 116, 139, 0.2)' }}>
                <div 
                  className="h-full bg-emerald-600 rounded-full"
                  style={{ width: `${paymentsPercentage}%` }}
                ></div>
              </div>
              <div className="text-xs mt-1" style={{ color: '#64748b' }}>{stats.paymentsCount} transactions</div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: '#cbd5e1' }}>Discounts</span>
                <span className="text-sm font-bold text-purple-500">{discountsPercentage}%</span>
              </div>
              <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(100, 116, 139, 0.2)' }}>
                <div 
                  className="h-full bg-purple-600 rounded-full"
                  style={{ width: `${discountsPercentage}%` }}
                ></div>
              </div>
              <div className="text-xs mt-1" style={{ color: '#64748b' }}>{stats.discountsCount} transactions</div>
            </div>
          </div>
        </div>

        <div 
          className="rounded-xl p-6 shadow-sm"
          style={{ 
            background: '#273548',
            border: '1px solid rgba(100, 116, 139, 0.3)'
          }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99, 102, 241, 0.2)' }}>
              <BarChart3 className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <h3 className="text-base font-semibold" style={{ color: '#e2e8f0' }}>Amount Distribution</h3>
              <p className="text-xs" style={{ color: '#64748b' }}>Transaction value ranges</p>
            </div>
          </div>

          <div className="space-y-4">
            {amountDistribution.map((dist, index) => {
              const percentage = (dist.count / totalTransactions * 100).toFixed(1);
              return (
                <div key={index}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm" style={{ color: '#cbd5e1' }}>Rs {dist.range}</span>
                    <span className="text-sm font-bold text-indigo-500">{dist.count}</span>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(100, 116, 139, 0.2)' }}>
                    <div 
                      className="h-full bg-indigo-600 rounded-full"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                  <div className="text-xs mt-1" style={{ color: '#64748b' }}>{percentage}% of total</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Daily Activity Chart */}
      <div 
        className="rounded-xl p-6 shadow-sm"
        style={{ 
          background: '#273548',
          border: '1px solid rgba(100, 116, 139, 0.3)'
        }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(34, 197, 94, 0.2)' }}>
            <Calendar className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <h3 className="text-base font-semibold" style={{ color: '#e2e8f0' }}>Daily Transaction Activity</h3>
            <p className="text-xs" style={{ color: '#64748b' }}>Debit vs Credit by day</p>
          </div>
        </div>

        <div className="space-y-4">
          {Object.entries(dayWiseData).map(([day, data]) => (
            <div key={day} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium" style={{ color: '#cbd5e1' }}>{day}</span>
                <span className="text-xs" style={{ color: '#64748b' }}>{data.count} transactions</span>
              </div>
              <div className="flex gap-2 items-center">
                {/* Debit Bar */}
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-xs text-orange-500 w-12 text-right">{data.debit.toLocaleString('en-PK', { notation: 'compact' })}</span>
                  <div className="flex-1 h-8 rounded-lg overflow-hidden flex items-center" style={{ background: 'rgba(249, 115, 22, 0.2)' }}>
                    <div 
                      className="h-full bg-orange-600"
                      style={{ width: `${(data.debit / maxDayAmount * 100)}%` }}
                    ></div>
                  </div>
                </div>
                {/* Credit Bar */}
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 h-8 rounded-lg overflow-hidden flex items-center justify-end" style={{ background: 'rgba(16, 185, 129, 0.2)' }}>
                    <div 
                      className="h-full bg-emerald-600"
                      style={{ width: `${(data.credit / maxDayAmount * 100)}%` }}
                    ></div>
                  </div>
                  <span className="text-xs text-emerald-500 w-12">{data.credit.toLocaleString('en-PK', { notation: 'compact' })}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-8 mt-6 pt-6" style={{ borderTop: '1px solid rgba(100, 116, 139, 0.2)' }}>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-600 rounded"></div>
            <span className="text-sm" style={{ color: '#94a3b8' }}>Debit</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-emerald-600 rounded"></div>
            <span className="text-sm" style={{ color: '#94a3b8' }}>Credit</span>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-6">
        <div 
          className="rounded-xl p-6"
          style={{ 
            background: 'linear-gradient(to bottom right, rgba(249, 115, 22, 0.15), rgba(251, 146, 60, 0.1))',
            border: '1px solid rgba(249, 115, 22, 0.3)'
          }}
        >
          <div className="text-sm mb-2 text-orange-500">Total Debit</div>
          <div className="text-3xl font-bold mb-1 text-orange-400">Rs {stats.totalDebit.toLocaleString('en-PK')}</div>
          <div className="text-xs" style={{ color: 'rgba(251, 146, 60, 0.8)' }}>Outgoing transactions</div>
        </div>

        <div 
          className="rounded-xl p-6"
          style={{ 
            background: 'linear-gradient(to bottom right, rgba(16, 185, 129, 0.15), rgba(52, 211, 153, 0.1))',
            border: '1px solid rgba(16, 185, 129, 0.3)'
          }}
        >
          <div className="text-sm mb-2 text-emerald-500">Total Credit</div>
          <div className="text-3xl font-bold mb-1 text-emerald-400">Rs {stats.totalCredit.toLocaleString('en-PK')}</div>
          <div className="text-xs" style={{ color: 'rgba(52, 211, 153, 0.8)' }}>Incoming transactions</div>
        </div>

        <div 
          className="rounded-xl p-6"
          style={{ 
            background: stats.netBalance >= 0 
              ? 'linear-gradient(to bottom right, rgba(59, 130, 246, 0.15), rgba(96, 165, 250, 0.1))'
              : 'linear-gradient(to bottom right, rgba(239, 68, 68, 0.15), rgba(248, 113, 113, 0.1))',
            border: stats.netBalance >= 0 
              ? '1px solid rgba(59, 130, 246, 0.3)'
              : '1px solid rgba(239, 68, 68, 0.3)'
          }}
        >
          <div className={`text-sm mb-2 ${stats.netBalance >= 0 ? 'text-blue-500' : 'text-red-500'}`}>Net Balance</div>
          <div className={`text-3xl font-bold mb-1 ${stats.netBalance >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
            Rs {Math.abs(stats.netBalance).toLocaleString('en-PK')}
          </div>
          <div className="text-xs" style={{ color: stats.netBalance >= 0 ? 'rgba(96, 165, 250, 0.8)' : 'rgba(248, 113, 113, 0.8)' }}>
            {stats.netBalance >= 0 ? 'Receivable' : 'Payable'}
          </div>
        </div>
      </div>
    </div>
  );
}
