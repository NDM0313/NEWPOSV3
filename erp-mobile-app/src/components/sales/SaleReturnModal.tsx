import { useEffect, useMemo, useState } from 'react';
import { Loader2, RotateCcw, X } from 'lucide-react';
import {
  createAndFinalizeSaleReturn,
  getSaleReturnCandidateItems,
  type SaleReturnCandidateItem,
} from '../../api/sales';
import { supabase } from '../../lib/supabase';

interface SaleReturnModalProps {
  isOpen: boolean;
  companyId: string;
  branchId: string;
  saleId: string;
  saleNo: string;
  customerId?: string | null;
  customerName?: string | null;
  userId?: string | null;
  onClose: () => void;
  onSuccess: (info: { returnId: string; returnNo: string }) => void;
}

type QtyMap = Record<string, number>;

export function SaleReturnModal({
  isOpen,
  companyId,
  branchId,
  saleId,
  saleNo,
  customerId,
  customerName,
  userId,
  onClose,
  onSuccess,
}: SaleReturnModalProps) {
  const [items, setItems] = useState<SaleReturnCandidateItem[]>([]);
  const [qtyMap, setQtyMap] = useState<QtyMap>({});
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState<string>('0');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [originalSaleTotal, setOriginalSaleTotal] = useState<number>(0);
  const [priorReturnedTotal, setPriorReturnedTotal] = useState<number>(0);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDiscount('0');
    const loadSaleCap = async () => {
      const { data: sale } = await supabase.from('sales').select('total').eq('id', saleId).maybeSingle();
      if (!cancelled) setOriginalSaleTotal(Number((sale as { total?: number } | null)?.total ?? 0) || 0);
      const { data: prior } = await supabase
        .from('sale_returns')
        .select('total, status')
        .eq('original_sale_id', saleId);
      const sum = (prior || [])
        .filter((r: { status?: string }) => r.status !== 'voided' && r.status !== 'cancelled')
        .reduce((s: number, r: { total?: number }) => s + (Number(r.total) || 0), 0);
      if (!cancelled) setPriorReturnedTotal(sum);
    };
    loadSaleCap();
    getSaleReturnCandidateItems(saleId).then(({ data, error: loadErr }) => {
      if (cancelled) return;
      if (loadErr) {
        setError(loadErr);
        setItems([]);
      } else {
        setItems(data);
        const next: QtyMap = {};
        data.forEach((i) => {
          next[i.saleItemId || `${i.productId}:${i.variationId || ''}`] = Number(i.soldQty) || 0;
        });
        setQtyMap(next);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, saleId]);

  const selectedRows = useMemo(
    () =>
      items
        .map((i) => {
          const key = i.saleItemId || `${i.productId}:${i.variationId || ''}`;
          const qty = Math.max(0, Math.min(Number(qtyMap[key] || 0), Number(i.soldQty || 0)));
          return { ...i, qty };
        })
        .filter((i) => i.qty > 0),
    [items, qtyMap],
  );

  const subtotal = useMemo(() => selectedRows.reduce((sum, i) => sum + i.qty * i.unitPrice, 0), [selectedRows]);
  const discountNum = Math.max(0, Math.min(Number(discount) || 0, subtotal));
  const returnTotal = Math.max(0, subtotal - discountNum);
  const remainingReturnable = Math.max(0, originalSaleTotal - priorReturnedTotal);
  const exceedsCap = originalSaleTotal > 0 && returnTotal > remainingReturnable + 0.005;

  const handleQtyChange = (key: string, maxQty: number, value: string) => {
    const parsed = Number(value);
    const qty = Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, maxQty)) : 0;
    setQtyMap((prev) => ({ ...prev, [key]: qty }));
  };

  const handleSubmit = async () => {
    if (selectedRows.length === 0) {
      setError('Select at least one item for return.');
      return;
    }
    if (exceedsCap) {
      setError(
        `Return amount (Rs. ${returnTotal.toLocaleString()}) exceeds remaining returnable on this invoice (Rs. ${remainingReturnable.toLocaleString()}).`,
      );
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error: submitErr } = await createAndFinalizeSaleReturn({
      companyId,
      branchId,
      saleId,
      customerId: customerId ?? null,
      customerName: customerName ?? null,
      userId: userId ?? null,
      reason: reason || null,
      notes: notes || null,
      discountAmount: discountNum,
      items: selectedRows.map((i) => ({
        saleItemId: i.saleItemId,
        productId: i.productId,
        variationId: i.variationId,
        productName: i.productName,
        sku: i.sku,
        quantity: i.qty,
        unitPrice: i.unitPrice,
      })),
    });
    setSaving(false);
    if (submitErr || !data) {
      setError(submitErr || 'Failed to create sale return.');
      return;
    }
    onSuccess(data);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-black/70 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-[#111827] border border-[#374151] rounded-t-2xl sm:rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[#374151] flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold">Create Sale Return</h3>
            <p className="text-xs text-[#9CA3AF]">Invoice: {saleNo}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-[#1F2937] text-[#9CA3AF]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto max-h-[68vh]">
          {loading ? (
            <div className="py-10 flex justify-center">
              <Loader2 className="w-7 h-7 text-[#3B82F6] animate-spin" />
            </div>
          ) : (
            <>
              {items.length === 0 && <p className="text-sm text-[#9CA3AF]">No returnable items found for this sale.</p>}
              {items.map((item) => {
                const key = item.saleItemId || `${item.productId}:${item.variationId || ''}`;
                const qty = Number(qtyMap[key] || 0);
                return (
                  <div key={key} className="bg-[#1F2937] border border-[#374151] rounded-xl p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{item.productName}</p>
                        <p className="text-xs text-[#9CA3AF]">
                          Sold: {item.soldQty} • @ Rs. {item.unitPrice.toLocaleString()}
                        </p>
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={item.soldQty}
                        value={qty}
                        onChange={(e) => handleQtyChange(key, item.soldQty, e.target.value)}
                        className="w-20 h-9 rounded-lg bg-[#111827] border border-[#374151] text-white px-2 text-sm"
                      />
                    </div>
                  </div>
                );
              })}

              <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-3 space-y-2">
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason (optional)"
                  className="w-full h-10 rounded-lg bg-[#111827] border border-[#374151] text-white placeholder:text-[#6B7280] px-3 text-sm"
                />
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes (optional)"
                  className="w-full rounded-lg bg-[#111827] border border-[#374151] text-white placeholder:text-[#6B7280] px-3 py-2 text-sm resize-none"
                />
                <div className="flex items-center gap-2">
                  <label className="text-xs text-[#9CA3AF] w-28 shrink-0">Discount (Rs.)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="flex-1 h-10 rounded-lg bg-[#111827] border border-[#374151] text-white px-3 text-sm"
                  />
                </div>
                <div className="space-y-1 border-t border-[#374151] pt-2 text-sm">
                  <div className="flex justify-between text-[#9CA3AF]">
                    <span>Subtotal</span>
                    <span className="text-white">Rs. {subtotal.toLocaleString()}</span>
                  </div>
                  {discountNum > 0 && (
                    <div className="flex justify-between text-[#9CA3AF]">
                      <span>Discount</span>
                      <span className="text-[#F59E0B]">- Rs. {discountNum.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold">
                    <span className="text-[#9CA3AF]">Return total</span>
                    <span className={exceedsCap ? 'text-[#EF4444]' : 'text-[#10B981]'}>
                      Rs. {returnTotal.toLocaleString()}
                    </span>
                  </div>
                  {originalSaleTotal > 0 && (
                    <div className="flex justify-between text-[11px] text-[#6B7280]">
                      <span>Remaining returnable on invoice</span>
                      <span>Rs. {remainingReturnable.toLocaleString()}</span>
                    </div>
                  )}
                </div>
                {exceedsCap && (
                  <div className="rounded-lg bg-[#EF4444]/20 border border-[#EF4444]/40 text-[#FCA5A5] text-xs px-3 py-2">
                    Return exceeds remaining returnable amount. Reduce qty or discount.
                  </div>
                )}
              </div>

              {error && <div className="rounded-lg bg-[#EF4444] text-white text-sm px-3 py-2">{error}</div>}
            </>
          )}
        </div>

        <div className="p-4 border-t border-[#374151] grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} className="h-11 rounded-lg border border-[#374151] text-[#D1D5DB]">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || saving || items.length === 0 || exceedsCap}
            className="h-11 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-60 text-white font-medium inline-flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            {saving ? 'Processing...' : 'Create Return'}
          </button>
        </div>
      </div>
    </div>
  );
}
