import React from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Package,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/app/components/ui/badge';
import { cn } from '@/app/components/ui/utils';
import type { DashboardV2Alert } from '@/app/lib/dashboardV2Mappers';

interface Props {
  alerts: DashboardV2Alert[];
  onNavigate?: (view: string) => void;
}

const severityConfig: Record<
  DashboardV2Alert['severity'],
  { label: string; bg: string; text: string; border: string; accent: string }
> = {
  info: {
    label: 'Info',
    bg: 'bg-blue-500/20',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    accent: 'bg-blue-500/10',
  },
  warning: {
    label: 'Warning',
    bg: 'bg-amber-500/20',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    accent: 'bg-amber-500/10',
  },
  critical: {
    label: 'Critical',
    bg: 'bg-red-500/20',
    text: 'text-red-400',
    border: 'border-red-500/30',
    accent: 'bg-red-500/10',
  },
};

function alertIcon(kind: DashboardV2Alert['kind']): React.ElementType {
  switch (kind) {
    case 'low_stock':
    case 'out_of_stock':
    case 'negative_stock':
      return Package;
    case 'rental_due':
    case 'rental_overdue':
      return Calendar;
    case 'negative_cash':
      return Wallet;
    case 'negative_bank':
      return Building2;
    case 'receivables':
      return ArrowUpRight;
    case 'payables':
      return ArrowDownRight;
    default:
      return AlertTriangle;
  }
}

function previewColumnLabel(kind: DashboardV2Alert['kind']): string {
  switch (kind) {
    case 'rental_due':
    case 'rental_overdue':
      return 'Booking';
    case 'negative_cash':
    case 'negative_bank':
    case 'receivables':
    case 'payables':
      return 'Item';
    default:
      return 'Product';
  }
}

function previewDetailLabel(kind: DashboardV2Alert['kind']): string {
  switch (kind) {
    case 'rental_due':
    case 'rental_overdue':
      return 'Detail';
    default:
      return 'Qty';
  }
}

function SeverityBadge({ severity }: { severity: DashboardV2Alert['severity'] }) {
  const cfg = severityConfig[severity];
  return (
    <Badge className={cn('text-[10px] font-medium uppercase tracking-wide border', cfg.bg, cfg.text, cfg.border)}>
      {cfg.label}
    </Badge>
  );
}

function AlertCard({
  alert,
  onNavigate,
}: {
  alert: DashboardV2Alert;
  onNavigate?: (view: string) => void;
}) {
  const cfg = severityConfig[alert.severity];
  const Icon = alertIcon(alert.kind);
  const previewRows = alert.previewRows ?? [];
  const hiddenCount = Math.max(0, alert.count - previewRows.length);

  return (
    <div className="rounded-xl border border-[#374151] bg-[#1F2937] flex flex-col min-w-0 overflow-hidden">
      <div className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 min-w-0">
            <div className={cn('p-2 rounded-lg shrink-0', cfg.accent)}>
              <Icon className={cn('w-4 h-4', cfg.text)} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-white font-medium text-sm">{alert.title}</h4>
                <span className="text-xs font-semibold text-[#9CA3AF] tabular-nums">{alert.count}</span>
              </div>
              <p className="text-[#9CA3AF] text-xs mt-0.5">{alert.message}</p>
            </div>
          </div>
          <SeverityBadge severity={alert.severity} />
        </div>

        {previewRows.length ? (
          <div className="rounded-lg border border-[#374151]/80 bg-[#111827]/60 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#6B7280] border-b border-[#374151]/80">
                  <th className="px-3 py-1.5 text-left font-medium">{previewColumnLabel(alert.kind)}</th>
                  <th className="px-3 py-1.5 text-right font-medium">{previewDetailLabel(alert.kind)}</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i} className="border-b border-[#374151]/40 last:border-0">
                    <td className="px-3 py-1.5 text-white truncate max-w-[140px]">{row.label}</td>
                    <td className="px-3 py-1.5 text-right text-[#9CA3AF] tabular-nums shrink-0">{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {hiddenCount > 0 ? (
              <p className="px-3 py-1.5 text-[10px] text-[#6B7280] border-t border-[#374151]/80">
                +{hiddenCount} more
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {alert.viewTarget && onNavigate ? (
        <div className="px-4 py-2 border-t border-[#374151] bg-[#111827]/40">
          <button
            type="button"
            onClick={() => onNavigate(alert.viewTarget!)}
            className="inline-flex items-center text-xs text-[#3B82F6] hover:text-blue-300 font-medium"
          >
            View
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

export const ActionRequiredPanel: React.FC<Props> = ({ alerts, onNavigate }) => {
  if (!alerts.length) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-emerald-500/10 shrink-0">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        </div>
        <p className="text-emerald-200/90 text-sm">
          No action required — all clear for stock, rentals, and liquidity alerts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <h3 className="text-white font-semibold">Action Required</h3>
        </div>
        <span className="text-xs font-medium px-2 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/30">
          {alerts.length} alert{alerts.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {alerts.map((alert) => (
          <AlertCard key={alert.id} alert={alert} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
};
