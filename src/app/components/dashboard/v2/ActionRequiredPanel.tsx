import React from 'react';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import type { DashboardV2Alert } from '@/app/lib/dashboardV2Mappers';

interface Props {
  alerts: DashboardV2Alert[];
  onNavigate?: (view: string) => void;
}

const severityColor: Record<DashboardV2Alert['severity'], string> = {
  info: 'border-blue-500/40 bg-blue-500/5',
  warning: 'border-amber-500/40 bg-amber-500/5',
  critical: 'border-red-500/40 bg-red-500/5',
};

export const ActionRequiredPanel: React.FC<Props> = ({ alerts, onNavigate }) => {
  if (!alerts.length) {
    return (
      <div className="rounded-xl border border-[#374151] bg-[#1F2937] p-4 text-[#9CA3AF] text-sm">
        No action required — all clear for stock, rentals, and liquidity alerts.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#374151] bg-[#1F2937] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#374151] flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-400" />
        <h3 className="text-white font-semibold">Action Required</h3>
        <span className="text-xs text-[#9CA3AF] ml-auto">{alerts.length} alert(s)</span>
      </div>
      <ul className="divide-y divide-[#374151]">
        {alerts.map((a) => (
          <li key={a.id} className={`px-4 py-3 border-l-2 ${severityColor[a.severity]}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-white font-medium text-sm">{a.title}</p>
                <p className="text-[#9CA3AF] text-xs mt-0.5">{a.message}</p>
                {a.previewRows?.length ? (
                  <ul className="mt-2 space-y-1">
                    {a.previewRows.map((p, i) => (
                      <li key={i} className="text-xs text-[#6B7280]">
                        {p.label} — {p.detail}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              {a.viewTarget && onNavigate ? (
                <button
                  type="button"
                  onClick={() => onNavigate(a.viewTarget!)}
                  className="shrink-0 inline-flex items-center text-xs text-[#3B82F6] hover:text-blue-300"
                >
                  View
                  <ChevronRight className="w-3 h-3" />
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
