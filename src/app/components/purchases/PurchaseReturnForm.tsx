/**
 * Purchase Return form – create and finalize in one step. FINAL when saved (no edit/delete).
 */
import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, Package, Minus, Plus, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { CalendarDatePicker } from '../ui/CalendarDatePicker';
import { toast } from 'sonner';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useSettings } from '@/app/context/SettingsContext';
import { purchaseReturnService, CreatePurchaseReturnData } from '@/app/services/purchaseReturnService';
import { purchaseService } from '@/app/services/purchaseService';
import { PackingDetails } from '../transactions/PackingEntryModal';
import { cn } from '../ui/utils';

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
  // Packing fields - preserved from original purchase item
  packing_type?: string;
  packing_quantity?: number;
  packing_unit?: string;
  packing_details?: PackingDetails; // Original packing details from purchase (read-only)
  // Variation object for display (same as Purchase View)
  variation?: any;
}

export const PurchaseReturnForm: React.FC<PurchaseReturnFormProps> = ({ purchaseId, onClose, onSuccess }) => {
  const { companyId, branchId: contextBranchId, user } = useSupabase();
  const { inventorySettings } = useSettings();
  const enablePacking = inventorySettings.enablePacking;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [originalPurchase, setOriginalPurchase] = useState<any>(null);
  const [returnItems, setReturnItems] = useState<ReturnItemRow[]>([]);
  const [returnDate, setReturnDate] = useState<Date>(new Date());
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

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
          // Preserve all packing fields from original purchase item (read-only)
          packing_type: it.packing_type,
          packing_quantity: it.packing_quantity,
          packing_unit: it.packing_unit,
          packing_details: it.packing_details || undefined,
          // Preserve variation object for display (same as Purchase View)
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

  // Packing is automatically calculated proportionally - no manual entry needed

  const subtotal = useMemo(() => returnItems.reduce((sum, item) => sum + item.return_quantity * item.unit_price, 0), [returnItems]);
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
          // Calculate proportional packing based on return quantity
          let returnPackingDetails: any = undefined;
          if (i.packing_details && i.quantity > 0) {
            const returnRatio = i.return_quantity / i.quantity;
            const originalPacking = i.packing_details;
            
            // Calculate proportional boxes and pieces
            const originalBoxes = originalPacking.total_boxes || 0;
            const originalPieces = originalPacking.total_pieces || 0;
            const originalMeters = originalPacking.total_meters || 0;
            
            const returnBoxes = Math.round(originalBoxes * returnRatio * 100) / 100;
            const returnPieces = Math.round(originalPieces * returnRatio * 100) / 100;
            const returnMeters = Math.round(originalMeters * returnRatio * 100) / 100;
            
            returnPackingDetails = {
              ...originalPacking,
              total_boxes: returnBoxes,
              total_pieces: returnPieces,
              total_meters: returnMeters,
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
            // Preserve packing structure (proportional to return quantity)
            packing_type: i.packing_type,
            packing_quantity: i.packing_quantity && i.quantity > 0 
              ? (i.packing_quantity * i.return_quantity / i.quantity)
              : undefined,
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
        total: subtotal,
      };
      const purchaseReturn = await purchaseReturnService.createPurchaseReturn(returnData);
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

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-8">
          <Loader2 className="animate-spin text-blue-500 mx-auto mb-4" size={32} />
          <p className="text-gray-400 text-center">Loading purchase...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-4xl my-8 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-6 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold text-white">Purchase Return</h2>
            <p className="text-sm text-gray-400 mt-1">
              Returning items from: <span className="text-blue-400 font-semibold">{originalPurchase?.po_no || purchaseId?.slice(0, 8)}</span>
            </p>
            <p className="text-xs text-amber-400 mt-1">Once saved, this return is FINAL and cannot be edited or deleted.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </Button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm bg-gray-800/50 rounded-lg p-4">
            <div>
              <span className="text-gray-400 text-xs uppercase">PO #</span>
              <div className="text-white font-semibold">{originalPurchase?.po_no || '—'}</div>
            </div>
            <div>
              <span className="text-gray-400 text-xs uppercase">Supplier</span>
              <div className="text-white font-semibold">{originalPurchase?.supplier_name || originalPurchase?.supplierName || '—'}</div>
            </div>
          </div>

          <div>
            <Label className="text-gray-200 mb-2 block">Return Date *</Label>
            <CalendarDatePicker value={returnDate} onChange={(d) => d && setReturnDate(d)} className="bg-gray-800 border-gray-700 text-white" />
          </div>

          <div>
            <Label className="text-gray-200 block mb-2">Return Items</Label>
            <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-900/50 border-b border-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Product</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">SKU</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Variation</th>
                    {enablePacking && <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Packing</th>}
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Unit Price</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Original Qty</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Already Returned</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Return Qty</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Unit</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {returnItems.length === 0 ? (
                    <tr>
                      <td colSpan={enablePacking ? 10 : 9} className="px-4 py-6 text-center text-gray-500">No items in this purchase</td>
                    </tr>
                  ) : (
                    returnItems.map((item, index) => {
                      const maxReturn = item.quantity - item.already_returned;
                      const canReturn = maxReturn > 0;
                      
                      // Extract variation data (same as Purchase View)
                      const variation = item.variation || null;
                      const variationAttrs = variation?.attributes || {};
                      const variationSku = variation?.sku || null;
                      const variationText = variationAttrs 
                        ? Object.entries(variationAttrs)
                            .filter(([_, v]) => v != null && v !== '')
                            .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`)
                            .join(', ')
                        : null;
                      
                      // Use variation SKU if available, otherwise use product SKU (same as Purchase View)
                      const finalSku = variationSku || item.sku || 'N/A';
                      
                      // Packing display (same format as Purchase View): "X Boxes, Y Pieces"
                      const pd = item.packing_details || {};
                      const totalBoxes = pd.total_boxes ?? 0;
                      const totalPieces = pd.total_pieces ?? 0;
                      const packingParts: string[] = [];
                      if (Number(totalBoxes) > 0) packingParts.push(`${totalBoxes} Box${Number(totalBoxes) !== 1 ? 'es' : ''}`);
                      if (Number(totalPieces) > 0) packingParts.push(`${totalPieces} Piece${Number(totalPieces) !== 1 ? 's' : ''}`);
                      const packingText = packingParts.length ? packingParts.join(', ') : '—';
                      const unitDisplay = item.unit ?? 'pcs';
                      
                      return (
                        <tr key={item.id} className={cn("border-gray-800", !canReturn && 'opacity-50')}>
                          {/* Product (with SKU in subtext - same as Purchase View) */}
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-white">{item.product_name}</p>
                              {finalSku && finalSku !== 'N/A' && (
                                <p className="text-xs text-gray-500">SKU: {finalSku}</p>
                              )}
                            </div>
                          </td>
                          {/* SKU (variation SKU or product SKU - same as Purchase View) */}
                          <td className="px-4 py-3 text-gray-400 font-mono text-sm">{finalSku}</td>
                          {/* Variation (same as Purchase View) */}
                          <td className="px-4 py-3">
                            {variationText ? (
                              <span className="text-gray-300 text-sm">{variationText}</span>
                            ) : (
                              <span className="text-gray-600">—</span>
                            )}
                          </td>
                          {/* Packing (same format as Purchase View: "X Boxes, Y Pieces") */}
                          {enablePacking && (
                            <td className="px-4 py-3 text-gray-400">{packingText}</td>
                          )}
                          {/* Unit Price (read-only, right aligned - same as Purchase View) */}
                          <td className="px-4 py-3 text-right text-white">
                            Rs. {Number(item.unit_price).toLocaleString()}
                          </td>
                          {/* Original Qty (read-only, center aligned) */}
                          <td className="px-4 py-3 text-center text-white font-medium">
                            {item.quantity}
                          </td>
                          {/* Already Returned (read-only, center aligned) */}
                          <td className="px-4 py-3 text-center">
                            {item.already_returned > 0 ? (
                              <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                                {item.already_returned}
                              </Badge>
                            ) : (
                              <span className="text-gray-500">0</span>
                            )}
                          </td>
                          {/* Return Qty (editable, center aligned) */}
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleQuantityChange(index, item.return_quantity - 1)} disabled={!canReturn || item.return_quantity <= 0}><Minus size={14} /></Button>
                              <Input type="number" min={0} max={maxReturn} value={item.return_quantity} onChange={(e) => handleQuantityChange(index, parseFloat(e.target.value) || 0)} disabled={!canReturn} className="w-18 text-center bg-gray-900 border-gray-700 text-white h-8" />
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleQuantityChange(index, item.return_quantity + 1)} disabled={!canReturn || item.return_quantity >= maxReturn}><Plus size={14} /></Button>
                            </div>
                            {!canReturn && (
                              <p className="text-xs text-red-400 mt-1 text-center">Fully returned</p>
                            )}
                          </td>
                          {/* Unit (read-only - same as Purchase View) */}
                          <td className="px-4 py-3 text-gray-400">{unitDisplay}</td>
                          {/* Total (right aligned - same as Purchase View) */}
                          <td className="px-4 py-3 text-right text-white font-medium">
                            Rs. {(item.return_quantity * item.unit_price).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <Label className="text-gray-200 mb-1 block">Reason (optional)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for return" className="bg-gray-800 border-gray-700 text-white" />
          </div>
          <div>
            <Label className="text-gray-200 mb-1 block">Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" className="bg-gray-800 border-gray-700 text-white min-h-[60px]" />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-700">
            <div className="text-lg font-semibold text-white">Total Return: <span className="text-red-400">{subtotal.toLocaleString()}</span></div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} className="border-gray-700 text-gray-300">Cancel</Button>
              <Button onClick={handleSubmit} disabled={saving || !hasAnyReturn} className="bg-blue-600 hover:bg-blue-700">
                {saving ? <Loader2 size={18} className="animate-spin mr-2" /> : <Save size={18} className="mr-2" />}
                Create & Finalize Return
              </Button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
