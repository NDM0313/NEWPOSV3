import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, Loader2, MoreVertical, Printer, RotateCcw, Ban, History, Search, ShoppingCart, Calendar, Paperclip, ChevronDown, ChevronUp, Briefcase, Share2, Download, FileText } from 'lucide-react';
import * as salesApi from '../../api/sales';
import * as reportsApi from '../../api/reports';
import { MobileReceivePayment } from './MobileReceivePayment';
import { AttachmentPreviewModal } from './AttachmentPreviewModal';

type SaleRecord = {
  raw: Record<string, unknown>;
  id: string;
  customer: string;
  amount: number;
  total_received: number;
  balance_due: number;
  /** From API when overpaid (total_received > total); no frontend calc */
  credit_balance: number;
  date: string;
  /** From DB join with users; not hardcoded */
  created_by_name: string;
  /** Studio worker cost; grand_total = amount + studio_charges */
  studio_charges?: number;
  grand_total?: number;
};

interface SalesHomeProps {
  onBack: () => void;
  onNewSale: () => void;
  companyId: string | null;
  branchId: string | null;
  userId?: string | null;
}

export function SalesHome({ onBack, onNewSale, companyId, branchId, userId }: SalesHomeProps) {
  const [recentSales, setRecentSales] = useState<SaleRecord[]>([]);
  const [stats, setStats] = useState<{ today: number; week: number }>({ today: 0, week: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null);
  const [menuSale, setMenuSale] = useState<SaleRecord | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<Array<{ id: string; date: string; amount: number; method: string; referenceNo: string; attachments?: { url: string; name: string }[] }>>([]);
  const [attachmentPreviewList, setAttachmentPreviewList] = useState<Array<{ url: string; name: string }> | null>(null);
  const [studioSummary, setStudioSummary] = useState<{
    has_studio: boolean;
    production_status: string;
    total_studio_cost: number;
    tasks_completed: number;
    tasks_total: number;
    production_duration_days: number | null;
    completed_at: string | null;
    breakdown: Array<{ task_type: string; cost: number; worker_id?: string }>;
    tasks_with_workers: Array<{ task_type: string; cost: number; worker_id?: string; worker_name?: string; created_by?: string; completed_by?: string }>;
  } | null>(null);
  const [showStudioBreakdown, setShowStudioBreakdown] = useState(false);

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
          const createdByUser = (s.created_by ?? s.created_by_user) as { full_name?: string } | null;
          const d = (s.invoice_date as string) || (s.created_at as string) || '';
          const dateObj = d ? new Date(d) : new Date();
          const isToday = dateObj.toDateString() === new Date().toDateString();
          const isYesterday = dateObj.toDateString() === new Date(Date.now() - 864e5).toDateString();
          let dateStr = dateObj.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
          if (isToday) dateStr = `Today, ${dateStr}`;
          else if (isYesterday) dateStr = `Yesterday, ${dateStr}`;
          else dateStr = dateObj.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
          const totalAmount = Number(s.total_amount ?? s.total ?? 0);
          const totalReceived = Number(s.total_received ?? 0);
          const balanceDue = Number(s.balance_due ?? 0);
          const creditBalance = Number(s.credit_balance ?? 0);
          const studioCharges = Number(s.studio_charges ?? 0);
          const grandTotal = Number(s.grand_total ?? totalAmount + studioCharges);
          return {
            raw: s,
            id: (s.invoice_no as string) || (s.id as string) || '—',
            customer: (cust?.name as string) || (s.customer_name as string) || 'Walk-in',
            amount: totalAmount,
            total_received: totalReceived,
            balance_due: balanceDue,
            credit_balance: creditBalance,
            date: dateStr,
            created_by_name: (createdByUser?.full_name as string) || '',
            studio_charges: studioCharges,
            grand_total: grandTotal,
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

  useEffect(() => {
    if (!selectedSale) {
      setStudioSummary(null);
      setShowStudioBreakdown(false);
      return;
    }
    const saleId = selectedSale.raw.id as string;
    if (!saleId) {
      setStudioSummary(null);
      return;
    }
    let cancelled = false;
    salesApi.getSaleStudioSummary(saleId).then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        setStudioSummary(null);
        return;
      }
      setStudioSummary(data ?? null);
    });
    return () => { cancelled = true; };
  }, [selectedSale]);

  const [cancelling, setCancelling] = useState(false);
  const [addPaymentSale, setAddPaymentSale] = useState<SaleRecord | null>(null);
  const baseUrl = import.meta.env.VITE_APP_URL || '';

  const refetchSales = useCallback(async (): Promise<SaleRecord[]> => {
    if (!companyId) return [];
    const effectiveBranchId = branchId && branchId !== 'all' ? branchId : null;
    const [salesRes, todayRes, weekRes] = await Promise.all([
      salesApi.getAllSales(companyId, effectiveBranchId),
      reportsApi.getSalesSummary(companyId, effectiveBranchId, 1),
      reportsApi.getSalesSummary(companyId, effectiveBranchId, 7),
    ]);
    let list: SaleRecord[] = [];
    if (salesRes.data?.length) {
      list = salesRes.data.slice(0, 10).map((s: Record<string, unknown>) => {
        const cust = s.customer as { name?: string } | null;
        const createdByUser = (s.created_by ?? s.created_by_user) as { full_name?: string } | null;
        const d = (s.invoice_date as string) || (s.created_at as string) || '';
        const dateObj = d ? new Date(d) : new Date();
        const isToday = dateObj.toDateString() === new Date().toDateString();
        const isYesterday = dateObj.toDateString() === new Date(Date.now() - 864e5).toDateString();
        let dateStr = dateObj.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
        if (isToday) dateStr = `Today, ${dateStr}`;
        else if (isYesterday) dateStr = `Yesterday, ${dateStr}`;
        else dateStr = dateObj.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
        const totalAmount = Number(s.total_amount ?? s.total ?? 0);
        const totalReceived = Number(s.total_received ?? 0);
        const balanceDue = Number(s.balance_due ?? 0);
        const creditBalance = Number(s.credit_balance ?? 0);
        const studioCharges = Number(s.studio_charges ?? 0);
        const grandTotal = Number(s.grand_total ?? totalAmount + studioCharges);
        return {
          raw: s,
          id: (s.invoice_no as string) || (s.id as string) || '—',
          customer: (cust?.name as string) || (s.customer_name as string) || 'Walk-in',
          amount: totalAmount,
          total_received: totalReceived,
          balance_due: balanceDue,
          credit_balance: creditBalance,
          date: dateStr,
          created_by_name: (createdByUser?.full_name as string) || '',
          studio_charges: studioCharges,
          grand_total: grandTotal,
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
    return list;
  }, [companyId, branchId]);

  const handleReceivePaymentSuccess = useCallback(async () => {
    const paidSaleId = addPaymentSale?.raw.id as string | undefined;
    setAddPaymentSale(null);
    const list = await refetchSales();
    if (list?.length && paidSaleId) {
      const updated = list.find((s) => (s.raw.id as string) === paidSaleId);
      if (updated) {
        setSelectedSale(updated);
        loadPaymentHistory(paidSaleId);
      } else {
        setSelectedSale(null);
      }
    } else {
      setSelectedSale(null);
    }
  }, [refetchSales, addPaymentSale, loadPaymentHistory]);

  const saleIdRaw = (s: SaleRecord) => (s.raw.id as string) || s.id;
  const handlePrintA4 = (sale: SaleRecord) => {
    setMenuSale(null);
    salesApi.logPrint(saleIdRaw(sale), 'A4', userId).catch(() => {});
    window.open(`${baseUrl}/sales?print=${saleIdRaw(sale)}`, '_blank', 'noopener');
  };
  const handlePrintThermal = (sale: SaleRecord) => {
    setMenuSale(null);
    salesApi.logPrint(saleIdRaw(sale), 'Thermal', userId).catch(() => {});
    window.open(`${baseUrl}/sales?print=${saleIdRaw(sale)}&thermal=1`, '_blank', 'noopener');
  };
  const handleShareWhatsApp = (sale: SaleRecord) => {
    setMenuSale(null);
    const due = sale.balance_due ?? 0;
    const total = sale.grand_total ?? sale.amount + (sale.studio_charges ?? 0);
    const link = `${baseUrl}/sales?invoice=${encodeURIComponent(saleIdRaw(sale))}`;
    const text = [`Invoice: ${sale.id}`, `Customer: ${sale.customer}`, `Total: Rs. ${total.toLocaleString()}`, `Balance Due: Rs. ${due.toLocaleString()}`, `View: ${link}`].join('\n');
    salesApi.logShare(saleIdRaw(sale), 'whatsapp', userId).catch(() => {});
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };
  const handleSharePdf = (sale: SaleRecord) => {
    setMenuSale(null);
    salesApi.logShare(saleIdRaw(sale), 'pdf', userId).catch(() => {});
    window.open(`${baseUrl}/sales?print=${saleIdRaw(sale)}`, '_blank', 'noopener');
  };
  const handleDownloadPdf = (sale: SaleRecord) => {
    setMenuSale(null);
    salesApi.logPrint(saleIdRaw(sale), 'A4', userId).catch(() => {});
    window.open(`${baseUrl}/sales?print=${saleIdRaw(sale)}`, '_blank', 'noopener');
  };
  const handlePrint = handlePrintA4;
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

  const openAddPayment = (sale: SaleRecord) => {
    setMenuSale(null);
    setAddPaymentSale(sale);
  };

  const closeAddPayment = () => setAddPaymentSale(null);

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
    const saleAmount = selectedSale.amount;
    const studioCost = selectedSale.studio_charges ?? 0;
    const grandTotal = selectedSale.grand_total ?? saleAmount + studioCost;
    const paidAmount = selectedSale.total_received;
    const dueAmount = selectedSale.balance_due;
    const paymentStatus = dueAmount <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';
    const cust = selectedSale.raw.customer as { name?: string; phone?: string } | null;
    const customerPhone = cust?.phone ?? (selectedSale.raw.contact_phone as string) ?? '—';
    const subtotal = Number(selectedSale.raw.subtotal ?? saleAmount);
    const discount = Number(selectedSale.raw.discount ?? 0);
    const isCancelled = selectedSale.raw.status === 'cancelled';
    const hasStudio = (studioSummary?.has_studio ?? false) || studioCost > 0;

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
                    <div className="absolute right-0 top-full mt-1 bg-[#1F2937] border border-[#374151] rounded-xl shadow-xl overflow-hidden min-w-[200px] z-50 max-h-[70vh] overflow-y-auto">
                      <button onClick={() => { handleShareWhatsApp(selectedSale); }} className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-[#374151]">
                        <Share2 className="w-5 h-5 text-[#10B981]" /> Share via WhatsApp
                      </button>
                      <button onClick={() => { handleSharePdf(selectedSale); }} className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-[#374151]">
                        <Share2 className="w-5 h-5 text-[#3B82F6]" /> Share PDF
                      </button>
                      <button onClick={() => { handlePrintA4(selectedSale); }} className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-[#374151]">
                        <Printer className="w-5 h-5 text-[#3B82F6]" /> Print A4
                      </button>
                      <button onClick={() => { handlePrintThermal(selectedSale); }} className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-[#374151]">
                        <FileText className="w-5 h-5 text-[#9CA3AF]" /> Print Thermal
                      </button>
                      <button onClick={() => { handleDownloadPdf(selectedSale); }} className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-[#374151]">
                        <Download className="w-5 h-5 text-[#3B82F6]" /> Download PDF
                      </button>
                      <div className="border-t border-[#374151]" />
                      <button onClick={() => { handleReturn(selectedSale); }} className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-[#374151]">
                        <RotateCcw className="w-5 h-5 text-[#3B82F6]" /> Create Sale Return
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
              <span className="text-white">Sale Amount:</span>
              <span className="text-[#10B981]">Rs. {saleAmount.toLocaleString()}</span>
            </div>
          </div>

          {hasStudio && (
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#3B82F6]" />
                STUDIO COST SUMMARY
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#9CA3AF]">Production Status:</span>
                  <span className="text-white capitalize">{studioSummary?.production_status ?? (studioCost > 0 ? 'In Progress' : '—')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9CA3AF]">Total Studio Cost:</span>
                  <span className="text-[#F59E0B] font-medium">Rs. {(studioSummary?.total_studio_cost ?? studioCost).toLocaleString()}</span>
                </div>
                {(studioSummary?.tasks_total ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#9CA3AF]">Tasks Completed:</span>
                    <span className="text-white">{studioSummary?.tasks_completed ?? 0} / {studioSummary?.tasks_total ?? 0}</span>
                  </div>
                )}
                {studioSummary?.production_duration_days != null && (
                  <div className="flex justify-between">
                    <span className="text-[#9CA3AF]">Production Duration:</span>
                    <span className="text-white">{studioSummary.production_duration_days} Days</span>
                  </div>
                )}
                {studioSummary?.completed_at && (
                  <div className="flex justify-between">
                    <span className="text-[#9CA3AF]">Completed On:</span>
                    <span className="text-white">{new Date(studioSummary.completed_at).toLocaleDateString('en-PK')}</span>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowStudioBreakdown((b) => !b)}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2 text-sm text-[#3B82F6] hover:bg-[#374151] rounded-lg"
              >
                {showStudioBreakdown ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                View Studio Breakdown
              </button>
              {showStudioBreakdown && (studioSummary?.tasks_with_workers?.length ? (
                <div className="mt-3 pt-3 border-t border-[#374151] space-y-2">
                  {studioSummary.tasks_with_workers.map((t, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-[#9CA3AF] capitalize">{t.task_type.replace(/_/g, ' ')}:</span>
                      <span className="text-white">Rs. {Number(t.cost).toLocaleString()}{t.worker_name ? ` (${t.worker_name})` : ''}</span>
                    </div>
                  ))}
                </div>
              ) : showStudioBreakdown && (studioSummary?.breakdown?.length ? (
                <div className="mt-3 pt-3 border-t border-[#374151] space-y-2">
                  {studioSummary.breakdown.map((t, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-[#9CA3AF] capitalize">{t.task_type.replace(/_/g, ' ')}:</span>
                      <span className="text-white">Rs. {Number(t.cost).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ) : showStudioBreakdown ? (
                <p className="mt-3 pt-3 border-t border-[#374151] text-xs text-[#9CA3AF]">No task breakdown available.</p>
              ) : null) )}
            </div>
          )}

          <div className="bg-gradient-to-br from-[#3B82F6]/10 to-[#10B981]/10 border border-[#3B82F6]/30 rounded-xl p-4 space-y-2">
            <h3 className="text-sm font-medium text-white mb-1">Final Bill</h3>
            <div className="flex justify-between text-sm">
              <span className="text-[#9CA3AF]">Sale Amount</span>
              <span className="text-white">Rs. {saleAmount.toLocaleString()}</span>
            </div>
            {studioCost > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-[#9CA3AF]">+ Studio Cost</span>
                <span className="text-[#F59E0B]">Rs. {studioCost.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-medium pt-1 border-t border-[#3B82F6]/30">
              <span className="text-white">Grand Total</span>
              <span className="text-[#10B981]">Rs. {grandTotal.toLocaleString()}</span>
            </div>
            <div className="pt-2 border-t border-[#3B82F6]/30 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-[#9CA3AF]">Customer Payments:</span>
                <span className="text-[#10B981]">Rs. {paidAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span className="text-white">Balance Due:</span>
                <span className={getPaymentStatusColor(paymentStatus)}>
                  Rs. {dueAmount.toLocaleString()}
                </span>
              </div>
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
                  <div key={p.id} className="flex justify-between items-center text-sm py-2 border-b border-[#374151] last:border-0 gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-white font-medium">Rs. {p.amount.toLocaleString()}</p>
                      <p className="text-xs text-[#9CA3AF]">{p.method} • {p.date}</p>
                      {p.referenceNo !== '—' && <p className="text-xs text-[#6B7280]">Ref: {p.referenceNo}</p>}
                    </div>
                    {p.attachments && p.attachments.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setAttachmentPreviewList(p.attachments!)}
                        className="p-2 rounded-lg text-[#3B82F6] hover:bg-[#374151] shrink-0"
                        aria-label="View attachments"
                      >
                        <Paperclip className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {attachmentPreviewList && attachmentPreviewList.length > 0 && (
            <AttachmentPreviewModal
              attachments={attachmentPreviewList}
              initialIndex={0}
              isOpen={true}
              onClose={() => setAttachmentPreviewList(null)}
            />
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
            {filteredSales.map((sale) => {
              const isCancelled = sale.raw.status === 'cancelled';
              const overpaid = sale.credit_balance > 0;
              const paid = !overpaid && sale.balance_due <= 0;
              const partial = !overpaid && sale.balance_due > 0 && sale.total_received > 0;
              const unpaid = !overpaid && sale.balance_due > 0 && sale.total_received === 0;
              const showAddPayment = !isCancelled && !overpaid && sale.balance_due > 0;
              return (
              <div key={sale.id} className="relative bg-[#1F2937] border border-[#374151] rounded-xl overflow-hidden hover:border-[#3B82F6]/50 transition-all min-w-0">
                <button
                  onClick={() => setSelectedSale(sale)}
                  className="w-full p-4 text-left active:scale-[0.98] min-w-0 pr-12"
                >
                  {/* Row 1: Invoice No. | Amount (right) */}
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-medium text-white truncate">{sale.id}</h3>
                    <span className="text-sm font-semibold text-[#10B981] shrink-0">Rs. {sale.amount.toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-[#D1D5DB] truncate">{sale.customer}</p>
                  {sale.created_by_name && (
                    <p className="text-xs text-[#9CA3AF] mt-0.5">Created by: {sale.created_by_name}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1 text-xs text-[#9CA3AF]">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span>{sale.date}</span>
                  </div>

                  <div className="border-t border-[#374151] my-3" aria-hidden="true" />

                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#9CA3AF]">Total:</span>
                      <span className="font-medium text-white">Rs. {sale.amount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#9CA3AF]">Received:</span>
                      <span className="text-[#10B981]">Rs. {sale.total_received.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-[#9CA3AF]">
                        {overpaid ? 'Credit Balance:' : 'Balance:'}
                      </span>
                      <span className={`font-medium shrink-0 ${overpaid ? 'text-[#10B981]' : 'text-white'}`}>
                        Rs. {overpaid ? sale.credit_balance.toLocaleString() : sale.balance_due.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Status badges: only one shown; no Add Payment when balance = 0 or cancelled or overpaid */}
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    {isCancelled && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#EF4444]/20 text-[#EF4444]">
                        Cancelled
                      </span>
                    )}
                    {!isCancelled && paid && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#10B981]/20 text-[#10B981]">
                        ✔ Paid
                      </span>
                    )}
                    {!isCancelled && partial && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#F59E0B]/20 text-[#F59E0B]">
                        Partially Paid
                      </span>
                    )}
                    {!isCancelled && unpaid && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#6B7280]/20 text-[#9CA3AF]">
                        Unpaid
                      </span>
                    )}
                    {!isCancelled && overpaid && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#10B981]/20 text-[#10B981]">
                        Credit Balance
                      </span>
                    )}
                  </div>
                </button>

                {/* Inline Add Payment when balance_due > 0 */}
                {showAddPayment && (
                  <div className="px-4 pb-3 pt-0 flex justify-end">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openAddPayment(sale); }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3B82F6]/90 hover:bg-[#2563EB] text-white text-sm font-medium transition-colors"
                    >
                      + Add
                    </button>
                  </div>
                )}

                <button
                  onClick={(e) => { e.stopPropagation(); setMenuSale(menuSale?.id === sale.id ? null : sale); }}
                  className="absolute top-3 right-3 p-2 hover:bg-[#374151] rounded-lg text-[#9CA3AF] transition-colors"
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
              );
            })}

            {filteredSales.length === 0 && (
              <div className="text-center py-12">
                <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-[#374151]" />
                <p className="text-[#9CA3AF]">No sales found</p>
              </div>
            )}
          </div>

          {addPaymentSale && companyId && (
            <MobileReceivePayment
              onClose={closeAddPayment}
              onSuccess={handleReceivePaymentSuccess}
              companyId={companyId}
              branchId={branchId}
              userId={userId ?? undefined}
              referenceId={addPaymentSale.raw.id as string}
              referenceNo={addPaymentSale.id}
              customerName={addPaymentSale.customer}
              customerId={(addPaymentSale.raw.customer_id as string) ?? (addPaymentSale.raw.customer as { id?: string } | null)?.id ?? null}
              totalAmount={addPaymentSale.grand_total ?? addPaymentSale.amount}
              alreadyPaid={addPaymentSale.total_received}
              outstandingAmount={addPaymentSale.balance_due}
            />
          )}
        </>
      )}
    </div>
  );
}
