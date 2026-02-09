import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, AlertCircle, Package, Minus, Plus, Trash2, Loader2, DollarSign, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { CalendarDatePicker } from '../ui/CalendarDatePicker';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
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
  size?: string;
  color?: string;
  variation?: {
    id?: string;
    size?: string;
    color?: string;
    attributes?: Record<string, unknown>;
    sku?: string;
  };
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
  
  // Return amount adjustment fields
  const [discountAmount, setDiscountAmount] = useState(0);
  const [restockingFee, setRestockingFee] = useState(0);
  const [manualAdjustment, setManualAdjustment] = useState(0);
  const [refundMethod, setRefundMethod] = useState<'cash' | 'bank' | 'adjust'>('cash');
  
  // Settlement dialog state
  const [showSettlementDialog, setShowSettlementDialog] = useState(false);
  const [pendingReturnData, setPendingReturnData] = useState<CreateSaleReturnData | null>(null);

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

        // Set default refund method based on original sale payment method
        // Cash sale → Cash Refund (default)
        // Credit sale → Adjust in Customer Account (default)
        if (sale.payment_method === 'cash' || sale.paymentMethod === 'cash') {
          setRefundMethod('cash');
        } else if (sale.payment_method === 'credit' || sale.paymentMethod === 'credit' || sale.payment_status === 'unpaid' || sale.paymentStatus === 'unpaid') {
          setRefundMethod('adjust'); // Adjust in Customer Account
        } else {
          setRefundMethod('cash'); // Default to cash refund
        }

        // Load original sale items with already returned quantities
        let items = await saleReturnService.getOriginalSaleItems(saleId, companyId);
        
        // Fallback: If service returns empty, try to get items from sale object
        if (!items || items.length === 0) {
          console.warn('[SALE RETURN] Service returned no items, trying sale object...');
          if (sale.items && sale.items.length > 0) {
            // Convert sale items to return items format
            items = sale.items.map((item: any) => ({
              id: item.id,
              product_id: item.product_id,
              variation_id: item.variation_id,
              product_name: item.product_name,
              sku: item.sku || item.product?.sku || 'N/A',
              quantity: Number(item.quantity || 0),
              unit: item.unit || 'piece',
              unit_price: Number(item.unit_price || item.price || 0),
              total: Number(item.total || 0),
              already_returned: 0, // Will be calculated if needed
              size: item.size || item.variation?.size,
              color: item.color || item.variation?.color,
              variation: item.variation,
            }));
            console.log('[SALE RETURN] Loaded items from sale object:', items);
          }
        }
        
        console.log('[SALE RETURN] Final items count:', items?.length);
        
        if (!items || items.length === 0) {
          toast.error('No items found in the original sale. Cannot create return.');
          console.error('[SALE RETURN] Sale has no items. Sale ID:', saleId, 'Sale object:', sale);
          onClose();
          return;
        }
        
        const formattedItems: ReturnItem[] = items.map(item => {
          // CRITICAL FIX: sale_item_id FK only works for sale_items table
          // If item came from sales_items table, we must set sale_item_id to undefined/null
          // to avoid foreign key constraint violation
          const saleItemId = (item as any)._fromSalesItems ? undefined : item.id;
          
          return {
            sale_item_id: saleItemId,
            product_id: item.product_id,
            variation_id: item.variation_id,
            product_name: item.product_name,
            sku: item.sku || 'N/A',
            original_quantity: item.quantity,
            already_returned: item.already_returned || 0,
            return_quantity: 0, // User will set this
            unit: item.unit || 'piece',
            unit_price: item.unit_price || 0,
            total: 0,
            size: item.size,
            color: item.color,
            variation: item.variation,
          };
        });

        console.log('[SALE RETURN] Formatted items:', formattedItems);
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
        subtotal: subtotal,
        discount_amount: discountAmount,
        total: total,
      };

      // If finalize is checked, show settlement dialog first
      if (finalize) {
        setPendingReturnData(returnData);
        setShowSettlementDialog(true);
        setSaving(false);
        return;
      }

      // Create sale return (draft - no settlement needed)
      const saleReturn = await saleReturnService.createSaleReturn(returnData);
      toast.success(`Sale return ${saleReturn.return_no || saleReturn.id} created as draft`);

      if (onSuccess) onSuccess();
      onClose();
    } catch (error: any) {
      console.error('[SALE RETURN FORM] Error saving return:', error);
      toast.error(error.message || 'Failed to create sale return');
    } finally {
      setSaving(false);
    }
  };

  // Handle settlement confirmation
  const handleSettlementConfirm = async () => {
    if (!pendingReturnData || !companyId || !contextBranchId || !originalSale) return;

    try {
      setSaving(true);
      setShowSettlementDialog(false);

      const branchId = contextBranchId === 'all' ? undefined : contextBranchId;
      if (!branchId) {
        toast.error('Please select a branch');
        return;
      }

      // Create sale return
      const saleReturn = await saleReturnService.createSaleReturn(pendingReturnData);

      // Finalize the return (creates stock movements and accounting)
      await saleReturnService.finalizeSaleReturn(saleReturn.id!, companyId, branchId, user?.id);
      
      // Create accounting reversal entry
      // Determine credit account based on refund method
      let creditAccount = 'Accounts Receivable';
      if (refundMethod === 'cash') {
        creditAccount = 'Cash'; // Cash refund
      } else if (refundMethod === 'bank') {
        creditAccount = 'Bank'; // Bank refund
      } else if (refundMethod === 'adjust') {
        creditAccount = 'Accounts Receivable'; // Adjust in customer account
      }

      try {
        const reversalSuccess = await accounting.createEntry({
          source: 'Sale Return',
          referenceNo: saleReturn.return_no || `RET-${saleReturn.id}`,
          debitAccount: 'Sales Revenue', // Reduces revenue
          creditAccount: creditAccount, // Based on refund method
          amount: total,
          description: `Sale Return: ${saleReturn.return_no || saleReturn.id} - Original: ${originalSale.invoice_no} - ${originalSale.customer_name}${discountAmount > 0 ? ` (Discount: Rs ${discountAmount.toLocaleString()})` : ''}${restockingFee > 0 ? ` (Restocking Fee: Rs ${restockingFee.toLocaleString()})` : ''}${manualAdjustment !== 0 ? ` (Adjustment: Rs ${manualAdjustment.toLocaleString()})` : ''} - Settlement: ${refundMethod === 'cash' ? 'Cash Refund' : refundMethod === 'bank' ? 'Bank Refund' : 'Adjust in Customer Account'}`,
          module: 'sales',
          metadata: {
            customerId: originalSale.customer_id,
            customerName: originalSale.customer_name,
            saleId: saleReturn.original_sale_id,
            invoiceId: originalSale.invoice_no,
            refundMethod: refundMethod,
            discountAmount: discountAmount,
            restockingFee: restockingFee,
            manualAdjustment: manualAdjustment,
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
        toast.warning('Sale return finalized, but accounting entry may have failed. Please check manually.');
      }

      toast.success(`Sale return ${saleReturn.return_no || saleReturn.id} finalized successfully`);
      setPendingReturnData(null);

      if (onSuccess) onSuccess();
      onClose();
    } catch (error: any) {
      console.error('[SALE RETURN FORM] Error finalizing return:', error);
      toast.error(error.message || 'Failed to finalize sale return');
    } finally {
      setSaving(false);
    }
  };

  const subtotal = useMemo(() => 
    returnItems.reduce((sum, item) => sum + item.total, 0), 
    [returnItems]
  );

  // Calculate adjusted total
  const total = useMemo(() => {
    let adjustedTotal = subtotal;
    adjustedTotal -= discountAmount; // Discount reduces return amount
    adjustedTotal += restockingFee; // Restocking fee increases return amount
    adjustedTotal += manualAdjustment; // Manual adjustment (can be positive or negative)
    return Math.max(0, adjustedTotal); // Ensure non-negative
  }, [subtotal, discountAmount, restockingFee, manualAdjustment]);

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
            <h2 className="text-2xl font-bold text-white">Sale Return</h2>
            <p className="text-sm text-gray-400 mt-1">
              Returning items from: <span className="text-blue-400 font-semibold">{originalSale?.invoice_no}</span>
            </p>
            <p className="text-xs text-amber-400 mt-1">
              ⚠️ Items are auto-loaded from original sale. Only return quantities can be edited.
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
          {/* Original Sale Info - READ ONLY */}
          <div className="bg-blue-900/20 border border-blue-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Package size={16} className="text-blue-400" />
              <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wide">Original Sale Information (Read-Only)</h3>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400 text-xs uppercase">Sale Invoice #:</span>
                <div className="text-white font-semibold mt-0.5">{originalSale?.invoice_no || 'N/A'}</div>
              </div>
              <div>
                <span className="text-gray-400 text-xs uppercase">Customer:</span>
                <div className="text-white font-semibold mt-0.5">{originalSale?.customer_name || 'Walk-in Customer'}</div>
              </div>
              <div>
                <span className="text-gray-400 text-xs uppercase">Original Sale Date:</span>
                <div className="text-white font-semibold mt-0.5">
                  {originalSale?.invoice_date ? format(new Date(originalSale.invoice_date), 'dd MMM yyyy') : '-'}
                </div>
              </div>
              <div>
                <span className="text-gray-400 text-xs uppercase">Original Total:</span>
                <div className="text-white font-semibold mt-0.5">Rs {Number(originalSale?.total || 0).toLocaleString()}</div>
              </div>
              <div>
                <span className="text-gray-400 text-xs uppercase">Sale Status:</span>
                <div className="mt-0.5">
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    {originalSale?.status || 'N/A'}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Return Date */}
          <div>
            <Label className="text-gray-200 mb-2 block">Return Date *</Label>
            <CalendarDatePicker
              value={returnDate}
              onChange={(date) => date && setReturnDate(date)}
              className="bg-gray-800 border-gray-700 text-white"
            />
          </div>

          {/* Return Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-gray-200 block">Return Items *</Label>
              <div className="text-xs text-gray-500 text-xs">
                Items from original sale - Only return quantity is editable
              </div>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-900/50 border-b border-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Product / Variation</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">SKU</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Original Qty</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Already Returned</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Return Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Unit Price</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {returnItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                        <Package size={32} className="mx-auto mb-2 opacity-50" />
                        <p>No items found in original sale</p>
                      </td>
                    </tr>
                  ) : (
                    returnItems.map((item, index) => {
                    const maxReturnable = item.original_quantity - item.already_returned;
                    const canReturn = maxReturnable > 0;

                    return (
                      <tr key={index} className={cn(
                        "hover:bg-gray-800/30 transition-colors",
                        !canReturn && "opacity-50"
                      )}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-white">{item.product_name}</div>
                          {(() => {
                            // Build variation text from variation object or size/color
                            let variationText = null;
                            if (item.variation) {
                              const attrs = item.variation.attributes || {};
                              if (Object.keys(attrs).length > 0) {
                                variationText = Object.entries(attrs)
                                  .filter(([_, v]) => v != null && v !== '')
                                  .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`)
                                  .join(', ');
                              } else if (item.variation.size || item.variation.color) {
                                variationText = [item.variation.size, item.variation.color].filter(Boolean).join(' / ');
                              }
                            } else if (item.size || item.color) {
                              variationText = [item.size, item.color].filter(Boolean).join(' / ');
                            }
                            
                            return variationText ? (
                              <div className="text-xs text-blue-400 mt-0.5">{variationText}</div>
                            ) : null;
                          })()}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-sm font-mono">
                          {item.variation?.sku || item.sku}
                        </td>
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
                  })
                  )}
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

          {/* Return Amount Adjustment Section */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-4">
            <h3 className="text-lg font-semibold text-white mb-3">Return Amount Adjustment</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-gray-300 mb-2 block text-sm">Discount Amount</Label>
                <Input
                  type="number"
                  min={0}
                  max={subtotal}
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(Math.max(0, Math.min(subtotal, parseFloat(e.target.value) || 0)))}
                  placeholder="0.00"
                  className="bg-gray-900 border-gray-700 text-white"
                />
                <p className="text-xs text-gray-500 mt-1">Reduces return amount</p>
              </div>
              
              <div>
                <Label className="text-gray-300 mb-2 block text-sm">Restocking Fee</Label>
                <Input
                  type="number"
                  min={0}
                  value={restockingFee}
                  onChange={(e) => setRestockingFee(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0.00"
                  className="bg-gray-900 border-gray-700 text-white"
                />
                <p className="text-xs text-gray-500 mt-1">Increases return amount</p>
              </div>
              
              <div>
                <Label className="text-gray-300 mb-2 block text-sm">Manual Adjustment</Label>
                <Input
                  type="number"
                  value={manualAdjustment}
                  onChange={(e) => setManualAdjustment(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="bg-gray-900 border-gray-700 text-white"
                />
                <p className="text-xs text-gray-500 mt-1">Positive or negative adjustment</p>
              </div>
            </div>

          </div>

          {/* Summary */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Subtotal:</span>
              <span className="text-white font-semibold">Rs {subtotal.toLocaleString()}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between items-center text-green-400">
                <span className="text-sm">Discount:</span>
                <span className="text-sm font-semibold">-Rs {discountAmount.toLocaleString()}</span>
              </div>
            )}
            {restockingFee > 0 && (
              <div className="flex justify-between items-center text-orange-400">
                <span className="text-sm">Restocking Fee:</span>
                <span className="text-sm font-semibold">+Rs {restockingFee.toLocaleString()}</span>
              </div>
            )}
            {manualAdjustment !== 0 && (
              <div className="flex justify-between items-center text-blue-400">
                <span className="text-sm">Manual Adjustment:</span>
                <span className="text-sm font-semibold">
                  {manualAdjustment >= 0 ? '+' : ''}Rs {manualAdjustment.toLocaleString()}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-700">
              <span className="text-white font-bold text-lg">Adjusted Return Amount:</span>
              <span className="text-red-400 font-bold text-lg">-Rs {total.toLocaleString()}</span>
            </div>
            {finalize && (
              <div className="mt-2 pt-2 border-t border-gray-700">
                <p className="text-xs text-amber-400">
                  ⚠️ Settlement method will be selected when finalizing
                </p>
              </div>
            )}
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

      {/* Settlement Dialog */}
      <Dialog open={showSettlementDialog} onOpenChange={setShowSettlementDialog}>
        <DialogContent className="bg-[#0B0F19] border-gray-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
              <DollarSign size={20} className="text-purple-400" />
              Return Amount Settlement
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="bg-[#0F1419] border border-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-2">Return Amount:</p>
              <p className="text-2xl font-bold text-red-400">Rs {total.toLocaleString()}</p>
            </div>
            
            <div>
              <Label className="text-gray-300 mb-3 block text-sm font-semibold">
                How would you like to settle this return amount?
              </Label>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setRefundMethod('cash')}
                  className={cn(
                    "w-full px-4 py-3 rounded-lg text-sm font-medium transition-all border flex items-center gap-3",
                    refundMethod === 'cash'
                      ? "bg-blue-600 text-white border-blue-500"
                      : "bg-gray-900/50 text-gray-400 border-gray-700 hover:bg-gray-800"
                  )}
                >
                  <DollarSign size={18} />
                  <div className="flex-1 text-left">
                    <div className="font-semibold">Cash Refund</div>
                    <div className="text-xs opacity-75">Refund amount in cash</div>
                  </div>
                  {refundMethod === 'cash' && <div className="w-2 h-2 rounded-full bg-white" />}
                </button>
                
                <button
                  type="button"
                  onClick={() => setRefundMethod('bank')}
                  className={cn(
                    "w-full px-4 py-3 rounded-lg text-sm font-medium transition-all border flex items-center gap-3",
                    refundMethod === 'bank'
                      ? "bg-blue-600 text-white border-blue-500"
                      : "bg-gray-900/50 text-gray-400 border-gray-700 hover:bg-gray-800"
                  )}
                >
                  <Building2 size={18} />
                  <div className="flex-1 text-left">
                    <div className="font-semibold">Bank Refund</div>
                    <div className="text-xs opacity-75">Refund amount via bank transfer</div>
                  </div>
                  {refundMethod === 'bank' && <div className="w-2 h-2 rounded-full bg-white" />}
                </button>
                
                <button
                  type="button"
                  onClick={() => setRefundMethod('adjust')}
                  className={cn(
                    "w-full px-4 py-3 rounded-lg text-sm font-medium transition-all border flex items-center gap-3",
                    refundMethod === 'adjust'
                      ? "bg-blue-600 text-white border-blue-500"
                      : "bg-gray-900/50 text-gray-400 border-gray-700 hover:bg-gray-800"
                  )}
                >
                  <Package size={18} />
                  <div className="flex-1 text-left">
                    <div className="font-semibold">Adjust in Customer Account</div>
                    <div className="text-xs opacity-75">Reduce customer's outstanding balance</div>
                  </div>
                  {refundMethod === 'adjust' && <div className="w-2 h-2 rounded-full bg-white" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-6 border-t border-gray-800 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowSettlementDialog(false);
                setPendingReturnData(null);
                setSaving(false);
              }}
              className="border-gray-700 text-gray-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSettlementConfirm}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Save size={16} className="mr-2" />
                  Confirm & Finalize
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
