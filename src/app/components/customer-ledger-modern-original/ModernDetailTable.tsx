import { useState } from 'react';
import { ArrowUpRight, ArrowDownRight, ChevronRight, ChevronDown } from 'lucide-react';
import type { DetailTransaction, Transaction } from '../../types';

interface ModernDetailTableProps {
  transactions: DetailTransaction[];
  onTransactionClick: (transaction: Transaction) => void;
}

export function ModernDetailTable({ transactions, onTransactionClick }: ModernDetailTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const formatAmount = (amount: number) => {
    return amount > 0 ? amount.toLocaleString('en-PK') : '-';
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="px-4 py-3 text-left text-xs text-slate-600 bg-slate-50 w-8"></th>
            <th className="px-4 py-3 text-left text-xs text-slate-600 bg-slate-50">Date</th>
            <th className="px-4 py-3 text-left text-xs text-slate-600 bg-slate-50">Reference</th>
            <th className="px-4 py-3 text-left text-xs text-slate-600 bg-slate-50">Type</th>
            <th className="px-4 py-3 text-left text-xs text-slate-600 bg-slate-50">Description</th>
            <th className="px-4 py-3 text-right text-xs text-slate-600 bg-slate-50">Debit</th>
            <th className="px-4 py-3 text-right text-xs text-slate-600 bg-slate-50">Credit</th>
            <th className="px-4 py-3 text-right text-xs text-slate-600 bg-slate-50">Balance</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <>
              <tr
                key={transaction.id}
                className={`border-b border-slate-100 hover:bg-blue-50/50 transition-colors cursor-pointer group ${
                  expandedRows.has(transaction.id) ? 'bg-blue-50/30' : ''
                }`}
                onClick={() => transaction.children && toggleRow(transaction.id)}
              >
                <td className="px-4 py-4 text-slate-400">
                  {transaction.children && (
                    expandedRows.has(transaction.id) 
                      ? <ChevronDown className="w-4 h-4" />
                      : <ChevronRight className="w-4 h-4" />
                  )}
                </td>
                <td className="px-4 py-4 text-slate-700 whitespace-nowrap">
                  {new Date(transaction.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-4 py-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTransactionClick(transaction);
                    }}
                    className="text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    {transaction.referenceNo}
                  </button>
                </td>
                <td className="px-4 py-4 text-slate-700">{transaction.documentType}</td>
                <td className="px-4 py-4 text-slate-700">{transaction.description}</td>
                <td className="px-4 py-4 text-right tabular-nums">
                  {transaction.debit > 0 && (
                    <span className="text-orange-700">{formatAmount(transaction.debit)}</span>
                  )}
                  {transaction.debit === 0 && <span className="text-slate-400">-</span>}
                </td>
                <td className="px-4 py-4 text-right tabular-nums">
                  {transaction.credit > 0 && (
                    <span className="text-emerald-700">{formatAmount(transaction.credit)}</span>
                  )}
                  {transaction.credit === 0 && <span className="text-slate-400">-</span>}
                </td>
                <td className="px-4 py-4 text-right text-slate-900 tabular-nums">
                  {transaction.runningBalance.toLocaleString('en-PK')}
                </td>
              </tr>
              {expandedRows.has(transaction.id) && transaction.children && (
                <>
                  {transaction.children.map((child, childIndex) => (
                    <tr key={`${transaction.id}-child-${childIndex}`} className="bg-slate-50/50 border-b border-slate-100">
                      <td className="px-4 py-3"></td>
                      <td className="px-4 py-3"></td>
                      <td className="px-4 py-3 pl-8">
                        <span className="inline-flex items-center gap-1 text-xs text-slate-600 bg-white px-2 py-1 rounded border border-slate-200">
                          {child.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600" colSpan={2}>
                        {child.description}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-700 tabular-nums">
                        {child.amount > 0 ? child.amount.toLocaleString('en-PK') : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-700 tabular-nums">
                        {child.amount < 0 ? Math.abs(child.amount).toLocaleString('en-PK') : '-'}
                      </td>
                      <td className="px-4 py-3"></td>
                    </tr>
                  ))}
                </>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}