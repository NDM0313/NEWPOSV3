import React from 'react';
import { TrendingUp, TrendingDown, FileText, CheckCircle, CreditCard } from 'lucide-react';
import type { CustomerLedgerSummary } from '@/app/services/customerLedgerApi';
import type { Transaction, Invoice } from '@/app/services/customerLedgerTypes';
import { Badge } from '@/app/components/ui/badge';
import { cn } from '@/app/components/ui/utils';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { useFormatDate } from '@/app/hooks/useFormatDate';

interface OverviewTabProps {
  summary: CustomerLedgerSummary;
  transactions: Transaction[];
  invoices: Invoice[];
}

export function OverviewTab({ summary, transactions, invoices }: OverviewTabProps) {
  const { formatCurrency } = useFormatCurrency();
  const { formatDate } = useFormatDate();
  
  const overdueInvoices = invoices.filter(inv => inv.status === 'Unpaid');
  const partiallyPaid = invoices.filter(inv => inv.status === 'Partially Paid');
  const totalPayments = transactions.filter(t => t.documentType === 'Payment').length;
  const totalSales = transactions.filter(t => t.documentType === 'Sale').length;

  return (
    <div className="space-y-6">
      {/* Quick Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 border border-blue-200">
          <div className="flex justify-between items-start mb-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs px-2 py-1 bg-blue-600 text-white rounded-full">Current</span>
          </div>
          <div className="text-xs text-blue-700 mb-1">Account Balance</div>
          <div className="text-2xl text-blue-900">{formatCurrency(summary.closingBalance)}</div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <div className="flex justify-between items-start mb-3">
            <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-orange-600" />
            </div>
            <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded-full">{overdueInvoices.length}</span>
          </div>
          <div className="text-xs text-slate-600 mb-1">Overdue Amount</div>
          <div className="text-2xl text-slate-900">
            {formatCurrency(overdueInvoices.reduce((sum, inv) => sum + inv.pendingAmount, 0))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <div className="flex justify-between items-start mb-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">{totalPayments}</span>
          </div>
          <div className="text-xs text-slate-600 mb-1">Total Received</div>
          <div className="text-2xl text-slate-900">{formatCurrency(summary.totalCredit)}</div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <div className="flex justify-between items-start mb-3">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full">{totalSales}</span>
          </div>
          <div className="text-xs text-slate-600 mb-1">Total Sales</div>
          <div className="text-2xl text-slate-900">{formatCurrency(summary.totalDebit)}</div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
            <h3 className="text-sm text-slate-900">Recent Transactions</h3>
            <p className="text-xs text-slate-500 mt-0.5">Last 5 activities</p>
          </div>
          <div className="divide-y divide-slate-100">
            {transactions.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">No recent transactions</div>
            ) : (
              transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="px-5 py-4 hover:bg-blue-50 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-sm text-slate-900">{transaction.referenceNo}</div>
                    <div className="text-xs text-slate-500">
                      {formatDate(transaction.date)}
                    </div>
                  </div>
                  <div className="text-xs text-slate-600 mb-2">{transaction.description}</div>
                  <div className="flex justify-between items-center">
                    <Badge className={cn(
                      "text-xs",
                      transaction.documentType === 'Sale' ? 'bg-blue-100 text-blue-700' :
                      transaction.documentType === 'Payment' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-purple-100 text-purple-700'
                    )}>
                      {transaction.documentType}
                    </Badge>
                    <div className="text-sm font-medium text-slate-900">
                      {transaction.debit > 0 ? (
                        <span className="text-orange-600">+{formatCurrency(transaction.debit)}</span>
                      ) : (
                        <span className="text-emerald-600">-{formatCurrency(transaction.credit)}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Invoices Summary */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
            <h3 className="text-sm text-slate-900">Invoices Summary</h3>
            <p className="text-xs text-slate-500 mt-0.5">Payment status overview</p>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Total Invoices</span>
              <span className="text-lg font-semibold text-slate-900">{summary.totalInvoices}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Total Amount</span>
              <span className="text-lg font-semibold text-slate-900">{formatCurrency(summary.totalInvoiceAmount)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Paid Amount</span>
              <span className="text-lg font-semibold text-emerald-600">{formatCurrency(summary.totalPaymentReceived)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Pending Amount</span>
              <span className="text-lg font-semibold text-red-600">{formatCurrency(summary.pendingAmount)}</span>
            </div>
            <div className="pt-4 border-t border-slate-200 grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-600">{summary.fullyPaid}</div>
                <div className="text-xs text-slate-500 mt-1">Fully Paid</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{summary.partiallyPaid}</div>
                <div className="text-xs text-slate-500 mt-1">Partially Paid</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{summary.unpaid}</div>
                <div className="text-xs text-slate-500 mt-1">Unpaid</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

