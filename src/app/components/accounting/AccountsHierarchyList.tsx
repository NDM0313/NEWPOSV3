import React from 'react';
import {
  Briefcase,
  Building2,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Landmark,
  type LucideIcon,
  PiggyBank,
  Shield,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/app/components/ui/badge';
import { cn } from '@/app/components/ui/utils';
import { getControlAccountKind } from '@/app/lib/accountControlKind';
import type { AccountsHierarchyRowModel } from './useAccountsHierarchyModel';

export type { AccountsHierarchyRowModel };

function accountRowVisual(account: {
  name?: string;
  type?: string;
  accountType?: string;
  code?: string;
}): { Icon: LucideIcon; boxClass: string } {
  const code = String(account.code || '').trim();
  const t = String(account.type || account.accountType || '').toLowerCase();
  const n = (account.name || '').toLowerCase();

  if (code === '2000' || n.includes('accounts payable') || t === 'payable')
    return { Icon: Shield, boxClass: 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/25' };
  if (code === '1100' || n.includes('receivable'))
    return { Icon: PiggyBank, boxClass: 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/25' };
  if (code === '1010' || t.includes('bank') || n.includes('bank'))
    return { Icon: Landmark, boxClass: 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/25' };
  if (code === '1020' || t.includes('wallet') || n.includes('wallet'))
    return { Icon: CreditCard, boxClass: 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/25' };
  if (code === '1000' || t.includes('cash') || n.includes('cash'))
    return { Icon: Wallet, boxClass: 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/25' };
  if (t.includes('expense') || n.includes('expense'))
    return { Icon: TrendingDown, boxClass: 'bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/20' };
  if (t.includes('revenue') || t.includes('income') || n.includes('income') || n.includes('revenue'))
    return { Icon: TrendingUp, boxClass: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/20' };
  if (t.includes('liabilit') || n.includes('liabilit'))
    return { Icon: Shield, boxClass: 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/25' };
  if (t.includes('asset') || n.includes('asset'))
    return { Icon: Briefcase, boxClass: 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/25' };

  return { Icon: Building2, boxClass: 'bg-gray-700/80 text-gray-300 ring-1 ring-gray-600/50' };
}

export type AccountsHierarchyListProps = {
  rows: AccountsHierarchyRowModel[];
  accountsViewMode: 'operational' | 'professional';
  formatCurrency: (n: number) => string;
  emptyState?: React.ReactNode;
  /** Optional: fake trend % for demos (e.g. test page). If unset, uses row.trendPct. */
  trendPctForRow?: (row: AccountsHierarchyRowModel) => number | null;
  renderRowMenu: (row: AccountsHierarchyRowModel) => React.ReactNode;
  /** Extra inline action (e.g. control breakdown chevron) */
  renderRowInlineExtra?: (row: AccountsHierarchyRowModel) => React.ReactNode;
};

export function AccountsHierarchyList({
  rows,
  accountsViewMode,
  formatCurrency,
  emptyState,
  trendPctForRow,
  renderRowMenu,
  renderRowInlineExtra,
}: AccountsHierarchyListProps) {
  if (rows.length === 0) {
    return <>{emptyState ?? null}</>;
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/40 overflow-hidden">
      <div
        className={cn(
          'hidden sm:grid gap-3 px-4 py-2.5 border-b border-gray-800 bg-gray-900/80 text-[10px] font-semibold uppercase tracking-wider text-gray-500',
          accountsViewMode === 'professional'
            ? 'sm:grid-cols-[minmax(0,1fr)_minmax(0,64px)_minmax(0,88px)_minmax(0,72px)_minmax(0,200px)]'
            : 'sm:grid-cols-[minmax(0,1fr)_minmax(0,88px)_minmax(0,72px)_minmax(0,200px)]'
        )}
      >
        <span>Account</span>
        {accountsViewMode === 'professional' ? <span className="text-left">Code</span> : null}
        <span className="text-left">Type</span>
        <span className="text-left">Status</span>
        <span className="text-right pr-11">Balance · GL</span>
      </div>

      <div className="divide-y divide-gray-800/90">
        {rows.map((row) => {
          const {
            account,
            depth,
            hasChildRows,
            isCollapsed,
            displayBalance,
            entryCount,
            onToggleCollapse,
            sectionHeader,
            coaPrimaryLabel,
            coaPartyRoleLabel,
            coaDetailLine,
          } = row;
          const controlKind = getControlAccountKind({ name: account.name, code: account.code });
          const visual = accountRowVisual(account);
          const { Icon } = visual;
          const iconLg = depth === 0;
          const trend =
            trendPctForRow?.(row) ?? row.trendPct ?? null;
          const subtitleParts = [
            coaDetailLine,
            accountsViewMode === 'operational' ? account.type || account.accountType || 'Account' : null,
            entryCount > 0 ? `${entryCount} entries` : null,
          ].filter(Boolean);
          const balPositive = displayBalance >= 0;

          return (
            <div key={account.id}>
              {sectionHeader ? (
                <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500 bg-gray-950/60 border-b border-gray-800/80">
                  {sectionHeader}
                </div>
              ) : null}
              <div
                className={cn(
                  'group px-3 py-3 sm:px-4 hover:bg-gray-800/25 transition-colors',
                  'flex flex-col gap-3 sm:grid sm:items-center sm:gap-3',
                  accountsViewMode === 'professional'
                    ? 'sm:grid-cols-[minmax(0,1fr)_minmax(0,64px)_minmax(0,88px)_minmax(0,72px)_minmax(0,200px)]'
                    : 'sm:grid-cols-[minmax(0,1fr)_minmax(0,88px)_minmax(0,72px)_minmax(0,200px)]'
                )}
              >
              <div className="flex min-w-0 items-start gap-2">
                <div
                  className="flex shrink-0 items-center gap-1.5"
                  style={{ paddingLeft: depth > 0 ? Math.min(depth * 14, 56) : 0 }}
                >
                  {hasChildRows ? (
                    <button
                      type="button"
                      title={isCollapsed ? 'Expand sub-accounts' : 'Collapse sub-accounts'}
                      className="rounded p-0.5 text-gray-400 hover:bg-gray-800 hover:text-white shrink-0"
                      onClick={onToggleCollapse}
                    >
                      {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  ) : (
                    <span className="inline-block w-5 shrink-0" aria-hidden />
                  )}
                  <div
                    className={cn(
                      'flex shrink-0 items-center justify-center rounded-xl',
                      iconLg ? 'h-11 w-11 rounded-2xl' : 'h-9 w-9',
                      visual.boxClass
                    )}
                  >
                    <Icon className={iconLg ? 'h-5 w-5' : 'h-[18px] w-[18px]'} strokeWidth={1.75} />
                  </div>
                </div>

                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-white text-sm sm:text-[15px] leading-tight">{coaPrimaryLabel}</span>
                    {coaPartyRoleLabel ? (
                      <Badge className="border-violet-500/35 bg-violet-500/15 text-[10px] uppercase tracking-wide text-violet-200">
                        {coaPartyRoleLabel}
                      </Badge>
                    ) : null}
                    {accountsViewMode !== 'professional' && account.code ? (
                      <Badge variant="outline" className="border-gray-600 bg-gray-800/80 text-[10px] font-mono text-gray-300 px-1.5 py-0">
                        {account.code}
                      </Badge>
                    ) : null}
                    {controlKind ? (
                      <Badge className="border-blue-500/35 bg-blue-500/15 text-[10px] uppercase tracking-wide text-blue-200">
                        Control
                      </Badge>
                    ) : null}
                    {(account as { is_default_cash?: boolean }).is_default_cash && (
                      <Badge className="border-green-500/30 bg-green-500/15 text-[10px] text-green-300">Default Cash</Badge>
                    )}
                    {(account as { is_default_bank?: boolean }).is_default_bank && (
                      <Badge className="border-blue-500/30 bg-blue-500/15 text-[10px] text-blue-300">Default Bank</Badge>
                    )}
                    {renderRowInlineExtra?.(row)}
                  </div>
                  {coaDetailLine ? (
                    <p className="mt-0.5 text-[11px] text-gray-400 leading-snug">{coaDetailLine}</p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-gray-500 leading-snug sm:hidden">{subtitleParts.filter((p) => p !== coaDetailLine).join(' · ')}</p>
                </div>
              </div>

              {accountsViewMode === 'professional' ? (
                <div className="text-[11px] font-mono text-gray-400 sm:border-l border-gray-800/80 sm:pl-3 tabular-nums">
                  {account.code || '—'}
                </div>
              ) : null}

              <div className="flex flex-col justify-center text-xs text-gray-400 sm:border-l border-gray-800/80 sm:pl-3">
                <Badge className="w-fit border-gray-700 bg-gray-800/90 text-gray-300 text-[10px] max-w-full truncate">
                  {account.type || account.accountType || '—'}
                </Badge>
                {accountsViewMode === 'professional' ? (
                  <span className="mt-1 text-[10px] text-gray-500 hidden sm:inline">{account.branch ? 'Branch' : 'Global'}</span>
                ) : null}
              </div>

              <div className="flex flex-col justify-center sm:border-l border-gray-800/80 sm:pl-3">
                {account.isActive ? (
                  <Badge className="w-fit border-green-500/30 bg-green-500/10 text-[10px] text-green-400">Active</Badge>
                ) : (
                  <Badge className="w-fit border-gray-500/30 bg-gray-500/10 text-[10px] text-gray-400">Inactive</Badge>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 sm:border-l border-gray-800/80 sm:pl-3">
                <div className="text-right flex-1 sm:flex-none min-w-0">
                  <div
                    className={cn(
                      'text-sm font-semibold tabular-nums',
                      balPositive ? 'text-emerald-400' : 'text-red-400'
                    )}
                  >
                    {formatCurrency(displayBalance)}
                  </div>
                  {hasChildRows && (
                    <span className="mt-0.5 block text-[9px] font-normal text-gray-500">
                      {account.balance !== displayBalance
                        ? `rollup · leaf ${formatCurrency(account.balance)}`
                        : 'incl. sub-accounts'}
                    </span>
                  )}
                  <div className="mt-1 flex items-center justify-end gap-1 text-[11px] tabular-nums">
                    {trend != null ? (
                      <>
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-400/90" />
                        <span className="text-emerald-400/90">{trend.toFixed(1)}%</span>
                      </>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </div>
                </div>
                <div className="shrink-0">{renderRowMenu(row)}</div>
              </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
