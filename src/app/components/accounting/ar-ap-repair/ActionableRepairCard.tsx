import React from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import {
  actionableRepairButtonLabel,
  actionableRepairStatusLabel,
  type ActionableRepairButton,
  type ActionableRepairClassification,
} from '@/app/lib/actionableRepairClassifier';

function statusBadgeClass(status: ActionableRepairClassification['status']): string {
  switch (status) {
    case 'fixable_now':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40';
    case 'needs_source_document':
      return 'bg-blue-500/15 text-blue-200 border-blue-500/40';
    case 'needs_gl_correction_draft':
      return 'bg-amber-500/15 text-amber-200 border-amber-500/40';
    case 'audit_only':
      return 'bg-slate-500/15 text-slate-300 border-slate-500/40';
    case 'blocked_unsafe':
      return 'bg-red-500/15 text-red-200 border-red-500/40';
    default:
      return 'bg-gray-500/15 text-gray-300 border-gray-600';
  }
}

function riskBadgeClass(level: string): string {
  if (level === 'critical' || level === 'high') return 'bg-red-900/40 text-red-300 border-red-800';
  if (level === 'medium') return 'bg-amber-900/40 text-amber-300 border-amber-800';
  return 'bg-emerald-900/40 text-emerald-300 border-emerald-800';
}

export interface ActionableRepairCardProps {
  classification: ActionableRepairClassification;
  readOnly?: boolean;
  compact?: boolean;
  onAction: (button: ActionableRepairButton, classification: ActionableRepairClassification) => void;
}

export function ActionableRepairStatusBadge({ status }: { status: ActionableRepairClassification['status'] }) {
  return (
    <Badge variant="outline" className={`text-[10px] ${statusBadgeClass(status)}`}>
      {actionableRepairStatusLabel(status)}
    </Badge>
  );
}

export function ActionableRepairCard({ classification: c, readOnly, compact, onAction }: ActionableRepairCardProps) {
  const btnLabel = actionableRepairButtonLabel(c.primaryButton);
  const disabled =
    readOnly ||
    c.primaryButton === 'blocked_explain' ||
    (c.primaryButton !== 'mark_reviewed' && c.primaryButton !== 'view_audit' && !c.canApply && c.status !== 'needs_gl_correction_draft');

  if (compact) {
    return (
      <div className="flex flex-col gap-1 min-w-[140px]">
        <ActionableRepairStatusBadge status={c.status} />
        <span className="text-[10px] text-gray-500 line-clamp-2" title={c.issueType}>
          {c.issueType}
        </span>
        {c.effectiveImpact ? (
          <span className="text-[10px] text-cyan-400/80 line-clamp-1" title={c.effectiveImpact}>
            Eff: {c.effectiveImpact}
          </span>
        ) : null}
        {c.auditImpact ? (
          <span className="text-[10px] text-gray-600 line-clamp-1" title={c.auditImpact}>
            Audit: {c.auditImpact}
          </span>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-[11px] border-gray-600"
          disabled={disabled && c.status !== 'needs_gl_correction_draft'}
          onClick={() => onAction(c.primaryButton, c)}
        >
          {btnLabel}
        </Button>
        {c.blockReason ? (
          <span className="text-[10px] text-amber-400/90 line-clamp-2" title={c.blockReason}>
            {c.blockReason}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-3 space-y-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-gray-200">{c.issueType}</span>
        <ActionableRepairStatusBadge status={c.status} />
        <Badge variant="outline" className={riskBadgeClass(c.riskLevel)}>
          {c.riskLevel} risk
        </Badge>
        <Badge variant="outline" className="border-gray-700 text-gray-400">
          {c.canApply ? 'Can apply' : 'Apply blocked'}
        </Badge>
      </div>

      <DetailRow label="Why detected" value={c.whyDetected} />
      <DetailRow label="Recommended" value={c.recommendedAction} />
      <DetailRow
        label="Will change"
        value={
          c.whatWillChange.length ? (
            <ul className="list-disc ml-4 space-y-0.5">
              {c.whatWillChange.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          ) : (
            <span className="text-gray-500">Nothing (view/mark only)</span>
          )
        }
      />
      <DetailRow
        label="Never changes"
        value={
          <ul className="list-disc ml-4 space-y-0.5 text-gray-400">
            {c.whatWillNeverChange.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        }
      />

      {c.blockReason ? (
        <div className="flex gap-2 text-amber-300/90 bg-amber-950/30 border border-amber-800/40 rounded p-2">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{c.blockReason}</span>
        </div>
      ) : null}

      <div className="pt-1 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={c.status === 'needs_gl_correction_draft' ? 'default' : 'outline'}
          className="h-8"
          disabled={disabled && c.status !== 'needs_gl_correction_draft'}
          onClick={() => onAction(c.primaryButton, c)}
        >
          {btnLabel}
        </Button>
        {c.status === 'blocked_unsafe' && c.blockReason ? (
          <span className="text-[10px] text-gray-500 self-center flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Review before any action
          </span>
        ) : null}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-2">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-300">{value}</span>
    </div>
  );
}
