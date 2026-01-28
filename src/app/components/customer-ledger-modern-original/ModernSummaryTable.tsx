import { Eye, FileText, CreditCard, Tag, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { Transaction } from '../../types';

interface ModernSummaryTableProps {
  transactions: Transaction[];
  onTransactionClick: (transaction: Transaction) => void;
}

export function ModernSummaryTable({ transactions, onTransactionClick }: ModernSummaryTableProps) {
  const formatAmount = (amount: number) => {
    return amount > 0 ? amount.toLocaleString('en-PK') : '-';
  };

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'Sale':
        return <FileText className="w-4 h-4" />;
      case 'Payment':
        return <CreditCard className="w-4 h-4" />;
      case 'Discount':
        return <Tag className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getDocumentStyle = (type: string) => {
    switch (type) {
      case 'Sale':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Payment':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Discount':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="px-4 py-3 text-left text-xs text-slate-600 bg-slate-50">Date</th>
            <th className="px-4 py-3 text-left text-xs text-slate-600 bg-slate-50">Reference</th>
            <th className="px-4 py-3 text-left text-xs text-slate-600 bg-slate-50">Type</th>
            <th className="px-4 py-3 text-left text-xs text-slate-600 bg-slate-50">Description</th>
            <th className="px-4 py-3 text-left text-xs text-slate-600 bg-slate-50">Payment Account</th>
            <th className="px-4 py-3 text-left text-xs text-slate-600 bg-slate-50">Notes</th>
            <th className="px-4 py-3 text-right text-xs text-slate-600 bg-slate-50">Debit</th>
            <th className="px-4 py-3 text-right text-xs text-slate-600 bg-slate-50">Credit</th>
            <th className="px-4 py-3 text-right text-xs text-slate-600 bg-slate-50">Balance</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction, index) => (
            <tr
              key={transaction.id}
              className="border-b border-slate-100 hover:bg-blue-50/50 transition-colors group"
            >
              <td className="px-4 py-4 text-slate-700 whitespace-nowrap">
                {new Date(transaction.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </td>
              <td className="px-4 py-4">
                <button
                  onClick={() => onTransactionClick(transaction)}
                  className="text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 group-hover:gap-2 transition-all"
                >
                  {transaction.referenceNo}
                  <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </td>
              <td className="px-4 py-4">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${getDocumentStyle(transaction.documentType)}`}>
                  {getDocumentIcon(transaction.documentType)}
                  {transaction.documentType}
                </span>
              </td>
              <td className="px-4 py-4 text-slate-700 max-w-xs truncate">{transaction.description}</td>
              <td className="px-4 py-4 text-slate-600 text-xs">{transaction.paymentAccount}</td>
              <td className="px-4 py-4 text-slate-500 text-xs max-w-32 truncate">{transaction.notes || '-'}</td>
              <td className="px-4 py-4 text-right tabular-nums">
                {transaction.debit > 0 && (
                  <span className="text-orange-700 flex items-center justify-end gap-1">
                    <ArrowUpRight className="w-3 h-3" />
                    {formatAmount(transaction.debit)}
                  </span>
                )}
                {transaction.debit === 0 && <span className="text-slate-400">-</span>}
              </td>
              <td className="px-4 py-4 text-right tabular-nums">
                {transaction.credit > 0 && (
                  <span className="text-emerald-700 flex items-center justify-end gap-1">
                    <ArrowDownRight className="w-3 h-3" />
                    {formatAmount(transaction.credit)}
                  </span>
                )}
                {transaction.credit === 0 && <span className="text-slate-400">-</span>}
              </td>
              <td className="px-4 py-4 text-right text-slate-900 tabular-nums">
                {transaction.runningBalance.toLocaleString('en-PK')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}