import { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, Plus, BookOpen, Loader2, RefreshCw, ChevronRight } from 'lucide-react';
import * as accountsApi from '../../api/accounts';
import { ensureDefaultAccounts } from '../../api/defaultAccounts';
import {
  buildOperationalCoaDisplayRows,
  filterCoaRowsByCollapse,
  getCoaParentIdsWithChildren,
} from '../../lib/coaTreeRows';

interface ChartOfAccountsViewProps {
  onBack: () => void;
  onAddAccount: () => void;
  companyId: string | null;
  reportRefreshEpoch?: number;
}

export function ChartOfAccountsView({ onBack, onAddAccount, companyId, reportRefreshEpoch = 0 }: ChartOfAccountsViewProps) {
  const [accounts, setAccounts] = useState<accountsApi.AccountRow[]>([]);
  const [loading, setLoading] = useState(!!companyId);
  const [collapsedParentIds, setCollapsedParentIds] = useState<Set<string>>(() => new Set());

  const load = useCallback(async () => {
    if (!companyId) {
      setAccounts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    await ensureDefaultAccounts(companyId);
    const { data, error } = await accountsApi.getAccounts(companyId);
    setLoading(false);
    setAccounts(error ? [] : data);
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load, reportRefreshEpoch]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [load]);

  const displayRows = useMemo(() => buildOperationalCoaDisplayRows(accounts), [accounts]);

  const parentIdsWithChildren = useMemo(
    () => getCoaParentIdsWithChildren(displayRows, accounts),
    [displayRows, accounts]
  );

  const parentCollapseKey = useMemo(
    () => [...parentIdsWithChildren].sort().join(','),
    [parentIdsWithChildren]
  );

  useEffect(() => {
    setCollapsedParentIds(new Set(parentIdsWithChildren));
  }, [parentCollapseKey]);

  const visibleRows = useMemo(
    () => filterCoaRowsByCollapse(displayRows, collapsedParentIds, accounts),
    [displayRows, collapsedParentIds, accounts]
  );

  const toggleCollapse = (accountId: string) => {
    setCollapsedParentIds((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  };

  return (
    <div className="min-h-screen pb-24 bg-[#111827]">
      <div className="bg-gradient-to-br from-[#F59E0B] to-[#D97706] p-4 sticky top-0 z-10 flow-screen-header">
        <div className="flex items-center justify-between gap-3">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-white">Chart of Accounts</h1>
            <p className="text-xs text-white/80">Operational COA · tap chevron to expand</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading || !companyId}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white disabled:opacity-40"
              title="Refresh balances"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onAddAccount}
              className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-white flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              <span className="text-sm font-medium hidden sm:inline">Add</span>
            </button>
          </div>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#F59E0B] animate-spin" />
          </div>
        ) : displayRows.length === 0 ? (
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-8 text-center">
            <BookOpen className="w-12 h-12 text-[#6B7280] mx-auto mb-3" />
            <p className="text-[#9CA3AF] mb-4">No accounts yet. Add your first account.</p>
            <button
              onClick={onAddAccount}
              className="px-4 py-2 bg-[#F59E0B] hover:bg-[#D97706] text-white rounded-lg font-medium inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Account
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleRows.map(({ account: acc, depth }) => {
              const hasChildren = parentIdsWithChildren.has(acc.id);
              const isCollapsed = collapsedParentIds.has(acc.id);
              return (
                <div
                  key={acc.id}
                  className={`bg-[#1F2937] border border-[#374151] rounded-xl p-4 flex items-center justify-between ${
                    acc.isGroup ? 'opacity-90' : ''
                  }`}
                  style={{ marginLeft: depth > 0 ? `${Math.min(depth, 6) * 12}px` : undefined }}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {hasChildren ? (
                      <button
                        type="button"
                        onClick={() => toggleCollapse(acc.id)}
                        className="shrink-0 p-0.5 text-[#9CA3AF] hover:text-white"
                        aria-label={isCollapsed ? 'Expand sub-accounts' : 'Collapse sub-accounts'}
                      >
                        <ChevronRight
                          className={`w-5 h-5 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                        />
                      </button>
                    ) : (
                      <span className="w-6 shrink-0" aria-hidden />
                    )}
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                        acc.isGroup ? 'bg-[#374151]/60' : 'bg-[#F59E0B]/20'
                      }`}
                    >
                      <BookOpen className={`w-5 h-5 ${acc.isGroup ? 'text-[#9CA3AF]' : 'text-[#F59E0B]'}`} />
                    </div>
                    <div className="min-w-0">
                      <p className={`font-medium truncate ${acc.isGroup ? 'text-[#9CA3AF] text-sm' : 'text-white'}`}>
                        {acc.name}
                      </p>
                      <p className="text-xs text-[#9CA3AF]">
                        {acc.code || '—'} · {acc.type}
                        {acc.isGroup ? ' · group' : ''}
                      </p>
                    </div>
                  </div>
                  {!acc.isGroup ? (
                    <p className="text-sm font-semibold text-white shrink-0 ml-2">
                      Rs. {(acc.balance || 0).toLocaleString()}
                    </p>
                  ) : null}
                </div>
              );
            })}
            <button
              onClick={onAddAccount}
              className="w-full py-3 border border-dashed border-[#374151] rounded-xl text-[#9CA3AF] hover:border-[#F59E0B] hover:text-[#F59E0B] transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Account
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
