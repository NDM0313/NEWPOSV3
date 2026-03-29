'use client';

import { Loader2, Users, X } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { cn } from '@/app/components/ui/utils';
import type { PartyGlRow } from '@/app/services/controlAccountBreakdownService';

export type ChartOfAccountsPartyDropdownProps = {
  formatCurrency: (n: number) => string;
  onCollapse: () => void;
  /** Control-account party list from GL resolver */
  loading?: boolean;
  error?: string | null;
  partyRows?: PartyGlRow[];
  partySectionNote?: string;
  /** e.g. AR / AP / Worker */
  scopeLabel?: string;
  /** Sub-account linked to one contact — no async list */
  linkedContactName?: string | null;
  linkedContactPartyType?: string | null;
};

function kindBadge(kind: PartyGlRow['kind']) {
  if (kind === 'ar') return { label: 'AR', className: 'border-amber-500/35 bg-amber-500/15 text-amber-200' };
  if (kind === 'ap') return { label: 'AP', className: 'border-rose-500/35 bg-rose-500/15 text-rose-200' };
  return { label: 'Worker', className: 'border-violet-500/35 bg-violet-500/15 text-violet-200' };
}

export function ChartOfAccountsPartyDropdown({
  formatCurrency,
  onCollapse,
  loading,
  error,
  partyRows = [],
  partySectionNote,
  scopeLabel,
  linkedContactName,
  linkedContactPartyType,
}: ChartOfAccountsPartyDropdownProps) {
  const isLinkedOnly = Boolean(linkedContactName) && !scopeLabel;

  return (
    <div
      className={cn(
        'border-t border-gray-800 bg-gray-950/90',
        'px-3 py-3 sm:px-4 sm:py-3.5',
        'animate-in slide-in-from-top-1 duration-150'
      )}
      role="region"
      aria-label="Linked parties for this account"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-800/90 border border-gray-700/80">
            <Users className="h-4 w-4 text-gray-300" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              {isLinkedOnly ? 'Linked party' : `Related parties · ${scopeLabel || 'GL'}`}
            </p>
            {isLinkedOnly ? (
              <p className="text-sm text-white font-medium truncate mt-0.5">{linkedContactName}</p>
            ) : null}
            {isLinkedOnly && linkedContactPartyType ? (
              <Badge variant="outline" className="mt-1 border-violet-500/35 bg-violet-500/10 text-[10px] text-violet-200">
                {linkedContactPartyType}
              </Badge>
            ) : null}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 text-gray-400 hover:text-white hover:bg-gray-800 gap-1.5 px-2"
          onClick={onCollapse}
        >
          <X className="h-3.5 w-3.5" />
          <span className="text-xs">Hide</span>
        </Button>
      </div>

      {!isLinkedOnly && loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
          Loading linked parties…
        </div>
      ) : null}

      {!isLinkedOnly && error ? (
        <p className="text-sm text-red-400/90 py-2">{error}</p>
      ) : null}

      {!isLinkedOnly && partySectionNote && !loading ? (
        <p className="text-[11px] text-amber-200/80 bg-amber-500/10 border border-amber-500/20 rounded-md px-2.5 py-1.5 mb-2">
          {partySectionNote}
        </p>
      ) : null}

      {!isLinkedOnly && !loading && !error && partyRows.length === 0 ? (
        <p className="text-sm text-gray-500 py-2">No non-zero party balances on this control for the current scope.</p>
      ) : null}

      {!isLinkedOnly && !loading && partyRows.length > 0 ? (
        <ul className="rounded-lg border border-gray-800/90 bg-gray-900/50 divide-y divide-gray-800/80 max-h-[min(320px,50vh)] overflow-y-auto">
          {partyRows.map((r) => {
            const b = kindBadge(r.kind);
            return (
              <li
                key={r.contactId}
                className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-gray-800/30 transition-colors"
              >
                <div className="min-w-0 flex items-center gap-2">
                  <Badge variant="outline" className={cn('text-[9px] shrink-0', b.className)}>
                    {b.label}
                  </Badge>
                  <span className="text-sm text-gray-100 truncate">{r.name}</span>
                </div>
                <span
                  className={cn(
                    'text-sm font-semibold tabular-nums shrink-0',
                    r.glAmount >= 0 ? 'text-emerald-400' : 'text-red-400'
                  )}
                >
                  {formatCurrency(r.glAmount)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
