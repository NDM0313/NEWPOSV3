import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Truck, Package, Loader2, ShoppingBag, Search, Download, MapPin, Phone, AlertTriangle } from 'lucide-react';
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
import { downloadCsv, getRentalDueAmount, matchesRentalSearch, todayIso } from '@/app/lib/rentalQueueUtils';
import { toast } from 'sonner';

interface PickupTodayTabProps {
  onProcessPickup: (rental: RentalUI) => void;
  refreshKey?: number;
  activeCount?: number;
  onViewAllRentals?: () => void;
}

export const PickupTodayTab = ({ onProcessPickup, refreshKey = 0, activeCount = 0, onViewAllRentals }: PickupTodayTabProps) => {
  const { companyId, branchId } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const today = todayIso();

  const [pickups, setPickups] = useState<RentalUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState<string>(branchId && branchId !== 'all' ? branchId : 'all');

  const effectiveBranch = branchFilter === 'all' ? undefined : branchFilter;

  const loadPickups = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const rows = await rentalService.getPickupsDue(companyId, effectiveBranch, { asOfDate: today });
      setPickups(rows);
    } catch (e) {
      console.error('[PickupTodayTab]', e);
      toast.error('Failed to load pickup queue');
      setPickups([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, effectiveBranch, today]);

  useEffect(() => {
    void loadPickups();
  }, [loadPickups, refreshKey]);

  useEffect(() => {
    if (branchId && branchId !== 'all') setBranchFilter(branchId);
  }, [branchId]);

  const branchOptions = useMemo(() => {
    const map = new Map<string, string>();
    pickups.forEach((r) => {
      if (r.branchId) map.set(r.branchId, r.location || r.branchId);
    });
    return [...map.entries()];
  }, [pickups]);

  const filtered = useMemo(
    () => pickups.filter((r) => matchesRentalSearch(r, search)),
    [pickups, search]
  );

  const dueToday = useMemo(() => filtered.filter((r) => r.startDate === today), [filtered, today]);
  const missed = useMemo(() => filtered.filter((r) => r.startDate < today), [filtered, today]);

  const kpis = useMemo(() => {
    const totalBalance = filtered.reduce((s, r) => s + getRentalDueAmount(r), 0);
    return {
      dueToday: dueToday.length,
      missed: missed.length,
      totalBalance,
    };
  }, [filtered, dueToday.length, missed.length]);

  const exportCsv = () => {
    downloadCsv(
      `pickups-due-${today}.csv`,
      ['Rental No', 'Customer', 'Phone', 'Branch', 'Pickup Date', 'Status', 'Items', 'Balance Due'],
      filtered.map((r) => [
        r.rentalNo,
        r.customerName,
        r.customerContact || '',
        r.location,
        r.startDate,
        r.startDate < today ? 'Missed' : 'Due Today',
        (r.items || []).map((i) => i.productName).join('; '),
        String(getRentalDueAmount(r)),
      ])
    );
  };

  const renderCard = (r: RentalUI, isMissed: boolean) => (
    <div
      key={r.id}
      className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-gray-700 transition-colors"
    >
      <div className="flex items-start gap-4 min-w-0 flex-1">
        <div className="w-12 h-12 rounded-xl bg-pink-500/20 flex items-center justify-center shrink-0">
          <Package size={24} className="text-pink-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-mono text-pink-400 font-semibold">{r.rentalNo}</p>
            <Badge className={isMissed ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-pink-500/20 text-pink-400 border-pink-500/30'}>
              {isMissed ? 'Missed' : 'Due Today'}
            </Badge>
          </div>
          <p className="text-white font-medium mt-1">{r.customerName}</p>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm text-gray-400">
            {r.customerContact && (
              <span className="flex items-center gap-1 truncate">
                <Phone size={14} className="shrink-0" /> {r.customerContact}
              </span>
            )}
            {r.location && (
              <span className="flex items-center gap-1 truncate">
                <MapPin size={14} className="shrink-0" /> {r.location}
              </span>
            )}
            <span>Pickup: {formatLongDate(r.startDate)}</span>
            <span className={getRentalDueAmount(r) > 0 ? 'text-amber-400 font-medium' : ''}>
              Balance: {formatCurrency(getRentalDueAmount(r))}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-2 truncate">
            {(r.items || []).map((i) => `${i.productName}${i.quantity > 1 ? ` ×${i.quantity}` : ''}`).join(', ') || '—'}
          </p>
        </div>
      </div>
      <Button
        size="lg"
        className="bg-green-600 hover:bg-green-500 text-white font-semibold shadow-lg shadow-green-600/20 shrink-0"
        onClick={() => onProcessPickup(r)}
      >
        <Truck size={18} className="mr-2" />
        Process Pickup
      </Button>
    </div>
  );

  const hasFilters = search.trim() !== '' || branchFilter !== 'all';
  const isEmpty = filtered.length === 0;

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      <div className="shrink-0 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Truck size={20} className="text-amber-400" />
              Pickup Today
            </h3>
            <p className="text-sm text-gray-400 mt-0.5">
              Rentals scheduled for pickup on {formatLongDate(today)} ({filtered.length} in queue)
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Operational queue as of today — not affected by header date range.
            </p>
          </div>
          <Button variant="outline" size="sm" className="border-gray-700 text-gray-300" onClick={exportCsv} disabled={isEmpty}>
            <Download size={16} className="mr-1.5" />
            Export CSV
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <div className="rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2">
            <span className="text-xs text-gray-400 uppercase">Due Today</span>
            <p className="text-xl font-bold text-white">{kpis.dueToday}</p>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2">
            <span className="text-xs text-gray-400 uppercase">Missed</span>
            <p className="text-xl font-bold text-amber-400">{kpis.missed}</p>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2 min-w-0">
            <span className="text-xs text-gray-400 uppercase">Balance Due</span>
            <AdaptiveCurrencyValue value={kpis.totalBalance} className="text-xl font-bold text-pink-400" as="p" />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search rental no, customer, product…"
              className="pl-9 bg-gray-900 border-gray-700 text-sm"
            />
          </div>
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-[180px] bg-gray-900 border-gray-700 text-sm h-9">
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700">
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
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
          <ShoppingBag size={64} className="mb-4 opacity-50" />
          <p className="text-lg font-medium">{hasFilters ? 'No pickups match filters' : 'No pickups today'}</p>
          <p className="text-sm mt-1 text-center max-w-md">
            {hasFilters
              ? 'Try clearing search or branch filter.'
              : activeCount > 0
                ? `${activeCount} active rental${activeCount === 1 ? '' : 's'} — none due for pickup today`
                : 'All rentals scheduled for today are already processed'}
          </p>
          {!hasFilters && activeCount > 0 && onViewAllRentals && (
            <Button variant="outline" size="sm" className="mt-4 border-gray-700 text-gray-300" onClick={onViewAllRentals}>
              View all rentals
            </Button>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-6">
          {missed.length > 0 && (
            <section>
              <h4 className="text-sm font-semibold text-amber-400 flex items-center gap-2 mb-3">
                <AlertTriangle size={16} /> Missed Pickups ({missed.length})
              </h4>
              <div className="space-y-3">{missed.map((r) => renderCard(r, true))}</div>
            </section>
          )}
          {dueToday.length > 0 && (
            <section>
              {missed.length > 0 && (
                <h4 className="text-sm font-semibold text-white mb-3">Due Today ({dueToday.length})</h4>
              )}
              <div className="space-y-3">{dueToday.map((r) => renderCard(r, false))}</div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};
