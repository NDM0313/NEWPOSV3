import React from 'react';
import { Label } from '@/app/components/ui/label';
import type { InOutDirection } from '@/app/lib/accountPostingInOutLabel';

type AccountPickerFieldLabelProps = {
  base: string;
  className?: string;
  drCr?: 'Dr' | 'Cr';
  inOut?: InOutDirection | 'IN/OUT';
  required?: boolean;
};

/** Label for debit/credit account pickers with Dr/Cr and IN/OUT in the title. */
export function AccountPickerFieldLabel({
  base,
  className,
  drCr,
  inOut,
  required,
}: AccountPickerFieldLabelProps) {
  return (
    <Label className={className}>
      {base}
      {(drCr || inOut) && (
        <span>
          {' '}
          (
          {drCr && <span>{drCr}</span>}
          {drCr && inOut && <span> · </span>}
          {inOut === 'IN/OUT' && <span className="text-muted-foreground font-medium">IN/OUT</span>}
          {inOut === 'IN' && <span className="text-emerald-400 font-semibold">IN</span>}
          {inOut === 'OUT' && <span className="text-amber-400 font-semibold">OUT</span>}
          )
        </span>
      )}
      {required && <span className="text-red-400"> *</span>}
    </Label>
  );
}
