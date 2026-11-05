import React from 'react';
import { Info } from 'lucide-react';

export interface AppliesToBannerProps {
  targets: string;
  className?: string;
}

/** Shows which document types a settings section affects. */
export function AppliesToBanner({ targets, className }: AppliesToBannerProps) {
  return (
    <div
      className={`flex items-start gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-100 ${className ?? ''}`}
    >
      <Info size={14} className="shrink-0 mt-0.5 text-blue-400" />
      <div>
        <span className="font-semibold text-blue-200">Applies to: </span>
        {targets}
      </div>
    </div>
  );
}
