import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, Loader2, MoreVertical, Printer, RotateCcw, Ban, History, Search, ShoppingCart, Calendar } from 'lucide-react';
import * as salesApi from '../../api/sales';
import * as reportsApi from '../../api/reports';

type SaleRecord = {
  raw: Record<string, unknown>;
  id: string;
  customer: string;
  amount: number;
  date: string;
};

interface SalesHomeProps {
  onBack: () => void;
  onNewSale: () => void;
  companyId: string | null;
  branchId: string | null;
}

export function SalesHome({ onBack, onNewSale, companyId, branchId }: SalesHomeProps) {
  const [recentSales, setRecentSales] = useState<SaleRecord[]>([]);
  const [stats, setStats] = useState<{ today: number; week: number }>({ today: 0, week: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null);
  const [menuSale, setMenuSale] = useState<SaleRecord | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<Array<{ id: string; date: string; amount: number; method: string; referenceNo: string }>>([]);

  const filteredSales = recentSales.filter(
    (sale) =>
      sale.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.customer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    const load = async () => {
      const effectiveBranchId = branchId && branchId !== 'all' ? branchId : undefined;
      const [salesRes, todayRes, weekRes] = await Promise.all([
        salesApi.getAllSales(companyId, effectiveBranchId ?? null),
        reportsApi.getSalesSummary(companyId, effectiveBranchId ?? null, 1),
        reportsApi.getSalesSummary(companyId, effectiveBranchId ?? null, 7),
      ]);

      if (cancelled) return;

      if (salesRes.data && salesRes.data.length > 0) {
        const list = salesRes.data.slice(0, 10).map((s: Record<string, unknown>) => {
          const cust = s.customer as { name?: string } | null;
          const d = (s.invoice_date as string) || (s.created_at as string) || '';
          const dateObj = d ? new Date(d) : new Date();
          const isToday = dateObj.toDateString() === new Date().toDateString();
          const isYesterday = dateObj.toDateString() === new Date(Date.now() - 864e5).toDateString();
          let dateStr = dateObj.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
          if (isToday) dateStr = `Today, ${dateStr}`;
          else if (isYesterday) dateStr = `Yesterday, ${dateStr}`;
          else dateStr = dateObj.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
          return {
            raw: s,
            id: (s.invoice_no as string) || (s.id as string) || '—',
            customer: (cust?.name as string) || (s.customer_name as string) || 'Walk-in',
            amount: Number(s.total ?? 0),
            date: dateStr,
          };
        });
        setRecentSales(list);
      } else {
        setRecentSales([]);
      }

      setStats({
        today: todayRes.data?.totalSales ?? 0,
        week: weekRes.data?.totalSales ?? 0,
      });
      setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [companyId, branchId]);

  const loadPaymentHistory = useCallback(async (saleId: string) => {
    if (!saleId) return;
    const { data } = await salesApi.getSalePayments(saleId);
    setPaymentHistory(data || []);
  }, []);

  useEffect(() => {
    if (selectedSale) {
      const saleId = selectedSale.raw.id as string;
      if (saleId) loadPaymentHistory(saleId);
      else setPaymentHistory([]);
    } else {
      setPaymentHistory([]);
    }
  }, [selectedSale, loadPaymentHistory]);

  const [cancelling, setCancelling] = useState(false);
  const baseUrl = import.meta.env.VITE_APP_URL || '';

  const handlePrint = (sale: SaleRecord) => {
    setMenuSale(null);
    window.open(`${baseUrl}/sales?print=${(sale.raw.id as string) || sale.id}`, '_blank', 'noopener');
  };
  const handlePaymentHistory = (sale: SaleRecord) => {
    setMenuSale(null);
    setSelectedSale(sale);
  };
  const handleReturn = (sale: SaleRecord) => {
    setMenuSale(null);
    window.open(`${baseUrl}/sales/returns?original=${(sale.raw.id as string) || sale.id}`, '_blank', 'noopener');
  };
  const handleCancel = async (sale: SaleRecord) => {
    setMenuSale(null);
    setCancelling(true);
    try {
      const { error } = await salesApi.cancelSale(sale.raw.id as string);
      if (error) {
        alert(error);
      } else {
        setRecentSales((prev) => prev.filter((s) => s.id !== sale.id));
        setSelectedSale(null);
      }
    } finally {
      setCancelling(false);
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'unpaid':
        return 'text-[#EF4444]';
      case 'partial':
        return 'text-[#F59E0B]';
      case 'paid':
        return 'text-[#10B981]';
      default:
        return 'text-[#9CA3AF]';
    }
  };

  // Sale Detail View (full-page, same layout as Purchase detail)
  if (selectedSale) {
    const items = (selectedSale.raw.items as Array<{ product_name?: string; quantity?: number; unit_price?: number; total?: number; packing_details?: { total_boxes?: number; total_pieces?: number } }>) ?? [];
    const total = selectedSale.amount;
    const paidAmount = paymentHistory.length > 0
      ? paymentHistory.reduce((sum, p) => sum + p.amount, 0)
      : Number(selectedSale.raw.paid_amount ?? 0);
    const dueAmount = total - paidAmount;
    const paymentStatus = dueAmount <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';
    const cust = selectedSale.raw.customer as { name?: string; phone?: string } | null;
    const customerPhone = cust?.phone ?? (selectedSale.raw.contact_phone as string) ?? '—';
    const subtotal = Number(selectedSale.raw.subtotal ?? total);
    const discount = Number(selectedSale.raw.discount ?? 0);
    const isCancelled = selectedSale.raw.status === 'cancelled';

    return (
      <div className="min-h-screen pb-24 bg-[#111827]">
        <div className="bg-[#1F2937] border-b border-[#374151] p-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedSale(null)}
              className="p-2 hover:bg-[#374151] rounded-lg transition-colors text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-white">{selectedSale.id}</h1>
              <p className="text-xs text-[#9CA3AF]">{selectedSale.customer}</p>
            </div>
            {isCancelled && (
              <span className="px-3 py-1 rounded-full text-xs font-medium text-[#EF4444] bg-[#EF4444]/10">
                CANCELLED
              </span>
            )}
            {!isCancelled && (
              <div className="relative">
                <button
                  onClick={() => setMenuSale(menuSale?.id === selectedSale.id ? null : selectedSale)}
                  className="p-2 hover:bg-[#374151] rounded-lg text-[#9CA3AF]"
                  aria-label="More options"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
                {menuSale?.id === selectedSale.id && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenuSale(null)} aria-hidden="true" />
                    <div className="absolute right-0 top-full mt-1 bg-[#1F2937] border border-[#374151] rounded-xl shadow-xl overflow-hidden min-w-[180px] z-50">
                      <button onClick={() => { handlePrint(selectedSale); setMenuSale(null); }} className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-[#374151]">
                        <Printer className="w-5 h-5 text-[#3B82F6]" /> Print
                      </button>
                      <button onClick={() => { handleReturn(selectedSale); setMenuSale(null); }} className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-[#374151]">
                        <RotateCcw className="w-5 h-5 text-[#3B82F6]" /> Return
                      </button>
                      <button onClick={() => handleCancel(selectedSale)} disabled={cancelling} className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-[#374151] disabled:opacity-50">
                        <Ban className="w-5 h-5 text-[#EF4444]" /> {cancelling ? 'Cancelling...' : 'Cancel Invoice'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <h3 className="text-sm font-medium text-white mb-3">Customer Information</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Name:</span>
                <span className="text-white">{selectedSale.customer}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Phone:</span>
                <span className="text-white">{customerPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Invoice Date:</span>
                <span className="text-white">{selectedSale.date}</span>
              </div>
            </div>
          </div>

          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <h3 className="text-sm font-medium text-white mb-3">Items ({items.length})</h3>
            <div className="space-y-3">
              {items.map((item, i) => (
                <div key={i} className="pb-3 border-b border-[#374151] last:border-0">
                  <div className="flex justify-between mb-1">
                    <span className="font-medium text-white">{item.product_name || 'Item'}</span>
                    <span className="text-[#10B981]">Rs. {(item.total ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs text-[#9CA3AF]">
                    <span>Qty: {item.quantity ?? 0}</span>
                    <span>@ Rs. {(item.unit_price ?? 0).toLocaleString()}</span>
                  </div>
                  {item.packing_details && ((item.packing_details.total_boxes ?? 0) > 0 || (item.packing_details.total_pieces ?? 0) > 0) && (
                    <p className="text-xs text-[#3B82F6] mt-1">
                      {item.packing_details.total_boxes ?? 0} Box / {item.packing_details.total_pieces ?? 0} Pc
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[#9CA3AF]">Subtotal:</span>
              <span className="text-white">Rs. {subtotal.toLocaleString()}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-[#9CA3AF]">Discount:</span>
                <span className="text-[#EF4444]">- Rs. {discount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-[#374151]">
              <span className="text-white">Total:</span>
              <span className="text-[#10B981]">Rs. {total.toLocaleString()}</span>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#3B82F6]/10 to-[#10B981]/10 border border-[#3B82F6]/30 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[#9CA3AF]">Paid Amount:</span>
              <span className="text-[#10B981]">Rs. {paidAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span className="text-white">Amount Due:</span>
              <span className={getPaymentStatusColor(paymentStatus)}>
                Rs. {dueAmount.toLocaleString()}
              </span>
            </div>
            <div className="pt-2 border-t border-[#3B82F6]/30">
              <span className={`text-xs font-medium ${getPaymentStatusColor(paymentStatus)}`}>
                {paymentStatus === 'paid' && '✓ Fully Paid'}
                {paymentStatus === 'partial' && '⚠ Partially Paid'}
                {paymentStatus === 'unpaid' && '✗ Unpaid'}
              </span>
            </div>
          </div>

          {paymentHistory.length > 0 && (
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <h3 className="text-sm font-medium text-[#9CA3AF] mb-3">Payment History</h3>
              <div className="space-y-2">
                {paymentHistory.map((p) => (
                  <div key={p.id} className="flex justify-between items-center text-sm py-2 border-b border-[#374151] last:border-0">
                    <div>
                      <p className="text-white font-medium">Rs. {p.amount.toLocaleString()}</p>
                      <p className="text-xs text-[#9CA3AF]">{p.method} • {p.date}</p>
                      {p.referenceNo !== '—' && <p className="text-xs text-[#6B7280]">Ref: {p.referenceNo}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-gradient-to-br from-[#3B82F6] to-[#2563EB] p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-white">Sales</h1>
            <p className="text-xs text-white/80">Invoices & receipts</p>
          </div>
          <button onClick={onNewSale} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-white">
            <Plus className="w-5 h-5" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sales..."
            className="w-full h-10 bg-white/10 border border-white/20 rounded-lg pl-10 pr-4 text-sm text-white placeholder:text-white/60 focus:outline-none focus:bg-white/20"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin" />
        </div>
      ) : (
        <>
          <div className="p-4 grid grid-cols-3 gap-3">
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-3 text-center">
              <p className="text-xs text-[#9CA3AF] mb-1">Today</p>
              <p className="text-xl font-bold text-[#3B82F6]">Rs. {stats.today.toLocaleString()}</p>
            </div>
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-3 text-center">
              <p className="text-xs text-[#9CA3AF] mb-1">This Week</p>
              <p className="text-xl font-bold text-[#F59E0B]">Rs. {stats.week.toLocaleString()}</p>
            </div>
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-3 text-center">
              <p className="text-xs text-[#9CA3AF] mb-1">Invoices</p>
              <p className="text-xl font-bold text-[#10B981]">{recentSales.length}</p>
            </div>
          </div>

          <div className="p-4 space-y-3">
            {filteredSales.map((sale) => (
              <div key={sale.id} className="relative bg-[#1F2937] border border-[#374151] rounded-xl overflow-hidden hover:border-[#3B82F6] transition-all">
                <button
                  onClick={() => setSelectedSale(sale)}
                  className="w-full p-4 text-left active:scale-[0.98] min-w-0 pr-12"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-white mb-1">{sale.id}</h3>
                      <p className="text-sm text-[#D1D5DB]">{sale.customer}</p>
                    </div>
                    <span className="text-sm font-semibold text-[#10B981]">Rs. {sale.amount.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-3 text-xs text-[#9CA3AF]">
                    <Calendar className="w-4 h-4" />
                    <span>{sale.date}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <span className="text-[#9CA3AF]">Total: </span>
                      <span className="font-semibold text-white">Rs. {sale.amount.toLocaleString()}</span>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => setMenuSale(menuSale?.id === sale.id ? null : sale)}
                  className="absolute top-4 right-4 p-2 hover:bg-[#374151] rounded-lg text-[#9CA3AF]"
                  aria-label="More options"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
                {menuSale?.id === sale.id && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setMenuSale(null)}>
                    <div className="bg-[#1F2937] border border-[#374151] rounded-2xl shadow-xl overflow-hidden w-full max-w-[280px]" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Sale options">
                      <div className="px-4 py-3 border-b border-[#374151]">
                        <p className="text-sm font-medium text-[#9CA3AF]">{sale.id}</p>
                        <p className="text-lg font-semibold text-white">Rs. {sale.amount.toLocaleString()}</p>
                      </div>
                      <div className="py-2">
                        <button onClick={() => handlePaymentHistory(sale)} className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-[#374151]">
                          <History className="w-5 h-5 text-[#3B82F6]" /> Payment History
                        </button>
                        <button onClick={() => handlePrint(sale)} className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-[#374151]">
                          <Printer className="w-5 h-5 text-[#3B82F6]" /> Print
                        </button>
                        <button onClick={() => handleReturn(sale)} className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-[#374151]">
                          <RotateCcw className="w-5 h-5 text-[#3B82F6]" /> Return
                        </button>
                        <button onClick={() => handleCancel(sale)} disabled={cancelling} className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-[#374151] disabled:opacity-50">
                          <Ban className="w-5 h-5 text-[#EF4444]" /> {cancelling ? 'Cancelling...' : 'Cancel Invoice'}
                        </button>
                      </div>
                      <button onClick={() => setMenuSale(null)} className="w-full py-3 text-sm text-[#9CA3AF] border-t border-[#374151] hover:bg-[#374151]">
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {filteredSales.length === 0 && (
              <div className="text-center py-12">
                <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-[#374151]" />
                <p className="text-[#9CA3AF]">No sales found</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
