import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, AlertCircle, Package, Loader2, DollarSign, Building2, Lock, Ruler, TrendingUp, Undo2, RefreshCw, Box, Check } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
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
import { useSettings } from '@/app/context/SettingsContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { saleReturnService, CreateSaleReturnData, UpdateSaleReturnData } from '@/app/services/saleReturnService';
import { saleService } from '@/app/services/saleService';
import { PackingEntryModal, type ReturnPackingDetails } from '../transactions/PackingEntryModal';
import { cn, formatBoxesPieces } from '../ui/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';

interface SaleReturnFormProps {
  saleId: string;
  /** When set, form opens in edit mode for this draft return. */
  returnId?: string | null;
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
  // Packing fields - preserved from original sale item
  packing_type?: string;
  packing_quantity?: number;
  packing_unit?: string;
  packing_details?: any; // JSONB
  /** Set by Return Packing dialog only; when present, return_quantity is read-only and equals returned_total_meters */
  return_packing_details?: ReturnPackingDetails;
  variation?: {
    id?: string;
    size?: string;
    color?: string;
    attributes?: Record<string, unknown>;
    sku?: string;
  };
}

export const SaleReturnForm: React.FC<SaleReturnFormProps> = ({ saleId, returnId, onClose, onSuccess }) => {
  const { companyId, branchId: contextBranchId, user } = useSupabase();
  const accounting = useAccounting();
  const { inventorySettings } = useSettings();
  const { formatCurrency } = useFormatCurrency();
  const enablePacking = inventorySettings.enablePacking;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [originalSale, setOriginalSale] = useState<any>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [returnDate, setReturnDate] = useState<Date>(new Date());
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  
  // Return amount adjustment fields
  const [discountAmount, setDiscountAmount] = useState(0);
  const [restockingFee, setRestockingFee] = useState(0);
  const [manualAdjustment, setManualAdjustment] = useState(0);
  const [refundMethod, setRefundMethod] = useState<'cash' | 'bank' | 'adjust'>('cash');
  
  // Settlement dialog state
  const [showSettlementDialog, setShowSettlementDialog] = useState(false);
  const [pendingReturnData, setPendingReturnData] = useState<CreateSaleReturnData | null>(null);

  // Return Packing dialog: single source of truth for return qty when packing enabled
  const [packingModalOpen, setPackingModalOpen] = useState(false);
  const [activePackingItemIndex, setActivePackingItemIndex] = useState<number | null>(null);

  // Load original sale and items (and existing return when returnId is set - edit mode)
  useEffect(() => {
    const loadData = async () => {
      if (!companyId || !saleId) return;

      try {
        setLoading(true);

        let existingReturn: (Awaited<ReturnType<typeof saleReturnService.getSaleReturnById>>) | null = null;
        if (returnId) {
          existingReturn = await saleReturnService.getSaleReturnById(returnId, companyId);
          if (existingReturn.status === 'final') {
            toast.error('Cannot edit a finalized sale return. It is locked.');
            onClose();
            return;
          }
        }

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
        if (sale.payment_method === 'cash' || sale.paymentMethod === 'cash') {
          setRefundMethod('cash');
        } else if (sale.payment_method === 'credit' || sale.paymentMethod === 'credit' || sale.payment_status === 'unpaid' || sale.paymentStatus === 'unpaid') {
          setRefundMethod('adjust');
        } else {
          setRefundMethod('cash');
        }

        if (existingReturn) {
          setReturnDate(existingReturn.return_date ? new Date(existingReturn.return_date) : new Date());
          setReason(existingReturn.reason || '');
          setNotes(existingReturn.notes || '');
          setDiscountAmount(Number(existingReturn.discount_amount) || 0);
        }

        // Load original sale items with already returned quantities
        let items = await saleReturnService.getOriginalSaleItems(saleId, companyId);
        
        // Fallback: If service returns empty, try to get items from sale object
        if (!items || items.length === 0) {
          if (sale.items && sale.items.length > 0) {
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
              already_returned: 0,
              size: item.size || item.variation?.size,
              color: item.color || item.variation?.color,
              variation: item.variation,
            }));
          }
        }
        
        if (!items || items.length === 0) {
          toast.error('No items found in the original sale. Cannot create return.');
          onClose();
          return;
        }

        const returnItemsMap = new Map<string, { quantity: number; total: number; packing_details?: any; return_packing_details?: any }>();
        if (existingReturn?.items?.length) {
          existingReturn.items.forEach((ri: any) => {
            const key = `${ri.product_id}-${ri.variation_id ?? ''}`;
            returnItemsMap.set(key, {
              quantity: Number(ri.quantity),
              total: Number(ri.total),
              packing_details: ri.packing_details,
              return_packing_details: ri.return_packing_details,
            });
          });
        }
        
        const formattedItems: ReturnItem[] = items.map(item => {
          const saleItemId = (item as any)._fromSalesItems ? undefined : item.id;
          const key = `${item.product_id}-${item.variation_id ?? ''}`;
          const fromReturn = returnItemsMap.get(key);
          const returnQty = fromReturn ? fromReturn.quantity : (existingReturn ? 0 : 0);
          const returnTotal = fromReturn ? fromReturn.total : 0;
          return {
            sale_item_id: saleItemId,
            product_id: item.product_id,
            variation_id: item.variation_id,
            product_name: item.product_name,
            sku: item.sku || 'N/A',
            original_quantity: item.quantity,
            already_returned: item.already_returned || 0,
            return_quantity: returnQty,
            unit: item.unit || 'piece',
            unit_price: item.unit_price || 0,
            total: returnTotal,
            size: item.size,
            color: item.color,
            packing_type: item.packing_type,
            packing_quantity: item.packing_quantity,
            packing_unit: item.packing_unit,
            packing_details: item.packing_details,
            return_packing_details: fromReturn?.return_packing_details,
            variation: item.variation,
          };
        });

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
  }, [companyId, saleId, returnId, onClose]);

  // Calculate totals when return quantities change
  useEffect(() => {
    setReturnItems(items => items.map(item => ({
      ...item,
      total: item.return_quantity * item.unit_price,
    })));
  }, []);

  const handleQuantityChange = (index: number, quantity: number) => {
    const item = returnItems[index];
    // When packing is enabled and item has packing_details, qty is controlled ONLY by Return Packing dialog
    if (enablePacking && item.packing_details && (item.packing_details.boxes?.length > 0 || item.packing_details.loose_pieces?.length > 0)) {
      return; // no-op; user must use Return Packing dialog
    }
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

  /** Called when user saves in Return Packing dialog. Sets return_quantity = returned_total_meters (single source of truth). */
  const handleSaveReturnPacking = (index: number, details: ReturnPackingDetails) => {
    const meters = details.returned_total_meters;
    setReturnItems(items => items.map((it, idx) => {
      if (idx !== index) return it;
      return {
        ...it,
        return_quantity: meters,
        total: meters * it.unit_price,
        return_packing_details: details,
      };
    }));
    setPackingModalOpen(false);
    setActivePackingItemIndex(null);
  };

  const handleSave = async () => {
    if (!companyId || !contextBranchId || !originalSale) return;

    // Validate: At least one item with return quantity > 0
    const itemsToReturn = returnItems.filter(item => item.return_quantity > 0);
    if (itemsToReturn.length === 0) {
      toast.error('Please select at least one item to return');
      return;
    }

    // When packing enabled: items with packing (boxes/loose) must have completed Return Packing (no manual qty)
    if (enablePacking) {
      for (const item of itemsToReturn) {
        const hasPackingStructure = item.packing_details && (item.packing_details.boxes?.length > 0 || item.packing_details.loose_pieces?.length > 0);
        if (hasPackingStructure && !item.return_packing_details) {
          toast.error(`Complete Return Packing for "${item.product_name}" before saving. Use the "Return Packing" button to select pieces.`);
          return;
        }
      }
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

      const buildItemsPayload = () =>
        itemsToReturn.map(item => {
          let returnPackingDetailsPayload: any = undefined;
          if (item.return_packing_details) {
            returnPackingDetailsPayload = item.return_packing_details;
          } else if (item.packing_details && item.original_quantity > 0) {
            const returnRatio = item.return_quantity / item.original_quantity;
            const originalPacking = item.packing_details;
            const originalBoxes = originalPacking.total_boxes || 0;
            const originalPieces = originalPacking.total_pieces || 0;
            const originalMeters = originalPacking.total_meters || 0;
            returnPackingDetailsPayload = {
              ...originalPacking,
              total_boxes: Math.round(originalBoxes * returnRatio * 100) / 100,
              total_pieces: Math.round(originalPieces * returnRatio * 100) / 100,
              total_meters: Math.round(originalMeters * returnRatio * 100) / 100,
            };
          }
          return {
            sale_item_id: item.sale_item_id,
            product_id: item.product_id,
            variation_id: item.variation_id,
            product_name: item.product_name,
            sku: item.sku,
            quantity: item.return_quantity,
            unit: item.unit,
            unit_price: item.unit_price,
            total: item.total,
            packing_type: item.packing_type,
            packing_quantity: item.packing_quantity && item.original_quantity > 0
              ? (item.packing_quantity * item.return_quantity / item.original_quantity)
              : undefined,
            packing_unit: item.packing_unit,
            packing_details: item.packing_details ?? undefined,
            return_packing_details: returnPackingDetailsPayload ?? undefined,
          };
        });

      // Edit mode: update draft return and close
      if (returnId && companyId) {
        const updateData: UpdateSaleReturnData = {
          return_date: format(returnDate, 'yyyy-MM-dd'),
          customer_id: originalSale.customer_id || undefined,
          customer_name: originalSale.customer_name || 'Walk-in',
          items: buildItemsPayload(),
          reason: reason || undefined,
          notes: notes || undefined,
          subtotal,
          discount_amount: discountAmount,
          total,
        };
        await saleReturnService.updateSaleReturn(returnId, companyId, updateData);
        toast.success('Sale return updated');
        if (onSuccess) onSuccess();
        onClose();
        setSaving(false);
        return;
      }

      // Create mode: prepare data and show settlement dialog
      const returnData: CreateSaleReturnData = {
        company_id: companyId,
        branch_id: branchId,
        original_sale_id: saleId,
        return_date: format(returnDate, 'yyyy-MM-dd'),
        customer_id: originalSale.customer_id || undefined,
        customer_name: originalSale.customer_name || 'Walk-in',
        items: buildItemsPayload(),
        reason: reason || undefined,
        notes: notes || undefined,
        created_by: user?.id,
        subtotal,
        discount_amount: discountAmount,
        total,
      };
      setPendingReturnData(returnData);
      setShowSettlementDialog(true);
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
          description: `Sale Return: ${saleReturn.return_no || saleReturn.id} - Original: ${originalSale.invoice_no} - ${originalSale.customer_name}${discountAmount > 0 ? ` (Discount: ${formatCurrency(discountAmount)})` : ''}${restockingFee > 0 ? ` (Restocking Fee: ${formatCurrency(restockingFee)})` : ''}${manualAdjustment !== 0 ? ` (Adjustment: ${formatCurrency(manualAdjustment)})` : ''} - Settlement: ${refundMethod === 'cash' ? 'Cash Refund' : refundMethod === 'bank' ? 'Bank Refund' : 'Adjust in Customer Account'}`,
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

  const [itemSearch, setItemSearch] = useState('');
  const filteredReturnItems = useMemo(() => {
    if (!itemSearch.trim()) return returnItems;
    const q = itemSearch.toLowerCase();
    return returnItems.filter(
      (i) =>
        (i.product_name || '').toLowerCase().includes(q) ||
        (i.sku || '').toLowerCase().includes(q) ||
        (i.variation?.sku || '').toLowerCase().includes(q)
    );
  }, [returnItems, itemSearch]);

  const originalAmount = Number(originalSale?.total ?? 0);
  const returnAmount = subtotal; // From returned items only (no manual input in amount panel)
  const netAfterReturn = Math.max(0, originalAmount - returnAmount);

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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 overflow-y-auto p-4">
      <div className="bg-[#0B0F19] border border-gray-800 rounded-2xl w-[80%] min-w-[1000px] max-w-6xl min-h-[85vh] max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header — Figma: Title + Ref, Return No, Controlled Reversal, Locked badge */}
        <div className="shrink-0 bg-gray-900/80 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              {returnId ? 'Edit ' : ''}Sales Return <span className="text-gray-400 font-normal">· Ref: {originalSale?.invoice_no || 'N/A'}</span>
              {originalSale?.customer_name ? (
                <span className="text-gray-400 font-normal"> · {originalSale.customer_name}</span>
              ) : null}
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-gray-500"># Return No: {returnId ? 'Draft' : 'New'}</span>
              <span className="flex items-center gap-1.5 text-amber-400/90 text-xs font-medium">
                <AlertCircle size={14} className="shrink-0" />
                Controlled Reversal
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div>
              <span className="text-[11px] text-gray-500 block mb-0.5">Return Date</span>
              <CalendarDatePicker value={returnDate} onChange={(date) => date && setReturnDate(date)} className="bg-gray-800 border-gray-700 text-white h-8 w-[140px] text-sm" />
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-400 hover:text-white rounded-full">
              <X size={22} />
            </Button>
          </div>
        </div>

        {/* Content: screenshot order — amount cards (horizontal) → Finalize → banner → Items Entry */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 pb-10 space-y-4 min-h-0">
          {/* 1) Amount Summary — compact 60px boxes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full h-[60px]">
            <div className="rounded-xl px-2.5 py-1.5 min-w-0 h-[60px] flex flex-col justify-center bg-green-500/10 border border-green-500/30 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-8 h-8 bg-green-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="flex items-center gap-1 text-green-400 relative">
                <TrendingUp size={12} className="shrink-0" />
                <span className="text-[9px] font-bold uppercase tracking-wider">Original Sale</span>
              </div>
              <p className="text-sm font-bold text-green-400 tracking-tight relative leading-tight">{formatCurrency(originalAmount)}</p>
              <p className="text-[8px] text-gray-500 relative">Reference</p>
            </div>
            <div className="rounded-xl px-2.5 py-1.5 min-w-0 h-[60px] flex flex-col justify-center bg-red-500/10 border border-red-500/30 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-8 h-8 bg-red-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="flex items-center gap-1 text-red-400 relative">
                <Undo2 size={12} className="shrink-0" />
                <span className="text-[9px] font-bold uppercase tracking-wider">Return Amount</span>
              </div>
              <p className="text-sm font-bold text-red-400 tracking-tight relative leading-tight">{formatCurrency(returnAmount)}</p>
              <p className="text-[8px] text-gray-500 relative">From items</p>
            </div>
            <div className="rounded-xl px-2.5 py-1.5 min-w-0 h-[60px] flex flex-col justify-center bg-blue-500/10 border border-blue-500/30 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-8 h-8 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute top-1 right-1">
                <RefreshCw size={10} className="text-blue-400/80" />
              </div>
              <div className="flex items-center gap-1 text-blue-400 relative">
                <span className="text-[9px] font-bold uppercase tracking-wider">Net After Return</span>
              </div>
              <p className="text-sm font-bold text-white tracking-tight relative leading-tight">{formatCurrency(netAfterReturn)}</p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex flex-wrap items-end gap-3 flex-1 min-w-0 max-w-md">
              <div className="min-w-[140px] w-[140px] shrink-0">
                <Label className="text-gray-500 text-xs mb-1 block">Reason (optional)</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Defective, Wrong item" className="bg-gray-800 border-gray-700 text-white text-sm h-9" />
              </div>
              <div className="flex-1 min-w-[200px]">
                <Label className="text-gray-500 text-xs mb-1 block">Notes (optional)</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes" className="bg-gray-800 border-gray-700 text-white text-sm h-9 w-[652px]" />
              </div>
            </div>
            <Button
              onClick={handleSave}
              disabled={saving || returnItems.filter(i => i.return_quantity > 0).length === 0 || (enablePacking && returnItems.some(i => {
                const hasPacking = i.packing_details && (i.packing_details.boxes?.length > 0 || i.packing_details.loose_pieces?.length > 0);
                return i.return_quantity > 0 && hasPacking && !i.return_packing_details;
              }))}
              size="sm"
              className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm flex items-center gap-1.5 shrink-0"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {returnId ? 'Update Return' : 'Finalize Return'}
            </Button>
          </div>

          {/* 2) Return Reversal Mode banner — below amount section (screenshot) */}
          <div className="flex items-center gap-3 px-4 py-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
              <AlertCircle size={18} className="text-amber-400" />
            </div>
            <p className="text-sm text-blue-100">
              <span className="font-semibold text-white">Return Reversal Mode:</span> Items are loaded from original sale invoice {originalSale?.invoice_no || 'N/A'}. Adjust return quantities as needed. Stock will be updated automatically upon finalization.
            </p>
          </div>

          {/* 3) Items Entry — Figma: section title + search + table */}
            <div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Box size={18} className="text-gray-500" />
                Items Entry
              </h3>
              <Input
                placeholder="Search products by name, SKU... ⌘K"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                className="mb-4 bg-gray-800/80 border-gray-700 text-white placeholder:text-gray-500 rounded-lg h-10"
              />
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-5 py-3 bg-gray-950/50 border-b border-gray-800 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
                    <Package size={16} />
                    Items ({filteredReturnItems.length})
                    <span className="text-xs font-normal normal-case text-purple-400 ml-1">Return Items</span>
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-800 hover:bg-transparent">
                        <TableHead className="text-gray-400">Product</TableHead>
                        <TableHead className="text-gray-400">SKU</TableHead>
                        <TableHead className="text-gray-400">Variation</TableHead>
                        {enablePacking && <TableHead className="text-gray-400">Packing</TableHead>}
                        <TableHead className="text-gray-400 text-right">Unit Price</TableHead>
                        <TableHead className="text-gray-400 text-center">Original Qty</TableHead>
                        <TableHead className="text-gray-400 text-center">Return Qty</TableHead>
                        <TableHead className="text-gray-400">Unit</TableHead>
                        <TableHead className="text-gray-400 text-right">Return Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReturnItems.length === 0 ? (
                        <TableRow className="border-gray-800 hover:bg-transparent" key="empty">
                          <TableCell colSpan={enablePacking ? 9 : 8} className="px-4 py-8 text-center text-gray-500">
                            <Package size={32} className="mx-auto mb-2 opacity-50" />
                            <p>{itemSearch ? 'No items match search' : 'No items found in original sale'}</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredReturnItems.map((item, idx) => {
                          const index = returnItems.indexOf(item);
                          const maxReturnable = item.original_quantity - item.already_returned;
                          const canReturn = maxReturnable > 0;
                          const hasPackingStructure = item.packing_details && (item.packing_details.boxes?.length > 0 || item.packing_details.loose_pieces?.length > 0);
                          const returnQtyFromPacking = hasPackingStructure && item.return_packing_details;
                          const pd = item.packing_details || {};
                          const totalBoxes = pd.total_boxes ?? 0;
                          const totalPieces = pd.total_pieces ?? 0;
                          // Packing display: same format as ViewPurchaseDetailsDrawer — Box(es), Piece(s), M
                          let packingText = '—';
                          if (item.return_packing_details) {
                            const rp = item.return_packing_details;
                            const returnPackingParts: string[] = [];
                            if ((rp.returned_boxes ?? 0) > 0) {
                              returnPackingParts.push(`${formatBoxesPieces(rp.returned_boxes)} Box${Math.round(Number(rp.returned_boxes)) !== 1 ? 'es' : ''}`);
                            }
                            if ((rp.returned_pieces_count ?? 0) > 0) {
                              returnPackingParts.push(`${formatBoxesPieces(rp.returned_pieces_count)} Piece${Math.round(Number(rp.returned_pieces_count)) !== 1 ? 's' : ''}`);
                            }
                            if ((rp.returned_total_meters ?? 0) > 0) {
                              returnPackingParts.push(`${Number(rp.returned_total_meters).toFixed(2)} M`);
                            }
                            packingText = returnPackingParts.length ? returnPackingParts.join(', ') : '—';
                          } else if (item.return_quantity > 0 && item.original_quantity > 0 && (totalBoxes > 0 || totalPieces > 0 || (pd.total_meters ?? 0) > 0)) {
                            const returnRatio = item.return_quantity / item.original_quantity;
                            const returnBoxes = Math.round(totalBoxes * returnRatio * 100) / 100;
                            const returnPieces = Math.round(totalPieces * returnRatio * 100) / 100;
                            const returnMeters = pd.total_meters != null ? Math.round((pd.total_meters * returnRatio) * 100) / 100 : 0;
                            const returnPackingParts: string[] = [];
                            if (Number(returnBoxes) > 0) returnPackingParts.push(`${formatBoxesPieces(returnBoxes)} Box${Math.round(Number(returnBoxes)) !== 1 ? 'es' : ''}`);
                            if (Number(returnPieces) > 0) returnPackingParts.push(`${formatBoxesPieces(returnPieces)} Piece${Math.round(Number(returnPieces)) !== 1 ? 's' : ''}`);
                            if (returnMeters > 0) returnPackingParts.push(`${returnMeters.toFixed(2)} M`);
                            packingText = returnPackingParts.length ? returnPackingParts.join(', ') : '—';
                          } else {
                            // Original packing from sale item (same as purchase view)
                            const packingParts: string[] = [];
                            if (Number(totalBoxes) > 0) packingParts.push(`${formatBoxesPieces(totalBoxes)} Box${Math.round(Number(totalBoxes)) !== 1 ? 'es' : ''}`);
                            if (Number(totalPieces) > 0) packingParts.push(`${formatBoxesPieces(totalPieces)} Piece${Math.round(Number(totalPieces)) !== 1 ? 's' : ''}`);
                            if ((pd.total_meters ?? 0) > 0) packingParts.push(`${Number(pd.total_meters).toFixed(2)} M`);
                            packingText = packingParts.length ? packingParts.join(', ') : '—';
                          }
                          const variationText = item.variation
                            ? (Object.keys(item.variation.attributes || {}).length > 0
                                ? Object.entries(item.variation.attributes || {})
                                    .filter(([_, v]) => v != null && v !== '')
                                    .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`).join(', ')
                                : [item.variation.size, item.variation.color].filter(Boolean).join(' / '))
                            : [item.size, item.color].filter(Boolean).join(' / ') || null;
                          const unitDisplay = item.unit ?? 'pcs';

                          return (
                            <TableRow key={index} className={cn("border-gray-800", !canReturn && "opacity-50")}>
                              <TableCell>
                                <div>
                                  <p className="font-medium text-white">{item.product_name}</p>
                                  {(item.variation?.sku || item.sku) && (
                                    <p className="text-xs text-gray-500">SKU: {item.variation?.sku || item.sku}</p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-gray-400">{item.variation?.sku || item.sku}</TableCell>
                              <TableCell>
                                {variationText ? (
                                  <span className="text-gray-300 text-sm">{variationText}</span>
                                ) : (
                                  <span className="text-gray-600">—</span>
                                )}
                              </TableCell>
                              {enablePacking && (
                                <TableCell className="text-gray-400">
                                  {hasPackingStructure ? (
                                    <button
                                      type="button"
                                      onClick={() => { setActivePackingItemIndex(index); setPackingModalOpen(true); }}
                                      className="text-left hover:text-purple-400 transition-colors cursor-pointer"
                                    >
                                      {item.return_quantity > 0 ? (
                                        <span className="text-purple-400 font-medium">{packingText}</span>
                                      ) : (
                                        <span>{packingText}</span>
                                      )}
                                    </button>
                                  ) : (
                                    <span>{packingText}</span>
                                  )}
                                </TableCell>
                              )}
                              <TableCell className="text-right text-white">
                                {formatCurrency(Number(item.unit_price))}
                              </TableCell>
                              <TableCell className="text-center text-white font-medium">
                                {item.original_quantity}
                              </TableCell>
                              <TableCell className="text-center">
                                {enablePacking && hasPackingStructure ? (
                                  <div className="flex flex-col items-center gap-0.5">
                                    <div className="flex items-center justify-center gap-1 rounded bg-gray-800/80 border border-amber-500/40 px-2 py-1.5 min-w-[4rem]">
                                      <span className="text-sm font-medium text-white tabular-nums">{item.return_quantity}</span>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 text-xs text-purple-400 hover:bg-purple-500/10"
                                      onClick={() => { setActivePackingItemIndex(index); setPackingModalOpen(true); }}
                                      disabled={!canReturn}
                                    >
                                      <Ruler size={10} className="mr-1" /> Packing
                                    </Button>
                                  </div>
                                ) : (
                                  <>
                                    <Input
                                      type="number"
                                      min={0}
                                      max={maxReturnable}
                                      value={item.return_quantity}
                                      onChange={(e) => handleQuantityChange(index, parseFloat(e.target.value) || 0)}
                                      disabled={!canReturn}
                                      className="w-20 text-center bg-gray-900 border border-gray-700 text-white h-8 mx-auto font-medium rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                      placeholder="0"
                                    />
                                    {!canReturn && (
                                      <p className="text-xs text-red-400 mt-1">Fully returned</p>
                                    )}
                                  </>
                                )}
                              </TableCell>
                              <TableCell className="text-gray-400">{unitDisplay}</TableCell>
                              <TableCell className="text-right text-red-400 font-medium">
                                {item.total > 0 ? `-${formatCurrency(Number(item.total))}` : '—'}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="px-5 py-3 bg-gray-950/50 border-t border-gray-800 flex items-center justify-between text-sm">
                  <span className="text-gray-400">
                    {filteredReturnItems.length} Item{filteredReturnItems.length !== 1 ? 's' : ''} · Qty: {filteredReturnItems.reduce((s, i) => s + i.return_quantity, 0)}
                  </span>
                  <span className="text-red-400 font-semibold">Total: -{formatCurrency(subtotal)}</span>
                </div>
              </div>
          </div>
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
              <p className="text-2xl font-bold text-red-400">{formatCurrency(total)}</p>
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

      {/* Return Packing dialog: single source of truth for return qty (meters) when item has packing */}
      {enablePacking && activePackingItemIndex !== null && returnItems[activePackingItemIndex] && (
        <PackingEntryModal
          open={packingModalOpen}
          onOpenChange={(open) => {
            setPackingModalOpen(open);
            if (!open) setActivePackingItemIndex(null);
          }}
          onSave={() => {}}
          initialData={returnItems[activePackingItemIndex].packing_details}
          productName={returnItems[activePackingItemIndex].product_name}
          returnMode={true}
          returnPackingDetails={returnItems[activePackingItemIndex].return_packing_details}
          onSaveReturnPacking={(details) => handleSaveReturnPacking(activePackingItemIndex, details)}
          alreadyReturnedPieces={new Set()}
        />
      )}
    </div>
  );
};
