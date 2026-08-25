'use client';

import React from 'react';

interface LedgerSummaryStripProps {
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
}

export const LedgerSummaryStrip: React.FC<LedgerSummaryStripProps> = ({
  openingBalance,
  totalDebit,
  totalCredit,
  closingBalance,
}) => {
  return (
    <div className="bg-card border-b border-border px-6 py-3 flex-shrink-0">
      <div className="grid grid-cols-4 gap-6 text-sm">
        <div>
          <div className="text-muted-foreground text-xs uppercase mb-1">Opening Balance</div>
          <div className="text-foreground font-semibold">
            Rs {openingBalance.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs uppercase mb-1">Total Debit</div>
          <div className="text-foreground font-semibold">
            Rs {totalDebit.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs uppercase mb-1">Total Credit</div>
          <div className="text-foreground font-semibold">
            Rs {totalCredit.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs uppercase mb-1">Closing Balance</div>
          <div className="text-foreground font-semibold">
            Rs {closingBalance.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
