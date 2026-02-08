import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, AlertCircle, Package, Minus, Plus, Trash2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { CalendarDatePicker } from '../ui/CalendarDatePicker';
import { toast } from 'sonner';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useAccounting } from '@/app/context/AccountingContext';
import { saleReturnService, CreateSaleReturnData } from '@/app/services/saleReturnService';
import { saleService } from '@/app/services/saleService';
import { cn } from '../ui/utils';

interface SaleReturnFormProps {
  saleId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

interface ReturnItem {
  sale_item_id?: string;
  product_id: string;
  variation_id?: string;
  product_name: string;
  sku: string;
  original_quantity: number;
  already_returned: number;
  return_quantity: number;
  unit?: string;
  unit_price: number;
  total: number;
}

export const SaleReturnForm: React.FC<SaleReturnFormProps> = ({ saleId, onClose, onSuccess }) => {
  const { companyId, branchId: contextBranchId, user } = useSupabase();
  const accounting = useAccounting();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [originalSale, setOriginalSale] = useState<any>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [returnDate, setReturnDate] = useState<Date>(new Date());
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [finalize, setFinalize] = useState(false);

  // Load original sale and items
  useEffect(() => {
    const loadData = async () => {
      if (!companyId || !saleId) return;

      try {
        setLoading(true);

        // Load original sale
        const sale = await saleService.getSaleById(saleId);
        setOriginalSale(sale);

        // Validate: Cannot return Draft/Quotation
        if (sale.status === 'draft' || sale.status === 'quotation') {
          toast.error('Cannot return Draft or Quotation sales. Only Final sales can be returned.');
          onClose();
          return;
        }

        // Load original sale items with already returned quantities
        const items = await saleReturnService.getOriginalSaleItems(saleId, companyId);
        
        const formattedItems: ReturnItem[] = items.map(item => ({
          sale_item_id: item.id,
          product_id: item.product_id,
          variation_id: item.variation_id,
          product_name: item.product_name,
          sku: item.sku,
          original_quantity: item.quantity,
          already_returned: item.already_returned || 0,
          return_quantity: 0, // User will set this
          unit: item.unit,
          unit_price: item.unit_price,
          total: 0,
        }));

        setReturnItems(formattedItems);
      } catch (error: any) {
        console.error('[SALE RETURN FORM] Error loading data:', error);
        toast.error(error.message || 'Failed to load sale data');
        onClose();
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [companyId, saleId, onClose]);

  // Calculate totals when return quantities change
  useEffect(() => {
    setReturnItems(items => items.map(item => ({
      ...item,
      total: item.return_quantity * item.unit_price,
    })));
  }, []);

  const handleQuantityChange = (index: number, quantity: number) => {
    const item = returnItems[index];
    const maxReturnable = item.original_quantity - item.already_returned;

    if (quantity < 0) {
      toast.error('Return quantity cannot be negative');
      return;
    }

    if (quantity > maxReturnable) {
      toast.error(`Cannot return more than ${maxReturnable} (Original: ${item.original_quantity}, Already returned: ${item.already_returned})`);
      return;
    }

    setReturnItems(items => items.map((it, idx) => 
      idx === index 
        ? { ...it, return_quantity: quantity, total: quantity * it.unit_price }
        : it
    ));
  };

  const handleSave = async () => {
    if (!companyId || !contextBranchId || !originalSale) return;

    // Validate: At least one item with return quantity > 0
    const itemsToReturn = returnItems.filter(item => item.return_quantity > 0);
    if (itemsToReturn.length === 0) {
      toast.error('Please select at least one item to return');
      return;
    }

    // Validate all quantities
    for (const item of itemsToReturn) {
      const maxReturnable = item.original_quantity - item.already_returned;
      if (item.return_quantity > maxReturnable) {
        toast.error(`Cannot return more than ${maxReturnable} for ${item.product_name}`);
        return;
      }
    }

    try {
      setSaving(true);

      const branchId = contextBranchId === 'all' ? undefined : contextBranchId;
      if (!branchId) {
        toast.error('Please select a branch');
        return;
      }

      // Prepare return data
      const returnData: CreateSaleReturnData = {
        company_id: companyId,
        branch_id: branchId,
        original_sale_id: saleId,
        return_date: format(returnDate, 'yyyy-MM-dd'),
        customer_id: originalSale.customer_id || undefined,
        customer_name: originalSale.customer_name,
        items: itemsToReturn.map(item => ({
          sale_item_id: item.sale_item_id,
          product_id: item.product_id,
          variation_id: item.variation_id,
          product_name: item.product_name,
          sku: item.sku,
          quantity: item.return_quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          total: item.total,
        })),
        reason: reason || undefined,
        notes: notes || undefined,
        created_by: user?.id,
      };

      // Create sale return
      const saleReturn = await saleReturnService.createSaleReturn(returnData);

      // If finalize is checked, finalize the return (creates stock movements and accounting)
      if (finalize) {
        await saleReturnService.finalizeSaleReturn(saleReturn.id!, companyId, branchId, user?.id);
        
        // Create accounting reversal entry
        // Reverse: DR Sales Revenue (reduces revenue), CR Accounts Receivable (reduces receivable)
        // For cash sales, we'll use Accounts Receivable as credit (will be adjusted by payment reversal if needed)
        try {
          const reversalSuccess = await accounting.createEntry({
            source: 'Sale Return',
            referenceNo: saleReturn.return_no || `RET-${saleReturn.id}`,
            debitAccount: 'Sales Revenue', // Reduces revenue
            creditAccount: 'Accounts Receivable', // Reduces receivable (or Cash if refund given)
            amount: total,
            description: `Sale Return: ${saleReturn.return_no || saleReturn.id} - Original: ${originalSale.invoice_no} - ${originalSale.customer_name}`,
            module: 'sales',
            metadata: {
              customerId: originalSale.customer_id,
              customerName: originalSale.customer_name,
              saleId: saleReturn.original_sale_id,
              invoiceId: originalSale.invoice_no,
            },
          });

          if (!reversalSuccess) {
            console.warn('[SALE RETURN] Accounting reversal may have failed, but stock movements were created');
            toast.warning('Sale return finalized, but accounting entry may have failed. Please check manually.');
          } else {
            console.log('[SALE RETURN] ✅ Accounting reversal entry created');
          }
        } catch (accountingError: any) {
          console.error('[SALE RETURN] Accounting reversal error (non-blocking):', accountingError);
          // Don't fail the return if accounting fails - stock movements are already created
          toast.warning('Sale return finalized, but accounting entry may have failed. Please check manually.');
        }

        toast.success(`Sale return ${saleReturn.return_no || saleReturn.id} finalized successfully`);
      } else {
        toast.success(`Sale return ${saleReturn.return_no || saleReturn.id} created as draft`);
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (error: any) {
      console.error('[SALE RETURN FORM] Error saving return:', error);
      toast.error(error.message || 'Failed to create sale return');
    } finally {
      setSaving(false);
    }
  };

  const subtotal = useMemo(() => 
    returnItems.reduce((sum, item) => sum + item.total, 0), 
    [returnItems]
  );

  const total = subtotal; // No discount/tax for now

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-8">
          <Loader2 className="animate-spin text-blue-500 mx-auto mb-4" size={32} />
          <p className="text-gray-400 text-center">Loading sale data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-5xl my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-6 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold text-white">Create Sale Return</h2>
            <p className="text-sm text-gray-400 mt-1">
              Original Sale: <span className="text-blue-400 font-semibold">{originalSale?.invoice_no}</span>
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X size={20} />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Original Sale Info */}
          <div className="bg-blue-900/20 border border-blue-800 rounded-xl p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Customer:</span>
                <span className="text-white font-semibold ml-2">{originalSale?.customer_name}</span>
              </div>
              <div>
                <span className="text-gray-400">Original Date:</span>
                <span className="text-white font-semibold ml-2">
                  {originalSale?.invoice_date ? format(new Date(originalSale.invoice_date), 'dd MMM yyyy') : '-'}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Original Total:</span>
                <span className="text-white font-semibold ml-2">Rs {Number(originalSale?.total || 0).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-gray-400">Status:</span>
                <Badge className="ml-2 bg-green-500/20 text-green-400 border-green-500/30">
                  {originalSale?.status || 'N/A'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Return Date */}
          <div>
            <Label className="text-gray-200 mb-2 block">Return Date *</Label>
            <CalendarDatePicker
              date={returnDate}
              onDateChange={(date) => date && setReturnDate(date)}
              className="bg-gray-800 border-gray-700 text-white"
            />
          </div>

          {/* Return Items */}
          <div>
            <Label className="text-gray-200 mb-3 block">Return Items *</Label>
            <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-900/50 border-b border-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Product</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">SKU</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Original Qty</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Already Returned</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Return Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Unit Price</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {returnItems.map((item, index) => {
                    const maxReturnable = item.original_quantity - item.already_returned;
                    const canReturn = maxReturnable > 0;

                    return (
                      <tr key={index} className={cn(
                        "hover:bg-gray-800/30 transition-colors",
                        !canReturn && "opacity-50"
                      )}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-white">{item.product_name}</div>
                          {item.variation_id && (
                            <div className="text-xs text-gray-500 mt-0.5">Variation included</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-sm font-mono">{item.sku}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{item.original_quantity}</td>
                        <td className="px-4 py-3 text-center">
                          {item.already_returned > 0 ? (
                            <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                              {item.already_returned}
                            </Badge>
                          ) : (
                            <span className="text-gray-500">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleQuantityChange(index, Math.max(0, item.return_quantity - 1))}
                              disabled={!canReturn || item.return_quantity <= 0}
                            >
                              <Minus size={14} />
                            </Button>
                            <Input
                              type="number"
                              min={0}
                              max={maxReturnable}
                              value={item.return_quantity}
                              onChange={(e) => handleQuantityChange(index, parseFloat(e.target.value) || 0)}
                              disabled={!canReturn}
                              className="w-20 text-center bg-gray-900 border-gray-700 text-white"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleQuantityChange(index, Math.min(maxReturnable, item.return_quantity + 1))}
                              disabled={!canReturn || item.return_quantity >= maxReturnable}
                            >
                              <Plus size={14} />
                            </Button>
                          </div>
                          {!canReturn && (
                            <p className="text-xs text-red-400 mt-1">Fully returned</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-300">Rs {Number(item.unit_price).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-white font-semibold">
                          Rs {Number(item.total).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Reason & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-200 mb-2 block">Return Reason</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Defective, Wrong item, Customer request"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <Label className="text-gray-200 mb-2 block">Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
                className="bg-gray-800 border-gray-700 text-white min-h-[80px]"
              />
            </div>
          </div>

          {/* Summary */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Subtotal:</span>
              <span className="text-white font-semibold">Rs {subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-700">
              <span className="text-white font-bold text-lg">Total:</span>
              <span className="text-white font-bold text-lg">Rs {total.toLocaleString()}</span>
            </div>
          </div>

          {/* Finalize Option */}
          <div className="flex items-center gap-2 p-3 bg-amber-900/20 border border-amber-800 rounded-lg">
            <input
              type="checkbox"
              id="finalize"
              checked={finalize}
              onChange={(e) => setFinalize(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded"
            />
            <Label htmlFor="finalize" className="text-gray-200 cursor-pointer">
              Finalize return (create stock movements and accounting entries)
            </Label>
          </div>

          {/* Warning */}
          {finalize && (
            <div className="flex items-start gap-2 p-3 bg-blue-900/20 border border-blue-800 rounded-lg">
              <AlertCircle size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-300">
                Finalizing will immediately create stock movements (stock IN) and accounting reversal entries. 
                This action cannot be undone.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-900 border-t border-gray-700 p-6 flex items-center justify-end gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-gray-700 text-gray-300"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || returnItems.filter(item => item.return_quantity > 0).length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={16} className="mr-2" />
                {finalize ? 'Save & Finalize' : 'Save as Draft'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
