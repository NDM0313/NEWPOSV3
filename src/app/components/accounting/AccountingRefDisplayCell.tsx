import React from 'react';
import { Badge } from '@/app/components/ui/badge';
import type { AccountingUiRef } from '@/app/lib/accountingDisplayReference';

/**
 * Primary = display ref, secondary = technical type:uuid, optional JE badge + source label.
 */
export function AccountingRefDisplayCell({
  ui,
  showSourceBadge = true,
  className = '',
}: {
  ui: AccountingUiRef | null | undefined;
  showSourceBadge?: boolean;
  className?: string;
}) {
  if (!ui) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  return (
    <div className={`min-w-0 max-w-[280px] ${className}`}>
      <div className="flex flex-wrap items-center gap-1">
        {showSourceBadge ? (
          <Badge variant="secondary" className="text-[9px] uppercase tracking-wide bg-muted text-muted-foreground border-0 shrink-0">
            {ui.sourceLabel}
          </Badge>
        ) : null}
        {ui.entryNoBadge ? (
          <Badge variant="outline" className="text-[10px] font-mono border-gray-600 text-muted-foreground shrink-0">
            {ui.entryNoBadge}
          </Badge>
        ) : null}
      </div>
      <div className="text-sm text-gray-100 font-medium truncate mt-0.5" title={ui.displayRef}>
        {ui.displayRef}
      </div>
      {!ui.documentResolved ? (
        <div className="text-[10px] text-amber-400/95 mt-0.5">No display reference found</div>
      ) : null}
      <div className="text-[10px] text-muted-foreground font-mono truncate mt-0.5" title={ui.technicalRef}>
        {ui.technicalRef}
      </div>
    </div>
  );
}
