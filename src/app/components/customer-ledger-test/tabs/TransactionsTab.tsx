import React, { useState } from 'react';
import { FileText, CreditCard, Tag } from 'lucide-react';
import type { Transaction } from '@/app/services/customerLedgerTypes';
import { Badge } from '@/app/components/ui/badge';
import { Input } from '@/app/components/ui/input';
import { EmptyState } from '@/app/components/shared/EmptyState';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { useFormatDate } from '@/app/hooks/useFormatDate';

interface TransactionsTabProps {
  transactions: Transaction[];
}

export function TransactionsTab({ transactions }: TransactionsTabProps) {
  const { formatCurrency } = useFormatCurrency();
  const { formatDate } = useFormatDate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'Sale' | 'Payment' | 'Discount'>('all');

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

  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.referenceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         t.paymentAccount.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (t.notes && t.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFilter = filterType === 'all' || t.documentType === filterType;
    return matchesSearch && matchesFilter;
  });

  if (transactions.length === 0) {
    return <EmptyState title="No Transactions" message="No transactions found for the selected period." />;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Input
            type="text"
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'Sale', 'Payment', 'Discount'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                filterType === type
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {type === 'all' ? 'All' : type}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Reference</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Description</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Debit</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Credit</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                    No transactions found
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {formatDate(transaction.date)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{transaction.referenceNo}</td>
                    <td className="px-4 py-3">
                      <Badge className={`${getDocumentStyle(transaction.documentType)} text-xs`}>
                        <span className="flex items-center gap-1">
                          {getDocumentIcon(transaction.documentType)}
                          {transaction.documentType}
                        </span>
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{transaction.description}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-orange-600">
                      {transaction.debit > 0 ? formatCurrency(transaction.debit) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-emerald-600">
                      {transaction.credit > 0 ? formatCurrency(transaction.credit) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900">
                      {formatCurrency(transaction.runningBalance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
