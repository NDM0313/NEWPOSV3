/**
 * Purchase Return form – SAME layout and behaviour as Sales Return (approved design).
 * Centered dialog, no supplier info, header auto (Purchase Return · Ref: xxx), three amount cards, Items Entry.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, Package, Minus, Plus, Loader2, AlertCircle, Box, TrendingUp, Undo2, RefreshCw, Check } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { DatePicker } from '../ui/DatePicker';
import { toast } from 'sonner';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useAccounting } from '@/app/context/AccountingContext';
import { useSettings } from '@/app/context/SettingsContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { purchaseReturnService, CreatePurchaseReturnData } from '@/app/services/purchaseReturnService';
import { purchaseService } from '@/app/services/purchaseService';
import { PackingDetails } from '../transactions/PackingEntryModal';
import { cn, formatBoxesPieces } from '../ui/utils';

interface PurchaseReturnFormProps {
  purchaseId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

interface ReturnItemRow {
  id: string;
  product_id: string;
  variation_id?: string;
  product_name: string;
  sku: string;
  quantity: number;
  unit?: string;
  unit_price: number;
  total: number;
  already_returned: number;
  return_quantity: number;
  packing_type?: string;
  packing_quantity?: number;
  packing_unit?: string;
  packing_details?: PackingDetails;
  variation?: any;
}

export const PurchaseReturnForm: React.FC<PurchaseReturnFormProps> = ({ purchaseId, onClose, onSuccess }) => {
  const { companyId, branchId: contextBranchId, user } = useSupabase();
  const accounting = useAccounting();
  const { inventorySettings } = useSettings();
  const { formatCurrency } = useFormatCurrency();
  const enablePacking = inventorySettings.enablePacking;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [originalPurchase, setOriginalPurchase] = useState<any>(null);
  const [returnItems, setReturnItems] = useState<ReturnItemRow[]>([]);
  const [returnDate, setReturnDate] = useState<Date>(new Date());
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [itemSearch, setItemSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!companyId || !purchaseId) return;
      try {
        setLoading(true);
        const [purchase, items] = await Promise.all([
          purchaseService.getPurchase(purchaseId),
          purchaseReturnService.getOriginalPurchaseItems(purchaseId, companyId),
        ]);
        setOriginalPurchase(purchase);
        setReturnItems((items || []).map((it: any) => ({
          ...it,
          return_quantity: 0,
          total: 0,
          packing_type: it.packing_type,
          packing_quantity: it.packing_quantity,
          packing_unit: it.packing_unit,
          packing_details: it.packing_details || undefined,
          variation: it.variation || undefined,
        })));
      } catch (e: any) {
        toast.error(e.message || 'Failed to load purchase');
        onClose();
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [companyId, purchaseId, onClose]);

  const handleQuantityChange = (index: number, value: number) => {
    const max = returnItems[index].quantity - returnItems[index].already_returned;
    const qty = Math.max(0, Math.min(max, value));
    setReturnItems(prev => prev.map((item, i) => i === index ? { ...item, return_quantity: qty, total: item.unit_price * qty } : item));
  };

  const filteredItems = useMemo(() => {
    if (!itemSearch.trim()) return returnItems;
    const q = itemSearch.toLowerCase();
    return returnItems.filter(
      (i) =>
        (i.product_name || '').toLowerCase().includes(q) ||
        (i.sku || '').toLowerCase().includes(q) ||
        (i.variation?.sku || '').toLowerCase().includes(q)
    );
  }, [returnItems, itemSearch]);

  const returnAmount = useMemo(() => returnItems.reduce((sum, item) => sum + item.return_quantity * item.unit_price, 0), [returnItems]);
  const originalAmount = Number(originalPurchase?.total ?? 0);
  const netAfterReturn = Math.max(0, originalAmount - returnAmount);
  const hasAnyReturn = returnItems.some(item => item.return_quantity > 0);

  const handleSubmit = async () => {
    if (!companyId || !contextBranchId || !originalPurchase || !hasAnyReturn) {
      if (!hasAnyReturn) toast.error('Select at least one item and quantity to return');
      return;
    }
    const branchId = contextBranchId === 'all' ? undefined : contextBranchId;
    if (!branchId) {
      toast.error('Please select a branch');
      return;
    }
    try {
      setSaving(true);
      const items = returnItems
        .filter(i => i.return_quantity > 0)
        .map(i => {
          let returnPackingDetails: any = undefined;
          if (i.packing_details && i.quantity > 0) {
            const returnRatio = i.return_quantity / i.quantity;
            const op = i.packing_details;
            returnPackingDetails = {
              ...op,
              total_boxes: Math.round((op.total_boxes || 0) * returnRatio * 100) / 100,
              total_pieces: Math.round((op.total_pieces || 0) * returnRatio * 100) / 100,
              total_meters: op.total_meters != null ? Math.round(Number(op.total_meters) * returnRatio * 100) / 100 : undefined,
            };
          }
          return {
            product_id: i.product_id,
            variation_id: i.variation_id,
            product_name: i.product_name,
            sku: i.sku,
            quantity: i.return_quantity,
            unit: i.unit,
            unit_price: i.unit_price,
            total: i.return_quantity * i.unit_price,
            packing_type: i.packing_type,
            packing_quantity: i.packing_quantity && i.quantity > 0 ? (i.packing_quantity * i.return_quantity / i.quantity) : undefined,
            packing_unit: i.packing_unit,
            packing_details: returnPackingDetails,
          };
        });
      const returnData: CreatePurchaseReturnData = {
        company_id: companyId,
        branch_id: branchId,
        original_purchase_id: purchaseId,
        return_date: returnDate.toISOString().split('T')[0],
        supplier_id: originalPurchase.supplier_id || originalPurchase.supplier,
        supplier_name: originalPurchase.supplier_name || originalPurchase.supplierName || 'Supplier',
        items,
        reason: reason || undefined,
        notes: notes || undefined,
        created_by: user?.id,
        total: returnAmount,
      };
      const purchaseReturn = await purchaseReturnService.createPurchaseReturn(returnData);
      // finalizePurchaseReturn already posts the GL entry (DR AP / CR Inventory)
      await purchaseReturnService.finalizePurchaseReturn(purchaseReturn.id!, companyId, branchId, user?.id);
      toast.success(`Purchase return ${purchaseReturn.return_no || purchaseReturn.id} created and finalized`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Failed to create purchase return');
    } finally {
      setSaving(false);
    }
  };

  const purchaseRef = originalPurchase?.po_no || originalPurchase?.purchase_no || originalPurchase?.purchaseNo || purchaseId?.slice(0, 8) || 'N/A';

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div className="bg-card border border-border rounded-xl p-8">
          <Loader2 className="animate-spin text-blue-500 mx-auto mb-4" size={32} />
          <p className="text-muted-foreground text-center">Loading purchase...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 overflow-y-auto p-4">
      <div className="bg-secondary border border-border rounded-2xl w-[80%] min-w-[1000px] max-w-6xl min-h-[85vh] max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header — Figma: same as Sales Return */}
        <div className="shrink-0 bg-card border-b border-border px-6 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground tracking-tight">
              Purchase Return <span className="text-muted-foreground font-normal">· Ref: {purchaseRef}</span>
            </h2>
            <div className="flex items-center gap-4 mt-2">
              <span className="text-sm text-muted-foreground"># Return No: New</span>
              <span className="flex items-center gap-2 text-amber-400/90 text-sm font-medium">
                <AlertCircle size={16} className="shrink-0" />
                Controlled Reversal
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div>
              <span className="text-xs text-muted-foreground block mb-0.5">Return Date</span>
              <DatePicker
                className="w-[160px]"
                value={format(returnDate, 'yyyy-MM-dd')}
                onChange={(v) => {
                  if (!v) return;
                  const d = parseISO(v);
                  if (isValid(d)) setReturnDate(d);
                }}
              />
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="text-muted-foreground hover:text-foreground rounded-full">
              <X size={22} />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
            <div className="rounded-2xl p-3 min-w-0 bg-green-500/10 border border-green-500/30 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-green-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="flex items-center gap-1.5 text-[var(--erp-money-positive)] mb-1.5 relative">
                <TrendingUp size={16} className="shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Original Purchase</span>
              </div>
              <p className="text-lg font-bold text-[var(--erp-money-positive)] tracking-tight relative">{formatCurrency(originalAmount)}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5 relative">Reference</p>
            </div>
            <div className="rounded-2xl p-3 min-w-0 bg-red-500/10 border border-red-500/30 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="flex items-center gap-1.5 text-red-400 mb-1.5 relative">
                <Undo2 size={16} className="shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Return Amount</span>
              </div>
              <p className="text-lg font-bold text-red-400 tracking-tight relative">{formatCurrency(returnAmount)}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5 relative">From items</p>
            </div>
            <div className="rounded-2xl p-3 min-w-0 bg-blue-500/10 border border-blue-500/30 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute top-1.5 right-1.5">
                <RefreshCw size={12} className="text-blue-400/80" />
              </div>
              <div className="flex items-center gap-1.5 text-blue-400 mb-1.5 relative">
                <span className="text-[10px] font-bold uppercase tracking-wider">Net After Return</span>
              </div>
              <p className="text-lg font-bold text-foreground tracking-tight relative">{formatCurrency(netAfterReturn)}</p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex flex-wrap items-end gap-3 flex-1 min-w-0 max-w-md">
              <div className="min-w-[140px] w-[140px] shrink-0">
                <Label className="text-muted-foreground text-xs mb-1 block">Reason (optional)</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Defective, Wrong item" className="bg-muted border-border text-foreground text-sm h-9" />
              </div>
              <div className="flex-1 min-w-[200px]">
                <Label className="text-muted-foreground text-xs mb-1 block">Notes (optional)</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes" className="bg-muted border-border text-foreground text-sm h-9 w-[652px]" />
              </div>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={saving || !hasAnyReturn}
              size="sm"
              className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm flex items-center gap-1.5 shrink-0"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Finalize Return
            </Button>
          </div>

          <div className="flex items-center gap-3 px-4 py-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
              <AlertCircle size={18} className="text-amber-400" />
            </div>
            <p className="text-sm text-blue-100">
              <span className="font-semibold text-foreground">Return Reversal Mode:</span> Items are loaded from original purchase {purchaseRef}. Adjust return quantities as needed. Stock will be updated automatically upon finalization.
            </p>
          </div>

          <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Box size={18} className="text-muted-foreground" />
                Items Entry
              </h3>
              <Input
                placeholder="Search products by name, SKU... ⌘K"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                className="mb-4 bg-muted/80 border-border text-foreground placeholder:text-muted-foreground rounded-lg h-10"
              />
              <div className="bg-muted/50 border border-border rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/40 border-b border-border">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase w-8">#</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">Name</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">SKU</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">Variation</th>
                      {enablePacking && <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">Packing</th>}
                      <th className="px-3 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase">Qty</th>
                      <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase">Unit Price</th>
                      <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase">Return Amount</th>
                      <th className="px-3 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase w-16">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={enablePacking ? 9 : 8} className="px-4 py-8 text-center text-muted-foreground">
                          <Package size={32} className="mx-auto mb-2 opacity-50" />
                          <p>{itemSearch ? 'No items match search' : 'No items in this purchase'}</p>
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((item, idx) => {
                        const index = returnItems.indexOf(item);
                        const maxReturn = item.quantity - item.already_returned;
                        const canReturn = maxReturn > 0;
                        const variationText = item.variation
                          ? (Object.keys(item.variation.attributes || {}).length > 0
                              ? Object.entries(item.variation.attributes || {})
                                  .filter(([_, v]) => v != null && v !== '')
                                  .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`).join(', ')
                              : [item.variation.size, item.variation.color].filter(Boolean).join(' / '))
                          : null;
                        const pd = item.packing_details || {};
                        const packingDisplay = (pd.total_boxes != null || pd.total_pieces != null || pd.total_meters != null)
                          ? [pd.total_boxes != null && pd.total_boxes > 0 && `${formatBoxesPieces(pd.total_boxes)} B`, pd.total_pieces != null && pd.total_pieces > 0 && `${formatBoxesPieces(pd.total_pieces)} P`, pd.total_meters != null && pd.total_meters > 0 && `${Number(pd.total_meters).toFixed(2)} M`].filter(Boolean).join(' · ') || '—'
                          : '—';

                        return (
                          <tr key={item.id} className={cn("hover:bg-accent/30", !canReturn && "opacity-50")}>
                            <td className="px-3 py-2.5 text-muted-foreground text-sm">{idx + 1}</td>
                            <td className="px-3 py-2.5 font-medium text-foreground">{item.product_name}</td>
                            <td className="px-3 py-2.5 text-muted-foreground text-sm font-mono">{item.variation?.sku || item.sku}</td>
                            <td className="px-3 py-2.5 text-muted-foreground text-sm">{variationText || '—'}</td>
                            {enablePacking && <td className="px-3 py-2.5 text-muted-foreground text-sm">{packingDisplay}</td>}
                            <td className="px-3 py-2.5">
                              <div className="flex items-center justify-center gap-1">
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleQuantityChange(index, item.return_quantity - 1)} disabled={!canReturn || item.return_quantity <= 0}><Minus size={12} /></Button>
                                <Input type="number" min={0} max={maxReturn} value={item.return_quantity} onChange={(e) => handleQuantityChange(index, parseFloat(e.target.value) || 0)} disabled={!canReturn} className="w-16 text-center bg-card border-border text-foreground h-8 text-sm" />
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleQuantityChange(index, item.return_quantity + 1)} disabled={!canReturn || item.return_quantity >= maxReturn}><Plus size={12} /></Button>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right text-muted-foreground text-sm">{Number(item.unit_price).toLocaleString()}</td>
                            <td className="px-3 py-2.5 text-right text-red-400 font-medium text-sm">
                              {(item.return_quantity * item.unit_price) > 0 ? `-${(item.return_quantity * item.unit_price).toLocaleString()}` : '0'}
                            </td>
                            <td className="px-3 py-2.5 text-center">—</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot className="bg-muted/60 border-t border-border">
                    <tr>
                      <td colSpan={enablePacking ? 5 : 4} className="px-4 py-3 text-sm text-muted-foreground">
                        {filteredItems.length} Item{filteredItems.length !== 1 ? 's' : ''}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground text-center font-medium">
                        Qty: {filteredItems.reduce((s, i) => s + i.return_quantity, 0)}
                      </td>
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3 text-right text-[var(--erp-money-positive)] font-bold text-sm">
                        Total: -{returnAmount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
};
