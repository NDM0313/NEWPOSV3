import { FileText, CreditCard, TrendingUp, TrendingDown } from 'lucide-react';
import type { LedgerData } from '../../types';

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
      {/* Primary Balance Cards – ERP theme */}
      <div className="grid grid-cols-4 gap-6">
        <div className="rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow bg-card border border-border">
          <div className="flex items-start justify-between mb-3">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-muted">
              <CreditCard className="w-6 h-6 text-muted-foreground" />
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">Opening</span>
          </div>
          <div className="text-sm mb-1 text-muted-foreground">Opening Balance</div>
          <div className="text-2xl text-foreground">Rs {formatAmount(openingBalance)}</div>
        </div>
        <div className="rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow bg-card border border-border">
          <div className="flex items-start justify-between mb-3">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-warning/10">
              <TrendingUp className="w-6 h-6 text-warning" />
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-warning/10 text-warning">Debit</span>
          </div>
          <div className="text-sm mb-1 text-muted-foreground">Total Debit</div>
          <div className="text-2xl text-foreground">Rs {formatAmount(totalDebit)}</div>
        </div>
        <div className="rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow bg-card border border-border">
          <div className="flex items-start justify-between mb-3">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-success/10">
              <TrendingDown className="w-6 h-6 text-success" />
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-success/10 text-success">Credit</span>
          </div>
          <div className="text-sm mb-1 text-muted-foreground">Total Credit</div>
          <div className="text-2xl text-foreground">Rs {formatAmount(totalCredit)}</div>
        </div>
        <div className="rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow bg-card border border-border">
          <div className="flex items-start justify-between mb-3">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-primary/20">
              <CreditCard className="w-6 h-6 text-primary" />
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary">Current</span>
          </div>
          <div className="text-sm mb-1 text-muted-foreground">Closing Balance</div>
          <div className="text-2xl text-foreground">Rs {formatAmount(closingBalance)}</div>
        </div>
      </div>
      <div className="rounded-xl p-6 shadow-sm bg-card border border-border">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base text-foreground">Invoices Summary</h3>
            <p className="text-xs text-muted-foreground">Overview of all customer invoices</p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-6 mb-6">
          <div className="text-center p-4 rounded-lg bg-muted">
            <div className="text-xs mb-1 text-muted-foreground">Total Invoices</div>
            <div className="text-2xl text-foreground">{invoicesSummary.totalInvoices}</div>
          </div>
          <div className="text-center p-4 rounded-lg bg-primary/10">
            <div className="text-xs mb-1 text-muted-foreground">Invoice Amount</div>
            <div className="text-xl text-primary">Rs {formatAmount(invoicesSummary.totalInvoiceAmount)}</div>
          </div>
          <div className="text-center p-4 rounded-lg bg-success/10">
            <div className="text-xs mb-1 text-muted-foreground">Payment Received</div>
            <div className="text-xl text-success">Rs {formatAmount(invoicesSummary.totalPaymentReceived)}</div>
          </div>
          <div className="text-center p-4 rounded-lg bg-warning/10">
            <div className="text-xs mb-1 text-muted-foreground">Pending Amount</div>
            <div className="text-xl text-warning">Rs {formatAmount(invoicesSummary.pendingAmount)}</div>
          </div>
        </div>
        <div className="flex items-center justify-center gap-8 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-success" />
            <span className="text-sm text-muted-foreground">Fully Paid: <span className="text-foreground">{invoicesSummary.fullyPaid}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-warning" />
            <span className="text-sm text-muted-foreground">Partially Paid: <span className="text-foreground">{invoicesSummary.partiallyPaid}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-destructive" />
            <span className="text-sm text-muted-foreground">Unpaid: <span className="text-foreground">{invoicesSummary.unpaid}</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}
