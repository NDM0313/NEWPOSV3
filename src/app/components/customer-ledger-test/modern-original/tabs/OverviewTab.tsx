import { TrendingUp, TrendingDown, FileText, ArrowRight, CheckCircle } from 'lucide-react';
import type { Transaction, LedgerData } from '@/app/services/customerLedgerTypes';

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
  const totalSales = ledgerData.transactions.filter(t => t.documentType === 'Sale' || t.documentType === 'Studio Sale').length;

  return (
    <div className="space-y-6">
      {/* Quick Stats Grid – same card style as Products page */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Account Balance</p>
              <p className="text-2xl font-bold text-white mt-1">Rs {formatAmount(ledgerData.closingBalance)}</p>
              <p className="text-xs text-gray-500 mt-1">Current</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-blue-500" />
            </div>
          </div>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Overdue Amount</p>
              <p className="text-2xl font-bold text-yellow-400 mt-1">Rs {formatAmount(overdueInvoices.reduce((sum, inv) => sum + inv.pendingAmount, 0))}</p>
              <p className="text-xs text-gray-500 mt-1">{overdueInvoices.length} unpaid</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <FileText className="w-6 h-6 text-yellow-500" />
            </div>
          </div>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Total Received</p>
              <p className="text-2xl font-bold text-green-400 mt-1">Rs {formatAmount(ledgerData.totalCredit)}</p>
              <p className="text-xs text-gray-500 mt-1">{totalPayments} payments</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-500" />
            </div>
          </div>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Total Sales</p>
              <p className="text-2xl font-bold text-white mt-1">Rs {formatAmount(ledgerData.totalDebit)}</p>
              <p className="text-xs text-gray-500 mt-1">{totalSales} sales</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-blue-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout – same card style as Products */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 bg-gray-950/95">
            <h3 className="text-sm font-semibold text-white">Recent Transactions</h3>
            <p className="text-xs text-gray-500 mt-0.5">Last 5 activities</p>
          </div>
          <div className="border-t border-gray-800">
            {recentTransactions.map((transaction, index) => (
              <button
                key={transaction.id}
                onClick={() => onTransactionClick(transaction)}
                className="w-full px-5 py-4 transition-colors text-left border-b border-gray-800/50 last:border-b-0 hover:bg-gray-800/30"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="text-sm font-medium text-white">{transaction.referenceNo}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(transaction.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  </div>
                </div>
                <div className="text-xs text-gray-500 mb-2">{transaction.description}</div>
                <div className="flex justify-between items-center">
                  <span className={`text-xs px-2 py-1 rounded border ${
                    transaction.documentType === 'Sale' || transaction.documentType === 'Studio Sale' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                    transaction.documentType === 'Payment' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                    'bg-purple-500/10 text-purple-400 border-purple-500/20'
                  }`}>
                    {transaction.documentType}
                  </span>
                  <span className={`text-sm font-medium ${transaction.debit > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                    {transaction.debit > 0 ? '+' : '-'} Rs {formatAmount(transaction.debit || transaction.credit)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 bg-gray-950/95">
            <h3 className="text-sm font-semibold text-white">Pending Invoices</h3>
            <p className="text-xs text-gray-500 mt-0.5">Requires attention</p>
          </div>
          <div className="border-t border-gray-800">
            {[...overdueInvoices, ...partiallyPaid].slice(0, 5).map((invoice, index) => (
              <div
                key={invoice.id ?? invoice.invoiceNo}
                className="px-5 py-4 border-b border-gray-800/50 last:border-b-0"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="text-sm font-medium text-white">{invoice.invoiceNo}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(invoice.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`text-xs px-2 py-1 rounded border ${
                    invoice.status === 'Unpaid' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                  }`}>
                    {invoice.status}
                  </span>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Pending</div>
                    <div className="text-sm font-medium text-yellow-400">Rs {formatAmount(invoice.pendingAmount)}</div>
                  </div>
                </div>
              </div>
            ))}
            {[...overdueInvoices, ...partiallyPaid].length === 0 && (
              <div className="px-5 py-8 text-center">
                <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                <p className="text-sm text-gray-500">All invoices cleared!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Payment Performance</h3>
        <div className="grid grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-white mb-1">{ledgerData.invoicesSummary.totalInvoices}</div>
            <div className="text-xs text-gray-500">Total Invoices</div>
          </div>
          <div className="text-center border-l border-r border-gray-800">
            <div className="text-3xl font-bold text-green-400 mb-1">
              {ledgerData.invoicesSummary.totalInvoiceAmount > 0
                ? ((ledgerData.invoicesSummary.totalPaymentReceived / ledgerData.invoicesSummary.totalInvoiceAmount) * 100).toFixed(1)
                : '0'}%
            </div>
            <div className="text-xs text-gray-500">Collection Rate</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-400 mb-1">
              {ledgerData.invoicesSummary.unpaid + ledgerData.invoicesSummary.partiallyPaid}
            </div>
            <div className="text-xs text-gray-500">Pending Invoices</div>
          </div>
        </div>
      </div>
    </div>
  );
}
