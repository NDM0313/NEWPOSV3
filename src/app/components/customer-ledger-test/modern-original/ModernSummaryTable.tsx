import { Eye, FileText, CreditCard, Tag, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { Transaction } from '@/app/services/customerLedgerTypes';

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
      case 'Studio Sale':
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
      case 'Studio Sale':
        return 'text-blue-400';
      case 'Payment':
        return 'text-emerald-400';
      case 'Discount':
        return 'text-purple-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ background: '#273548' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #334155', background: '#1e293b' }}>
            <th className="px-4 py-3 text-left text-xs" style={{ color: '#94a3b8' }}>Date</th>
            <th className="px-4 py-3 text-left text-xs" style={{ color: '#94a3b8' }}>Reference</th>
            <th className="px-4 py-3 text-left text-xs" style={{ color: '#94a3b8' }}>Type</th>
            <th className="px-4 py-3 text-left text-xs" style={{ color: '#94a3b8' }}>Description</th>
            <th className="px-4 py-3 text-left text-xs" style={{ color: '#94a3b8' }}>Payment Account</th>
            <th className="px-4 py-3 text-left text-xs" style={{ color: '#94a3b8' }}>Notes</th>
            <th className="px-4 py-3 text-right text-xs" style={{ color: '#94a3b8' }}>Debit</th>
            <th className="px-4 py-3 text-right text-xs" style={{ color: '#94a3b8' }}>Credit</th>
            <th className="px-4 py-3 text-right text-xs" style={{ color: '#94a3b8' }}>Balance</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction, index) => (
            <tr
              key={transaction.id}
              style={{ 
                borderBottom: '1px solid #334155',
                background: index % 2 === 0 ? '#273548' : 'transparent'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#334155'}
              onMouseLeave={(e) => e.currentTarget.style.background = index % 2 === 0 ? '#273548' : 'transparent'}
              className="transition-colors group"
            >
              <td className="px-4 py-4 whitespace-nowrap" style={{ color: '#ffffff' }}>
                {new Date(transaction.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </td>
              <td className="px-4 py-4">
                <button
                  onClick={() => onTransactionClick(transaction)}
                  className="hover:underline flex items-center gap-1 group-hover:gap-2 transition-all"
                  style={{ color: '#60a5fa' }}
                >
                  {transaction.referenceNo}
                  <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </td>
              <td className="px-4 py-4">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${getDocumentStyle(transaction.documentType)}`} style={{ borderColor: '#334155' }}>
                  {getDocumentIcon(transaction.documentType)}
                  {transaction.documentType}
                </span>
              </td>
              <td className="px-4 py-4 max-w-xs truncate" style={{ color: '#ffffff' }}>{transaction.description}</td>
              <td className="px-4 py-4 text-xs" style={{ color: '#94a3b8' }}>{transaction.paymentAccount}</td>
              <td className="px-4 py-4 text-xs max-w-32 truncate" style={{ color: '#64748b' }}>{transaction.notes || '-'}</td>
              <td className="px-4 py-4 text-right tabular-nums">
                {transaction.debit > 0 && (
                  <span className="flex items-center justify-end gap-1" style={{ color: '#fb923c' }}>
                    <ArrowUpRight className="w-3 h-3" />
                    {formatAmount(transaction.debit)}
                  </span>
                )}
                {transaction.debit === 0 && <span style={{ color: '#64748b' }}>-</span>}
              </td>
              <td className="px-4 py-4 text-right tabular-nums">
                {transaction.credit > 0 && (
                  <span className="flex items-center justify-end gap-1" style={{ color: '#34d399' }}>
                    <ArrowDownRight className="w-3 h-3" />
                    {formatAmount(transaction.credit)}
                  </span>
                )}
                {transaction.credit === 0 && <span style={{ color: '#64748b' }}>-</span>}
              </td>
              <td className="px-4 py-4 text-right tabular-nums" style={{ color: '#ffffff' }}>
                {transaction.runningBalance.toLocaleString('en-PK')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}