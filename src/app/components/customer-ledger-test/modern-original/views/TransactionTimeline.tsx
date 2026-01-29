import { Calendar, TrendingUp, TrendingDown, FileText, CreditCard, Tag, DollarSign } from 'lucide-react';
import type { Transaction } from '@/app/services/customerLedgerTypes';

interface TransactionTimelineProps {
  transactions: Transaction[];
  onTransactionClick: (transaction: Transaction) => void;
}

export function TransactionTimeline({ transactions, onTransactionClick }: TransactionTimelineProps) {
  const groupedByMonth = transactions.reduce((groups, transaction) => {
    const monthYear = new Date(transaction.date).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    if (!groups[monthYear]) {
      groups[monthYear] = [];
    }
    groups[monthYear].push(transaction);
    return groups;
  }, {} as Record<string, Transaction[]>);

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'Opening Balance': return <DollarSign className="w-4 h-4 text-gray-400" />;
      case 'Sale': return <FileText className="w-4 h-4 text-blue-500" />;
      case 'Payment': return <CreditCard className="w-4 h-4 text-green-500" />;
      case 'Discount': return <Tag className="w-4 h-4 text-purple-500" />;
      default: return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  const getDocumentDotClass = (type: string) => {
    switch (type) {
      case 'Opening Balance': return 'bg-gray-600/30 border-gray-500/50';
      case 'Sale': return 'bg-blue-500/20 border-blue-500/50';
      case 'Payment': return 'bg-green-500/20 border-green-500/50';
      case 'Discount': return 'bg-purple-500/20 border-purple-500/50';
      default: return 'bg-gray-500/20 border-gray-500/50';
    }
  };

  return (
    <div className="space-y-8">
      {Object.entries(groupedByMonth).map(([monthYear, monthTransactions]) => {
        const monthDebit = monthTransactions.reduce((sum, t) => sum + t.debit, 0);
        const monthCredit = monthTransactions.reduce((sum, t) => sum + t.credit, 0);

        return (
          <div key={monthYear} className="relative">
            <div className="sticky top-0 z-10 rounded-xl px-6 py-4 mb-6 bg-gray-900/50 border border-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-blue-500/10">
                    <Calendar className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <div className="text-xl font-bold text-white">{monthYear}</div>
                    <div className="text-sm text-gray-500">{monthTransactions.length} transactions</div>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Total Debit</div>
                    <div className="text-lg font-bold text-yellow-400">Rs {monthDebit.toLocaleString('en-PK')}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Total Credit</div>
                    <div className="text-lg font-bold text-green-400">Rs {monthCredit.toLocaleString('en-PK')}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative pl-12">
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-700/50" />

              {monthTransactions.map((transaction, index) => (
                <div
                  key={transaction.id}
                  onClick={() => onTransactionClick(transaction)}
                  className="relative mb-6 group cursor-pointer"
                >
                  <div
                    className={`absolute -left-6 w-12 h-12 rounded-full border-4 border-gray-900 flex items-center justify-center z-10 transition-transform group-hover:scale-105 ${getDocumentDotClass(transaction.documentType)}`}
                  >
                    {getDocumentIcon(transaction.documentType)}
                  </div>

                  <div className="ml-8 rounded-xl overflow-hidden bg-gray-900/50 border border-gray-800 hover:border-gray-700 transition-colors">
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="text-base font-bold text-blue-400">{transaction.referenceNo}</div>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs border ${
                              transaction.documentType === 'Opening Balance' ? 'bg-gray-600/30 text-gray-300 border-gray-600' :
                              transaction.documentType === 'Sale' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                              transaction.documentType === 'Payment' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                              'bg-purple-500/10 text-purple-400 border-purple-500/20'
                            }`}>
                              {transaction.documentType}
                            </span>
                          </div>
                          <div className="text-sm text-gray-400 mb-2">{transaction.description}</div>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(transaction.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="flex items-center gap-1">
                              <CreditCard className="w-3 h-3" />
                              {transaction.paymentAccount}
                            </span>
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          {transaction.debit > 0 && (
                            <div className="flex items-center justify-end gap-2 mb-1">
                              <TrendingUp className="w-4 h-4 text-yellow-500" />
                              <span className="text-xl font-bold text-yellow-400 tabular-nums">+{transaction.debit.toLocaleString('en-PK')}</span>
                            </div>
                          )}
                          {transaction.credit > 0 && (
                            <div className="flex items-center justify-end gap-2 mb-1">
                              <TrendingDown className="w-4 h-4 text-green-500" />
                              <span className="text-xl font-bold text-green-400 tabular-nums">-{transaction.credit.toLocaleString('en-PK')}</span>
                            </div>
                          )}
                          <div className="text-xs text-gray-500 mt-2">Balance</div>
                          <div className="text-base font-bold tabular-nums text-white">Rs {transaction.runningBalance.toLocaleString('en-PK')}</div>
                        </div>
                      </div>
                      {transaction.notes && (
                        <div className="mt-3 pt-3 border-t border-gray-800">
                          <div className="text-xs text-gray-500 mb-1">Notes:</div>
                          <div className="text-sm text-gray-400">{transaction.notes}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {index < monthTransactions.length - 1 && (
                    <div className="absolute left-0 top-12 bottom-0 w-px bg-gray-700/30" />
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
