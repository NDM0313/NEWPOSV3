import React from 'react';
import { cn } from '@/app/components/ui/utils';
import { IN_OUT, type LedgerSide } from '@/app/lib/debitCreditInOutLabels';

export function DebitCreditInOutBadge({ side, className }: { side: LedgerSide; className?: string }) {
  const meta = IN_OUT[side];
  const isIn = side === 'debit';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide border shrink-0',
        isIn ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-red-500/15 text-red-400 border-red-500/30',
        className
      )}
    >
      <span aria-hidden>{meta.arrow}</span>
      {meta.badge}
    </span>
  );
}

export function AccountSideLabelRow({
  title,
  side,
  required,
  hint,
  className,
}: {
  title: string;
  side: LedgerSide;
  required?: boolean;
  hint?: string;
  className?: string;
}) {
  const meta = IN_OUT[side];
  return (
    <div className={cn('mb-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-gray-300">
          {title}
          {required && <span className="text-red-400"> *</span>}
        </span>
        <DebitCreditInOutBadge side={side} />
      </div>
      <p className="text-[11px] text-gray-500 mt-1">{hint ?? meta.hint}</p>
    </div>
  );
}

export function MoneyFlowSummaryBar({ inLabel, outLabel }: { inLabel: string; outLabel: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-2 text-[11px] mb-3">
      <span className="text-emerald-400 font-semibold whitespace-nowrap">↑ IN</span>
      <span className="text-gray-400">{inLabel}</span>
      <span className="text-gray-600 hidden sm:inline">•</span>
      <span className="text-red-400 font-semibold whitespace-nowrap">↓ OUT</span>
      <span className="text-gray-400">{outLabel}</span>
    </div>
  );
}
