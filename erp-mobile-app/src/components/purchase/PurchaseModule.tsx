import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, ShoppingBag, Plus, Search, Package, Calendar, Loader2, MapPin, Paperclip } from 'lucide-react';
import type { User } from '../../types';
import * as purchasesApi from '../../api/purchases';
import * as branchesApi from '../../api/branches';
import { CreatePurchaseFlow } from './CreatePurchaseFlow';
import { MobilePaySupplier } from './MobilePaySupplier';
import { AttachmentPreviewModal } from '../sales/AttachmentPreviewModal';

interface PurchaseModuleProps {
  onBack: () => void;
  user: User;
  companyId: string | null;
  branchId: string | null;
}

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
  const [paymentHistory, setPaymentHistory] = useState<purchasesApi.PurchasePaymentRow[]>([]);
  const [attachmentPreviewList, setAttachmentPreviewList] = useState<Array<{ url: string; name: string }> | null>(null);

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

  useEffect(() => {
    if (!companyId) {
      setOrders([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    purchasesApi.getPurchases(companyId, effectiveBranchId ?? null).then(({ data, error }) => {
      if (cancelled) return;
      setLoading(false);
      setOrders(error ? [] : data);
    });
    return () => { cancelled = true; };
  }, [companyId, effectiveBranchId]);

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
    return (
      <div className="min-h-screen pb-24 bg-[#111827]">
        <div className="bg-[#1F2937] border-b border-[#374151] p-4 sticky top-0 z-10">
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

        <div className="p-4 space-y-4">
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

          {['ordered', 'draft', 'sent', 'confirmed'].includes(selectedOrder.status) && (
            <button
              onClick={async () => {
                const { error } = await purchasesApi.updatePurchaseStatus(companyId!, selectedOrder.id, 'final');
                if (error) return;
                const { data } = await purchasesApi.getPurchaseById(companyId!, selectedOrder.id);
                if (data) setSelectedOrder(data);
                purchasesApi.getPurchases(companyId!, effectiveBranchId ?? null).then(({ data: list }) => {
                  if (list?.length) setOrders(list);
                });
              }}
              className="w-full py-3 bg-[#10B981] hover:bg-[#059669] text-white rounded-xl font-medium"
            >
              Mark as Final
            </button>
          )}

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
    </div>
  );
}
