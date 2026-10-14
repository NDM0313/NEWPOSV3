import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  message: string;
  onRetry: () => void;
}

export const DashboardErrorState: React.FC<Props> = ({ message, onRetry }) => (
  <div className="rounded-xl border border-red-900/50 bg-card p-8 text-center">
    <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
    <h3 className="text-foreground font-semibold mb-1">Could not load dashboard</h3>
    <p className="text-muted-foreground text-sm mb-4">{message}</p>
    <button
      type="button"
      onClick={onRetry}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#374151] text-foreground hover:bg-[#4B5563]"
    >
      <RefreshCw className="w-4 h-4" />
      Retry
    </button>
  </div>
);
