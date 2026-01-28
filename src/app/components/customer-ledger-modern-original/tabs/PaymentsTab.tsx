import { useState } from 'react';
import { Search, Download, CreditCard, ArrowDownRight } from 'lucide-react';
import type { Transaction } from '../../../types';

interface PaymentsTabProps {
  transactions: Transaction[];
  onTransactionClick: (transaction: Transaction) => void;
}

export function PaymentsTab({ transactions, onTransactionClick }: PaymentsTabProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const payments = transactions.filter(t => t.documentType === 'Payment');

  const filteredPayments = payments.filter(p =>
    p.referenceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.paymentAccount.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group by payment method
  const paymentsByMethod = payments.reduce((acc, payment) => {
    const method = payment.paymentAccount;
    if (!acc[method]) {
      acc[method] = { count: 0, total: 0 };
    }
    acc[method].count += 1;
    acc[method].total += payment.credit;
    return acc;
  }, {} as Record<string, { count: number; total: number }>);

  const getPaymentIcon = (method: string) => {
    if (method.toLowerCase().includes('cash')) return <CreditCard className="w-4 h-4" />;
    if (method.toLowerCase().includes('bank')) return <CreditCard className="w-4 h-4" />;
    if (method.toLowerCase().includes('wallet') || method.toLowerCase().includes('jazz')) return <CreditCard className="w-4 h-4" />;
    return <CreditCard className="w-4 h-4" />;
  };

  const getPaymentColor = (method: string) => {
    if (method.toLowerCase().includes('cash')) return 'bg-emerald-50 text-emerald-700';
    if (method.toLowerCase().includes('bank')) return 'bg-blue-50 text-blue-700';
    if (method.toLowerCase().includes('wallet')) return 'bg-purple-50 text-purple-700';
    return 'bg-slate-50 text-slate-700';
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search payments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            style={{ 
              background: 'rgba(30, 41, 59, 0.3)',
              border: '1px solid rgba(100, 116, 139, 0.3)',
              color: '#e2e8f0'
            }}
          />
        </div>

        <button className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors flex items-center gap-2">
          <Download className="w-4 h-4" />
          Export Payments
        </button>
      </div>

      {/* Payment Method Summary */}
      <div className="grid grid-cols-4 gap-4">
        {Object.entries(paymentsByMethod).map(([method, data]) => (
          <div 
            key={method} 
            className="rounded-xl p-4 transition-colors"
            style={{ 
              background: '#273548',
              border: '1px solid rgba(100, 116, 139, 0.3)'
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getPaymentColor(method).replace('text-', 'bg-').replace('-700', '-100')}`}>
                {getPaymentIcon(method)}
              </div>
              <div className="flex-1">
                <div className="text-xs" style={{ color: '#cbd5e1' }}>{method}</div>
                <div className="text-xs" style={{ color: '#64748b' }}>{data.count} payments</div>
              </div>
            </div>
            <div className="text-lg" style={{ color: '#e2e8f0' }}>Rs {data.total.toLocaleString('en-PK')}</div>
          </div>
        ))}
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600">
          Showing <span className="text-slate-900">{filteredPayments.length}</span> of {payments.length} payments
        </div>
        <div className="text-sm text-slate-600">
          Total Received: <span className="text-emerald-700">Rs {payments.reduce((sum, p) => sum + p.credit, 0).toLocaleString('en-PK')}</span>
        </div>
      </div>

      {/* Payments Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-left text-xs text-slate-600">Date</th>
              <th className="px-4 py-3 text-left text-xs text-slate-600">Reference</th>
              <th className="px-4 py-3 text-left text-xs text-slate-600">Payment Method</th>
              <th className="px-4 py-3 text-left text-xs text-slate-600">Description</th>
              <th className="px-4 py-3 text-left text-xs text-slate-600">Notes</th>
              <th className="px-4 py-3 text-right text-xs text-slate-600">Amount Received</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayments.map((payment, index) => (
              <tr
                key={payment.id}
                className={`border-b border-slate-100 hover:bg-emerald-50/30 transition-colors cursor-pointer ${
                  index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                }`}
                onClick={() => onTransactionClick(payment)}
              >
                <td className="px-4 py-4 text-slate-700 whitespace-nowrap">
                  {new Date(payment.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-4 py-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTransactionClick(payment);
                    }}
                    className="text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    {payment.referenceNo}
                  </button>
                </td>
                <td className="px-4 py-4">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${getPaymentColor(payment.paymentAccount)}`}>
                    {getPaymentIcon(payment.paymentAccount)}
                    {payment.paymentAccount}
                  </span>
                </td>
                <td className="px-4 py-4 text-slate-700 max-w-xs truncate">{payment.description}</td>
                <td className="px-4 py-4 text-slate-500 text-xs max-w-32 truncate">{payment.notes || '-'}</td>
                <td className="px-4 py-4 text-right text-emerald-700 tabular-nums">
                  Rs {payment.credit.toLocaleString('en-PK')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}