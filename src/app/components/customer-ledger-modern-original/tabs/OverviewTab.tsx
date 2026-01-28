import { TrendingUp, TrendingDown, FileText, ArrowRight, CheckCircle } from 'lucide-react';
import type { LedgerData, Transaction } from '../../../types';

interface OverviewTabProps {
  ledgerData: LedgerData;
  onTransactionClick: (transaction: Transaction) => void;
}

export function OverviewTab({ ledgerData, onTransactionClick }: OverviewTabProps) {
  const formatAmount = (amount: number) => amount.toLocaleString('en-PK');
  
  const recentTransactions = ledgerData.transactions.slice(0, 5);
  const overdueInvoices = ledgerData.invoices.filter(inv => inv.status === 'Unpaid');
  const partiallyPaid = ledgerData.invoices.filter(inv => inv.status === 'Partially Paid');

  // Calculate payment trends
  const totalPayments = ledgerData.transactions.filter(t => t.documentType === 'Payment').length;
  const totalSales = ledgerData.transactions.filter(t => t.documentType === 'Sale').length;

  return (
    <div className="space-y-6">
      {/* Quick Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        {/* Account Balance - Light Blue Card */}
        <div className="rounded-xl p-5 shadow-sm" style={{
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(96, 165, 250, 0.1) 100%)',
          border: '1px solid rgba(59, 130, 246, 0.3)'
        }}>
          <div className="flex justify-between items-start mb-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{
              background: '#3b82f6'
            }}>
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs px-2 py-1 rounded-full text-white" style={{ background: '#3b82f6' }}>Current</span>
          </div>
          <div className="text-xs mb-1" style={{ color: '#93c5fd' }}>Account Balance</div>
          <div className="text-2xl" style={{ color: '#ffffff' }}>Rs {formatAmount(ledgerData.closingBalance)}</div>
        </div>

        {/* Overdue Amount */}
        <div className="rounded-xl p-5 shadow-sm" style={{
          background: '#273548',
          border: '1px solid #334155'
        }}>
          <div className="flex justify-between items-start mb-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{
              background: 'rgba(249, 115, 22, 0.1)'
            }}>
              <FileText className="w-5 h-5" style={{ color: '#f97316' }} />
            </div>
            <span className="text-xs px-2 py-1 rounded-full" style={{
              background: 'rgba(249, 115, 22, 0.15)',
              color: '#fb923c'
            }}>{overdueInvoices.length}</span>
          </div>
          <div className="text-xs mb-1" style={{ color: '#94a3b8' }}>Overdue Amount</div>
          <div className="text-2xl" style={{ color: '#ffffff' }}>
            Rs {formatAmount(overdueInvoices.reduce((sum, inv) => sum + inv.pendingAmount, 0))}
          </div>
        </div>

        {/* Total Received */}
        <div className="rounded-xl p-5 shadow-sm" style={{
          background: '#273548',
          border: '1px solid #334155'
        }}>
          <div className="flex justify-between items-start mb-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{
              background: 'rgba(16, 185, 129, 0.1)'
            }}>
              <CheckCircle className="w-5 h-5" style={{ color: '#10b981' }} />
            </div>
            <span className="text-xs px-2 py-1 rounded-full" style={{
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#34d399'
            }}>{totalPayments}</span>
          </div>
          <div className="text-xs mb-1" style={{ color: '#94a3b8' }}>Total Received</div>
          <div className="text-2xl" style={{ color: '#ffffff' }}>Rs {formatAmount(ledgerData.totalCredit)}</div>
        </div>

        {/* Total Sales */}
        <div className="rounded-xl p-5 shadow-sm" style={{
          background: '#273548',
          border: '1px solid #334155'
        }}>
          <div className="flex justify-between items-start mb-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{
              background: 'rgba(139, 92, 246, 0.1)'
            }}>
              <TrendingDown className="w-5 h-5" style={{ color: '#8b5cf6' }} />
            </div>
            <span className="text-xs px-2 py-1 rounded-full" style={{
              background: 'rgba(139, 92, 246, 0.15)',
              color: '#a78bfa'
            }}>{totalSales}</span>
          </div>
          <div className="text-xs mb-1" style={{ color: '#94a3b8' }}>Total Sales</div>
          <div className="text-2xl" style={{ color: '#ffffff' }}>Rs {formatAmount(ledgerData.totalDebit)}</div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <div className="rounded-xl overflow-hidden shadow-sm" style={{
          background: '#273548',
          border: '1px solid #334155'
        }}>
          <div className="px-5 py-4" style={{
            borderBottom: '1px solid #334155',
            background: '#1e293b'
          }}>
            <h3 className="text-sm" style={{ color: '#ffffff' }}>Recent Transactions</h3>
            <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>Last 5 activities</p>
          </div>
          <div style={{ borderTop: '1px solid #334155' }}>
            {recentTransactions.map((transaction, index) => (
              <button
                key={transaction.id}
                onClick={() => onTransactionClick(transaction)}
                className="w-full px-5 py-4 transition-colors text-left"
                style={{
                  borderBottom: index < recentTransactions.length - 1 ? '1px solid #334155' : 'none'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="text-sm" style={{ color: '#ffffff' }}>{transaction.referenceNo}</div>
                  <div className="text-xs" style={{ color: '#94a3b8' }}>
                    {new Date(transaction.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  </div>
                </div>
                <div className="text-xs mb-2" style={{ color: '#94a3b8' }}>{transaction.description}</div>
                <div className="flex justify-between items-center">
                  <span className={`text-xs px-2 py-1 rounded`} style={{
                    background: transaction.documentType === 'Sale' ? 'rgba(59, 130, 246, 0.15)' :
                               transaction.documentType === 'Payment' ? 'rgba(16, 185, 129, 0.15)' :
                               'rgba(139, 92, 246, 0.15)',
                    color: transaction.documentType === 'Sale' ? '#60a5fa' :
                          transaction.documentType === 'Payment' ? '#34d399' :
                          '#a78bfa'
                  }}>
                    {transaction.documentType}
                  </span>
                  <span className="text-sm" style={{
                    color: transaction.debit > 0 ? '#fb923c' : '#34d399'
                  }}>
                    {transaction.debit > 0 ? '+' : '-'} Rs {formatAmount(transaction.debit || transaction.credit)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Pending Invoices */}
        <div className="rounded-xl overflow-hidden shadow-sm" style={{
          background: '#273548',
          border: '1px solid #334155'
        }}>
          <div className="px-5 py-4" style={{
            borderBottom: '1px solid #334155',
            background: '#1e293b'
          }}>
            <h3 className="text-sm" style={{ color: '#ffffff' }}>Pending Invoices</h3>
            <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>Requires attention</p>
          </div>
          <div style={{ borderTop: '1px solid #334155' }}>
            {[...overdueInvoices, ...partiallyPaid].slice(0, 5).map((invoice, index) => (
              <div 
                key={invoice.invoiceNo} 
                className="px-5 py-4 transition-colors"
                style={{
                  borderBottom: index < 4 && [...overdueInvoices, ...partiallyPaid].length > index + 1 ? '1px solid #334155' : 'none'
                }}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="text-sm" style={{ color: '#ffffff' }}>{invoice.invoiceNo}</div>
                  <div className="text-xs" style={{ color: '#94a3b8' }}>
                    {new Date(invoice.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs px-2 py-1 rounded" style={{
                    background: invoice.status === 'Unpaid' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    color: invoice.status === 'Unpaid' ? '#f87171' : '#fbbf24'
                  }}>
                    {invoice.status}
                  </span>
                  <div className="text-right">
                    <div className="text-xs" style={{ color: '#94a3b8' }}>Pending</div>
                    <div className="text-sm" style={{ color: '#fb923c' }}>Rs {formatAmount(invoice.pendingAmount)}</div>
                  </div>
                </div>
              </div>
            ))}
            {[...overdueInvoices, ...partiallyPaid].length === 0 && (
              <div className="px-5 py-8 text-center">
                <CheckCircle className="w-12 h-12 mx-auto mb-2" style={{ color: '#10b981' }} />
                <p className="text-sm" style={{ color: '#94a3b8' }}>All invoices cleared!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Performance */}
      <div className="rounded-xl p-6 shadow-sm" style={{
        background: 'linear-gradient(135deg, #1e293b 0%, rgba(59, 130, 246, 0.05) 100%)',
        border: '1px solid #334155'
      }}>
        <h3 className="text-sm mb-4" style={{ color: '#ffffff' }}>Payment Performance</h3>
        <div className="grid grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl mb-1" style={{ color: '#ffffff' }}>
              {ledgerData.invoicesSummary.totalInvoices}
            </div>
            <div className="text-xs" style={{ color: '#94a3b8' }}>Total Invoices</div>
          </div>
          <div className="text-center" style={{ borderLeft: '1px solid #334155', borderRight: '1px solid #334155' }}>
            <div className="text-3xl mb-1" style={{ color: '#10b981' }}>
              {((ledgerData.invoicesSummary.totalPaymentReceived / ledgerData.invoicesSummary.totalInvoiceAmount) * 100).toFixed(1)}%
            </div>
            <div className="text-xs" style={{ color: '#94a3b8' }}>Collection Rate</div>
          </div>
          <div className="text-center">
            <div className="text-3xl mb-1" style={{ color: '#fb923c' }}>
              {ledgerData.invoicesSummary.unpaid + ledgerData.invoicesSummary.partiallyPaid}
            </div>
            <div className="text-xs" style={{ color: '#94a3b8' }}>Pending Invoices</div>
          </div>
        </div>
      </div>
    </div>
  );
}
