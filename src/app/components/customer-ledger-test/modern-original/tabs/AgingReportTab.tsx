import { Clock, TrendingUp, AlertTriangle } from 'lucide-react';
import type { Invoice } from '@/app/services/customerLedgerTypes';
import React from 'react';

interface AgingReportTabProps {
  invoices: Invoice[];
}

export function AgingReportTab({ invoices }: AgingReportTabProps) {
  const safeInvoices = invoices || [];
  const today = new Date('2025-01-27');

  const agingBuckets = safeInvoices
    .filter(inv => inv.pendingAmount > 0)
    .reduce((acc, invoice) => {
      const invoiceDate = new Date(invoice.date);
      const daysPast = Math.floor((today.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
      const bucket = daysPast <= 30 ? '0-30' :
                    daysPast <= 60 ? '31-60' :
                    daysPast <= 90 ? '61-90' : '90+';
      if (!acc[bucket]) {
        acc[bucket] = { count: 0, amount: 0, invoices: [] };
      }
      acc[bucket].count += 1;
      acc[bucket].amount += invoice.pendingAmount;
      acc[bucket].invoices.push({ ...invoice, daysPast });
      return acc;
    }, {} as Record<string, { count: number; amount: number; invoices: Array<Invoice & { daysPast: number }> }>);

  const totalPending = Object.values(agingBuckets).reduce((sum, bucket) => sum + bucket.amount, 0);

  const getBucketClasses = (bucket: string) => {
    switch (bucket) {
      case '0-30': return { card: 'bg-gray-900/50 border border-gray-800', icon: 'bg-green-500/10 text-green-500', value: 'text-green-400' };
      case '31-60': return { card: 'bg-gray-900/50 border border-gray-800', icon: 'bg-yellow-500/10 text-yellow-500', value: 'text-yellow-400' };
      case '61-90': return { card: 'bg-gray-900/50 border border-gray-800', icon: 'bg-orange-500/10 text-orange-500', value: 'text-orange-400' };
      case '90+': return { card: 'bg-gray-900/50 border border-gray-800', icon: 'bg-red-500/10 text-red-500', value: 'text-red-400' };
      default: return { card: 'bg-gray-900/50 border border-gray-800', icon: 'bg-gray-500/10 text-gray-500', value: 'text-gray-400' };
    }
  };

  const getBucketIcon = (bucket: string) => {
    switch (bucket) {
      case '0-30': return <Clock className="w-5 h-5" />;
      case '31-60': return <TrendingUp className="w-5 h-5" />;
      case '61-90':
      case '90+': return <AlertTriangle className="w-5 h-5" />;
      default: return <Clock className="w-5 h-5" />;
    }
  };

  const getAgeBadgeClass = (daysPast: number) => {
    if (daysPast <= 30) return 'bg-green-500/10 text-green-400 border-green-500/20';
    if (daysPast <= 60) return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    if (daysPast <= 90) return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    return 'bg-red-500/10 text-red-400 border-red-500/20';
  };

  const getStatusBadgeClass = (status: string) => {
    if (status === 'Unpaid') return 'bg-red-500/10 text-red-400 border-red-500/20';
    return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {['0-30', '31-60', '61-90', '90+'].map((bucket) => {
          const data = agingBuckets[bucket] || { count: 0, amount: 0, invoices: [] };
          const percentage = totalPending > 0 ? (data.amount / totalPending * 100).toFixed(1) : '0';
          const classes = getBucketClasses(bucket);
          return (
            <div key={bucket} className={`rounded-xl p-4 ${classes.card}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">{bucket} days</p>
                  <p className="text-2xl font-bold text-white mt-1">Rs {data.amount.toLocaleString('en-PK')}</p>
                  <p className="text-xs text-gray-500 mt-1">{data.count} invoices • {percentage}%</p>
                </div>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${classes.icon}`}>
                  {getBucketIcon(bucket)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800 bg-gray-950/95">
          <h3 className="text-sm font-semibold text-white">Receivables Aging Detail</h3>
          <p className="text-xs text-gray-500 mt-0.5">Outstanding invoices by age</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-950/95 border-b border-gray-800">
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Age (Days)</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice Total</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Paid</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Pending</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(agingBuckets)
                .sort((a, b) => {
                  const order = { '0-30': 0, '31-60': 1, '61-90': 2, '90+': 3 };
                  return order[a[0] as keyof typeof order] - order[b[0] as keyof typeof order];
                })
                .flatMap(([bucket, data]) => {
                  const classes = getBucketClasses(bucket);
                  return [
                    <tr key={`${bucket}-header`} className="bg-gray-950/80 border-t border-b border-gray-800">
                      <td colSpan={7} className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs border ${classes.icon}`}>
                            {getBucketIcon(bucket)}
                            {bucket} Days
                          </span>
                          <span className="text-xs text-gray-500">
                            {data.count} invoices • Rs {data.amount.toLocaleString('en-PK')} pending
                          </span>
                        </div>
                      </td>
                    </tr>,
                    ...data.invoices
                      .sort((a, b) => b.daysPast - a.daysPast)
                      .map((invoice, index) => (
                        <tr
                          key={invoice.invoiceNo}
                          className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors cursor-pointer ${
                            index % 2 === 0 ? '' : 'bg-gray-900/30'
                          }`}
                        >
                          <td className="px-6 py-3 text-white font-medium">{invoice.invoiceNo}</td>
                          <td className="px-6 py-3 text-gray-400">
                            {new Date(invoice.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-6 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs border ${getAgeBadgeClass(invoice.daysPast)}`}>
                              {invoice.daysPast} days
                            </span>
                          </td>
                          <td className="px-6 py-3">
                            <span className={`text-xs px-2 py-1 rounded border ${getStatusBadgeClass(invoice.status)}`}>
                              {invoice.status}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-right tabular-nums text-white">{invoice.invoiceTotal.toLocaleString('en-PK')}</td>
                          <td className="px-6 py-3 text-right tabular-nums text-green-400">{invoice.paidAmount.toLocaleString('en-PK')}</td>
                          <td className="px-6 py-3 text-right tabular-nums text-yellow-400 font-medium">{invoice.pendingAmount.toLocaleString('en-PK')}</td>
                        </tr>
                      )),
                  ];
                })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-gray-900/50 border border-red-500/20 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 bg-red-500/10">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-red-400 mb-2">Collection Risk Analysis</h3>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <div className="text-xs text-gray-500 mb-1">High Risk (90+ days)</div>
                <div className="text-2xl font-bold text-red-400">Rs {(agingBuckets['90+']?.amount || 0).toLocaleString('en-PK')}</div>
                <div className="text-xs text-gray-500 mt-1">{agingBuckets['90+']?.count || 0} invoices requiring immediate attention</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Medium Risk (61-90 days)</div>
                <div className="text-2xl font-bold text-orange-400">Rs {(agingBuckets['61-90']?.amount || 0).toLocaleString('en-PK')}</div>
                <div className="text-xs text-gray-500 mt-1">{agingBuckets['61-90']?.count || 0} invoices need follow-up</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Total Outstanding</div>
                <div className="text-2xl font-bold text-white">Rs {totalPending.toLocaleString('en-PK')}</div>
                <div className="text-xs text-gray-500 mt-1">
                  Across {Object.values(agingBuckets).reduce((sum, b) => sum + b.count, 0)} pending invoices
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
