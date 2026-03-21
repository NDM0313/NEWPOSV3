import React from 'react';
import { FileText, ShoppingCart, PackageCheck, Ban, RotateCcw } from 'lucide-react';
import { getEffectivePurchaseStatus } from '@/app/utils/statusHelpers';
import { cn } from '@/app/components/ui/utils';

export type PurchaseLifecycleAction =
  | 'lifecycle_draft'
  | 'lifecycle_ordered'
  | 'lifecycle_received'
  | 'lifecycle_cancel'
  | 'restore_draft'
  | 'restore_ordered';

/** Minimal purchase row shape for lifecycle menu (PurchasesPage list). */
export type PurchaseLifecycleRow = {
  status: string;
};

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

/** Same-row lifecycle actions for status popover + row ⋮ menu. */
export function PurchaseLifecycleMenuBlock({
  purchase,
  onPick,
  variant = 'popover',
}: {
  purchase: PurchaseLifecycleRow;
  onPick: (action: PurchaseLifecycleAction) => void;
  variant?: 'popover' | 'menu';
}) {
  const eff = getEffectivePurchaseStatus(purchase as any);
  const cancelled = eff === 'cancelled';
  const posted = eff === 'received' || eff === 'final';

  if (cancelled) {
    return (
      <div className={cn('flex flex-col gap-0.5', variant === 'menu' ? 'py-1' : 'p-1')}>
        <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-400/90">
          Cancelled — restore to continue
        </div>
        <p className="px-2 pb-2 text-[11px] text-muted-foreground leading-snug">
          Restore to Draft or Order, then use Convert to Received / Final when ready.
        </p>
        <Btn onClick={() => onPick('restore_draft')}>
          <RotateCcw className="h-4 w-4 shrink-0 text-blue-400" /> Restore to Draft
        </Btn>
        <Btn onClick={() => onPick('restore_ordered')}>
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
      <Btn disabled={posted} onClick={() => onPick('lifecycle_ordered')}>
        <ShoppingCart className="h-4 w-4 shrink-0" /> Convert to Order
      </Btn>
      <Btn disabled={posted} onClick={() => onPick('lifecycle_received')}>
        <PackageCheck className="h-4 w-4 shrink-0" /> Convert to Received / Final
      </Btn>
      <div className="my-1 h-px bg-border" />
      <Btn
        onClick={() => onPick('lifecycle_cancel')}
        className="text-amber-400 hover:text-amber-300"
      >
        <Ban className="h-4 w-4 shrink-0" /> Cancel
      </Btn>
    </div>
  );
}
