import { Calendar, TrendingUp, TrendingDown, FileText, CreditCard, Tag } from 'lucide-react';
import type { Transaction } from '../../../types/index';

interface TransactionTimelineProps {
  transactions: Transaction[];
  onTransactionClick: (transaction: Transaction) => void;
}

export function TransactionTimeline({ transactions, onTransactionClick }: TransactionTimelineProps) {
  // Group by month
  const groupedByMonth = transactions.reduce((groups, transaction) => {
    const monthYear = new Date(transaction.date).toLocaleDateString('en-GB', { 
      month: 'long', 
      year: 'numeric' 
    });
    if (!groups[monthYear]) {
      groups[monthYear] = [];
    }
    groups[monthYear].push(transaction);
    return groups;
  }, {} as Record<string, Transaction[]>);

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

  const getDocumentColor = (type: string) => {
    switch (type) {
      case 'Sale':
        return 'bg-blue-600';
      case 'Payment':
        return 'bg-emerald-600';
      case 'Discount':
        return 'bg-purple-600';
      default:
        return 'bg-slate-600';
    }
  };

  return (
    <div className="space-y-8">
      {Object.entries(groupedByMonth).map(([monthYear, monthTransactions]) => {
        const monthDebit = monthTransactions.reduce((sum, t) => sum + t.debit, 0);
        const monthCredit = monthTransactions.reduce((sum, t) => sum + t.credit, 0);

        return (
          <div key={monthYear} className="relative">
            {/* Month Header */}
            <div 
              className="sticky top-0 z-10 rounded-xl px-6 py-4 shadow-lg mb-6"
              style={{ 
                background: 'linear-gradient(to right, #3b82f6, #2563eb)',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-12 h-12 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(255, 255, 255, 0.2)' }}
                  >
                    <Calendar className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="text-xl font-bold text-white">{monthYear}</div>
                    <div className="text-sm" style={{ color: 'rgba(219, 234, 254, 0.9)' }}>{monthTransactions.length} transactions</div>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <div className="text-xs" style={{ color: 'rgba(219, 234, 254, 0.9)' }}>Total Debit</div>
                    <div className="text-lg font-bold text-white">Rs {monthDebit.toLocaleString('en-PK')}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs" style={{ color: 'rgba(219, 234, 254, 0.9)' }}>Total Credit</div>
                    <div className="text-lg font-bold text-white">Rs {monthCredit.toLocaleString('en-PK')}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="relative pl-12">
              {/* Vertical Line */}
              <div 
                className="absolute left-6 top-0 bottom-0 w-0.5"
                style={{ 
                  background: 'linear-gradient(to bottom, rgba(59, 130, 246, 0.3), rgba(100, 116, 139, 0.3), rgba(59, 130, 246, 0.3))'
                }}
              ></div>

              {monthTransactions.map((transaction, index) => (
                <div
                  key={transaction.id}
                  onClick={() => onTransactionClick(transaction)}
                  className="relative mb-6 group cursor-pointer"
                >
                  {/* Timeline Dot */}
                  <div 
                    className={`absolute -left-6 w-12 h-12 rounded-full ${getDocumentColor(transaction.documentType)} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform z-10`}
                    style={{ border: '4px solid #273548' }}
                  >
                    <div className="text-white">
                      {getDocumentIcon(transaction.documentType)}
                    </div>
                  </div>

                  {/* Transaction Card */}
                  <div 
                    className="ml-8 rounded-xl shadow-sm hover:shadow-md transition-all overflow-hidden"
                    style={{ 
                      background: '#273548',
                      border: '1px solid rgba(100, 116, 139, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.3)';
                    }}
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="text-base font-bold" style={{ color: '#60a5fa' }}>{transaction.referenceNo}</div>
                            <span 
                              className={`px-2.5 py-0.5 rounded-full text-xs ${
                                transaction.documentType === 'Sale' ? 'bg-blue-500/20 text-blue-400' :
                                transaction.documentType === 'Payment' ? 'bg-emerald-500/20 text-emerald-400' :
                                'bg-purple-500/20 text-purple-400'
                              }`}
                              style={{ border: 'none' }}
                            >
                              {transaction.documentType}
                            </span>
                          </div>
                          <div className="text-sm mb-2" style={{ color: '#cbd5e1' }}>{transaction.description}</div>
                          <div className="flex items-center gap-4 text-xs" style={{ color: '#64748b' }}>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(transaction.date).toLocaleDateString('en-GB', { 
                                day: '2-digit', 
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
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
                              <TrendingUp className="w-4 h-4 text-orange-500" />
                              <span className="text-xl font-bold text-orange-500 tabular-nums">
                                +{transaction.debit.toLocaleString('en-PK')}
                              </span>
                            </div>
                          )}
                          {transaction.credit > 0 && (
                            <div className="flex items-center justify-end gap-2 mb-1">
                              <TrendingDown className="w-4 h-4 text-emerald-500" />
                              <span className="text-xl font-bold text-emerald-500 tabular-nums">
                                -{transaction.credit.toLocaleString('en-PK')}
                              </span>
                            </div>
                          )}
                          <div className="text-xs mt-2" style={{ color: '#64748b' }}>Balance</div>
                          <div className="text-base font-bold tabular-nums" style={{ color: '#e2e8f0' }}>
                            Rs {transaction.runningBalance.toLocaleString('en-PK')}
                          </div>
                        </div>
                      </div>

                      {transaction.notes && (
                        <div 
                          className="mt-3 pt-3"
                          style={{ borderTop: '1px solid rgba(100, 116, 139, 0.2)' }}
                        >
                          <div className="text-xs mb-1" style={{ color: '#64748b' }}>Notes:</div>
                          <div className="text-sm" style={{ color: '#cbd5e1' }}>{transaction.notes}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Connection Line to Next */}
                  {index < monthTransactions.length - 1 && (
                    <div 
                      className="absolute left-0 top-12 bottom-0 w-px"
                      style={{ background: 'rgba(100, 116, 139, 0.2)' }}
                    ></div>
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
