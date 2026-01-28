import React from 'react';
import { CreditCard } from 'lucide-react';
import type { Payment } from '@/app/services/customerLedgerTypes';
import { Badge } from '@/app/components/ui/badge';
import { EmptyState } from '@/app/components/shared/EmptyState';

interface PaymentsTabProps {
  payments: Payment[];
}

export function PaymentsTab({ payments }: PaymentsTabProps) {
  const formatAmount = (amount: number) => amount.toLocaleString('en-PK');

  if (payments.length === 0) {
    return <EmptyState title="No Payments" message="No payments found for the selected period." />;
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Payment No</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Method</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Applied To</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{payment.paymentNo}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {new Date(payment.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-emerald-600">
                    Rs {formatAmount(payment.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                      <CreditCard className="w-3 h-3 mr-1" />
                      {payment.method}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {payment.appliedInvoices.length > 0 ? payment.appliedInvoices.join(', ') : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                      {payment.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
