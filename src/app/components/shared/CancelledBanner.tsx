/**
 * Reusable banner for cancelled documents (Sale/Purchase).
 * Shows clear RED/AMBER "CANCELLED DOCUMENT" banner at top.
 * Optionally shows Credit Note and Refund references.
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/app/components/ui/utils';

interface CancelledBannerProps {
  /** Credit Note number if generated (e.g. CN-001) */
  creditNoteNo?: string | null;
  /** Refund number if refund was made (e.g. RF-001) */
  refundNo?: string | null;
  /** Compact mode for inline use */
  compact?: boolean;
  className?: string;
}

export const CancelledBanner: React.FC<CancelledBannerProps> = ({
  creditNoteNo,
  refundNo,
  compact = false,
  className,
}) => {
  return (
    <div
      className={cn(
        'rounded-lg border border-amber-500/50 bg-amber-500/10',
        compact ? 'px-3 py-2' : 'px-4 py-3',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle size={compact ? 16 : 20} className="text-amber-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className={cn('font-semibold text-amber-400', compact ? 'text-sm' : 'text-base')}>
            CANCELLED DOCUMENT
          </p>
          {(creditNoteNo || refundNo) && (
            <div className={cn('text-amber-300/90 mt-1 space-y-0.5', compact ? 'text-xs' : 'text-sm')}>
              {creditNoteNo && (
                <p>Reversed by Credit Note: {creditNoteNo}</p>
              )}
              {refundNo && (
                <p>Refund Reference: {refundNo}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
