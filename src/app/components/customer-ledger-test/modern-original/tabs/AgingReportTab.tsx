import { Clock, TrendingUp, AlertTriangle } from 'lucide-react';
import type { Invoice } from '@/app/services/customerLedgerTypes';
import React from 'react';

interface AgingReportTabProps {
  invoices: Invoice[];
}

export function AgingReportTab({ invoices }: AgingReportTabProps) {
  // Safety check for invoices array
  const safeInvoices = invoices || [];
  
  // Calculate aging buckets (0-30, 31-60, 61-90, 90+ days)
  const today = new Date('2025-01-27'); // Current date from the app
  
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

  const getBucketStyle = (bucket: string) => {
    switch (bucket) {
      case '0-30':
        return {
          cardBg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.05) 100%)',
          iconBg: '#10b981',
          textColor: '#10b981',
          secondaryColor: '#6ee7b7'
        };
      case '31-60':
        return {
          cardBg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.05) 100%)',
          iconBg: '#f59e0b',
          textColor: '#f59e0b',
          secondaryColor: '#fbbf24'
        };
      case '61-90':
        return {
          cardBg: 'linear-gradient(135deg, rgba(249, 115, 22, 0.15) 0%, rgba(234, 88, 12, 0.05) 100%)',
          iconBg: '#f97316',
          textColor: '#fb923c',
          secondaryColor: '#fdba74'
        };
      case '90+':
        return {
          cardBg: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.05) 100%)',
          iconBg: '#ef4444',
          textColor: '#ef4444',
          secondaryColor: '#fca5a5'
        };
      default:
        return {
          cardBg: 'rgba(148, 163, 184, 0.1)',
          iconBg: '#64748b',
          textColor: '#94a3b8',
          secondaryColor: '#cbd5e1'
        };
    }
  };

  const getBucketIcon = (bucket: string) => {
    switch (bucket) {
      case '0-30':
        return <Clock className="w-5 h-5" />;
      case '31-60':
        return <TrendingUp className="w-5 h-5" />;
      case '61-90':
        return <AlertTriangle className="w-5 h-5" />;
      case '90+':
        return <AlertTriangle className="w-5 h-5" />;
      default:
        return <Clock className="w-5 h-5" />;
    }
  };

  const getAgeBadgeStyle = (daysPast: number) => {
    if (daysPast <= 30) return { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981' };
    if (daysPast <= 60) return { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' };
    if (daysPast <= 90) return { bg: 'rgba(249, 115, 22, 0.15)', color: '#fb923c' };
    return { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' };
  };

  const getStatusBadgeStyle = (status: string) => {
    if (status === 'Unpaid') return { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' };
    return { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' };
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        {['0-30', '31-60', '61-90', '90+'].map((bucket) => {
          const data = agingBuckets[bucket] || { count: 0, amount: 0, invoices: [] };
          const percentage = totalPending > 0 ? (data.amount / totalPending * 100).toFixed(1) : 0;
          const style = getBucketStyle(bucket);
          
          return (
            <div 
              key={bucket} 
              className="rounded-xl p-5"
              style={{ background: style.cardBg }}
            >
              <div className="flex items-start justify-between mb-3">
                <div 
                  className="w-12 h-12 rounded-lg flex items-center justify-center"
                  style={{ background: style.iconBg }}
                >
                  <div className="text-white">
                    {getBucketIcon(bucket)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs" style={{ color: '#94a3b8' }}>{bucket} days</div>
                  <div className="text-sm mt-0.5" style={{ color: style.textColor }}>{percentage}%</div>
                </div>
              </div>
              <div className="text-xs mb-1" style={{ color: '#94a3b8' }}>{data.count} invoices</div>
              <div className="text-xl" style={{ color: style.textColor }}>Rs {data.amount.toLocaleString('en-PK')}</div>
            </div>
          );
        })}
      </div>

      {/* Aging Details */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#273548' }}>
        <div className="px-6 py-4" style={{ 
          borderBottom: '1px solid #334155',
          background: '#1e293b'
        }}>
          <h3 className="text-sm" style={{ color: '#ffffff' }}>Receivables Aging Detail</h3>
          <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>Outstanding invoices by age</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ 
                background: '#1e293b',
                borderBottom: '1px solid #334155'
              }}>
                <th className="px-6 py-3 text-left text-xs" style={{ color: '#94a3b8' }}>Invoice</th>
                <th className="px-6 py-3 text-left text-xs" style={{ color: '#94a3b8' }}>Date</th>
                <th className="px-6 py-3 text-left text-xs" style={{ color: '#94a3b8' }}>Age (Days)</th>
                <th className="px-6 py-3 text-left text-xs" style={{ color: '#94a3b8' }}>Status</th>
                <th className="px-6 py-3 text-right text-xs" style={{ color: '#94a3b8' }}>Invoice Total</th>
                <th className="px-6 py-3 text-right text-xs" style={{ color: '#94a3b8' }}>Paid</th>
                <th className="px-6 py-3 text-right text-xs" style={{ color: '#94a3b8' }}>Pending</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(agingBuckets)
                .sort((a, b) => {
                  const order = { '0-30': 0, '31-60': 1, '61-90': 2, '90+': 3 };
                  return order[a[0] as keyof typeof order] - order[b[0] as keyof typeof order];
                })
                .flatMap(([bucket, data]) => {
                  const style = getBucketStyle(bucket);
                  return [
                    // Bucket Header
                    <tr 
                      key={`${bucket}-header`}
                      style={{ 
                        background: '#1e293b',
                        borderTop: '1px solid #334155',
                        borderBottom: '1px solid #334155'
                      }}
                    >
                      <td colSpan={7} className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <span 
                            className="inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs"
                            style={{ 
                              background: style.cardBg,
                              color: style.textColor
                            }}
                          >
                            {getBucketIcon(bucket)}
                            {bucket} Days
                          </span>
                          <span className="text-xs" style={{ color: '#94a3b8' }}>
                            {data.count} invoices • Rs {data.amount.toLocaleString('en-PK')} pending
                          </span>
                        </div>
                      </td>
                    </tr>,
                    
                    // Invoice Rows
                    ...data.invoices
                      .sort((a, b) => b.daysPast - a.daysPast)
                      .map((invoice, index) => {
                        const ageBadge = getAgeBadgeStyle(invoice.daysPast);
                        const statusBadge = getStatusBadgeStyle(invoice.status);
                        
                        return (
                          <tr
                            key={invoice.invoiceNo}
                            style={{
                              borderBottom: '1px solid #334155',
                              background: index % 2 === 0 ? '#273548' : 'rgba(30, 41, 59, 0.3)'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#1e293b'}
                            onMouseLeave={(e) => e.currentTarget.style.background = index % 2 === 0 ? '#273548' : 'rgba(30, 41, 59, 0.3)'}
                            className="transition-colors cursor-pointer"
                          >
                            <td className="px-6 py-3" style={{ color: '#ffffff' }}>{invoice.invoiceNo}</td>
                            <td className="px-6 py-3" style={{ color: '#cbd5e1' }}>
                              {new Date(invoice.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="px-6 py-3">
                              <span 
                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs"
                                style={{
                                  background: ageBadge.bg,
                                  color: ageBadge.color
                                }}
                              >
                                {invoice.daysPast} days
                              </span>
                            </td>
                            <td className="px-6 py-3">
                              <span 
                                className="text-xs px-2 py-1 rounded"
                                style={{
                                  background: statusBadge.bg,
                                  color: statusBadge.color
                                }}
                              >
                                {invoice.status}
                              </span>
                            </td>
                            <td className="px-6 py-3 text-right tabular-nums" style={{ color: '#ffffff' }}>
                              {invoice.invoiceTotal.toLocaleString('en-PK')}
                            </td>
                            <td className="px-6 py-3 text-right tabular-nums" style={{ color: '#10b981' }}>
                              {invoice.paidAmount.toLocaleString('en-PK')}
                            </td>
                            <td className="px-6 py-3 text-right tabular-nums" style={{ color: '#fb923c' }}>
                              {invoice.pendingAmount.toLocaleString('en-PK')}
                            </td>
                          </tr>
                        );
                      })
                  ];
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Risk Analysis */}
      <div 
        className="rounded-xl p-6" 
        style={{ 
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(249, 115, 22, 0.1) 100%)'
        }}
      >
        <div className="flex items-start gap-4">
          <div 
            className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: '#ef4444' }}
          >
            <AlertTriangle className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-base mb-2" style={{ color: '#ef4444' }}>Collection Risk Analysis</h3>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <div className="text-xs mb-1" style={{ color: '#fca5a5' }}>High Risk (90+ days)</div>
                <div className="text-2xl" style={{ color: '#ef4444' }}>
                  Rs {(agingBuckets['90+']?.amount || 0).toLocaleString('en-PK')}
                </div>
                <div className="text-xs mt-1" style={{ color: '#fca5a5' }}>
                  {agingBuckets['90+']?.count || 0} invoices requiring immediate attention
                </div>
              </div>
              <div>
                <div className="text-xs mb-1" style={{ color: '#fdba74' }}>Medium Risk (61-90 days)</div>
                <div className="text-2xl" style={{ color: '#fb923c' }}>
                  Rs {(agingBuckets['61-90']?.amount || 0).toLocaleString('en-PK')}
                </div>
                <div className="text-xs mt-1" style={{ color: '#fdba74' }}>
                  {agingBuckets['61-90']?.count || 0} invoices need follow-up
                </div>
              </div>
              <div>
                <div className="text-xs mb-1" style={{ color: '#cbd5e1' }}>Total Outstanding</div>
                <div className="text-2xl" style={{ color: '#ffffff' }}>
                  Rs {totalPending.toLocaleString('en-PK')}
                </div>
                <div className="text-xs mt-1" style={{ color: '#cbd5e1' }}>
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