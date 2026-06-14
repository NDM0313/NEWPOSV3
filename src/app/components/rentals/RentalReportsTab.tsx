/**
 * Rental Reports Tab — Monthly revenue, products, customers with filters and exports.
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { BarChart3, TrendingUp, Users, Package, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useSupabase } from '@/app/context/SupabaseContext';
import { supabase } from '@/lib/supabase';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { AdaptiveCurrencyValue } from '@/app/components/shared/AdaptiveCurrencyValue';
import { cn } from '../ui/utils';
import { mapRentalStatus } from '@/app/lib/rentalUiMapper';
import { ReportActions } from '@/app/components/reports/ReportActions';
import { branchService } from '@/app/services/branchService';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { downloadCsv } from '@/app/lib/rentalQueueUtils';

interface RentalRow {
  id: string;
  bookingNo: string;
  customerName: string;
  customerId: string;
  bookingDate: string;
  branchId: string;
  status: string;
  rentalCharges: number;
  paidAmount: number;
  dueAmount: number;
  items: Array<{ productName: string; productId: string; quantity: number; total: number }>;
}

function monthsAgoIso(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

export const RentalReportsTab = () => {
  const { companyId, branchId: globalBranchId } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const printRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(false);
  const [rentals, setRentals] = useState<RentalRow[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [startDate, setStartDate] = useState(monthsAgoIso(12));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [branchFilter, setBranchFilter] = useState<string>(
    globalBranchId && globalBranchId !== 'all' ? globalBranchId : 'all'
  );

  useEffect(() => {
    if (!companyId) return;
    branchService.getBranchesCached(companyId).then((list) => {
      setBranches(list.map((b) => ({ id: b.id, name: b.name || b.code || b.id })));
    }).catch(() => setBranches([]));
  }, [companyId]);

  useEffect(() => {
    if (globalBranchId && globalBranchId !== 'all') setBranchFilter(globalBranchId);
  }, [globalBranchId]);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    (async () => {
      try {
        const { data: rentalData } = await supabase
          .from('rentals')
          .select('id, booking_no, customer_name, customer_id, booking_date, branch_id, status, rental_charges, paid_amount, due_amount, total_amount')
          .eq('company_id', companyId)
          .gte('booking_date', startDate)
          .lte('booking_date', endDate)
          .order('booking_date', { ascending: false });

        const rentalIds = (rentalData || []).map((r: { id: string }) => r.id);
        const itemsByRental = new Map<string, Array<{ product_name?: string; product_id?: string; quantity?: number; total?: number }>>();
        if (rentalIds.length > 0) {
          const { data: items } = await supabase
            .from('rental_items')
            .select('rental_id, product_name, product_id, quantity, total')
            .in('rental_id', rentalIds);
          for (const item of (items || []) as Array<{ rental_id: string; product_name?: string; product_id?: string; quantity?: number; total?: number }>) {
            const list = itemsByRental.get(item.rental_id) || [];
            list.push(item);
            itemsByRental.set(item.rental_id, list);
          }
        }

        setRentals((rentalData || []).map((r: Record<string, unknown>) => ({
          id: String(r.id),
          bookingNo: String(r.booking_no || ''),
          customerName: String(r.customer_name || ''),
          customerId: String(r.customer_id || ''),
          bookingDate: String(r.booking_date || '').slice(0, 10),
          branchId: String(r.branch_id || ''),
          status: String(r.status || ''),
          rentalCharges: Number(r.rental_charges ?? r.total_amount ?? 0),
          paidAmount: Number(r.paid_amount ?? 0),
          dueAmount: Number(r.due_amount ?? 0),
          items: (itemsByRental.get(String(r.id)) || []).map((i) => ({
            productName: String(i.product_name || ''),
            productId: String(i.product_id || ''),
            quantity: Number(i.quantity ?? 0),
            total: Number(i.total ?? 0),
          })),
        })));
      } catch (err) {
        console.error('[RentalReports] Load error:', err);
        setRentals([]);
      }
      setLoading(false);
    })();
  }, [companyId, startDate, endDate]);

  const filtered = useMemo(() => {
    if (branchFilter === 'all') return rentals;
    return rentals.filter((r) => r.branchId === branchFilter);
  }, [rentals, branchFilter]);

  const monthlyRevenue = useMemo(() => {
    const byMonth = new Map<string, { revenue: number; collected: number; count: number }>();
    for (const r of filtered) {
      const month = r.bookingDate.slice(0, 7);
      const m = byMonth.get(month) || { revenue: 0, collected: 0, count: 0 };
      m.revenue += r.rentalCharges;
      m.collected += r.paidAmount;
      m.count++;
      byMonth.set(month, m);
    }
    return [...byMonth.entries()]
      .map(([month, d]) => ({ month, ...d }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [filtered]);

  const mostRented = useMemo(() => {
    const byProduct = new Map<string, { name: string; count: number; revenue: number }>();
    for (const r of filtered) {
      for (const item of r.items) {
        const key = item.productId || item.productName;
        const p = byProduct.get(key) || { name: item.productName, count: 0, revenue: 0 };
        p.count += item.quantity;
        p.revenue += item.total;
        byProduct.set(key, p);
      }
    }
    return [...byProduct.values()].sort((a, b) => b.count - a.count).slice(0, 20);
  }, [filtered]);

  const customerFrequency = useMemo(() => {
    const byCustomer = new Map<string, { name: string; bookings: number; totalSpent: number; totalPaid: number }>();
    for (const r of filtered) {
      const key = r.customerId || r.customerName;
      const c = byCustomer.get(key) || { name: r.customerName, bookings: 0, totalSpent: 0, totalPaid: 0 };
      c.bookings++;
      c.totalSpent += r.rentalCharges;
      c.totalPaid += r.paidAmount;
      byCustomer.set(key, c);
    }
    return [...byCustomer.values()].sort((a, b) => b.bookings - a.bookings).slice(0, 20);
  }, [filtered]);

  const stats = useMemo(() => {
    let active = 0;
    let returned = 0;
    let cancelled = 0;
    let overdue = 0;
    let totalRevenue = 0;
    let totalCollected = 0;
    let totalOutstanding = 0;
    for (const r of filtered) {
      const uiStatus = mapRentalStatus(r.status);
      totalRevenue += r.rentalCharges;
      totalCollected += r.paidAmount;
      totalOutstanding += r.dueAmount;
      if (uiStatus === 'cancelled') cancelled++;
      else if (uiStatus === 'returned') returned++;
      else if (uiStatus === 'overdue') overdue++;
      else if (['booked', 'rented'].includes(uiStatus)) active++;
    }
    const collectionRate = totalRevenue > 0 ? (totalCollected / totalRevenue) * 100 : 0;
    return {
      total: filtered.length,
      active,
      returned,
      cancelled,
      overdue,
      totalRevenue,
      totalCollected,
      totalOutstanding,
      collectionRate,
    };
  }, [filtered]);

  const monthlyTotals = useMemo(
    () => monthlyRevenue.reduce(
      (acc, m) => ({ count: acc.count + m.count, revenue: acc.revenue + m.revenue, collected: acc.collected + m.collected }),
      { count: 0, revenue: 0, collected: 0 }
    ),
    [monthlyRevenue]
  );

  const productTotals = useMemo(
    () => mostRented.reduce((acc, p) => ({ count: acc.count + p.count, revenue: acc.revenue + p.revenue }), { count: 0, revenue: 0 }),
    [mostRented]
  );

  const exportCsv = () => {
    downloadCsv(
      `rental-report-${startDate}-${endDate}.csv`,
      ['Booking No', 'Customer', 'Booking Date', 'Status', 'Revenue', 'Collected', 'Due'],
      filtered.map((r) => [
        r.bookingNo,
        r.customerName,
        r.bookingDate,
        mapRentalStatus(r.status),
        String(r.rentalCharges),
        String(r.paidAmount),
        String(r.dueAmount),
      ])
    );
  };

  const fmtCount = (n: number) => (n ? n.toLocaleString('en-PK') : '0');

  if (loading && rentals.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <ReportActions
        title="Rental Reports"
        onCsv={exportCsv}
        onPrint={() => window.print()}
        previewContentRef={printRef}
        previewDocumentType="ledger"
        previewReference="Rental Reports"
        className="mb-0 border-b border-gray-800"
      />

      <div ref={printRef} className="flex-1 p-4 md:p-6 space-y-6 overflow-y-auto">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">From</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-gray-900 border-gray-700 text-sm w-[160px]" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">To</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-gray-900 border-gray-700 text-sm w-[160px]" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Branch</label>
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-[180px] bg-gray-900 border-gray-700 text-sm h-9">
                <SelectValue placeholder="Branch" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-700">
                <SelectItem value="all">All branches</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {loading && <Loader2 className="h-5 w-5 animate-spin text-blue-400 mb-2" />}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {([
            { label: 'Total Bookings', value: fmtCount(stats.total), color: 'text-white', icon: BarChart3 },
            { label: 'Active', value: fmtCount(stats.active), color: 'text-green-400', icon: TrendingUp },
            { label: 'Returned', value: fmtCount(stats.returned), color: 'text-blue-400', icon: TrendingUp },
            { label: 'Overdue', value: fmtCount(stats.overdue), color: 'text-red-400', icon: TrendingUp },
            { label: 'Cancelled', value: fmtCount(stats.cancelled), color: 'text-gray-400', icon: TrendingUp },
            { label: 'Total Revenue', amount: stats.totalRevenue, color: 'text-blue-400', icon: BarChart3 },
            { label: 'Collected', amount: stats.totalCollected, color: 'text-emerald-400', icon: BarChart3 },
            { label: 'Outstanding', amount: stats.totalOutstanding, color: stats.totalOutstanding > 0 ? 'text-red-400' : 'text-gray-400', icon: BarChart3 },
          ] as const).map((s) => (
            <div key={s.label} className="bg-gray-900/60 border border-gray-800 rounded-lg px-4 py-3 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <s.icon size={14} className="text-gray-500 shrink-0" />
                <p className="text-xs uppercase tracking-wide font-semibold text-gray-500 truncate">{s.label}</p>
              </div>
              {'amount' in s && s.amount != null ? (
                <AdaptiveCurrencyValue value={s.amount} className={cn('text-lg md:text-xl font-bold min-w-0', s.color)} as="p" />
              ) : (
                <p className={cn('text-lg md:text-xl font-bold min-w-0', s.color)}>{'value' in s ? s.value : ''}</p>
              )}
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3 flex flex-wrap gap-6 text-sm">
          <span className="text-gray-400">Collection rate: <strong className="text-emerald-400">{stats.collectionRate.toFixed(1)}%</strong></span>
          <span className="text-gray-400">Period: <strong className="text-white">{startDate}</strong> → <strong className="text-white">{endDate}</strong></span>
          <span className="text-gray-400">Branch: <strong className="text-white">{branchFilter === 'all' ? 'All' : branches.find((b) => b.id === branchFilter)?.name || branchFilter}</strong></span>
        </div>

        {monthlyRevenue.length > 0 && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <BarChart3 size={20} className="text-blue-400" /> Monthly Revenue
            </h3>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
                  <YAxis stroke="#9CA3AF" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    cursor={{ fill: 'rgba(55, 65, 81, 0.35)' }}
                    contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                    formatter={(value: number, name: string) => [formatCurrency(value), name === 'revenue' ? 'Revenue' : 'Collected']}
                  />
                  <Bar dataKey="revenue" fill="#3B82F6" name="revenue" radius={[4, 4, 0, 0]} activeBar={{ fill: '#2563EB' }} />
                  <Bar dataKey="collected" fill="#10B981" name="collected" radius={[4, 4, 0, 0]} activeBar={{ fill: '#059669' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 text-lg font-bold text-white flex items-center gap-2">
              <BarChart3 size={18} className="text-blue-400" /> Monthly Revenue
            </div>
            <div className="overflow-y-auto max-h-[320px]">
              <table className="w-full text-base leading-snug">
                <thead className="bg-gray-950/80 text-sm uppercase text-gray-400 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Month</th>
                    <th className="text-right px-4 py-3 font-medium">Bookings</th>
                    <th className="text-right px-4 py-3 font-medium">Revenue</th>
                    <th className="text-right px-4 py-3 font-medium">Collected</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {monthlyRevenue.map((m) => (
                    <tr key={m.month} className="hover:bg-gray-800/20">
                      <td className="px-4 py-2.5 text-white font-mono">{m.month}</td>
                      <td className="px-4 py-2.5 text-right text-gray-300">{m.count}</td>
                      <td className="px-4 py-2.5 text-right text-blue-400 font-mono">{formatCurrency(m.revenue)}</td>
                      <td className="px-4 py-2.5 text-right text-emerald-400 font-mono">{formatCurrency(m.collected)}</td>
                    </tr>
                  ))}
                  {monthlyRevenue.length > 0 && (
                    <tr className="bg-gray-950/60 font-semibold">
                      <td className="px-4 py-2.5 text-white">Total</td>
                      <td className="px-4 py-2.5 text-right text-white">{monthlyTotals.count}</td>
                      <td className="px-4 py-2.5 text-right text-blue-400 font-mono">{formatCurrency(monthlyTotals.revenue)}</td>
                      <td className="px-4 py-2.5 text-right text-emerald-400 font-mono">{formatCurrency(monthlyTotals.collected)}</td>
                    </tr>
                  )}
                  {monthlyRevenue.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No data for selected period</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 text-lg font-bold text-white flex items-center gap-2">
              <Package size={18} className="text-pink-400" /> Most Rented Products
            </div>
            <div className="overflow-y-auto max-h-[320px]">
              <table className="w-full text-base leading-snug">
                <thead className="bg-gray-950/80 text-sm uppercase text-gray-400 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Product</th>
                    <th className="text-right px-4 py-3 font-medium">Qty</th>
                    <th className="text-right px-4 py-3 font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {mostRented.map((p, i) => (
                    <tr key={p.name + i} className="hover:bg-gray-800/20">
                      <td className="px-4 py-2.5 text-white">{p.name || '—'}</td>
                      <td className="px-4 py-2.5 text-right text-pink-400 font-bold">{p.count}</td>
                      <td className="px-4 py-2.5 text-right text-gray-300 font-mono">{formatCurrency(p.revenue)}</td>
                    </tr>
                  ))}
                  {mostRented.length > 0 && (
                    <tr className="bg-gray-950/60 font-semibold">
                      <td className="px-4 py-2.5 text-white">Total (top 20)</td>
                      <td className="px-4 py-2.5 text-right text-pink-400">{productTotals.count}</td>
                      <td className="px-4 py-2.5 text-right text-gray-300 font-mono">{formatCurrency(productTotals.revenue)}</td>
                    </tr>
                  )}
                  {mostRented.length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-500">No data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 text-lg font-bold text-white flex items-center gap-2">
              <Users size={18} className="text-amber-400" /> Top Customers
            </div>
            <div className="overflow-y-auto max-h-[320px]">
              <table className="w-full text-base leading-snug">
                <thead className="bg-gray-950/80 text-sm uppercase text-gray-400 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Customer</th>
                    <th className="text-right px-4 py-3 font-medium">Bookings</th>
                    <th className="text-right px-4 py-3 font-medium">Spent</th>
                    <th className="text-right px-4 py-3 font-medium">Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {customerFrequency.map((c, i) => (
                    <tr key={c.name + i} className="hover:bg-gray-800/20">
                      <td className="px-4 py-2.5 text-white">{c.name || '—'}</td>
                      <td className="px-4 py-2.5 text-right text-amber-400 font-bold">{c.bookings}</td>
                      <td className="px-4 py-2.5 text-right text-gray-300 font-mono">{formatCurrency(c.totalSpent)}</td>
                      <td className="px-4 py-2.5 text-right text-emerald-400 font-mono">{formatCurrency(c.totalPaid)}</td>
                    </tr>
                  ))}
                  {customerFrequency.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
