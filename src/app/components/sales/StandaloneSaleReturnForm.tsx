import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, Plus, Trash2, Package, Loader2, AlertCircle, DollarSign, Building2, Wallet, UserCheck, ChevronDown, Check } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { CalendarDatePicker } from '../ui/CalendarDatePicker';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { toast } from 'sonner';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useSettings } from '@/app/context/SettingsContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { useAccounting } from '@/app/context/AccountingContext';
import { PackingEntryModal, type PackingDetails } from '@/app/components/transactions/PackingEntryModal';
import { saleReturnService, CreateSaleReturnData } from '@/app/services/saleReturnService';
import { productService } from '@/app/services/productService';
import { contactService } from '@/app/services/contactService';
import { branchService, Branch } from '@/app/services/branchService';
import { Badge } from '../ui/badge';
import { cn, formatBoxesPieces } from '../ui/utils';

export interface StandaloneReturnItem {
  product_id: string;
  variation_id?: string | null;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  total: number;
  unit?: string;
  variationLabel?: string;
  packing_details?: PackingDetails | null;
}

interface StandaloneSaleReturnFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const StandaloneSaleReturnForm: React.FC<StandaloneSaleReturnFormProps> = ({ open, onClose, onSuccess }) => {
  const { companyId, branchId: contextBranchId, user } = useSupabase();
  const { inventorySettings } = useSettings();
  const { formatCurrency } = useFormatCurrency();
  const enablePacking = inventorySettings.enablePacking ?? false;
  const accounting = useAccounting();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<Array<{
    id: string;
    name: string;
    sku: string;
    retail_price: number;
    variations?: Array<{ id: string; sku?: string; attributes?: Record<string, unknown> }>;
  }>>([]);
  const [contacts, setContacts] = useState<Array<{ id: string; name: string }>>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<string>('');
  const [customerId, setCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('Walk-in Customer');
  const [returnDate, setReturnDate] = useState<Date>(new Date());
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<StandaloneReturnItem[]>([]);

  // Add item state
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [pendingProduct, setPendingProduct] = useState<typeof products[0] | null>(null);
  const [pendingVariationId, setPendingVariationId] = useState<string | null>(null);
  const [pendingQty, setPendingQty] = useState(1);
  const [pendingPrice, setPendingPrice] = useState(0);
  const [showSettlementDialog, setShowSettlementDialog] = useState(false);
  const [pendingReturnData, setPendingReturnData] = useState<CreateSaleReturnData | null>(null);
  const [refundMethod, setRefundMethod] = useState<'cash' | 'bank' | 'adjust'>('cash');
  const [selectedRefundAccountId, setSelectedRefundAccountId] = useState<string>('');
  const [settlementNotes, setSettlementNotes] = useState('');
  const [packingModalOpen, setPackingModalOpen] = useState(false);
  const [packingItemIndex, setPackingItemIndex] = useState<number | null>(null);
  const [pendingPackingDetails, setPendingPackingDetails] = useState<PackingDetails | null>(null);

  const filteredProducts = useMemo(() => {
    if (!productSearchTerm.trim()) return products;
    const q = productSearchTerm.toLowerCase();
    return products.filter(
      (p) =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q)
    );
  }, [products, productSearchTerm]);

  useEffect(() => {
    if (!open || !companyId) return;
    const load = async () => {
      setLoading(true);
      try {
        const [productsData, contactsData, branchesData] = await Promise.all([
          productService.getAllProducts(companyId),
          contactService.getAllContacts(companyId, 'customer'),
          branchService.getAllBranches(companyId),
        ]);
        setProducts(
          (productsData || []).map((p: any) => ({
            id: p.id,
            name: p.name || '',
            sku: p.sku || '',
            retail_price: Number(p.retail_price ?? p.retailPrice ?? 0),
            variations: p.variations || [],
          }))
        );
        setContacts((contactsData || []).map((c: any) => ({ id: c.id, name: c.name || '' })));
        setBranches(branchesData || []);
        const branch = contextBranchId && contextBranchId !== 'all'
          ? branchesData?.find((b: Branch) => b.id === contextBranchId)
          : branchesData?.[0];
        if (branch) setBranchId(branch.id);
      } catch (e: any) {
        toast.error(e?.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [open, companyId, contextBranchId]);

  useEffect(() => {
    if (customerId && contacts.length) {
      const c = contacts.find((x) => x.id === customerId);
      if (c) setCustomerName(c.name);
    } else {
      setCustomerName('Walk-in Customer');
    }
  }, [customerId, contacts]);

  // Refund accounts: same filtering as UnifiedPaymentDialog (case-insensitive type, code, name, branch)
  const refundAccounts = useMemo(() => {
    if (refundMethod !== 'cash' && refundMethod !== 'bank') return [];
    const methodNorm = String(refundMethod).toLowerCase().trim();
    const isCash = methodNorm === 'cash';
    const isBank = methodNorm === 'bank';
    const effectiveBranchId = branchId || (contextBranchId !== 'all' ? contextBranchId : null);

    return accounting.accounts.filter((account) => {
      if (account.isActive === false) return false;
      const accType = String((account as any).type ?? (account as any).accountType ?? '').toLowerCase().trim();
      const accCode = (account as any).code ?? '';
      const accName = (account.name || '').toLowerCase();

      const typeMatches =
        accType === methodNorm ||
        (isCash && (accType === 'cash' || accCode === '1000' || accName.includes('cash'))) ||
        (isBank && (accType === 'bank' || accCode === '1010' || accName.includes('bank')));

      if (!typeMatches) return false;
      if (!effectiveBranchId || effectiveBranchId === 'all') return true;
      const accountBranch = (account as any).branchId ?? (account as any).branch ?? '';
      const isGlobal = !accountBranch || accountBranch === 'global' || accountBranch === '';
      const isBranchSpecific = accountBranch === effectiveBranchId;
      return isGlobal || isBranchSpecific;
    });
  }, [refundMethod, accounting.accounts, branchId, contextBranchId]);

  // When refund method changes, reset or auto-select first account
  useEffect(() => {
    if (refundMethod === 'adjust') {
      setSelectedRefundAccountId('');
      return;
    }
    if (refundAccounts.length > 0) {
      setSelectedRefundAccountId((prev) => {
        const stillValid = refundAccounts.some((a) => a.id === prev);
        return stillValid ? prev : refundAccounts[0].id;
      });
    } else {
      setSelectedRefundAccountId('');
    }
  }, [refundMethod, refundAccounts]);

  const addItem = () => {
    if (!pendingProduct) {
      toast.error('Select a product');
      return;
    }
    const qtyToUse = pendingPackingDetails ? Math.round(pendingPackingDetails.total_meters * 100) / 100 : pendingQty;
    if (qtyToUse <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }
    const hasVariations = pendingProduct.variations && pendingProduct.variations.length > 0;
    if (hasVariations && !pendingVariationId) {
      toast.error('Select a variation');
      return;
    }
    const variation = hasVariations && pendingVariationId
      ? pendingProduct.variations!.find((v) => v.id === pendingVariationId)
      : null;
    const sku = variation?.sku || pendingProduct.sku;
    const variationLabel = variation && variation.attributes
      ? Object.entries(variation.attributes).map(([k, v]) => `${k}: ${v}`).join(', ')
      : undefined;
      const price = pendingPrice >= 0 ? pendingPrice : pendingProduct.retail_price;
      const total = price * qtyToUse;
    setItems((prev) => [
      ...prev,
      {
        product_id: pendingProduct.id,
        variation_id: pendingVariationId || null,
        product_name: pendingProduct.name,
        sku,
        quantity: qtyToUse,
        unit_price: price,
        total,
        unit: 'piece',
        variationLabel,
        packing_details: pendingPackingDetails ?? undefined,
      },
    ]);
    setPendingProduct(null);
    setPendingVariationId(null);
    setPendingQty(1);
    setPendingPrice(pendingProduct.retail_price);
    setPendingPackingDetails(null);
    setProductSearchOpen(false);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    if (packingItemIndex === index) { setPackingModalOpen(false); setPackingItemIndex(null); }
    if (packingItemIndex !== null && packingItemIndex > index) setPackingItemIndex((prev) => (prev == null ? null : prev - 1));
  };

  const handleSavePacking = (details: PackingDetails) => {
    const qty = Math.round(details.total_meters * 100) / 100;
    if (packingItemIndex === null) {
      setPendingPackingDetails(details);
      setPendingQty(qty);
      setPackingModalOpen(false);
      return;
    }
    setItems((prev) => prev.map((item, i) => {
      if (i !== packingItemIndex) return item;
      const newQty = qty;
      return {
        ...item,
        packing_details: details,
        quantity: newQty,
        total: Math.round(item.unit_price * newQty * 100) / 100,
      };
    }));
    setPackingModalOpen(false);
    setPackingItemIndex(null);
  };

  const openPackingForPending = () => {
    if (!pendingProduct) return;
    setPackingItemIndex(null);
    setPackingModalOpen(true);
  };

  const openPackingForItem = (index: number) => {
    setPackingItemIndex(index);
    setPackingModalOpen(true);
  };

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.total, 0), [items]);

  const handleSave = async () => {
    if (!companyId) return;
    if (items.length === 0) {
      toast.error('Add at least one item');
      return;
    }
    const branch = branchId || (contextBranchId !== 'all' ? contextBranchId : undefined);
    if (!branch) {
      toast.error('Select a branch');
      return;
    }
    try {
      setSaving(true);
      const payload: CreateSaleReturnData = {
        company_id: companyId,
        branch_id: branch,
        return_date: format(returnDate, 'yyyy-MM-dd'),
        customer_id: customerId || undefined,
        customer_name: customerName,
        items: items.map((i) => ({
          product_id: i.product_id,
          variation_id: i.variation_id ?? undefined,
          product_name: i.product_name,
          sku: i.sku,
          quantity: i.quantity,
          unit: i.unit || 'piece',
          unit_price: i.unit_price,
          total: i.total,
          ...(i.packing_details && {
            packing_type: 'meters',
            packing_quantity: Math.round((i.packing_details.total_meters ?? 0) * 100) / 100,
            packing_unit: 'meters',
            packing_details: i.packing_details,
          }),
        })),
        reason: reason || undefined,
        notes: notes || undefined,
        created_by: user?.id,
        subtotal,
        discount_amount: 0,
        total: subtotal,
      };
      setPendingReturnData(payload);
      setShowSettlementDialog(true);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to prepare return');
    } finally {
      setSaving(false);
    }
  };

  const handleSettlementConfirm = async () => {
    if (!pendingReturnData || !companyId) return;
    const branch = contextBranchId === 'all' ? undefined : (branchId || contextBranchId || undefined);
    if (!branch) {
      toast.error('Please select a branch');
      return;
    }
    if ((refundMethod === 'cash' || refundMethod === 'bank') && !selectedRefundAccountId) {
      toast.error('Please select an account for refund');
      return;
    }
    try {
      setSaving(true);
      setShowSettlementDialog(false);
      const saleReturn = await saleReturnService.createSaleReturn(pendingReturnData);
      await saleReturnService.finalizeSaleReturn(saleReturn.id!, companyId, branch, user?.id);

      let creditAccount = 'Accounts Receivable';
      if (refundMethod === 'cash' || refundMethod === 'bank') {
        const acc = accounting.getAccountById(selectedRefundAccountId);
        creditAccount = (acc?.name || (refundMethod === 'cash' ? 'Cash' : 'Bank')) as any;
      }

      try {
        const settlementLabel = refundMethod === 'cash' ? 'Cash' : refundMethod === 'bank' ? 'Bank' : 'Adjust in Customer Account';
        const desc = settlementNotes.trim()
          ? `Sale Return (no invoice): ${saleReturn.return_no || saleReturn.id} - ${customerName} - Settlement: ${settlementLabel}. ${settlementNotes.trim()}`
          : `Sale Return (no invoice): ${saleReturn.return_no || saleReturn.id} - ${customerName} - Settlement: ${settlementLabel}`;
        await accounting.createEntry({
          source: 'Sale Return',
          referenceNo: saleReturn.return_no || `SR-${saleReturn.id?.slice(0, 8)}`,
          debitAccount: 'Sales Revenue',
          creditAccount,
          amount: subtotal,
          description: desc,
          module: 'sales',
          metadata: {
            customerId: pendingReturnData.customer_id,
            customerName: pendingReturnData.customer_name,
            saleReturnId: saleReturn.id,
            refundMethod,
          },
        });
      } catch (accErr: any) {
        console.warn('[STANDALONE RETURN] Accounting entry failed (non-blocking):', accErr);
        toast.warning('Return finalized; accounting entry may need to be added manually.');
      }

      toast.success(`Sale return ${saleReturn.return_no || saleReturn.id} finalized`);
      setPendingReturnData(null);
      setItems([]);
      setSettlementNotes('');
      if (onSuccess) onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to finalize return');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-8">
          <Loader2 className="animate-spin text-blue-500 mx-auto mb-4" size={32} />
          <p className="text-gray-400 text-center">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 overflow-y-auto p-4">
        <div className="bg-[#0B0F19] border border-gray-800 rounded-2xl w-[90%] max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
          <div className="shrink-0 bg-gray-900/80 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Sale Return (No Invoice)</h2>
              <p className="text-xs text-gray-500 mt-0.5">Return items without linking to a sale invoice</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-400 hover:text-white rounded-full">
              <X size={22} />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-500 text-xs">Branch</Label>
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700 text-white">
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-500 text-xs">Customer</Label>
                <Select value={customerId || 'walk-in'} onValueChange={(v) => setCustomerId(v === 'walk-in' ? '' : v)}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                    <SelectValue placeholder="Walk-in Customer" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700 text-white">
                    <SelectItem value="walk-in">Walk-in Customer</SelectItem>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-500 text-xs">Return Date</Label>
                <CalendarDatePicker value={returnDate} onChange={(d) => d && setReturnDate(d)} className="bg-gray-800 border-gray-700 text-white h-9 mt-1 w-full" />
              </div>
              <div>
                <Label className="text-gray-500 text-xs">Reason (optional)</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Defective" className="bg-gray-800 border-gray-700 text-white mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-gray-500 text-xs">Notes (optional)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes" className="bg-gray-800 border-gray-700 text-white mt-1" />
            </div>

            <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <AlertCircle size={18} className="text-amber-400 shrink-0" />
              <p className="text-sm text-amber-100">This return is not linked to any invoice. Stock will be increased for the selected items upon finalization.</p>
            </div>

            {/* Add item */}
            <div className="border border-gray-800 rounded-xl p-4 bg-gray-900/50">
              <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                <Plus size={16} /> Add Item
              </h3>
              <div className="flex flex-wrap items-end gap-3">
                <Popover open={productSearchOpen} onOpenChange={setProductSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="bg-gray-800 border-gray-700 text-white w-[260px] justify-between">
                      {pendingProduct ? `${pendingProduct.name} ${pendingProduct.sku ? `(${pendingProduct.sku})` : ''}` : 'Select product...'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[260px] p-0 bg-gray-900 border-gray-700" align="start">
                    <Command>
                      <CommandInput placeholder="Search product..." value={productSearchTerm} onValueChange={setProductSearchTerm} className="text-white" />
                      <CommandList>
                        <CommandEmpty>No product found.</CommandEmpty>
                        <CommandGroup>
                          {filteredProducts.map((p) => (
                            <CommandItem
                              key={p.id}
                              value={`${p.name} ${p.sku}`}
                              onSelect={() => {
                                setPendingProduct(p);
                                setPendingVariationId(p.variations?.length ? null : null);
                                setPendingPrice(p.retail_price);
                                setPendingPackingDetails(null);
                                if (!p.variations?.length) setPendingVariationId(null);
                              }}
                              className="text-white"
                            >
                              {p.name} {p.sku && <span className="text-gray-500">({p.sku})</span>}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {pendingProduct?.variations?.length ? (
                  <Select value={pendingVariationId || ''} onValueChange={setPendingVariationId}>
                    <SelectTrigger className="w-[180px] bg-gray-800 border-gray-700 text-white">
                      <SelectValue placeholder="Select variation" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-700 text-white">
                      {pendingProduct.variations.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.attributes && Object.keys(v.attributes).length > 0
                            ? Object.entries(v.attributes).map(([k, val]) => `${k}: ${val}`).join(', ')
                            : v.sku || v.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}

                <div className="w-24">
                  <Label className="text-xs text-gray-500">Qty</Label>
                  <Input type="number" min={0} step={0.01} value={pendingQty} onChange={(e) => setPendingQty(Number(e.target.value) || 0)} className="bg-gray-800 border-gray-700 text-white h-9" readOnly={!!pendingPackingDetails} />
                </div>
                <div className="w-28">
                  <Label className="text-xs text-gray-500">Unit Price</Label>
                  <Input type="number" min={0} step={0.01} value={pendingPrice} onChange={(e) => setPendingPrice(Number(e.target.value) || 0)} className="bg-gray-800 border-gray-700 text-white h-9" />
                </div>
                {enablePacking && pendingProduct && (
                  <div className="flex items-end">
                    {pendingPackingDetails ? (
                      <div className="flex items-center gap-2 h-9">
                        <span className="text-xs text-gray-400">
                          {formatBoxesPieces(pendingPackingDetails.total_boxes)} Box, {formatBoxesPieces(pendingPackingDetails.total_pieces)} Pc, {Number(pendingPackingDetails.total_meters).toFixed(2)} M
                        </span>
                        <Button type="button" variant="ghost" size="sm" className="text-blue-400 h-8 px-2" onClick={() => setPendingPackingDetails(null)}>Clear</Button>
                      </div>
                    ) : (
                      <Button type="button" variant="outline" size="sm" className="bg-gray-800 border-gray-700 text-blue-400 hover:bg-gray-700 h-9" onClick={openPackingForPending}>
                        <Package size={14} className="mr-1" /> Add Packing
                      </Button>
                    )}
                  </div>
                )}
                <Button onClick={addItem} size="sm" className="bg-blue-600 hover:bg-blue-700">
                  <Plus size={16} className="mr-1" /> Add
                </Button>
              </div>
            </div>

            {/* Items table */}
            <div className="border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-4 py-2 bg-gray-950/50 border-b border-gray-800 flex items-center gap-2">
                <Package size={16} className="text-gray-500" />
                <span className="text-sm font-medium text-gray-400">Items ({items.length})</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800 hover:bg-transparent">
                    <TableHead className="text-gray-400">Product</TableHead>
                    <TableHead className="text-gray-400">SKU / Variation</TableHead>
                    {enablePacking && <TableHead className="text-gray-400 w-[140px]">Packing</TableHead>}
                    <TableHead className="text-gray-400 text-right">Qty</TableHead>
                    <TableHead className="text-gray-400 text-right">Unit Price</TableHead>
                    <TableHead className="text-gray-400 text-right">Total</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow className="border-gray-800">
                      <TableCell colSpan={enablePacking ? 7 : 6} className="text-center text-gray-500 py-8">
                        No items. Add products above.
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((row, idx) => (
                      <TableRow key={idx} className="border-gray-800">
                        <TableCell className="text-white font-medium">{row.product_name}</TableCell>
                        <TableCell className="text-gray-400">{row.sku}{row.variationLabel ? ` · ${row.variationLabel}` : ''}</TableCell>
                        {enablePacking && (
                          <TableCell>
                            {row.packing_details ? (
                              <button type="button" onClick={() => openPackingForItem(idx)} className="text-xs text-gray-400 hover:text-blue-400 text-left">
                                {formatBoxesPieces(row.packing_details.total_boxes)} Box, {formatBoxesPieces(row.packing_details.total_pieces)} Pc, {Number(row.packing_details.total_meters).toFixed(2)} M
                              </button>
                            ) : (
                              <Button type="button" variant="ghost" size="sm" className="text-blue-400 h-8 text-xs px-2" onClick={() => openPackingForItem(idx)}>
                                <Package size={12} className="mr-1" /> Add Packing
                              </Button>
                            )}
                          </TableCell>
                        )}
                        <TableCell className="text-right text-white">{row.quantity}</TableCell>
                        <TableCell className="text-right text-white">{row.unit_price.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-white">{row.total.toLocaleString()}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => removeItem(idx)}>
                            <Trash2 size={14} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {items.length > 0 && (
                <div className="px-4 py-3 border-t border-gray-800 flex justify-end">
                  <span className="text-sm text-gray-400">Subtotal: </span>
                  <span className="text-lg font-semibold text-white ml-2">{formatCurrency(subtotal)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 border-t border-gray-800 px-6 py-4 flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} className="border-gray-700 text-gray-300">Cancel</Button>
            <Button onClick={handleSave} disabled={saving || items.length === 0} className="bg-blue-600 hover:bg-blue-700">
              {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
              Finalize Return
            </Button>
          </div>
        </div>
      </div>

      {/* Packing dialog — same as Sale form (when enablePacking) */}
      {enablePacking && (
        <PackingEntryModal
          open={packingModalOpen}
          onOpenChange={setPackingModalOpen}
          productName={packingItemIndex === null ? (pendingProduct?.name ?? 'Product') : (items[packingItemIndex ?? 0]?.product_name ?? 'Product')}
          initialData={packingItemIndex === null ? (pendingPackingDetails ?? undefined) : (items[packingItemIndex ?? 0]?.packing_details ?? undefined)}
          onSave={handleSavePacking}
        />
      )}

      {/* Settlement Dialog — copy of UnifiedPaymentDialog (Receive Payment) layout */}
      {showSettlementDialog && (
        <>
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] animate-in fade-in duration-200"
            onClick={() => { setShowSettlementDialog(false); setSaving(false); setSettlementNotes(''); }}
          />
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none overflow-y-auto">
            <div
              className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-3xl pointer-events-auto animate-in zoom-in-95 duration-200 my-8"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header — same as Receive Payment */}
              <div className="flex items-center justify-between p-5 border-b border-gray-800 bg-gradient-to-r from-gray-900 via-gray-900 to-gray-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-xl">
                    💵
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Refund / Return Settlement</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Complete transaction details</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowSettlementDialog(false); setSaving(false); setSettlementNotes(''); }}
                  className="text-gray-400 hover:text-white transition-colors p-1.5 hover:bg-gray-800 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Body — TWO COLUMN LAYOUT (same as UnifiedPaymentDialog) */}
              <div className="p-5">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* LEFT COLUMN */}
                  <div className="space-y-4">
                    {/* Entity Info Card — Customer + Return Amount */}
                    <div className="bg-gradient-to-br from-gray-950/80 to-gray-900/50 border border-gray-800 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium text-gray-400">Return Details</span>
                        <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20">
                          RETURN
                        </Badge>
                      </div>
                      <p className="text-lg font-bold text-white mb-1">{customerName}</p>
                      <p className="text-xs text-gray-500 font-mono bg-gray-900/50 px-2 py-1 rounded inline-block">
                        Ref: No invoice
                      </p>
                      <div className="mt-4 pt-4 border-t border-gray-800">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400">Return Amount</span>
                          <span className="text-xl font-bold text-red-400">
                            {formatCurrency(subtotal)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Refund Method — same as Payment Method in UnifiedPaymentDialog (Cash, Bank, Adjust in Customer Account) */}
                    <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                      <label className="block text-sm font-semibold text-gray-300 mb-2">
                        Refund Method <span className="text-red-400">*</span>
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setRefundMethod('cash')}
                          className={cn(
                            'flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-lg border-2 transition-all',
                            refundMethod === 'cash'
                              ? 'border-blue-500 bg-blue-500/10'
                              : 'border-gray-700 bg-gray-900/50 hover:border-gray-600'
                          )}
                        >
                          <Wallet size={18} className={refundMethod === 'cash' ? 'text-blue-400' : 'text-gray-400'} />
                          <span className={cn('text-xs font-medium', refundMethod === 'cash' ? 'text-blue-400' : 'text-gray-400')}>Cash</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setRefundMethod('bank')}
                          className={cn(
                            'flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-lg border-2 transition-all',
                            refundMethod === 'bank'
                              ? 'border-blue-500 bg-blue-500/10'
                              : 'border-gray-700 bg-gray-900/50 hover:border-gray-600'
                          )}
                        >
                          <Building2 size={18} className={refundMethod === 'bank' ? 'text-blue-400' : 'text-gray-400'} />
                          <span className={cn('text-xs font-medium', refundMethod === 'bank' ? 'text-blue-400' : 'text-gray-400')}>Bank</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setRefundMethod('adjust')}
                          className={cn(
                            'flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-lg border-2 transition-all',
                            refundMethod === 'adjust'
                              ? 'border-blue-500 bg-blue-500/10'
                              : 'border-gray-700 bg-gray-900/50 hover:border-gray-600'
                          )}
                        >
                          <UserCheck size={18} className={refundMethod === 'adjust' ? 'text-blue-400' : 'text-gray-400'} />
                          <span className={cn('text-xs font-medium text-center leading-tight', refundMethod === 'adjust' ? 'text-blue-400' : 'text-gray-400')}>Adjust in Account</span>
                        </button>
                      </div>
                    </div>

                    {/* Select Account — only when Cash or Bank (same as UnifiedPaymentDialog) */}
                    {(refundMethod === 'cash' || refundMethod === 'bank') && (
                      <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                        <label className="block text-sm font-semibold text-gray-300 mb-2">
                          Select Account <span className="text-red-400">*</span>
                        </label>
                        <div className="relative">
                          <select
                            value={selectedRefundAccountId}
                            onChange={(e) => setSelectedRefundAccountId(e.target.value)}
                            className="w-full bg-gray-900 border-2 border-gray-700 rounded-lg px-4 py-2.5 pr-10 text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none"
                          >
                            <option value="" className="text-gray-500">
                              {refundMethod === 'cash' && 'Select Cash Account'}
                              {refundMethod === 'bank' && 'Select Bank Account'}
                            </option>
                            {refundAccounts.map((account) => (
                              <option key={account.id} value={account.id} className="text-white bg-gray-900">
                                {account.name} • Balance: {formatCurrency(Number(account.balance || 0))}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                        </div>
                        {selectedRefundAccountId === '' && (
                          <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
                            <AlertCircle size={11} />
                            Please select an account to proceed
                          </p>
                        )}
                        {selectedRefundAccountId && (() => {
                          const account = accounting.getAccountById(selectedRefundAccountId);
                          return account ? (
                            <div className="mt-2 text-xs text-gray-400">
                              Selected: <span className="text-white font-medium">{account.name}</span>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    )}
                  </div>

                  {/* RIGHT COLUMN — Notes (same as UnifiedPaymentDialog) */}
                  <div className="space-y-4">
                    <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                      <label className="block text-sm font-semibold text-gray-300 mb-2">
                        Notes (Optional)
                      </label>
                      <textarea
                        value={settlementNotes}
                        onChange={(e) => setSettlementNotes(e.target.value)}
                        placeholder="Add refund notes, remarks..."
                        rows={5}
                        className="w-full bg-gray-900 border-2 border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer — same as UnifiedPaymentDialog */}
              <div className="flex items-center justify-between p-5 border-t border-gray-800 bg-gray-950/50">
                <div className="text-xs text-gray-400" />
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => { setShowSettlementDialog(false); setSaving(false); setSettlementNotes(''); }}
                    className="border-gray-700 text-gray-300 hover:bg-gray-800 px-5 text-sm"
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSettlementConfirm}
                    disabled={saving || ((refundMethod === 'cash' || refundMethod === 'bank') && !selectedRefundAccountId)}
                    className="bg-blue-600 hover:bg-blue-500 text-white min-w-[150px] px-5 py-2.5 text-sm font-semibold"
                  >
                    {saving ? (
                      <span className="flex items-center gap-2">
                        <Loader2 size={16} className="animate-spin" />
                        Processing...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Check size={16} />
                        Confirm & Finalize
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};
