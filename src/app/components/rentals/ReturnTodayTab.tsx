import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CornerDownLeft, Package, Loader2, ShoppingBag, Calendar, User, Search, Download, MapPin, Phone,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import type { RentalUI } from '@/app/context/RentalContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { rentalService } from '@/app/services/rentalService';
import { formatLongDate } from '../ui/utils';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { AdaptiveCurrencyValue } from '@/app/components/shared/AdaptiveCurrencyValue';
import {
  downloadCsv,
  daysOverdue,
  getRentalDueAmount,
  matchesRentalSearch,
  todayIso,
} from '@/app/lib/rentalQueueUtils';
import { toast } from 'sonner';

interface ReturnTodayTabProps {
  onProcessReturn: (rental: RentalUI) => void;
  refreshKey?: number;
  activeCount?: number;
  onViewAllRentals?: () => void;
}

export const ReturnTodayTab = ({ onProcessReturn, refreshKey = 0, activeCount = 0, onViewAllRentals }: ReturnTodayTabProps) => {
  const { companyId, branchId } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const today = todayIso();

  const [returns, setReturns] = useState<RentalUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState<string>(branchId && branchId !== 'all' ? branchId : 'all');

  const effectiveBranch = branchFilter === 'all' ? undefined : branchFilter;

  const loadReturns = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const rows = await rentalService.getReturnsDue(companyId, effectiveBranch, today);
      setReturns(rows);
    } catch (e) {
      console.error('[ReturnTodayTab]', e);
      toast.error('Failed to load return queue');
      setReturns([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, effectiveBranch, today]);

  useEffect(() => {
    void loadReturns();
  }, [loadReturns, refreshKey]);

  useEffect(() => {
    if (branchId && branchId !== 'all') setBranchFilter(branchId);
  }, [branchId]);

  const branchOptions = useMemo(() => {
    const map = new Map<string, string>();
    returns.forEach((r) => {
      if (r.branchId) map.set(r.branchId, r.location || r.branchId);
    });
    return [...map.entries()];
  }, [returns]);

  const filtered = useMemo(
    () =>
      returns
        .filter((r) => matchesRentalSearch(r, search))
        .sort((a, b) => (a.expectedReturnDate < b.expectedReturnDate ? -1 : 1)),
    [returns, search]
  );

  const kpis = useMemo(() => {
    const dueToday = filtered.filter((r) => r.expectedReturnDate === today).length;
    const overdue = filtered.filter((r) => r.expectedReturnDate < today || r.status === 'overdue').length;
    const totalBalance = filtered.reduce((s, r) => s + getRentalDueAmount(r), 0);
    return { dueToday, overdue, totalBalance, total: filtered.length };
  }, [filtered, today]);

  const exportCsv = () => {
    downloadCsv(
      `returns-due-${today}.csv`,
      ['Rental No', 'Customer', 'Branch', 'Return Due', 'Days Overdue', 'Status', 'Balance Due', 'Items'],
      filtered.map((r) => {
        const od = daysOverdue(r.expectedReturnDate, today);
        return [
          r.rentalNo,
          r.customerName,
          r.location,
          r.expectedReturnDate,
          String(od),
          r.status,
          String(getRentalDueAmount(r)),
          (r.items || []).map((i) => i.productName).join('; '),
        ];
      })
    );
  };

  const hasFilters = search.trim() !== '';
  const isEmpty = filtered.length === 0;

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      <div className="shrink-0 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <CornerDownLeft size={20} className="text-[var(--erp-money-positive)]" />
              Return Today
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Rentals due or overdue for return ({filtered.length})
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Operational queue as of today — not affected by header date range.
            </p>
          </div>
          <Button variant="outline" size="sm" className="border-border text-muted-foreground" onClick={exportCsv} disabled={isEmpty}>
            <Download size={16} className="mr-1.5" />
            Export CSV
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <div className="rounded-lg border border-border bg-muted/50 px-4 py-2">
            <span className="text-xs text-muted-foreground uppercase">In Queue</span>
            <p className="text-xl font-bold text-foreground">{kpis.total}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/50 px-4 py-2">
            <span className="text-xs text-muted-foreground uppercase">Due Today</span>
            <p className="text-xl font-bold text-[var(--erp-money-positive)]">{kpis.dueToday}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/50 px-4 py-2">
            <span className="text-xs text-muted-foreground uppercase">Overdue</span>
            <p className="text-xl font-bold text-red-400">{kpis.overdue}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/50 px-4 py-2 min-w-0">
            <span className="text-xs text-muted-foreground uppercase">Balance Outstanding</span>
            <AdaptiveCurrencyValue value={kpis.totalBalance} className="text-xl font-bold text-amber-400" as="p" />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search rental no, customer, product…"
              className="pl-9 bg-card border-border text-sm"
            />
          </div>
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-[180px] bg-card border-border text-sm h-9">
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">All branches</SelectItem>
              {branchOptions.map(([id, label]) => (
                <SelectItem key={id} value={id}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={40} className="text-pink-500 animate-spin" />
        </div>
      ) : isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
          <ShoppingBag size={64} className="mb-4 opacity-50" />
          <p className="text-lg font-medium">{hasFilters ? 'No returns match filters' : 'No returns due today'}</p>
          <p className="text-sm mt-1 text-center max-w-md">
            {hasFilters
              ? 'Try clearing search or branch filter.'
              : activeCount > 0
                ? `${activeCount} active rental${activeCount === 1 ? '' : 's'} — none due for return today`
                : 'All rentals due or overdue are already processed'}
          </p>
          {!hasFilters && activeCount > 0 && onViewAllRentals && (
            <Button variant="outline" size="sm" className="mt-4 border-border text-muted-foreground" onClick={onViewAllRentals}>
              View all rentals
            </Button>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-4">
          {filtered.map((r) => {
            const od = daysOverdue(r.expectedReturnDate, today);
            return (
              <div
                key={r.id}
                className="bg-card border border-border rounded-xl p-4 hover:border-border transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center shrink-0">
                      <Package size={24} className="text-[var(--erp-money-positive)]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-mono text-[var(--erp-money-positive)] font-semibold">{r.rentalNo}</p>
                        <Badge
                          className={
                            r.status === 'overdue' || od > 0
                              ? 'bg-red-500/20 text-red-400 border-red-500/30'
                              : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                          }
                        >
                          {od > 0 ? `${od}d overdue` : r.status === 'overdue' ? 'Overdue' : 'Rented'}
                        </Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <User size={14} className="text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">Customer:</span>
                          <span className="text-foreground font-medium truncate">{r.customerName}</span>
                        </div>
                        {r.customerContact && (
                          <div className="flex items-center gap-2">
                            <Phone size={14} className="text-muted-foreground shrink-0" />
                            <span className="text-foreground truncate">{r.customerContact}</span>
                          </div>
                        )}
                        {r.location && (
                          <div className="flex items-center gap-2">
                            <MapPin size={14} className="text-muted-foreground shrink-0" />
                            <span className="text-foreground truncate">{r.location}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Package size={14} className="text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">Items:</span>
                          <span className="text-foreground truncate">
                            {r.items?.map((i) => `${i.productName}${i.quantity > 1 ? ` ×${i.quantity}` : ''}`).join(', ') || '—'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">Pickup:</span>
                          <span className="text-foreground">{formatLongDate(r.startDate)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">Return due:</span>
                          <span className="text-foreground font-medium">{formatLongDate(r.expectedReturnDate)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Balance due:</span>
                          <span className={getRentalDueAmount(r) > 0 ? 'text-red-400 font-semibold' : 'text-muted-foreground'}>
                            {formatCurrency(getRentalDueAmount(r))}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <Button
                      size="lg"
                      className="bg-green-600 hover:bg-green-500 text-foreground font-semibold shadow-lg shadow-green-600/20"
                      onClick={() => onProcessReturn(r)}
                    >
                      <CornerDownLeft size={18} className="mr-2" />
                      Process Return
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
