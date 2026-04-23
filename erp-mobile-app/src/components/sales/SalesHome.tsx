import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, Loader2, MoreVertical, Printer, RotateCcw, Ban, History, Search, ShoppingCart, Calendar, Paperclip, Briefcase, Share2, Download, FileText, AlertTriangle, SquarePen, X } from 'lucide-react';
import * as salesApi from '../../api/sales';
import * as studioApi from '../../api/studio';
import * as reportsApi from '../../api/reports';
import { supabase } from '../../lib/supabase';
import { MobileReceivePayment } from './MobileReceivePayment';
import { AttachmentPreviewModal } from './AttachmentPreviewModal';
import { SaleReturnModal } from './SaleReturnModal';
import { PdfPreviewModal } from '../shared/PdfPreviewModal';
import { usePdfPreview } from '../shared/usePdfPreview';
import { InvoicePreviewPdf, type InvoicePreviewItem } from '../shared/InvoicePreviewPdf';

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
  /** From sales_with_shipping when sale has a shipment */
  shipment_status?: string;
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
    breakdown: Array<{ task_type: string; cost: number; worker_id?: string; worker_name?: string; completed_at?: string | null }>;
    tasks_with_workers: Array<{ task_type: string; cost: number; worker_id?: string; worker_name?: string; created_by?: string; completed_by?: string; completed_at?: string | null }>;
  } | null>(null);
  const [, setShowStudioBreakdown] = useState(false);
  const [studioBreakdownFallback, setStudioBreakdownFallback] = useState<Array<{ task_type: string; cost: number; worker_name?: string; completed_at?: string | null }>>([]);

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
          const grandTotal = Number(s.grand_total ?? totalAmount);
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
            shipment_status: (s.shipment_status as string) || undefined,
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
      setStudioBreakdownFallback([]);
      return;
    }
    const saleId = selectedSale.raw.id as string;
    if (!saleId) {
      setStudioSummary(null);
      setStudioBreakdownFallback([]);
      return;
    }
    let cancelled = false;
    const isStudioSale = (selectedSale.studio_charges ?? 0) > 0 || selectedSale.raw.is_studio === true || String(selectedSale.id || '').startsWith('STD-');
    salesApi.getSaleStudioSummary(saleId).then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        setStudioSummary(null);
        if (!isStudioSale) setStudioBreakdownFallback([]);
        return;
      }
      setStudioSummary(data ?? null);
      const hasBreakdown = (data?.tasks_with_workers?.length ?? 0) > 0 || (data?.breakdown?.length ?? 0) > 0;
      if (isStudioSale && !hasBreakdown) {
        setStudioBreakdownFallback([]);
      } else if (!isStudioSale) {
        setStudioBreakdownFallback([]);
      }
    });
    if (isStudioSale) {
      studioApi.getStudioStagesBySaleId(saleId).then(({ data: stages }) => {
        if (!cancelled) setStudioBreakdownFallback(stages ?? []);
      });
    }
    return () => { cancelled = true; };
  }, [selectedSale]);

  const [cancelling, setCancelling] = useState(false);
  const [addPaymentSale, setAddPaymentSale] = useState<SaleRecord | null>(null);
  const [cancelConfirmSale, setCancelConfirmSale] = useState<SaleRecord | null>(null);
  const [returnSale, setReturnSale] = useState<SaleRecord | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // In-app invoice preview (replaces VITE_APP_URL-dependent print/pdf navigation)
  const [previewSale, setPreviewSale] = useState<SaleRecord | null>(null);
  const pdfPreview = usePdfPreview(companyId);
  // Lightweight editor for invoice date + notes (full line-item edit stays web-only for safety)
  const [editSale, setEditSale] = useState<SaleRecord | null>(null);
  const [editDate, setEditDate] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editSaving, setEditSaving] = useState(false);

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
        const grandTotal = Number(s.grand_total ?? totalAmount);
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
          shipment_status: (s.shipment_status as string) || undefined,
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

  const openInvoicePreview = useCallback(
    async (sale: SaleRecord, kind: 'A4' | 'Thermal' | 'PDF') => {
      setMenuSale(null);
      setPreviewSale(sale);
      await pdfPreview.openPreview();
      if (kind === 'Thermal' || kind === 'A4') {
        salesApi.logPrint(saleIdRaw(sale), kind, userId).catch(() => {});
      } else {
        salesApi.logShare(saleIdRaw(sale), 'pdf', userId).catch(() => {});
      }
    },
    [pdfPreview, userId],
  );

  const handlePrintA4 = (sale: SaleRecord) => {
    openInvoicePreview(sale, 'A4');
  };
  const handlePrintThermal = (sale: SaleRecord) => {
    openInvoicePreview(sale, 'Thermal');
  };
  const handleSharePdf = (sale: SaleRecord) => {
    openInvoicePreview(sale, 'PDF');
  };
  const handleDownloadPdf = (sale: SaleRecord) => {
    openInvoicePreview(sale, 'PDF');
  };

  const handleShareWhatsApp = (sale: SaleRecord) => {
    setMenuSale(null);
    const due = sale.balance_due ?? 0;
    const total = sale.grand_total ?? sale.amount;
    const text = [
      `Invoice: ${sale.id}`,
      `Customer: ${sale.customer}`,
      `Total: Rs. ${total.toLocaleString()}`,
      `Balance Due: Rs. ${due.toLocaleString()}`,
    ].join('\n');
    const rawPhone = String(
      ((sale.raw.customer as { phone?: string } | null)?.phone as string) ||
      (sale.raw.contact_number as string) ||
      (sale.raw.contact_phone as string) ||
      '',
    );
    const cleanPhone = rawPhone.replace(/[^\d+]/g, '').replace(/^0/, '92');
    salesApi.logShare(saleIdRaw(sale), 'whatsapp', userId).catch(() => {});
    const waUrl = cleanPhone
      ? `https://wa.me/${encodeURIComponent(cleanPhone)}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleEdit = (sale: SaleRecord) => {
    setMenuSale(null);
    const currentDate = String(
      (sale.raw.invoice_date as string) || (sale.raw.created_at as string) || '',
    ).slice(0, 10);
    setEditDate(currentDate);
    setEditNotes(String((sale.raw.notes as string) || ''));
    setEditSale(sale);
  };

  const confirmEdit = async () => {
    if (!editSale || editSaving) return;
    setEditSaving(true);
    setActionError(null);
    try {
      const updates: Record<string, unknown> = {};
      if (editDate) updates.invoice_date = editDate;
      updates.notes = editNotes || null;
      const { error } = await supabase
        .from('sales')
        .update(updates)
        .eq('id', editSale.raw.id as string);
      if (error) {
        setActionError(error.message);
      } else {
        setActionSuccess(`Invoice ${editSale.id} updated.`);
        await refetchSales();
        setEditSale(null);
      }
    } finally {
      setEditSaving(false);
    }
  };
  const handlePaymentHistory = (sale: SaleRecord) => {
    setMenuSale(null);
    setSelectedSale(sale);
  };
  const handleReturn = (sale: SaleRecord) => {
    setMenuSale(null);
    const targetBranch = String((sale.raw.branch_id as string) || (branchId && branchId !== 'all' ? branchId : '') || '').trim();
    if (!targetBranch) {
      setActionError('Branch is required to create sale return. Please switch to a specific branch.');
      return;
    }
    setReturnSale(sale);
  };
  const handleCancel = (sale: SaleRecord) => {
    setMenuSale(null);
    setCancelConfirmSale(sale);
  };
  const confirmCancel = async () => {
    if (!cancelConfirmSale) return;
    setCancelling(true);
    setActionError(null);
    try {
      const { error } = await salesApi.cancelSale(cancelConfirmSale.raw.id as string);
      if (error) {
        setActionError(error);
      } else {
        setRecentSales((prev) => prev.filter((s) => s.id !== cancelConfirmSale.id));
        setSelectedSale(null);
        setActionSuccess(`Invoice ${cancelConfirmSale.id} cancelled successfully.`);
        setCancelConfirmSale(null);
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

  useEffect(() => {
    if (!actionSuccess) return;
    const t = setTimeout(() => setActionSuccess(null), 3000);
    return () => clearTimeout(t);
  }, [actionSuccess]);

  useEffect(() => {
    if (!actionError || cancelConfirmSale) return;
    const t = setTimeout(() => setActionError(null), 4000);
    return () => clearTimeout(t);
  }, [actionError, cancelConfirmSale]);

  const renderSaleMenuActions = (sale: SaleRecord) => (
    <>
      <button onClick={() => handlePaymentHistory(sale)} className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-[#374151]">
        <History className="w-5 h-5 text-[#3B82F6]" /> Payment History
      </button>
      <button onClick={() => handleShareWhatsApp(sale)} className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-[#374151]">
        <Share2 className="w-5 h-5 text-[#10B981]" /> Share via WhatsApp
      </button>
      <button onClick={() => handleSharePdf(sale)} className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-[#374151]">
        <Share2 className="w-5 h-5 text-[#3B82F6]" /> Share PDF
      </button>
      <button onClick={() => handlePrintA4(sale)} className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-[#374151]">
        <Printer className="w-5 h-5 text-[#3B82F6]" /> Print A4
      </button>
      <button onClick={() => handlePrintThermal(sale)} className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-[#374151]">
        <FileText className="w-5 h-5 text-[#9CA3AF]" /> Print Thermal
      </button>
      <button onClick={() => handleDownloadPdf(sale)} className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-[#374151]">
        <Download className="w-5 h-5 text-[#3B82F6]" /> Download PDF
      </button>
      <div className="border-t border-[#374151]" />
      <button onClick={() => handleEdit(sale)} className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-[#374151]">
        <SquarePen className="w-5 h-5 text-[#3B82F6]" /> Edit Invoice
      </button>
      <button onClick={() => handleReturn(sale)} className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-[#374151]">
        <RotateCcw className="w-5 h-5 text-[#3B82F6]" /> Create Sale Return
      </button>
      <button onClick={() => handleCancel(sale)} disabled={cancelling} className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-[#374151] disabled:opacity-50">
        <Ban className="w-5 h-5 text-[#EF4444]" /> {cancelling ? 'Cancelling...' : 'Cancel Invoice'}
      </button>
    </>
  );

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
    // Same as web drawer: when payment rows are loaded, total paid = sum of lines (sale + manual receipt allocations).
    const paidFromHistory =
      paymentHistory.length > 0 ? paymentHistory.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) : null;
    const paidAmount = paidFromHistory != null ? paidFromHistory : selectedSale.total_received;
    const dueRaw = grandTotal - paidAmount;
    const dueAmount = dueRaw <= 0.005 ? 0 : dueRaw;
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
                      {renderSaleMenuActions(selectedSale)}
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

          {hasStudio && (() => {
            const stageList = (studioSummary?.tasks_with_workers?.length ? studioSummary.tasks_with_workers : studioSummary?.breakdown?.length ? studioSummary.breakdown : studioBreakdownFallback) as Array<{ task_type: string; cost: number; worker_name?: string; completed_at?: string | null }>;
            const stageLabel = (t: string) => t === 'dyer' ? 'Dyeing' : t === 'stitching' ? 'Stitching' : t === 'handwork' ? 'Handwork' : String(t).replace(/_/g, ' ');
            const stagesSum = stageList.length ? stageList.reduce((a, t) => a + Number(t.cost), 0) : 0;
            const totalStudioCostDisplay = Math.max(studioCost, studioSummary?.total_studio_cost ?? 0, stagesSum);
            const productionStatusDisplay = studioSummary?.production_status != null && studioSummary.production_status !== ''
              ? (String(studioSummary.production_status).toLowerCase() === 'completed' ? 'Complete' : 'Pending')
              : (studioCost > 0 ? 'Pending' : '—');
            return (
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#3B82F6]" />
                STUDIO COST SUMMARY
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#9CA3AF]">Production Status:</span>
                  <span className="text-white capitalize">{productionStatusDisplay}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9CA3AF]">Total Studio Cost:</span>
                  <span className="text-[#F59E0B] font-medium">Rs. {totalStudioCostDisplay.toLocaleString()}</span>
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
              {stageList.length > 0 ? (
                <div className="mt-3 pt-3 border-t border-[#374151] space-y-3">
                  <p className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wide">Stages · Worker · Cost · Completed</p>
                  {stageList.map((t, i) => (
                    <div key={i} className="bg-[#374151]/50 rounded-lg p-3 space-y-1.5 text-sm">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-white font-medium">{stageLabel(t.task_type)}</span>
                        <span className="text-[#10B981] shrink-0">Rs. {Number(t.cost).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs text-[#9CA3AF]">
                        <span>{t.worker_name || '—'}</span>
                        <span>{t.completed_at ? new Date(t.completed_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 pt-3 border-t border-[#374151] text-xs text-[#9CA3AF]">No stage details yet. Stages will appear when production is linked.</p>
              )}
            </div>
            );
          })()}

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
                  {/* Row 1: Invoice No. | Amount (right; grand total when studio cost present) */}
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-medium text-white truncate">{sale.id}</h3>
                    <span className="text-sm font-semibold text-[#10B981] shrink-0">
                      Rs. {(sale.grand_total ?? sale.amount).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-[#D1D5DB] truncate">{sale.customer}</p>
                  {sale.shipment_status && (
                    <span className="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded bg-[#3B82F6]/20 text-[#93C5FD] border border-[#3B82F6]/30">
                      {sale.shipment_status === 'Delivered' || sale.shipment_status === 'delivered' ? '✅ Delivered' :
                        sale.shipment_status === 'In Transit' || sale.shipment_status === 'Out for Delivery' ? '🚚 In Transit' :
                        sale.shipment_status === 'Cancelled' || sale.shipment_status === 'cancelled' ? '❌ Cancelled' :
                        `📦 ${sale.shipment_status}`}
                    </span>
                  )}
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
                    {(sale.studio_charges ?? 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-[#9CA3AF]">Studio Cost:</span>
                        <span className="font-medium text-[#F59E0B]">Rs. {(sale.studio_charges ?? 0).toLocaleString()}</span>
                      </div>
                    )}
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
                        {renderSaleMenuActions(sale)}
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

          {actionSuccess && (
            <div className="fixed left-4 right-4 bottom-24 z-[75] py-3 px-4 rounded-lg text-sm font-medium text-center shadow-lg bg-[#10B981] text-white">
              {actionSuccess}
            </div>
          )}
          {!cancelConfirmSale && actionError && (
            <div className="fixed left-4 right-4 bottom-24 z-[75] py-3 px-4 rounded-lg text-sm font-medium text-center shadow-lg bg-[#EF4444] text-white">
              {actionError}
            </div>
          )}
        </>
      )}

      {cancelConfirmSale && (
        <div className="fixed inset-0 z-[85] bg-black/70 flex items-end sm:items-center justify-center p-4" onClick={() => setCancelConfirmSale(null)}>
          <div className="w-full max-w-sm bg-[#1F2937] border border-[#374151] rounded-2xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-[#EF4444]/20 text-[#EF4444]">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Cancel invoice?</h3>
                <p className="text-sm text-[#9CA3AF] mt-1">
                  {cancelConfirmSale.id} will be cancelled and hidden from active sales.
                </p>
              </div>
            </div>
            {actionError && <p className="mt-3 text-sm text-[#FCA5A5]">{actionError}</p>}
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button type="button" onClick={() => setCancelConfirmSale(null)} className="h-10 rounded-lg border border-[#374151] text-[#D1D5DB]">
                Keep
              </button>
              <button type="button" onClick={confirmCancel} disabled={cancelling} className="h-10 rounded-lg bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-60 text-white font-medium">
                {cancelling ? 'Cancelling...' : 'Cancel Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {returnSale && companyId && (
        <SaleReturnModal
          isOpen={true}
          companyId={companyId}
          branchId={String((returnSale.raw.branch_id as string) || (branchId && branchId !== 'all' ? branchId : '') || '')}
          saleId={String(returnSale.raw.id || '')}
          saleNo={returnSale.id}
          customerId={((returnSale.raw.customer as { id?: string } | null)?.id as string) || (returnSale.raw.customer_id as string) || null}
          customerName={returnSale.customer}
          userId={userId ?? null}
          onClose={() => setReturnSale(null)}
          onSuccess={({ returnNo }) => {
            setReturnSale(null);
            setActionSuccess(`Sale return ${returnNo} created successfully.`);
          }}
        />
      )}

      {previewSale && pdfPreview.brand && (
        <PdfPreviewModal
          open={pdfPreview.open}
          onClose={() => { pdfPreview.close(); setPreviewSale(null); }}
          title={`Invoice ${previewSale.id}`}
          filename={`invoice-${previewSale.id}.pdf`}
          whatsAppFallbackText={`Invoice: ${previewSale.id}\nCustomer: ${previewSale.customer}\nTotal: Rs. ${(previewSale.grand_total ?? previewSale.amount).toLocaleString()}`}
        >
          <InvoicePreviewPdf
            brand={pdfPreview.brand}
            docType="sale"
            docNumber={previewSale.id}
            docDate={String((previewSale.raw.invoice_date as string) || (previewSale.raw.created_at as string) || '').slice(0, 10)}
            partyName={previewSale.customer}
            partyPhone={((previewSale.raw.customer as { phone?: string } | null)?.phone as string) || (previewSale.raw.contact_phone as string) || null}
            branchName={((previewSale.raw.branch as { name?: string } | null)?.name as string) || null}
            items={(((previewSale.raw.items as Array<Record<string, unknown>>) || []).map((it) => ({
              productName: String(it.product_name ?? (it.product as { name?: string } | null)?.name ?? 'Item'),
              sku: (it.sku as string) || ((it.product as { sku?: string } | null)?.sku as string) || null,
              quantity: Number(it.quantity ?? 0),
              unitPrice: Number(it.unit_price ?? 0),
              total: Number(it.total ?? 0),
            }) as InvoicePreviewItem))}
            subtotal={Number(previewSale.raw.subtotal ?? previewSale.amount)}
            discount={Number(previewSale.raw.discount_amount ?? previewSale.raw.discount ?? 0)}
            tax={Number(previewSale.raw.tax_amount ?? 0)}
            total={previewSale.grand_total ?? previewSale.amount}
            paid={previewSale.total_received}
            due={previewSale.balance_due}
            notes={(previewSale.raw.notes as string) || null}
            generatedBy={previewSale.created_by_name || null}
          />
        </PdfPreviewModal>
      )}

      {editSale && (
        <div className="fixed inset-0 z-[80] bg-black/70 flex items-end sm:items-center justify-center p-4" onClick={() => !editSaving && setEditSale(null)}>
          <div className="bg-[#1F2937] border border-[#374151] rounded-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-[#374151] flex items-center justify-between">
              <div>
                <h3 className="text-white font-semibold">Edit Invoice</h3>
                <p className="text-xs text-[#9CA3AF]">{editSale.id}</p>
              </div>
              <button onClick={() => !editSaving && setEditSale(null)} className="p-2 rounded-lg hover:bg-[#374151] text-[#9CA3AF]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs text-[#9CA3AF] mb-1">Invoice Date</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full h-10 rounded-lg bg-[#111827] border border-[#374151] text-white px-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-[#9CA3AF] mb-1">Notes</label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full rounded-lg bg-[#111827] border border-[#374151] text-white px-3 py-2 text-sm resize-none"
                />
              </div>
              <p className="text-[11px] text-[#F59E0B]">
                For line-item edits (products, quantities, prices) please cancel this invoice and create a new one — ensures accounting stays consistent.
              </p>
              {actionError && <div className="rounded-lg bg-[#EF4444] text-white text-sm px-3 py-2">{actionError}</div>}
            </div>
            <div className="p-4 border-t border-[#374151] grid grid-cols-2 gap-3">
              <button type="button" onClick={() => !editSaving && setEditSale(null)} className="h-11 rounded-lg border border-[#374151] text-[#D1D5DB]">
                Cancel
              </button>
              <button type="button" onClick={confirmEdit} disabled={editSaving} className="h-11 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-60 text-white font-medium">
                {editSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
