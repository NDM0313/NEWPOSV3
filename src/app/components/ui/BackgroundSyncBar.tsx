import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/app/components/ui/utils';

/** Slim non-blocking indicator for list/table background refetch. */
export function BackgroundSyncBar({
  active,
  label = 'Syncing…',
  className,
}: {
  active: boolean;
  label?: string;
  className?: string;
}) {
  if (!active) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 text-[11px] text-sky-300/95 bg-sky-950/40 border-b border-sky-900/50',
        className
      )}
    >
      <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
      <span>{label}</span>
    </div>
  );
}
