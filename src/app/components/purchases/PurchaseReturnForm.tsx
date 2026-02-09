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
import { purchaseReturnService, CreatePurchaseReturnData } from '@/app/services/purchaseReturnService';
import { purchaseService } from '@/app/services/purchaseService';
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
}

export const PurchaseReturnForm: React.FC<PurchaseReturnFormProps> = ({ purchaseId, onClose, onSuccess }) => {
  const { companyId, branchId: contextBranchId, user } = useSupabase();
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
        .map(i => ({
          product_id: i.product_id,
          variation_id: i.variation_id,
          product_name: i.product_name,
          sku: i.sku,
          quantity: i.return_quantity,
          unit: i.unit,
          unit_price: i.unit_price,
          total: i.return_quantity * i.unit_price,
        }));
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
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Product</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">SKU</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-400 uppercase">Purchased</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-400 uppercase">Already Returned</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-400 uppercase">Return Qty</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-400 uppercase">Unit Price</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-400 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {returnItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-gray-500">No items in this purchase</td>
                    </tr>
                  ) : (
                    returnItems.map((item, index) => {
                      const maxReturn = item.quantity - item.already_returned;
                      const canReturn = maxReturn > 0;
                      return (
                        <tr key={item.id} className={cn(!canReturn && 'opacity-50')}>
                          <td className="px-4 py-2 text-white font-medium">{item.product_name}</td>
                          <td className="px-4 py-2 text-gray-400 font-mono text-sm">{item.sku}</td>
                          <td className="px-4 py-2 text-center text-gray-300">{item.quantity}</td>
                          <td className="px-4 py-2 text-center">{item.already_returned > 0 ? <Badge className="bg-orange-500/20 text-orange-400">{item.already_returned}</Badge> : '0'}</td>
                          <td className="px-4 py-2">
                            <div className="flex items-center justify-center gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleQuantityChange(index, item.return_quantity - 1)} disabled={!canReturn || item.return_quantity <= 0}><Minus size={14} /></Button>
                              <Input type="number" min={0} max={maxReturn} value={item.return_quantity} onChange={(e) => handleQuantityChange(index, parseFloat(e.target.value) || 0)} disabled={!canReturn} className="w-18 text-center bg-gray-900 border-gray-700 text-white h-8" />
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleQuantityChange(index, item.return_quantity + 1)} disabled={!canReturn || item.return_quantity >= maxReturn}><Plus size={14} /></Button>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right text-gray-300">{Number(item.unit_price).toLocaleString()}</td>
                          <td className="px-4 py-2 text-right text-white font-medium">{(item.return_quantity * item.unit_price).toLocaleString()}</td>
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
