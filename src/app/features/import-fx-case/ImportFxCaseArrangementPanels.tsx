/**
 * Presentational cards for Import FX W2 ARRANGEMENT (no data fetching).
 */

import React from 'react';
import { cn } from '@/app/components/ui/utils';
import {
  W2_ACCOUNTING_NOT_POSTED_LABEL,
  W2_PLANNING_ONLY_NOTICE,
  formatAccountingStatusLabel,
  formatArrangementStatusLabel,
  formatLastUpdated,
  formatPlannedCurrencyPair,
} from '@/app/lib/importFxCaseWorkspaceView';

export function ArrangementSectionCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-muted/40 border border-border rounded-xl p-4 space-y-3 min-w-0">
      <div>
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        {hint ? <p className="text-xs text-muted-foreground mt-0.5">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function ImportFxCaseHeaderBar({
  caseNo,
  operationalStatus,
  accountingStatus,
  agentName,
  sourceCurrency,
  settlementCurrency,
  updatedAt,
  confirmedAt,
  readOnly,
}: {
  caseNo: string | null;
  operationalStatus: string | null;
  accountingStatus: string | null;
  agentName: string | null;
  sourceCurrency: string | null;
  settlementCurrency: string | null;
  updatedAt: string | null;
  confirmedAt: string | null;
  readOnly: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3 sm:p-4 space-y-3 min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Case number</p>
          <p className="text-base font-semibold text-foreground truncate">{caseNo || 'New draft'}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {readOnly && (
            <span className="inline-flex items-center rounded-full border border-amber-600/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:text-amber-100">
              Read only
            </span>
          )}
          <span className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium">
            {formatArrangementStatusLabel(operationalStatus)}
          </span>
          <span className="inline-flex items-center rounded-full border border-emerald-600/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:text-emerald-200">
            Accounting: {formatAccountingStatusLabel(accountingStatus) || W2_ACCOUNTING_NOT_POSTED_LABEL}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 text-sm min-w-0">
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">Agent</p>
          <p className="truncate text-foreground">{agentName || '—'}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">Planned source → settlement</p>
          <p className="truncate text-foreground">
            {formatPlannedCurrencyPair(sourceCurrency, settlementCurrency)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">Last updated</p>
          <p className="truncate text-foreground">{formatLastUpdated(updatedAt)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">Arrangement confirmed</p>
          <p className="truncate text-foreground">{confirmedAt ? formatLastUpdated(confirmedAt) : 'Not yet'}</p>
        </div>
      </div>
      <div className="rounded-lg border border-sky-600/30 bg-sky-500/10 px-3 py-2 text-sm text-sky-950 dark:text-sky-100">
        {W2_PLANNING_ONLY_NOTICE}
      </div>
    </div>
  );
}
