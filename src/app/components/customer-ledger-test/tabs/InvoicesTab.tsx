import React from 'react';
import type { Invoice } from '@/app/services/customerLedgerTypes';
import { Badge } from '@/app/components/ui/badge';
import { EmptyState } from '@/app/components/shared/EmptyState';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { useFormatDate } from '@/app/hooks/useFormatDate';

interface InvoicesTabProps {
  invoices: Invoice[];
}

export function InvoicesTab({ invoices }: InvoicesTabProps) {
  const { formatCurrency } = useFormatCurrency();
  const { formatDate } = useFormatDate();

  const getStatusBadge = (status: Invoice['status']) => {
    switch (status) {
      case 'Fully Paid':
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Fully Paid</Badge>;
      case 'Partially Paid':
        return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">Partially Paid</Badge>;
      case 'Unpaid':
        return <Badge className="bg-red-100 text-red-700 border-red-200">Unpaid</Badge>;
    }
  };

  if (invoices.length === 0) {
    return <EmptyState title="No Invoices" message="No invoices found for the selected period." />;
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Invoice No</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Total</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Paid</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Pending</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((invoice) => (
                <tr key={invoice.invoiceNo} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{invoice.invoiceNo}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {formatDate(invoice.date)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-slate-900">
                    {formatCurrency(invoice.invoiceTotal)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-emerald-600">
                    {formatCurrency(invoice.paidAmount)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-red-600">
                    {formatCurrency(invoice.pendingAmount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {getStatusBadge(invoice.status)}
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
