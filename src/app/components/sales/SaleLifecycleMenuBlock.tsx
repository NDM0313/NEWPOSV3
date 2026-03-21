import React from 'react';
import { FileText, FileCheck, ShoppingCart, CheckCircle2, Ban, RotateCcw } from 'lucide-react';
import type { Sale } from '@/app/context/SalesContext';
import { getEffectiveSaleStatus } from '@/app/utils/statusHelpers';
import { cn } from '@/app/components/ui/utils';

export type SaleLifecycleAction =
  | 'lifecycle_draft'
  | 'lifecycle_quotation'
  | 'lifecycle_order'
  | 'lifecycle_final'
  | 'lifecycle_cancel'
  | 'restore_draft'
  | 'restore_quotation'
  | 'restore_order';

interface Props {
  sale: Sale;
  onPick: (action: SaleLifecycleAction) => void;
  /** Use compact list styling (popover or dropdown). */
  variant?: 'popover' | 'menu';
}

const Btn = ({
  children,
  onClick,
  disabled,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    className={cn(
      'w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-left transition-colors',
      disabled ? 'opacity-40 pointer-events-none' : 'hover:bg-accent cursor-pointer',
      className
    )}
  >
    {children}
  </button>
);

/** Shared lifecycle actions for status popover + row ⋮ menu (same-row model). */
export function SaleLifecycleMenuBlock({ sale, onPick, variant = 'popover' }: Props) {
  const eff = getEffectiveSaleStatus(sale);
  const cancelled = eff === 'cancelled';
  const isFinal = sale.status === 'final';

  if (cancelled) {
    return (
      <div className={cn('flex flex-col gap-0.5', variant === 'menu' ? 'py-1' : 'p-1')}>
        <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-400/90">
          Cancelled — restore to continue
        </div>
        <p className="px-2 pb-2 text-[11px] text-muted-foreground leading-snug">
          You cannot finalize while cancelled. Restore to a stage, then use Convert to Final.
        </p>
        <Btn onClick={() => onPick('restore_draft')}>
          <RotateCcw className="h-4 w-4 shrink-0 text-blue-400" /> Restore to Draft
        </Btn>
        <Btn onClick={() => onPick('restore_quotation')}>
          <RotateCcw className="h-4 w-4 shrink-0 text-blue-400" /> Restore to Quotation
        </Btn>
        <Btn onClick={() => onPick('restore_order')}>
          <RotateCcw className="h-4 w-4 shrink-0 text-blue-400" /> Restore to Order
        </Btn>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-0.5', variant === 'menu' ? 'py-1' : 'p-1')}>
      <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Status & lifecycle
      </div>
      <Btn onClick={() => onPick('lifecycle_draft')}>
        <FileText className="h-4 w-4 shrink-0" /> Save as Draft
      </Btn>
      <Btn disabled={isFinal} onClick={() => onPick('lifecycle_quotation')}>
        <FileCheck className="h-4 w-4 shrink-0" /> Convert to Quotation
      </Btn>
      <Btn disabled={isFinal} onClick={() => onPick('lifecycle_order')}>
        <ShoppingCart className="h-4 w-4 shrink-0" /> Convert to Order
      </Btn>
      <Btn disabled={isFinal} onClick={() => onPick('lifecycle_final')}>
        <CheckCircle2 className="h-4 w-4 shrink-0" /> Convert to Final
      </Btn>
      <div className="my-1 h-px bg-border" />
      <Btn onClick={() => onPick('lifecycle_cancel')} className="text-amber-400 hover:text-amber-300">
        <Ban className="h-4 w-4 shrink-0" /> Cancel
      </Btn>
    </div>
  );
}
