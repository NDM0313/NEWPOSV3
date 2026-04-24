import { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, ShoppingBag, Plus, Search, Package, Calendar, Loader2, MapPin, Paperclip, MoreVertical, History, Share2, Printer, Download, SquarePen, RotateCcw, Ban, AlertTriangle, X, Trash2 } from 'lucide-react';
import type { User } from '../../types';
import * as purchasesApi from '../../api/purchases';
import {
  purchaseAccountingSnapshotFromRow,
  syncPurchaseDocumentJournalInPlaceMobile,
} from '../../api/purchaseEditAccounting';
import * as branchesApi from '../../api/branches';
import * as contactsApi from '../../api/contacts';
import * as productsApi from '../../api/products';
import { supabase, erpMobileCanUseRealtime } from '../../lib/supabase';
import { CreatePurchaseFlow } from './CreatePurchaseFlow';
import { MobilePaySupplier } from './MobilePaySupplier';
import { AttachmentPreviewModal } from '../sales/AttachmentPreviewModal';
import { MobileActionBar } from '../shared/MobileActionBar';
import { PdfPreviewModal } from '../shared/PdfPreviewModal';
import { usePdfPreview } from '../shared/usePdfPreview';
import { InvoicePreviewPdf, type InvoicePreviewItem } from '../shared/InvoicePreviewPdf';

interface PurchaseModuleProps {
  onBack: () => void;
  user: User;
  companyId: string | null;
  branchId: string | null;
}

type EditPurchaseLine = {
  lineKey: string;
  lineId: string;
  productId: string;
  variationId: string | null;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
};

export function PurchaseModule({ onBack, user, companyId, branchId }: PurchaseModuleProps) {
  const [view, setView] = useState<'list' | 'create' | 'details'>('list');
  const [orders, setOrders] = useState<purchasesApi.PurchaseListItem[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<purchasesApi.PurchaseDetail | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(!!companyId);
  const [detailLoading, setDetailLoading] = useState(false);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [showBranchPicker, setShowBranchPicker] = useState(false);
  const [createBranchId, setCreateBranchId] = useState<string | null>(null);
  const [addPaymentOrder, setAddPaymentOrder] = useState<purchasesApi.PurchaseListItem | null>(null);
  const [menuOrder, setMenuOrder] = useState<purchasesApi.PurchaseListItem | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<purchasesApi.PurchasePaymentRow[]>([]);
  const [attachmentPreviewList, setAttachmentPreviewList] = useState<Array<{ url: string; name: string }> | null>(null);
  const [markAsFinalError, setMarkAsFinalError] = useState<string | null>(null);
  const [markAsFinalLoading, setMarkAsFinalLoading] = useState(false);
  const [cancelOrder, setCancelOrder] = useState<purchasesApi.PurchaseListItem | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  // In-app preview/edit state (replaces VITE_APP_URL-based tab navigation)
  const [previewOrder, setPreviewOrder] = useState<purchasesApi.PurchaseListItem | null>(null);
  const [previewItems, setPreviewItems] = useState<InvoicePreviewItem[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const pdfPreview = usePdfPreview(companyId);
  const [editOrder, setEditOrder] = useState<purchasesApi.PurchaseListItem | null>(null);
  const [editDate, setEditDate] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editSupplierId, setEditSupplierId] = useState<string | null>(null);
  const [editSupplierName, setEditSupplierName] = useState<string>('');
  const [editSupplierOptions, setEditSupplierOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [editSuppliersLoading, setEditSuppliersLoading] = useState(false);
  const [frozenShippingCost, setFrozenShippingCost] = useState(0);
  const [editDiscount, setEditDiscount] = useState<string>('0');
  const [editTax, setEditTax] = useState<string>('0');
  const [showDiscountField, setShowDiscountField] = useState(false);
  const [showTaxField, setShowTaxField] = useState(false);
  const [productCatalog, setProductCatalog] = useState<productsApi.Product[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [showAddProductRow, setShowAddProductRow] = useState(false);
  const [editLineItems, setEditLineItems] = useState<EditPurchaseLine[]>([]);
  const [editLinesLoading, setEditLinesLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [returnNotice, setReturnNotice] = useState<purchasesApi.PurchaseListItem | null>(null);

  const effectiveBranchId = branchId && branchId !== 'all' ? branchId : undefined;

  const loadPaymentHistory = useCallback(async (purchaseId: string) => {
    if (!purchaseId) return;
    const { data } = await purchasesApi.getPurchasePayments(purchaseId);
    setPaymentHistory(data || []);
  }, []);

  useEffect(() => {
    if (selectedOrder) {
      loadPaymentHistory(selectedOrder.id);
    } else {
      setPaymentHistory([]);
    }
  }, [selectedOrder, loadPaymentHistory]);
  const canAddDirect = !!companyId && !!effectiveBranchId;
  const canAddWithPicker = !!companyId && branchId === 'all' && !branchesLoading && branches.length > 0;

  const loadOrders = useCallback(() => {
    if (!companyId) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    purchasesApi.getPurchases(companyId, effectiveBranchId ?? null).then(({ data, error }) => {
      setLoading(false);
      setOrders(error ? [] : data);
    });
  }, [companyId, effectiveBranchId]);

  useEffect(() => {
    if (!companyId) {
      setOrders([]);
      setLoading(false);
      return;
    }
    loadOrders();
  }, [companyId, effectiveBranchId, loadOrders]);

  useEffect(() => {
    if (!companyId || !erpMobileCanUseRealtime) return;
    const channel = supabase
      .channel('purchases-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchases' }, () => {
        loadOrders();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, loadOrders]);

  useEffect(() => {
    if (companyId && branchId === 'all') {
      setBranchesLoading(true);
      branchesApi.getBranches(companyId).then(({ data }) => {
        setBranchesLoading(false);
        if (data?.length) setBranches(data);
        else setBranches([]);
      });
    } else {
      setBranches([]);
      setBranchesLoading(false);
    }
  }, [companyId, branchId]);

  const handleAddClick = () => {
    if (canAddDirect) {
      setCreateBranchId(branchId);
      setView('create');
    } else if (canAddWithPicker && branches.length === 1) {
      setCreateBranchId(branches[0].id);
      setView('create');
    } else if (canAddWithPicker && branches.length > 1) {
      setShowBranchPicker(true);
    }
  };

  const handleBranchPick = (id: string) => {
    setCreateBranchId(id);
    setShowBranchPicker(false);
    setView('create');
  };

  const handleOrderClick = async (order: purchasesApi.PurchaseListItem) => {
    if (!companyId) return;
    setDetailLoading(true);
    setSelectedOrder(null);
    const { data, error } = await purchasesApi.getPurchaseById(companyId, order.id);
    setDetailLoading(false);
    if (error || !data) return;
    setSelectedOrder(data);
    setView('details');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'text-[#9CA3AF] bg-[#9CA3AF]/10';
      case 'sent':
      case 'ordered':
        return 'text-[#3B82F6] bg-[#3B82F6]/10';
      case 'confirmed':
        return 'text-[#F59E0B] bg-[#F59E0B]/10';
      case 'received':
      case 'final':
        return 'text-[#10B981] bg-[#10B981]/10';
      case 'cancelled':
        return 'text-[#EF4444] bg-[#EF4444]/10';
      default:
        return 'text-[#9CA3AF] bg-[#9CA3AF]/10';
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

  const filteredOrders = orders.filter(
    (order) =>
      order.vendor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.poNo.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingCount = orders.filter((o) => o.status !== 'received' && o.status !== 'final').length;
  const receivedCount = orders.filter((o) => o.status === 'received' || o.status === 'final').length;

  const handleShareWhatsApp = (order: purchasesApi.PurchaseListItem) => {
    setMenuOrder(null);
    const text = [
      `PO: ${order.poNo}`,
      `Supplier: ${order.vendor}`,
      `Total: Rs. ${order.total.toLocaleString()}`,
      `Due: Rs. ${order.dueAmount.toLocaleString()}`,
    ].join('\n');
    const cleanPhone = String(order.vendorPhone || '').replace(/[^\d+]/g, '').replace(/^0/, '92');
    const waUrl = cleanPhone
      ? `https://wa.me/${encodeURIComponent(cleanPhone)}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const openPurchasePreview = useCallback(async (order: purchasesApi.PurchaseListItem) => {
    if (!companyId) return;
    setMenuOrder(null);
    setPreviewOrder(order);
    setPreviewLoading(true);
    try {
      const [{ data: detail }] = await Promise.all([
        purchasesApi.getPurchaseById(companyId, order.id),
        pdfPreview.openPreview(),
      ]);
      const items: InvoicePreviewItem[] = (detail?.items || []).map((it) => ({
        productName: it.productName,
        sku: null,
        quantity: Number(it.quantity) || 0,
        unitPrice: Number(it.unitPrice) || 0,
        total: Number(it.total) || 0,
      }));
      setPreviewItems(items);
    } finally {
      setPreviewLoading(false);
    }
  }, [companyId, pdfPreview]);

  const handlePrint = (order: purchasesApi.PurchaseListItem) => { openPurchasePreview(order); };

  const handleEdit = async (order: purchasesApi.PurchaseListItem) => {
    setMenuOrder(null);
    setEditOrder(order);
    setEditLineItems([]);
    setEditLinesLoading(true);
    setActionError(null);
    setProductSearch('');
    setShowAddProductRow(false);
    const effBranch = branchId && branchId !== 'all' ? branchId : null;
    if (companyId) {
      setEditSuppliersLoading(true);
      void contactsApi.getContacts(companyId, 'supplier', effBranch).then(({ data, error: sErr }) => {
        setEditSuppliersLoading(false);
        if (!sErr && data?.length) setEditSupplierOptions(data.map((c) => ({ id: c.id, name: c.name })));
        else setEditSupplierOptions([]);
      });
      void productsApi.getProducts(companyId).then(({ data }) => setProductCatalog(data || []));
    } else {
      setEditSupplierOptions([]);
      setProductCatalog([]);
    }
    if (!companyId) {
      setEditLinesLoading(false);
      return;
    }
    const { data: det, error: detErr } = await purchasesApi.getPurchaseById(companyId, order.id);
    setEditLinesLoading(false);
    if (detErr || !det) {
      setEditDate(String(order.date || '').slice(0, 10));
      setEditSupplierName(order.vendor || '');
      setEditSupplierId(null);
      setEditDiscount(String(order.discount ?? 0));
      setShowDiscountField(Number(order.discount ?? 0) > 0);
      const { data: extra } = await supabase
        .from('purchases')
        .select('notes, shipping_cost, tax_amount, supplier_id')
        .eq('id', order.id)
        .maybeSingle();
      const r = (extra ?? {}) as Record<string, unknown>;
      setEditNotes(String((r.notes as string) || ''));
      setFrozenShippingCost(Number(r.shipping_cost ?? 0) || 0);
      const taxVal = Number(r.tax_amount ?? 0) || 0;
      setEditTax(String(taxVal));
      setShowTaxField(taxVal > 0);
      setEditSupplierId((r.supplier_id as string) || null);
      return;
    }
    setEditDate(det.orderDate && det.orderDate !== '—' ? det.orderDate.slice(0, 10) : String(order.date || '').slice(0, 10));
    setEditSupplierName(det.vendor);
    setEditSupplierId(det.supplierId ?? null);
    setEditDiscount(String(det.discount));
    setEditTax(String(det.taxAmount ?? 0));
    setFrozenShippingCost(Number(det.shippingCost) || 0);
    setEditNotes(det.notes ?? '');
    setShowDiscountField(det.discount > 0);
    setShowTaxField(det.taxAmount > 0);
    setEditLineItems(
      det.items
        .filter((it) => it.productId)
        .map((it) => ({
          lineKey: it.id,
          lineId: it.id,
          productId: it.productId as string,
          variationId: it.variationId ?? null,
          productName: it.productName,
          sku: it.sku || '—',
          quantity: it.quantity,
          unitPrice: it.unitPrice,
        })),
    );
  };

  const updateEditPurchaseLine = (index: number, patch: Partial<EditPurchaseLine>) => {
    setEditLineItems((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const removeEditPurchaseLine = (index: number) => {
    setEditLineItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const editPurchaseLineSubtotal = editLineItems.reduce(
    (s, r) => s + Math.max(0, (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0)),
    0,
  );

  const filteredPurchaseCatalog = useMemo(() => {
    if (!editOrder) return [];
    const q = productSearch.trim().toLowerCase();
    if (!q) return productCatalog.slice(0, 35);
    return productCatalog
      .filter((p) => p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q))
      .slice(0, 45);
  }, [editOrder, productSearch, productCatalog]);

  const closePurchaseEditModal = () => {
    if (editSaving) return;
    setEditOrder(null);
    setEditLineItems([]);
    setEditSupplierOptions([]);
    setProductCatalog([]);
    setProductSearch('');
    setShowAddProductRow(false);
    setShowDiscountField(false);
    setShowTaxField(false);
  };

  const pickProductForEditPurchase = (p: productsApi.Product) => {
    const key = globalThis.crypto?.randomUUID?.() ?? `plk-${Date.now()}`;
    if (p.hasVariations && p.variations && p.variations.length > 0) {
      const v = p.variations[0];
      setEditLineItems((prev) => [
        ...prev,
        {
          lineKey: key,
          lineId: key,
          productId: p.id,
          variationId: v.id,
          productName: `${p.name} (${Object.values(v.attributes || {}).filter(Boolean).join(', ')})`,
          sku: v.sku,
          quantity: 1,
          unitPrice: Number(v.price) || 0,
        },
      ]);
    } else {
      setEditLineItems((prev) => [
        ...prev,
        {
          lineKey: key,
          lineId: key,
          productId: p.id,
          variationId: null,
          productName: p.name,
          sku: p.sku,
          quantity: 1,
          unitPrice: Number(p.costPrice) || Number(p.retailPrice) || 0,
        },
      ]);
    }
    setProductSearch('');
    setShowAddProductRow(false);
  };

  const confirmEditOrder = async () => {
    if (!editOrder || editSaving) return;
    const purchaseId = editOrder.id;
    const poNoCapture = editOrder.poNo;
    const vendorCapture = editOrder.vendor;
    let oldPurchaseSnap: ReturnType<typeof purchaseAccountingSnapshotFromRow> | null = null;
    if (companyId) {
      const { data: rb } = await supabase
        .from('purchases')
        .select('total, subtotal, discount_amount, shipping_cost, tax_amount, purchase_charges')
        .eq('id', purchaseId)
        .maybeSingle();
      oldPurchaseSnap = purchaseAccountingSnapshotFromRow(
        rb
          ? (rb as Record<string, unknown>)
          : {
              total: editOrder.total,
              subtotal: editOrder.subtotal,
              discount_amount: editOrder.discount,
              shipping_cost: frozenShippingCost,
            },
      );
    }
    setEditSaving(true);
    setActionError(null);
    try {
      const discount = Number(editDiscount) || 0;
      const shipping = frozenShippingCost;
      const tax = Number(editTax) || 0;
      const paid = Number(editOrder.paidAmount ?? 0) || 0;

      const lines = editLineItems
        .map((row) => {
          const qty = Math.max(0, Number(row.quantity) || 0);
          const up = Math.max(0, Number(row.unitPrice) || 0);
          const total = Math.max(0, qty * up);
          return { ...row, quantity: qty, unitPrice: up, total };
        })
        .filter((row) => row.productId && row.quantity > 0);

      if (lines.length === 0) {
        if (editLineItems.length > 0) {
          setActionError('Add at least one line with quantity greater than zero.');
          return;
        }
        const subtotal = Number(editOrder.subtotal ?? 0) || 0;
        const total = Math.max(0, subtotal - discount + tax + shipping);
        const due = Math.max(0, total - paid);
        const updates: Record<string, unknown> = {
          notes: editNotes || null,
          supplier_name: editSupplierName || editOrder.vendor,
          supplier_id: editSupplierId || null,
          discount_amount: discount,
          tax_amount: tax,
          shipping_cost: shipping,
          total,
          due_amount: due,
          updated_at: new Date().toISOString(),
        };
        if (editDate) updates.po_date = editDate;
        const { error } = await supabase.from('purchases').update(updates).eq('id', editOrder.id);
        if (error) setActionError(error.message);
        else {
          if (companyId && oldPurchaseSnap) {
            try {
              const { data: newRow } = await supabase
                .from('purchases')
                .select('total, subtotal, discount_amount, shipping_cost, tax_amount, purchase_charges')
                .eq('id', purchaseId)
                .maybeSingle();
              if (newRow) {
                const newSnap = purchaseAccountingSnapshotFromRow(newRow as Record<string, unknown>);
                const acct = await syncPurchaseDocumentJournalInPlaceMobile({
                  companyId,
                  purchaseId,
                  supplierId: editSupplierId,
                  supplierName: editSupplierName || vendorCapture,
                  poNo: poNoCapture,
                  oldSnapshot: oldPurchaseSnap,
                  newSnapshot: newSnap,
                });
                if (acct.error) console.warn('[PurchaseModule] Ledger sync after header edit:', acct.error);
              }
            } catch (e) {
              console.warn('[PurchaseModule] Ledger sync threw (header path):', e);
            }
          }
          setEditOrder(null);
          setEditLineItems([]);
          if (companyId) {
            const { data } = await purchasesApi.getPurchases(companyId, effectiveBranchId ?? null);
            if (data) setOrders(data);
          }
        }
        return;
      }

      const rpcRes = await purchasesApi.updatePurchaseWithItems({
        purchaseId: editOrder.id,
        userId: user.id,
        supplierId: editSupplierId,
        items: lines.map((r) => ({
          productId: r.productId,
          variationId: r.variationId,
          productName: r.productName,
          sku: r.sku,
          quantity: r.quantity,
          unitPrice: r.unitPrice,
          total: r.total,
        })),
        discountAmount: discount,
        taxAmount: tax,
        shippingCost: shipping,
        notes: editNotes || null,
        supplierName: editSupplierName || null,
        contactNumber: null,
        poDate: editDate || null,
      });
      if (rpcRes.error) {
        setActionError(rpcRes.error);
        return;
      }
      if (companyId && oldPurchaseSnap) {
        try {
          const { data: newRow } = await supabase
            .from('purchases')
            .select('total, subtotal, discount_amount, shipping_cost, tax_amount, purchase_charges')
            .eq('id', purchaseId)
            .maybeSingle();
          if (newRow) {
            const newSnap = purchaseAccountingSnapshotFromRow(newRow as Record<string, unknown>);
            const acct = await syncPurchaseDocumentJournalInPlaceMobile({
              companyId,
              purchaseId,
              supplierId: editSupplierId,
              supplierName: editSupplierName || vendorCapture,
              poNo: poNoCapture,
              oldSnapshot: oldPurchaseSnap,
              newSnapshot: newSnap,
            });
            if (acct.error) console.warn('[PurchaseModule] Ledger sync after line edit:', acct.error);
          }
        } catch (e) {
          console.warn('[PurchaseModule] Ledger sync threw (line path):', e);
        }
      }
      setEditOrder(null);
      setEditLineItems([]);
      if (companyId) {
        const { data } = await purchasesApi.getPurchases(companyId, effectiveBranchId ?? null);
        if (data) setOrders(data);
      }
    } finally {
      setEditSaving(false);
    }
  };

  const handleReturn = (order: purchasesApi.PurchaseListItem) => {
    setMenuOrder(null);
    // Purchase return workflow is server-heavy and lives in web ERP. Show a
    // friendly in-app notice instead of opening a new tab.
    setReturnNotice(order);
  };

  const handleCancel = (order: purchasesApi.PurchaseListItem) => {
    setMenuOrder(null);
    setCancelOrder(order);
  };

  const confirmCancel = async () => {
    if (!cancelOrder || !companyId) return;
    setCancelling(true);
    setActionError(null);
    const { error } = await purchasesApi.cancelPurchase(companyId, cancelOrder.id, {
      userId: user?.id ?? null,
    });
    setCancelling(false);
    if (error) {
      setActionError(error);
      return;
    }
    // Keep the PO visible with a "Cancelled" badge (parity with web ERP).
    setOrders((prev) =>
      prev.map((o) =>
        o.id === cancelOrder.id ? { ...o, status: 'cancelled' } : o,
      ),
    );
    if (selectedOrder?.id === cancelOrder.id) {
      setSelectedOrder((prev) => (prev ? { ...prev, status: 'cancelled' } : prev));
    }
    setCancelOrder(null);
  };

  const renderOrderMenuActions = (order: purchasesApi.PurchaseListItem) => {
    const canAddPayment = (order.status === 'final' || order.status === 'received') && order.dueAmount > 0 && (order.branchId || effectiveBranchId);
    return (
      <>
        <button onClick={() => handleOrderClick(order)} className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-[#374151]">
          <History className="w-5 h-5 text-[#3B82F6]" /> View & Payment History
        </button>
        {canAddPayment && (
          <button onClick={() => { setMenuOrder(null); setAddPaymentOrder(order); }} className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-[#374151]">
            <Plus className="w-5 h-5 text-[#10B981]" /> Add Payment
          </button>
        )}
        <button onClick={() => handleShareWhatsApp(order)} className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-[#374151]">
          <Share2 className="w-5 h-5 text-[#10B981]" /> Share via WhatsApp
        </button>
        <button onClick={() => handlePrint(order)} className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-[#374151]">
          <Printer className="w-5 h-5 text-[#3B82F6]" /> Print
        </button>
        <button onClick={() => handlePrint(order)} className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-[#374151]">
          <Download className="w-5 h-5 text-[#3B82F6]" /> Download PDF
        </button>
        <div className="border-t border-[#374151]" />
        <button onClick={() => handleEdit(order)} className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-[#374151]">
          <SquarePen className="w-5 h-5 text-[#3B82F6]" /> Edit Purchase
        </button>
        <button onClick={() => handleReturn(order)} className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-[#374151]">
          <RotateCcw className="w-5 h-5 text-[#3B82F6]" /> Create Purchase Return
        </button>
        <button onClick={() => handleCancel(order)} className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-[#374151]">
          <Ban className="w-5 h-5 text-[#EF4444]" /> Cancel Purchase
        </button>
      </>
    );
  };

  if (view === 'create' && companyId && createBranchId) {
    return (
      <CreatePurchaseFlow
        companyId={companyId}
        branchId={createBranchId}
        userId={user.id}
        onBack={() => { setView('list'); setCreateBranchId(null); }}
        onDone={() => {
          setView('list');
          setCreateBranchId(null);
          purchasesApi.getPurchases(companyId, effectiveBranchId ?? null).then(({ data }) => {
            if (data?.length) setOrders(data);
          });
        }}
      />
    );
  }

  if (view === 'details' && selectedOrder) {
    const showMarkAsFinal = ['ordered', 'draft', 'sent', 'confirmed'].includes(selectedOrder.status);
    return (
      <div className="min-h-screen bg-[#111827] flex flex-col">
        <div className="bg-[#1F2937] border-b border-[#374151] p-4 sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setView('list');
                setSelectedOrder(null);
              }}
              className="p-2 hover:bg-[#374151] rounded-lg transition-colors text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-white">{selectedOrder.poNo}</h1>
              <p className="text-xs text-[#9CA3AF]">{selectedOrder.vendor}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedOrder.status)}`}>
              {selectedOrder.status.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="p-4 space-y-4 flex-1 overflow-y-auto pb-28">
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <h3 className="text-sm font-medium text-white mb-3">Supplier Information</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Name:</span>
                <span className="text-white">{selectedOrder.vendor}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Phone:</span>
                <span className="text-white">{selectedOrder.vendorPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Order Date:</span>
                <span className="text-white">{selectedOrder.orderDate}</span>
              </div>
            </div>
          </div>

          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <h3 className="text-sm font-medium text-white mb-3">Items ({selectedOrder.items.length})</h3>
            <div className="space-y-3">
              {selectedOrder.items.map((item) => (
                <div key={item.id} className="pb-3 border-b border-[#374151] last:border-0">
                  <div className="flex justify-between mb-1">
                    <span className="font-medium text-white">{item.productName}</span>
                    <span className="text-[#10B981]">Rs. {item.total.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs text-[#9CA3AF]">
                    <span>Qty: {item.quantity}</span>
                    <span>@ Rs. {item.unitPrice.toLocaleString()}</span>
                  </div>
                  {item.packingDetails && (() => {
                    const pd = item.packingDetails;
                    const boxes = pd.total_boxes ?? 0;
                    const pieces = pd.total_pieces ?? 0;
                    const meters = (pd as { total_meters?: number }).total_meters ?? 0;
                    const hasBoxPcM = boxes > 0 || pieces > 0 || meters > 0;
                    const packs = pd.packs ?? 0;
                    const unitsPerPack = pd.units_per_pack ?? 0;
                    if (hasBoxPcM) {
                      return <p className="text-xs text-[#10B981] mt-0.5">{boxes} Box / {pieces} Pc / {meters.toFixed(0)} M</p>;
                    }
                    if (packs > 0 && unitsPerPack > 0) {
                      return <p className="text-xs text-[#10B981] mt-0.5">{packs} packs × {unitsPerPack} = {item.quantity} units</p>;
                    }
                    return null;
                  })()}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[#9CA3AF]">Subtotal:</span>
              <span className="text-white">Rs. {selectedOrder.subtotal.toLocaleString()}</span>
            </div>
            {selectedOrder.discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-[#9CA3AF]">Discount:</span>
                <span className="text-[#EF4444]">- Rs. {selectedOrder.discount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-[#374151]">
              <span className="text-white">Total:</span>
              <span className="text-[#10B981]">Rs. {selectedOrder.total.toLocaleString()}</span>
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

        {showMarkAsFinal && (
          <MobileActionBar
            label="Total"
            value={`Rs. ${selectedOrder.total.toLocaleString()}`}
            buttonLabel="Mark as Final"
            onButtonClick={async () => {
              setMarkAsFinalError(null);
              setMarkAsFinalLoading(true);
              const { error } = await purchasesApi.updatePurchaseStatus(companyId!, selectedOrder.id, 'final');
              setMarkAsFinalLoading(false);
              if (error) {
                setMarkAsFinalError(error);
                return;
              }
              const { data } = await purchasesApi.getPurchaseById(companyId!, selectedOrder.id);
              if (data) setSelectedOrder(data);
              purchasesApi.getPurchases(companyId!, effectiveBranchId ?? null).then(({ data: list }) => {
                if (list?.length) setOrders(list);
              });
            }}
            loading={markAsFinalLoading}
            error={markAsFinalError}
            variant="success"
            aboveNav={true}
          />
        )}
      </div>
    );
  }

  if (detailLoading) {
    return (
      <div className="min-h-screen bg-[#111827] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-[#10B981] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 bg-[#111827]">
      <div className="bg-gradient-to-br from-[#10B981] to-[#059669] p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-white">Purchase Orders</h1>
            <p className="text-xs text-white/80">Supplier orders & bills</p>
          </div>
          <button
            onClick={handleAddClick}
            disabled={!companyId || (!canAddDirect && !canAddWithPicker)}
            className="flex items-center gap-2 px-3 py-2.5 bg-white text-[#059669] hover:bg-white/90 disabled:opacity-50 rounded-lg font-medium text-sm shadow-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search orders..."
            className="w-full h-10 bg-white/10 border border-white/20 rounded-lg pl-10 pr-4 text-sm text-white placeholder:text-white/60 focus:outline-none focus:bg-white/20"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-[#10B981] animate-spin" />
        </div>
      ) : (
        <>
          <div className="p-4 grid grid-cols-3 gap-3">
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-3 text-center">
              <p className="text-xs text-[#9CA3AF] mb-1">Total</p>
              <p className="text-xl font-bold text-[#3B82F6]">{orders.length}</p>
            </div>
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-3 text-center">
              <p className="text-xs text-[#9CA3AF] mb-1">Pending</p>
              <p className="text-xl font-bold text-[#F59E0B]">{pendingCount}</p>
            </div>
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-3 text-center">
              <p className="text-xs text-[#9CA3AF] mb-1">Received</p>
              <p className="text-xl font-bold text-[#10B981]">{receivedCount}</p>
            </div>
          </div>

          <div className="p-4 space-y-3">
            {filteredOrders.map((order) => {
              const canAddPayment = (order.status === 'final' || order.status === 'received') && order.dueAmount > 0 && (order.branchId || effectiveBranchId);
              return (
              <div key={order.id} className="relative bg-[#1F2937] border border-[#374151] rounded-xl overflow-hidden hover:border-[#10B981]/50 transition-all min-w-0">
                <button
                  onClick={() => handleOrderClick(order)}
                  className="w-full p-4 text-left active:scale-[0.98] min-w-0 pr-12"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-medium text-white truncate">{order.poNo}</h3>
                    <span className="text-sm font-semibold text-[#10B981] shrink-0">Rs. {order.total.toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-[#D1D5DB] truncate">{order.vendor}</p>
                  {order.created_by_name && (
                    <p className="text-xs text-[#9CA3AF] mt-0.5">Created by: {order.created_by_name}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1 text-xs text-[#9CA3AF]">
                    <Package className="w-3.5 h-3.5 shrink-0" />
                    <span>{order.itemCount} items</span>
                    <span className="text-[#374151]">•</span>
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span>{order.dateDisplay ?? order.date}</span>
                  </div>
                  <span className={`inline-block mt-1.5 px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(order.status)}`}>
                    {order.status}
                  </span>

                  <div className="border-t border-[#374151] my-3" aria-hidden="true" />

                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#9CA3AF]">Total:</span>
                      <span className="font-medium text-white">Rs. {order.total.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#9CA3AF]">Paid:</span>
                      <span className="text-[#10B981]">Rs. {order.paidAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-[#9CA3AF]">Amount Due:</span>
                      <span className={`font-medium shrink-0 ${getPaymentStatusColor(order.paymentStatus)}`}>
                        Rs. {order.dueAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    {order.status === 'cancelled' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#EF4444]/20 text-[#EF4444]">Cancelled</span>
                    )}
                    {order.status !== 'cancelled' && order.paymentStatus === 'paid' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#10B981]/20 text-[#10B981]">✔ Paid</span>
                    )}
                    {order.status !== 'cancelled' && order.paymentStatus === 'partial' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#F59E0B]/20 text-[#F59E0B]">Partially Paid</span>
                    )}
                    {order.status !== 'cancelled' && order.paymentStatus === 'unpaid' && order.dueAmount > 0 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#6B7280]/20 text-[#9CA3AF]">Unpaid</span>
                    )}
                  </div>
                </button>

                {canAddPayment && (
                  <div className="px-4 pb-3 pt-0 flex justify-end">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setAddPaymentOrder(order); }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#10B981]/90 hover:bg-[#059669] text-white text-sm font-medium transition-colors"
                    >
                      + Add
                    </button>
                  </div>
                )}

                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOrder(menuOrder?.id === order.id ? null : order); }}
                  className="absolute top-3 right-3 p-2 hover:bg-[#374151] rounded-lg text-[#9CA3AF] transition-colors"
                  aria-label="More options"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
                {menuOrder?.id === order.id && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setMenuOrder(null)}>
                    <div className="bg-[#1F2937] border border-[#374151] rounded-2xl shadow-xl overflow-hidden w-full max-w-[300px]" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Purchase options">
                      <div className="px-4 py-3 border-b border-[#374151]">
                        <p className="text-sm font-medium text-[#9CA3AF]">{order.poNo}</p>
                        <p className="text-lg font-semibold text-white">Rs. {order.total.toLocaleString()}</p>
                      </div>
                      <div className="py-2">{renderOrderMenuActions(order)}</div>
                      <button onClick={() => setMenuOrder(null)} className="w-full py-3 text-sm text-[#9CA3AF] border-t border-[#374151] hover:bg-[#374151]">
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </div>
              );
            })}

            {filteredOrders.length === 0 && (
              <div className="text-center py-12">
                <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-[#374151]" />
                <p className="text-[#9CA3AF]">No purchase orders found</p>
              </div>
            )}
          </div>
        </>
      )}

      {addPaymentOrder && companyId && (addPaymentOrder.branchId || effectiveBranchId) && (
        <MobilePaySupplier
          onClose={() => setAddPaymentOrder(null)}
          onSuccess={() => {
            const paidPurchaseId = addPaymentOrder.id;
            setAddPaymentOrder(null);
            purchasesApi.getPurchases(companyId, effectiveBranchId ?? null).then(({ data }) => {
              if (data?.length) setOrders(data);
            });
            if (selectedOrder?.id === paidPurchaseId) {
              purchasesApi.getPurchaseById(companyId, paidPurchaseId).then(({ data }) => {
                if (data) setSelectedOrder(data);
              });
            }
          }}
          companyId={companyId}
          branchId={addPaymentOrder.branchId || effectiveBranchId!}
          userId={user.id}
          purchaseId={addPaymentOrder.id}
          poNo={addPaymentOrder.poNo}
          supplierName={addPaymentOrder.vendor}
          totalAmount={addPaymentOrder.total}
          paidAmount={addPaymentOrder.paidAmount}
          dueAmount={addPaymentOrder.dueAmount}
        />
      )}

      {showBranchPicker && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowBranchPicker(false)}>
          <div className="bg-[#1F2937] border-t sm:border border-[#374151] rounded-t-2xl sm:rounded-xl w-full max-w-md max-h-[70vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-[#374151]">
              <h3 className="font-semibold text-white">Select branch for purchase</h3>
              <p className="text-sm text-[#9CA3AF]">Choose which branch this purchase is for</p>
            </div>
            <div className="p-4 overflow-y-auto max-h-[50vh] space-y-2">
              {branches.map((b) => (
                <button
                  key={b.id}
                  onClick={() => handleBranchPick(b.id)}
                  className="w-full flex items-center gap-3 p-4 bg-[#111827] border border-[#374151] rounded-xl hover:border-[#10B981] text-left transition-colors"
                >
                  <MapPin className="w-5 h-5 text-[#10B981] flex-shrink-0" />
                  <span className="font-medium text-white">{b.name}</span>
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-[#374151]">
              <button
                onClick={() => setShowBranchPicker(false)}
                className="w-full py-3 bg-[#374151] hover:bg-[#4B5563] text-white rounded-lg font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {actionError && !cancelOrder && (
        <div className="fixed left-4 right-4 bottom-24 z-[75] py-3 px-4 rounded-lg text-sm font-medium text-center shadow-lg bg-[#EF4444] text-white">
          {actionError}
        </div>
      )}

      {cancelOrder && (
        <div className="fixed inset-0 z-[85] bg-black/70 flex items-end sm:items-center justify-center p-4" onClick={() => setCancelOrder(null)}>
          <div className="w-full max-w-sm bg-[#1F2937] border border-[#374151] rounded-2xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-[#EF4444]/20 text-[#EF4444]">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Cancel purchase?</h3>
                <p className="text-sm text-[#9CA3AF] mt-1">
                  {cancelOrder.poNo} will be marked as <span className="text-[#F87171] font-medium">Cancelled</span>. Stock will be restored and the linked journal entry reversed. The PO stays visible in the list with a cancelled badge.
                </p>
              </div>
            </div>
            {actionError && <p className="mt-3 text-sm text-[#FCA5A5]">{actionError}</p>}
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button type="button" onClick={() => setCancelOrder(null)} className="h-10 rounded-lg border border-[#374151] text-[#D1D5DB]">
                Keep
              </button>
              <button type="button" onClick={confirmCancel} disabled={cancelling} className="h-10 rounded-lg bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-60 text-white font-medium">
                {cancelling ? 'Cancelling...' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewOrder && pdfPreview.brand && (
        <PdfPreviewModal
          open={pdfPreview.open}
          onClose={() => { pdfPreview.close(); setPreviewOrder(null); setPreviewItems([]); }}
          title={`PO ${previewOrder.poNo}`}
          filename={`purchase-${previewOrder.poNo}.pdf`}
          whatsAppFallbackText={`PO: ${previewOrder.poNo}\nSupplier: ${previewOrder.vendor}\nTotal: Rs. ${previewOrder.total.toLocaleString()}`}
        >
          {previewLoading ? (
            <div style={{ padding: 48, textAlign: 'center' }}>Loading items…</div>
          ) : (
            <InvoicePreviewPdf
              brand={pdfPreview.brand}
              docType="purchase"
              docNumber={previewOrder.poNo}
              docDate={String(previewOrder.date || '').slice(0, 10)}
              partyName={previewOrder.vendor}
              partyPhone={previewOrder.vendorPhone}
              items={previewItems}
              subtotal={previewOrder.subtotal}
              discount={previewOrder.discount}
              total={previewOrder.total}
              paid={previewOrder.paidAmount}
              due={previewOrder.dueAmount}
              generatedBy={previewOrder.created_by_name || null}
            />
          )}
        </PdfPreviewModal>
      )}

      {editOrder && (
        <div
          className="fixed inset-0 z-[85] bg-black/70 flex items-end sm:items-center justify-center p-4"
          onClick={closePurchaseEditModal}
        >
          <div className="bg-[#1F2937] border border-[#374151] rounded-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-[#374151] flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-white font-semibold">Edit Purchase</h3>
                <p className="text-xs text-[#9CA3AF]">{editOrder.poNo}</p>
              </div>
              <button type="button" onClick={closePurchaseEditModal} className="p-2 rounded-lg hover:bg-[#374151] text-[#9CA3AF]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto">
              <div>
                <label className="block text-xs text-[#9CA3AF] mb-1">Supplier</label>
                <select
                  value={editSupplierId ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    setEditSupplierId(v || null);
                    const s = editSupplierOptions.find((x) => x.id === v);
                    if (s) setEditSupplierName(s.name);
                    else if (!v) setEditSupplierName(editOrder.vendor || '');
                  }}
                  disabled={editSuppliersLoading}
                  className="w-full h-10 rounded-lg bg-[#111827] border border-[#374151] text-white px-3 text-sm"
                >
                  <option value="">—</option>
                  {editSupplierOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {editSuppliersLoading && <p className="text-[10px] text-[#9CA3AF] mt-1">Loading suppliers…</p>}
              </div>
              <div>
                <label className="block text-xs text-[#9CA3AF] mb-1">Order Date</label>
                <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)}
                  className="w-full h-10 rounded-lg bg-[#111827] border border-[#374151] text-white px-3 text-sm" />
              </div>

              {(showDiscountField || Number(editOrder.discount ?? 0) > 0) && (
                <div>
                  <label className="block text-xs text-[#9CA3AF] mb-1">Discount</label>
                  <input type="number" min="0" step="0.01" value={editDiscount} onChange={(e) => setEditDiscount(e.target.value)}
                    className="w-full h-10 rounded-lg bg-[#111827] border border-[#374151] text-white px-3 text-sm" />
                </div>
              )}
              {!showDiscountField && Number(editOrder.discount ?? 0) <= 0 && (
                <button type="button" onClick={() => setShowDiscountField(true)} className="text-xs text-[#60A5FA] hover:underline">
                  Add discount
                </button>
              )}

              {(showTaxField || Number(editTax) > 0) && (
                <div>
                  <label className="block text-xs text-[#9CA3AF] mb-1">Tax</label>
                  <input type="number" min="0" step="0.01" value={editTax} onChange={(e) => setEditTax(e.target.value)}
                    className="w-full h-10 rounded-lg bg-[#111827] border border-[#374151] text-white px-3 text-sm" />
                </div>
              )}
              {!showTaxField && Number(editTax) <= 0 && (
                <button type="button" onClick={() => setShowTaxField(true)} className="text-xs text-[#60A5FA] hover:underline">
                  Add tax
                </button>
              )}

              <div>
                <label className="block text-xs text-[#9CA3AF] mb-1">Notes</label>
                <textarea rows={3} value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full rounded-lg bg-[#111827] border border-[#374151] text-white px-3 py-2 text-sm resize-none" />
              </div>

              <div className="border-t border-[#374151] pt-3">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <p className="text-xs font-semibold text-white">Line items</p>
                  <button type="button" onClick={() => setShowAddProductRow((s) => !s)} className="text-xs text-[#60A5FA] font-medium">
                    {showAddProductRow ? 'Hide search' : '+ Add product'}
                  </button>
                </div>
                {showAddProductRow && (
                  <div className="mb-3 space-y-2">
                    <input
                      type="search"
                      placeholder="Search product name or SKU…"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="w-full h-9 rounded-lg bg-[#111827] border border-[#374151] text-white px-3 text-sm"
                    />
                    <ul className="max-h-32 overflow-y-auto rounded-lg border border-[#374151] divide-y divide-[#374151] bg-[#111827]">
                      {filteredPurchaseCatalog.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => pickProductForEditPurchase(p)}
                            className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#374151]"
                          >
                            {p.name} <span className="text-[#9CA3AF]">({p.sku})</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {editLinesLoading ? (
                  <p className="text-xs text-[#9CA3AF] py-2">Loading lines…</p>
                ) : editLineItems.length === 0 ? (
                  <p className="text-[11px] text-[#F59E0B]">
                    No purchase lines loaded. You can still save header fields only (apply DB migration update_purchase_with_items to edit lines).
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {editLineItems.map((row, idx) => (
                      <div key={row.lineKey} className="rounded-lg bg-[#111827] border border-[#374151] p-2 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs text-white truncate min-w-0 flex-1">{row.productName}</p>
                          {editLineItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeEditPurchaseLine(idx)}
                              className="p-1.5 rounded-lg text-[#EF4444] hover:bg-[#EF4444]/10 shrink-0"
                              aria-label="Remove line"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-[#9CA3AF]">Qty</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.quantity}
                              onChange={(e) => updateEditPurchaseLine(idx, { quantity: Number(e.target.value) || 0 })}
                              className="w-full h-9 rounded bg-[#0B1120] border border-[#374151] text-white px-2 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-[#9CA3AF]">Unit price</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.unitPrice}
                              onChange={(e) => updateEditPurchaseLine(idx, { unitPrice: Number(e.target.value) || 0 })}
                              className="w-full h-9 rounded bg-[#0B1120] border border-[#374151] text-white px-2 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-lg bg-[#111827] border border-[#374151] p-3 text-xs space-y-1">
                <div className="flex justify-between text-[#9CA3AF]">
                  <span>Lines subtotal</span>
                  <span className="text-white">Rs. {editPurchaseLineSubtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[#9CA3AF]">
                  <span>Recalculated Total</span>
                  <span className="text-[#10B981] font-semibold">
                    Rs. {(
                      (editLineItems.length > 0 ? editPurchaseLineSubtotal : Number(editOrder.subtotal ?? 0) || 0) -
                      (Number(editDiscount) || 0) +
                      (Number(editTax) || 0) +
                      frozenShippingCost
                    ).toLocaleString()}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-[#9CA3AF]">
                Line changes save via server (stock rebuilt). Total must stay at or above amount already paid. Shipping is not edited here.
              </p>
              {actionError && <div className="rounded-lg bg-[#EF4444] text-white text-sm px-3 py-2">{actionError}</div>}
            </div>
            <div className="p-4 border-t border-[#374151] grid grid-cols-2 gap-3 shrink-0">
              <button type="button" onClick={closePurchaseEditModal} className="h-11 rounded-lg border border-[#374151] text-[#D1D5DB]">
                Cancel
              </button>
              <button type="button" onClick={confirmEditOrder} disabled={editSaving} className="h-11 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-60 text-white font-medium">
                {editSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {returnNotice && (
        <div className="fixed inset-0 z-[85] bg-black/70 flex items-end sm:items-center justify-center p-4" onClick={() => setReturnNotice(null)}>
          <div className="bg-[#1F2937] border border-[#374151] rounded-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-[#374151] flex items-center gap-3">
              <RotateCcw className="w-5 h-5 text-[#3B82F6]" />
              <h3 className="text-white font-semibold">Purchase Return</h3>
            </div>
            <div className="p-4 space-y-3 text-sm text-[#D1D5DB]">
              <p>
                Purchase Return flow (partial returns, price adjustment, stock reversal, Cr Note)
                is managed from the web ERP to keep accounting entries atomic.
              </p>
              <p className="text-[#F59E0B]">
                PO: <span className="text-white">{returnNotice.poNo}</span> · Supplier:{' '}
                <span className="text-white">{returnNotice.vendor}</span>
              </p>
              <p className="text-xs text-[#9CA3AF]">
                Coming soon: in-app draft flow. For now please create the return from web ERP.
              </p>
            </div>
            <div className="p-4 border-t border-[#374151] grid grid-cols-1 gap-2">
              <button type="button" onClick={() => setReturnNotice(null)} className="h-11 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white font-medium">
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
