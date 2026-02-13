import { useState } from 'react';
import { Search, Download, CreditCard, ArrowDownRight } from 'lucide-react';
import type { Transaction } from '@/app/services/customerLedgerTypes';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { useFormatDate } from '@/app/hooks/useFormatDate';

interface PaymentsTabProps {
  transactions: Transaction[];
  onTransactionClick: (transaction: Transaction) => void;
}

export function PaymentsTab({ transactions, onTransactionClick }: PaymentsTabProps) {
  const { formatCurrency } = useFormatCurrency();
  const { formatDate } = useFormatDate();
  const [searchTerm, setSearchTerm] = useState('');

  const payments = transactions.filter(t => t.documentType === 'Payment');

  const filteredPayments = payments.filter(p =>
    p.referenceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.paymentAccount.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
    if (method.toLowerCase().includes('cash')) return <CreditCard className="w-4 h-4 text-green-500" />;
    if (method.toLowerCase().includes('bank')) return <CreditCard className="w-4 h-4 text-blue-500" />;
    if (method.toLowerCase().includes('wallet') || method.toLowerCase().includes('jazz')) return <CreditCard className="w-4 h-4 text-purple-400" />;
    return <CreditCard className="w-4 h-4 text-gray-500" />;
  };

  const getPaymentBadgeClass = (method: string) => {
    if (method.toLowerCase().includes('cash')) return 'bg-green-500/10 text-green-400 border-green-500/20';
    if (method.toLowerCase().includes('bank')) return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    if (method.toLowerCase().includes('wallet')) return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search payments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm focus:outline-none bg-gray-950 border border-gray-700 text-white placeholder:text-gray-500 focus:border-gray-600"
          />
        </div>
        <button className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-500 transition-colors flex items-center gap-2">
          <Download className="w-4 h-4" />
          Export Payments
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {Object.entries(paymentsByMethod).map(([method, data]) => (
          <div
            key={method}
            className="bg-gray-900/50 border border-gray-800 rounded-xl p-4"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold truncate max-w-[120px]">{method}</p>
                <p className="text-2xl font-bold text-white mt-1">{formatCurrency(data.total)}</p>
                <p className="text-xs text-gray-500 mt-1">{data.count} payments</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                {getPaymentIcon(method)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>Showing <span className="text-white font-medium">{filteredPayments.length}</span> of {payments.length} payments</span>
        <span>Total Received: <span className="text-green-400 font-semibold">{formatCurrency(payments.reduce((sum, p) => sum + p.credit, 0))}</span></span>
      </div>

      <div className="overflow-x-auto border border-gray-800 rounded-xl bg-gray-900/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-950/95 border-b border-gray-800">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Reference</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Payment Method</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount Received</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayments.map((payment, index) => (
              <tr
                key={payment.id}
                className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors cursor-pointer ${
                  index % 2 === 0 ? '' : 'bg-gray-900/30'
                }`}
                onClick={() => onTransactionClick(payment)}
              >
                <td className="px-4 py-4 text-white whitespace-nowrap">
                  {formatDate(payment.date)}
                </td>
                <td className="px-4 py-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTransactionClick(payment);
                    }}
                    className="text-blue-400 hover:text-blue-300 font-medium"
                  >
                    {payment.referenceNo}
                  </button>
                </td>
                <td className="px-4 py-4">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${getPaymentBadgeClass(payment.paymentAccount)}`}>
                    {getPaymentIcon(payment.paymentAccount)}
                    {payment.paymentAccount}
                  </span>
                </td>
                <td className="px-4 py-4 text-gray-400 max-w-xs truncate">{payment.description}</td>
                <td className="px-4 py-4 text-gray-500 text-xs max-w-32 truncate">{payment.notes || '-'}</td>
                <td className="px-4 py-4 text-right text-green-400 tabular-nums font-semibold">
                  {formatCurrency(payment.credit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
