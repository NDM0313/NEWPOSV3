import React from 'react';
import { Badge } from '@/app/components/ui/badge';
import { cn } from '@/app/components/ui/utils';
import { type ArApRiskLevel, riskBadgeClass } from '@/app/lib/arApReconciliationDiagnostics';

export function RiskBadge(props: { level: ArApRiskLevel; className?: string }) {
  return (
    <Badge className={cn('border text-[10px] uppercase tracking-wide', riskBadgeClass(props.level), props.className)}>
      {props.level} risk
    </Badge>
  );
}

export function FalsePositiveBadge() {
  return (
    <Badge className="border text-[10px] bg-cyan-500/15 text-cyan-200 border-cyan-500/40">
      Likely mapped — heuristic false positive
    </Badge>
  );
}

export function MetadataReviewBadge() {
  return (
    <Badge className="border text-[10px] bg-violet-500/15 text-violet-200 border-violet-500/40">
      Mapped financially — metadata review
    </Badge>
  );
}

export function AppliedGlCorrectionBadge() {
  return (
    <Badge className="border text-[10px] bg-emerald-500/15 text-emerald-200 border-emerald-500/40">
      Applied GL correction — audit only
    </Badge>
  );
}

export function PostabilityBadge(props: { label: string; isNonFinal: boolean }) {
  return (
    <Badge
      className={cn(
        'border text-[10px]',
        props.isNonFinal
          ? 'bg-slate-500/15 text-slate-300 border-slate-500/40'
          : 'bg-orange-500/15 text-orange-200 border-orange-500/40'
      )}
    >
      {props.label}
    </Badge>
  );
}
