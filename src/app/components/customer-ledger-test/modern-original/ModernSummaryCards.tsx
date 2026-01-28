import { FileText, CreditCard, TrendingUp, TrendingDown } from 'lucide-react';
import type { LedgerData } from '@/app/services/customerLedgerTypes';

interface ModernSummaryCardsProps {
  ledgerData: LedgerData;
}

export function ModernSummaryCards({ ledgerData }: ModernSummaryCardsProps) {
  const { openingBalance, totalDebit, totalCredit, closingBalance, invoicesSummary } = ledgerData;

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('en-PK');
  };

  return (
    <div className="space-y-6">
      {/* Primary Balance Cards */}
      <div className="grid grid-cols-4 gap-6">
        {/* Opening Balance */}
        <div className="rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow" style={{
          background: '#273548',
          border: '1px solid #334155'
        }}>
          <div className="flex items-start justify-between mb-3">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: '#1e293b' }}>
              <CreditCard className="w-6 h-6" style={{ color: '#94a3b8' }} />
            </div>
            <span className="text-xs px-2 py-1 rounded-full" style={{ background: '#1e293b', color: '#94a3b8' }}>Opening</span>
          </div>
          <div className="text-sm mb-1" style={{ color: '#94a3b8' }}>Opening Balance</div>
          <div className="text-2xl" style={{ color: '#ffffff' }}>Rs {formatAmount(openingBalance)}</div>
        </div>

        {/* Total Debit */}
        <div className="rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow" style={{
          background: '#273548',
          border: '1px solid #334155'
        }}>
          <div className="flex items-start justify-between mb-3">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: 'rgba(249, 115, 22, 0.1)' }}>
              <TrendingUp className="w-6 h-6" style={{ color: '#f97316' }} />
            </div>
            <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(249, 115, 22, 0.1)', color: '#f97316' }}>Debit</span>
          </div>
          <div className="text-sm mb-1" style={{ color: '#94a3b8' }}>Total Debit</div>
          <div className="text-2xl" style={{ color: '#ffffff' }}>Rs {formatAmount(totalDebit)}</div>
        </div>

        {/* Total Credit */}
        <div className="rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow" style={{
          background: '#273548',
          border: '1px solid #334155'
        }}>
          <div className="flex items-start justify-between mb-3">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
              <TrendingDown className="w-6 h-6" style={{ color: '#10b981' }} />
            </div>
            <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>Credit</span>
          </div>
          <div className="text-sm mb-1" style={{ color: '#94a3b8' }}>Total Credit</div>
          <div className="text-2xl" style={{ color: '#ffffff' }}>Rs {formatAmount(totalCredit)}</div>
        </div>

        {/* Closing Balance */}
        <div className="rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow" style={{
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
        }}>
          <div className="flex items-start justify-between mb-3">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255, 255, 255, 0.2)' }}>
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <span className="text-xs px-2 py-1 text-white rounded-full" style={{ background: 'rgba(255, 255, 255, 0.2)' }}>Current</span>
          </div>
          <div className="text-sm mb-1" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>Closing Balance</div>
          <div className="text-2xl text-white">Rs {formatAmount(closingBalance)}</div>
        </div>
      </div>

      {/* Invoices Summary Card */}
      <div className="rounded-xl p-6 shadow-sm" style={{
        background: '#273548',
        border: '1px solid #334155'
      }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
            <FileText className="w-5 h-5" style={{ color: '#3b82f6' }} />
          </div>
          <div>
            <h3 className="text-base" style={{ color: '#ffffff' }}>Invoices Summary</h3>
            <p className="text-xs" style={{ color: '#94a3b8' }}>Overview of all customer invoices</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6 mb-6">
          <div className="text-center p-4 rounded-lg" style={{ background: '#1e293b' }}>
            <div className="text-xs mb-1" style={{ color: '#94a3b8' }}>Total Invoices</div>
            <div className="text-2xl" style={{ color: '#ffffff' }}>{invoicesSummary.totalInvoices}</div>
          </div>
          <div className="text-center p-4 rounded-lg" style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
            <div className="text-xs mb-1" style={{ color: '#94a3b8' }}>Invoice Amount</div>
            <div className="text-xl" style={{ color: '#3b82f6' }}>Rs {formatAmount(invoicesSummary.totalInvoiceAmount)}</div>
          </div>
          <div className="text-center p-4 rounded-lg" style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
            <div className="text-xs mb-1" style={{ color: '#94a3b8' }}>Payment Received</div>
            <div className="text-xl" style={{ color: '#10b981' }}>Rs {formatAmount(invoicesSummary.totalPaymentReceived)}</div>
          </div>
          <div className="text-center p-4 rounded-lg" style={{ background: 'rgba(249, 115, 22, 0.1)' }}>
            <div className="text-xs mb-1" style={{ color: '#94a3b8' }}>Pending Amount</div>
            <div className="text-xl" style={{ color: '#f97316' }}>Rs {formatAmount(invoicesSummary.pendingAmount)}</div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-8 pt-4" style={{ borderTop: '1px solid #334155' }}>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: '#10b981' }}></div>
            <span className="text-sm" style={{ color: '#94a3b8' }}>Fully Paid: <span style={{ color: '#ffffff' }}>{invoicesSummary.fullyPaid}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: '#f59e0b' }}></div>
            <span className="text-sm" style={{ color: '#94a3b8' }}>Partially Paid: <span style={{ color: '#ffffff' }}>{invoicesSummary.partiallyPaid}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: '#ef4444' }}></div>
            <span className="text-sm" style={{ color: '#94a3b8' }}>Unpaid: <span style={{ color: '#ffffff' }}>{invoicesSummary.unpaid}</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}
