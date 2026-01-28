import React from 'react';
import { Clock } from 'lucide-react';
import type { AgingReport } from '@/app/services/customerLedgerApi';
import { EmptyState } from '@/app/components/shared/EmptyState';

interface AgingReportTabProps {
  agingReport: AgingReport;
}

export function AgingReportTab({ agingReport }: AgingReportTabProps) {
  const formatAmount = (amount: number) => amount.toLocaleString('en-PK');

  if (agingReport.total === 0) {
    return <EmptyState title="No Outstanding Amounts" message="All invoices are fully paid." />;
  }

  const agingBuckets = [
    { label: 'Current (0 days)', amount: agingReport.current, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { label: '1-30 Days', amount: agingReport.days1to30, color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { label: '31-60 Days', amount: agingReport.days31to60, color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    { label: '61-90 Days', amount: agingReport.days61to90, color: 'bg-orange-50 text-orange-700 border-orange-200' },
    { label: '90+ Days', amount: agingReport.days90plus, color: 'bg-red-50 text-red-700 border-red-200' },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-4">
        {agingBuckets.map((bucket, index) => (
          <div key={index} className={`rounded-xl p-5 border ${bucket.color}`}>
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4" />
              <div className="text-xs font-medium">{bucket.label}</div>
            </div>
            <div className="text-2xl font-bold">Rs {formatAmount(bucket.amount)}</div>
            <div className="text-xs mt-1 opacity-75">
              {((bucket.amount / agingReport.total) * 100).toFixed(1)}% of total
            </div>
          </div>
        ))}
      </div>

      {/* Total Summary */}
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-6 border border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Total Outstanding</h3>
            <p className="text-sm text-slate-600">Sum of all aging buckets</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-slate-900">Rs {formatAmount(agingReport.total)}</div>
            <div className="text-xs text-slate-500 mt-1">Outstanding Receivables</div>
          </div>
        </div>
      </div>
    </div>
  );
}
