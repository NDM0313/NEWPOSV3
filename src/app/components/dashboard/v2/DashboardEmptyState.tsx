import React from 'react';
import { Calendar } from 'lucide-react';

interface Props {
  periodLabel: string;
  branchLabel: string;
}

export const DashboardEmptyState: React.FC<Props> = ({ periodLabel, branchLabel }) => (
  <div className="rounded-xl border border-border bg-card p-8 text-center">
    <Calendar className="w-10 h-10 text-[#6B7280] mx-auto mb-3" />
    <h3 className="text-foreground font-semibold mb-1">No activity in this period</h3>
    <p className="text-muted-foreground text-sm">
      No final sales, posted purchases, or paid expenses between <strong className="text-foreground">{periodLabel}</strong>
      {branchLabel ? <> for <strong className="text-foreground">{branchLabel}</strong></> : null}.
    </p>
  </div>
);
