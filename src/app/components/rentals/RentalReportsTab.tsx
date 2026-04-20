/**
 * Rental Reports Tab — Monthly revenue, most rented products, customer frequency.
 */
import { useState, useEffect, useMemo } from 'react';
import { BarChart3, TrendingUp, Users, Package, Loader2 } from 'lucide-react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { supabase } from '@/lib/supabase';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { cn } from '../ui/utils';

interface RentalRow {
  id: string;
  bookingNo: string;
  customerName: string;
  customerId: string;
  bookingDate: string;
  pickupDate: string;
  returnDate: string;
  status: string;
  rentalCharges: number;
  paidAmount: number;
  dueAmount: number;
  items: Array<{ productName: string; productId: string; quantity: number; total: number }>;
}

export const RentalReportsTab = () => {
  const { companyId } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const [loading, setLoading] = useState(false);
  const [rentals, setRentals] = useState<RentalRow[]>([]);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    (async () => {
      try {
        const { data: rentalData } = await supabase
          .from('rentals')
          .select('id, booking_no, customer_name, customer_id, booking_date, pickup_date, return_date, status, rental_charges, paid_amount, due_amount')
          .eq('company_id', companyId)
          .order('booking_date', { ascending: false });

        const rentalIds = (rentalData || []).map((r: any) => r.id);
        let itemsByRental = new Map<string, any[]>();
        if (rentalIds.length > 0) {
          const { data: items } = await supabase
            .from('rental_items')
            .select('rental_id, product_name, product_id, quantity, total')
            .in('rental_id', rentalIds);
          for (const item of (items || []) as any[]) {
            const list = itemsByRental.get(item.rental_id) || [];
            list.push(item);
            itemsByRental.set(item.rental_id, list);
          }
        }

        setRentals((rentalData || []).map((r: any) => ({
          id: r.id,
          bookingNo: r.booking_no || '',
          customerName: r.customer_name || '',
          customerId: r.customer_id || '',
          bookingDate: (r.booking_date || '').slice(0, 10),
          pickupDate: (r.pickup_date || '').slice(0, 10),
          returnDate: (r.return_date || '').slice(0, 10),
          status: r.status || '',
          rentalCharges: Number(r.rental_charges) || 0,
          paidAmount: Number(r.paid_amount) || 0,
          dueAmount: Number(r.due_amount) || 0,
          items: (itemsByRental.get(r.id) || []).map((i: any) => ({
            productName: i.product_name, productId: i.product_id,
            quantity: Number(i.quantity) || 0, total: Number(i.total) || 0,
          })),
        })));
      } catch (err) {
        console.error('[RentalReports] Load error:', err);
      }
      setLoading(false);
    })();
  }, [companyId]);

  // Monthly revenue
  const monthlyRevenue = useMemo(() => {
    const byMonth = new Map<string, { revenue: number; collected: number; count: number }>();
    for (const r of rentals) {
      const month = r.bookingDate.slice(0, 7);
      const m = byMonth.get(month) || { revenue: 0, collected: 0, count: 0 };
      m.revenue += r.rentalCharges;
      m.collected += r.paidAmount;
      m.count++;
      byMonth.set(month, m);
    }
    return [...byMonth.entries()]
      .map(([month, d]) => ({ month, ...d }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [rentals]);

  // Most rented products
  const mostRented = useMemo(() => {
    const byProduct = new Map<string, { name: string; count: number; revenue: number }>();
    for (const r of rentals) {
      for (const item of r.items) {
        const key = item.productId || item.productName;
        const p = byProduct.get(key) || { name: item.productName, count: 0, revenue: 0 };
        p.count += item.quantity;
        p.revenue += item.total;
        byProduct.set(key, p);
      }
    }
    return [...byProduct.values()].sort((a, b) => b.count - a.count).slice(0, 20);
  }, [rentals]);

  // Customer frequency
  const customerFrequency = useMemo(() => {
    const byCustomer = new Map<string, { name: string; bookings: number; totalSpent: number; totalPaid: number }>();
    for (const r of rentals) {
      const key = r.customerId || r.customerName;
      const c = byCustomer.get(key) || { name: r.customerName, bookings: 0, totalSpent: 0, totalPaid: 0 };
      c.bookings++;
      c.totalSpent += r.rentalCharges;
      c.totalPaid += r.paidAmount;
      byCustomer.set(key, c);
    }
    return [...byCustomer.values()].sort((a, b) => b.bookings - a.bookings).slice(0, 20);
  }, [rentals]);

  // Summary stats
  const stats = useMemo(() => {
    const active = rentals.filter(r => ['booked', 'active', 'picked_up'].includes(r.status));
    const overdue = rentals.filter(r => r.status === 'overdue');
    const totalRevenue = rentals.reduce((s, r) => s + r.rentalCharges, 0);
    const totalCollected = rentals.reduce((s, r) => s + r.paidAmount, 0);
    const totalOutstanding = rentals.reduce((s, r) => s + r.dueAmount, 0);
    return { total: rentals.length, active: active.length, overdue: overdue.length, totalRevenue, totalCollected, totalOutstanding };
  }, [rentals]);

  const fmt = (n: number) => n ? n.toLocaleString('en-PK') : '0';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 overflow-y-auto max-h-full">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {([
          { label: 'Total Bookings', value: fmt(stats.total), color: 'text-white', icon: BarChart3 },
          { label: 'Active', value: fmt(stats.active), color: 'text-green-400', icon: TrendingUp },
          { label: 'Overdue', value: fmt(stats.overdue), color: 'text-red-400', icon: TrendingUp },
          { label: 'Total Revenue', value: formatCurrency(stats.totalRevenue), color: 'text-blue-400', icon: BarChart3 },
          { label: 'Collected', value: formatCurrency(stats.totalCollected), color: 'text-emerald-400', icon: BarChart3 },
          { label: 'Outstanding', value: formatCurrency(stats.totalOutstanding), color: stats.totalOutstanding > 0 ? 'text-red-400' : 'text-gray-400', icon: BarChart3 },
        ] as const).map(s => (
          <div key={s.label} className="bg-gray-900/60 border border-gray-800 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <s.icon size={14} className="text-gray-500" />
              <p className="text-[10px] text-gray-500 uppercase">{s.label}</p>
            </div>
            <p className={cn('text-lg font-bold', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly Revenue */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-800 text-sm font-medium text-blue-400 flex items-center gap-1.5">
            <BarChart3 size={14} /> Monthly Revenue
          </div>
          <div className="overflow-y-auto max-h-[300px]">
            <table className="w-full text-xs">
              <thead className="bg-gray-950/80 text-gray-400 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2">Month</th>
                  <th className="text-right px-3 py-2">Bookings</th>
                  <th className="text-right px-3 py-2">Revenue</th>
                  <th className="text-right px-3 py-2">Collected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {monthlyRevenue.map(m => (
                  <tr key={m.month} className="hover:bg-gray-800/20">
                    <td className="px-3 py-2 text-white font-mono">{m.month}</td>
                    <td className="px-3 py-2 text-right text-gray-300">{m.count}</td>
                    <td className="px-3 py-2 text-right text-blue-400 font-mono">{formatCurrency(m.revenue)}</td>
                    <td className="px-3 py-2 text-right text-emerald-400 font-mono">{formatCurrency(m.collected)}</td>
                  </tr>
                ))}
                {monthlyRevenue.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-500">No data</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Most Rented Products */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-800 text-sm font-medium text-pink-400 flex items-center gap-1.5">
            <Package size={14} /> Most Rented Products
          </div>
          <div className="overflow-y-auto max-h-[300px]">
            <table className="w-full text-xs">
              <thead className="bg-gray-950/80 text-gray-400 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2">Product</th>
                  <th className="text-right px-3 py-2">Times Rented</th>
                  <th className="text-right px-3 py-2">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {mostRented.map((p, i) => (
                  <tr key={p.name + i} className="hover:bg-gray-800/20">
                    <td className="px-3 py-2 text-white">{p.name}</td>
                    <td className="px-3 py-2 text-right text-pink-400 font-bold">{p.count}</td>
                    <td className="px-3 py-2 text-right text-gray-300 font-mono">{formatCurrency(p.revenue)}</td>
                  </tr>
                ))}
                {mostRented.length === 0 && <tr><td colSpan={3} className="px-3 py-6 text-center text-gray-500">No data</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Customer Frequency */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-800 text-sm font-medium text-amber-400 flex items-center gap-1.5">
            <Users size={14} /> Top Customers
          </div>
          <div className="overflow-y-auto max-h-[300px]">
            <table className="w-full text-xs">
              <thead className="bg-gray-950/80 text-gray-400 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2">Customer</th>
                  <th className="text-right px-3 py-2">Bookings</th>
                  <th className="text-right px-3 py-2">Spent</th>
                  <th className="text-right px-3 py-2">Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {customerFrequency.map((c, i) => (
                  <tr key={c.name + i} className="hover:bg-gray-800/20">
                    <td className="px-3 py-2 text-white">{c.name}</td>
                    <td className="px-3 py-2 text-right text-amber-400 font-bold">{c.bookings}</td>
                    <td className="px-3 py-2 text-right text-gray-300 font-mono">{formatCurrency(c.totalSpent)}</td>
                    <td className="px-3 py-2 text-right text-emerald-400 font-mono">{formatCurrency(c.totalPaid)}</td>
                  </tr>
                ))}
                {customerFrequency.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-500">No data</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
