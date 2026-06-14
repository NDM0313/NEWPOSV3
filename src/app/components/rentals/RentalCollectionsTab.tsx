/**
 * Rental Collections Tab – Customer Outstanding Dashboard
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DollarSign, Phone, Calendar, Loader2, Search, Download } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import type { RentalUI } from '@/app/context/RentalContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { rentalService } from '@/app/services/rentalService';
import { cn } from '@/app/components/ui/utils';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import {
  AgingBucket,
  downloadCsv,
  getAgingBucket,
  getRentalDueAmount,
  matchesRentalSearch,
  todayIso,
} from '@/app/lib/rentalQueueUtils';
import { toast } from 'sonner';

interface RentalCollectionsTabProps {
  onCollectPayment: (rental: RentalUI) => void;
  refreshKey?: number;
}

const AGING_OPTIONS: { value: AgingBucket | 'all'; label: string }[] = [
  { value: 'all', label: 'All buckets' },
  { value: 'current', label: 'Current' },
  { value: '1-30', label: '1–30 days' },
  { value: '31-60', label: '31–60 days' },
  { value: '61-90', label: '61–90 days' },
  { value: '90+', label: '90+ days' },
];

export const RentalCollectionsTab = ({ onCollectPayment, refreshKey = 0 }: RentalCollectionsTabProps) => {
  const { companyId, branchId } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const today = todayIso();

  const [rentals, setRentals] = useState<RentalUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [agingFilter, setAgingFilter] = useState<AgingBucket | 'all'>('all');
  const [branchFilter, setBranchFilter] = useState<string>(branchId && branchId !== 'all' ? branchId : 'all');

  const effectiveBranch = branchFilter === 'all' ? undefined : branchFilter;

  const loadOutstanding = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const rows = await rentalService.getOutstandingForCollections(companyId, effectiveBranch);
      setRentals(rows);
    } catch (e) {
      console.error('[RentalCollectionsTab]', e);
      toast.error('Failed to load outstanding rentals');
      setRentals([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, effectiveBranch]);

  useEffect(() => {
    void loadOutstanding();
  }, [loadOutstanding, refreshKey]);

  useEffect(() => {
    if (branchId && branchId !== 'all') setBranchFilter(branchId);
  }, [branchId]);

  const branchOptions = useMemo(() => {
    const map = new Map<string, string>();
    rentals.forEach((r) => {
      if (r.branchId) map.set(r.branchId, r.location || r.branchId);
    });
    return [...map.entries()];
  }, [rentals]);

  const filtered = useMemo(() => {
    return rentals
      .filter((r) => matchesRentalSearch(r, search))
      .filter((r) => agingFilter === 'all' || getAgingBucket(r.expectedReturnDate, today) === agingFilter)
      .sort((a, b) => getRentalDueAmount(b) - getRentalDueAmount(a));
  }, [rentals, search, agingFilter, today]);

  const agingBuckets = useMemo(() => {
    let current = 0, days1to30 = 0, days31to60 = 0, days61to90 = 0, days90plus = 0;
    rentals.forEach((r) => {
      const amt = getRentalDueAmount(r);
      const bucket = getAgingBucket(r.expectedReturnDate, today);
      if (bucket === 'current') current += amt;
      else if (bucket === '1-30') days1to30 += amt;
      else if (bucket === '31-60') days31to60 += amt;
      else if (bucket === '61-90') days61to90 += amt;
      else days90plus += amt;
    });
    return { current, days1to30, days31to60, days61to90, days90plus };
  }, [rentals, today]);

  const totalOutstanding = useMemo(
    () => rentals.reduce((sum, r) => sum + getRentalDueAmount(r), 0),
    [rentals]
  );

  const exportCsv = () => {
    downloadCsv(
      `rental-collections-${today}.csv`,
      ['Rental No', 'Customer', 'Phone', 'Return Date', 'Aging', 'Paid', 'Total', 'Due', 'Status'],
      filtered.map((r) => [
        r.rentalNo,
        r.customerName,
        r.customerContact || '',
        r.expectedReturnDate,
        getAgingBucket(r.expectedReturnDate, today),
        String(r.paidAmount ?? 0),
        String(r.totalAmount ?? 0),
        String(getRentalDueAmount(r)),
        r.status,
      ])
    );
  };

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      <div className="shrink-0 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Customer Outstanding</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              Rentals with balance due – collect payments to reduce AR
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Aging basis: expected return date · queue as of today (not header date range)</p>
          </div>
          <Button variant="outline" size="sm" className="border-gray-700 text-gray-300" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download size={16} className="mr-1.5" />
            Export CSV
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2">
            <span className="text-xs text-gray-400 uppercase">Total Outstanding</span>
            <p className="text-xl font-bold text-amber-400">{formatCurrency(totalOutstanding)}</p>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2">
            <span className="text-xs text-gray-400 uppercase">Rentals Due</span>
            <p className="text-xl font-bold text-white">{rentals.length}</p>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2">
            <span className="text-xs text-gray-400 uppercase">Current</span>
            <p className="text-lg font-semibold text-green-400">{formatCurrency(agingBuckets.current)}</p>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2">
            <span className="text-xs text-gray-400 uppercase">1-30 Days</span>
            <p className="text-lg font-semibold text-amber-400">{formatCurrency(agingBuckets.days1to30)}</p>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2">
            <span className="text-xs text-gray-400 uppercase">31-60 Days</span>
            <p className="text-lg font-semibold text-orange-400">{formatCurrency(agingBuckets.days31to60)}</p>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2">
            <span className="text-xs text-gray-400 uppercase">61-90 Days</span>
            <p className="text-lg font-semibold text-red-400">{formatCurrency(agingBuckets.days61to90)}</p>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2">
            <span className="text-xs text-gray-400 uppercase">90+ Days</span>
            <p className="text-lg font-semibold text-red-500">{formatCurrency(agingBuckets.days90plus)}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer, rental no, phone…"
              className="pl-9 bg-gray-900 border-gray-700 text-sm"
            />
          </div>
          <Select value={agingFilter} onValueChange={(v) => setAgingFilter(v as AgingBucket | 'all')}>
            <SelectTrigger className="w-[160px] bg-gray-900 border-gray-700 text-sm h-9">
              <SelectValue placeholder="Aging" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700">
              {AGING_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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

      <div className="flex-1 min-h-0 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <DollarSign size={48} className="mb-4 opacity-50" />
            <p className="text-lg font-medium">
              {search || agingFilter !== 'all' ? 'No outstanding rentals match filters' : 'No outstanding rentals'}
            </p>
            <p className="text-sm mt-1">All rental payments are up to date</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="w-full text-base leading-snug">
              <thead className="bg-gray-950/80 text-sm uppercase text-gray-400 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Rental</th>
                  <th className="text-left px-4 py-3 font-medium">Customer</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Return</th>
                  <th className="text-right px-4 py-3 font-medium">Paid</th>
                  <th className="text-right px-4 py-3 font-medium">Total</th>
                  <th className="text-right px-4 py-3 font-medium">Due</th>
                  <th className="text-right px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {filtered.map((r) => {
                  const due = getRentalDueAmount(r);
                  const od = r.expectedReturnDate < today ? Math.floor((new Date(today).getTime() - new Date(r.expectedReturnDate).getTime()) / 86400000) : 0;
                  return (
                    <tr key={r.id} className={cn('hover:bg-gray-800/30', od > 0 && 'bg-red-500/5')}>
                      <td className="px-4 py-3">
                        <span className="font-mono text-pink-400 font-medium">{r.rentalNo}</span>
                        {r.status === 'returned' && (
                          <span className="ml-2 text-xs px-2 py-0.5 rounded bg-gray-500/20 text-gray-400">Returned</span>
                        )}
                        {od > 0 && r.status !== 'returned' && (
                          <span className="ml-2 text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">{od}d overdue</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-white font-medium">{r.customerName}</p>
                        {r.customerContact && (
                          <p className="text-sm text-gray-400 flex items-center gap-1 mt-0.5">
                            <Phone size={12} /> {r.customerContact}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-300 hidden md:table-cell">
                        <span className="flex items-center gap-1 text-sm">
                          <Calendar size={12} className="text-gray-500" />
                          {r.expectedReturnDate}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-400 font-mono">{formatCurrency(r.paidAmount ?? 0)}</td>
                      <td className="px-4 py-3 text-right text-gray-300 font-mono">{formatCurrency(r.totalAmount ?? 0)}</td>
                      <td className="px-4 py-3 text-right text-amber-400 font-bold font-mono">{formatCurrency(due)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          className="bg-amber-500 hover:bg-amber-600 text-white"
                          onClick={() => onCollectPayment(r)}
                        >
                          <DollarSign size={14} className="mr-1.5" />
                          Collect
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
