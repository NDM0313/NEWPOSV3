import { FileText, CreditCard, TrendingUp, TrendingDown } from 'lucide-react';
import type { LedgerData } from '@/app/services/customerLedgerTypes';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';

interface ModernSummaryCardsProps {
  ledgerData: LedgerData;
}

export function ModernSummaryCards({ ledgerData }: ModernSummaryCardsProps) {
  const { formatCurrency } = useFormatCurrency();
  const { openingBalance, totalDebit, totalCredit, closingBalance, invoicesSummary } = ledgerData;

  return (
    <div className="space-y-6">
      {/* Primary Balance Cards – exact match to Products page cards */}
      <div className="grid grid-cols-4 gap-4">
        {/* Opening Balance */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Opening Balance</p>
              <p className="text-2xl font-bold text-white mt-1">{formatCurrency(openingBalance)}</p>
              <p className="text-xs text-gray-500 mt-1">Opening</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-gray-500/10 flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Total Debit */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Total Debit</p>
              <p className="text-2xl font-bold text-yellow-400 mt-1">{formatCurrency(totalDebit)}</p>
              <p className="text-xs text-gray-500 mt-1">Debit</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-yellow-500" />
            </div>
          </div>
        </div>

        {/* Total Credit */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Total Credit</p>
              <p className="text-2xl font-bold text-green-400 mt-1">{formatCurrency(totalCredit)}</p>
              <p className="text-xs text-gray-500 mt-1">Credit</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-green-500" />
            </div>
          </div>
        </div>

        {/* Closing Balance */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Closing Balance</p>
              <p className="text-2xl font-bold text-white mt-1">{formatCurrency(closingBalance)}</p>
              <p className="text-xs text-gray-500 mt-1">Current</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-blue-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Invoices Summary Card – same card style as Products */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/10">
            <FileText className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Invoices Summary</h3>
            <p className="text-xs text-gray-500 mt-0.5">Overview of all customer invoices</p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 rounded-lg bg-gray-800/50 border border-gray-800">
            <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Total Invoices</div>
            <div className="text-2xl font-bold text-white">{invoicesSummary.totalInvoices}</div>
          </div>
          <div className="text-center p-4 rounded-lg bg-gray-800/50 border border-gray-800">
            <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Invoice Amount</div>
            <div className="text-xl font-bold text-blue-400">{formatCurrency(invoicesSummary.totalInvoiceAmount)}</div>
          </div>
          <div className="text-center p-4 rounded-lg bg-gray-800/50 border border-gray-800">
            <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Payment Received</div>
            <div className="text-xl font-bold text-green-400">{formatCurrency(invoicesSummary.totalPaymentReceived)}</div>
          </div>
          <div className="text-center p-4 rounded-lg bg-gray-800/50 border border-gray-800">
            <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Pending Amount</div>
            <div className="text-xl font-bold text-yellow-400">{formatCurrency(invoicesSummary.pendingAmount)}</div>
          </div>
        </div>
        <div className="flex items-center justify-center gap-8 pt-4 border-t border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-sm text-gray-400">Fully Paid: <span className="text-white font-medium">{invoicesSummary.fullyPaid}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="text-sm text-gray-400">Partially Paid: <span className="text-white font-medium">{invoicesSummary.partiallyPaid}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-sm text-gray-400">Unpaid: <span className="text-white font-medium">{invoicesSummary.unpaid}</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}
