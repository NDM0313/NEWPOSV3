import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, Plus, Trash2, Package, Loader2, AlertCircle } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { DatePicker } from '../ui/DatePicker';
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
import { useAccounting } from '@/app/context/AccountingContext';
import { useSettings } from '@/app/context/SettingsContext';
import { PackingEntryModal, type PackingDetails } from '@/app/components/transactions/PackingEntryModal';
import { purchaseReturnService, CreatePurchaseReturnData } from '@/app/services/purchaseReturnService';
import { productService } from '@/app/services/productService';
import { contactService } from '@/app/services/contactService';
import { branchService, Branch } from '@/app/services/branchService';
import { cn, formatBoxesPieces } from '../ui/utils';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';

export interface StandalonePurchaseReturnItem {
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

interface StandalonePurchaseReturnFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const StandalonePurchaseReturnForm: React.FC<StandalonePurchaseReturnFormProps> = ({ open, onClose, onSuccess }) => {
  const { companyId, branchId: contextBranchId, user } = useSupabase();
  const accounting = useAccounting();
  const { inventorySettings } = useSettings();
  const { formatCurrency } = useFormatCurrency();
  const enablePacking = inventorySettings.enablePacking ?? false;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<Array<{
    id: string;
    name: string;
    sku: string;
    cost_price: number;
    variations?: Array<{ id: string; sku?: string; attributes?: Record<string, unknown> }>;
  }>>([]);
  const [contacts, setContacts] = useState<Array<{ id: string; name: string }>>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<string>('');
  const [supplierId, setSupplierId] = useState<string>('');
  const [supplierName, setSupplierName] = useState<string>('Select supplier');
  const [returnDate, setReturnDate] = useState<Date>(new Date());
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<StandalonePurchaseReturnItem[]>([]);

  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [pendingProduct, setPendingProduct] = useState<typeof products[0] | null>(null);
  const [pendingVariationId, setPendingVariationId] = useState<string | null>(null);
  const [pendingQty, setPendingQty] = useState(1);
  const [pendingPrice, setPendingPrice] = useState(0);
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
          contactService.getAllContacts(companyId, 'supplier'),
          branchService.getAllBranches(companyId),
        ]);
        setProducts(
          (productsData || []).map((p: any) => ({
            id: p.id,
            name: p.name || '',
            sku: p.sku || '',
            cost_price: Number(p.cost_price ?? p.costPrice ?? 0),
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
    if (supplierId && contacts.length) {
      const c = contacts.find((x) => x.id === supplierId);
      if (c) setSupplierName(c.name);
    } else {
      setSupplierName('Select supplier');
    }
  }, [supplierId, contacts]);

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
    const price = pendingPrice >= 0 ? pendingPrice : pendingProduct.cost_price;
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
    setPendingPrice(pendingProduct.cost_price);
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
    if (!supplierId) {
      toast.error('Select a supplier');
      return;
    }
    const branch = branchId || (contextBranchId !== 'all' ? contextBranchId : undefined);
    if (!branch) {
      toast.error('Select a branch');
      return;
    }
    try {
      setSaving(true);
      const payload: CreatePurchaseReturnData = {
        company_id: companyId,
        branch_id: branch,
        return_date: format(returnDate, 'yyyy-MM-dd'),
        supplier_id: supplierId || undefined,
        supplier_name: supplierName,
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
      const purchaseReturn = await purchaseReturnService.createPurchaseReturn(payload);
      // finalizePurchaseReturn already posts the GL entry (DR AP / CR Inventory)
      await purchaseReturnService.finalizePurchaseReturn(purchaseReturn.id!, companyId, branch, user?.id);
      toast.success(`Purchase return ${purchaseReturn.return_no || purchaseReturn.id} finalized`);
      setItems([]);
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
        <div className="bg-card border border-border rounded-xl p-8">
          <Loader2 className="animate-spin text-orange-500 mx-auto mb-4" size={32} />
          <p className="text-muted-foreground text-center">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 overflow-y-auto p-4">
        <div className="bg-secondary border border-border rounded-2xl w-[90%] max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
          <div className="shrink-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">Purchase Return (No Invoice)</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Return items to supplier without linking to a purchase invoice</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="text-muted-foreground hover:text-foreground rounded-full">
              <X size={22} />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground text-xs">Branch</Label>
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger className="bg-muted border-border text-foreground mt-1">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border text-popover-foreground">
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Supplier</Label>
                <Select value={supplierId || ''} onValueChange={(v) => setSupplierId(v || '')}>
                  <SelectTrigger className="bg-muted border-border text-foreground mt-1">
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border text-popover-foreground">
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Return Date</Label>
                <DatePicker
                  value={format(returnDate, 'yyyy-MM-dd')}
                  onChange={(v) => {
                    if (!v) return;
                    const d = parseISO(v);
                    if (isValid(d)) setReturnDate(d);
                  }}
                />
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Reason (optional)</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Defective" className="bg-muted border-border text-foreground mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Notes (optional)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes" className="bg-muted border-border text-foreground mt-1" />
            </div>

            <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <AlertCircle size={18} className="text-amber-400 shrink-0" />
              <p className="text-sm text-amber-100">This return is not linked to any invoice. Stock will be decreased (items returned to supplier) upon finalization.</p>
            </div>

            <div className="border border-border rounded-xl p-4 bg-muted/40">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Plus size={16} /> Add Item
              </h3>
              <div className="flex flex-wrap items-end gap-3">
                <Popover open={productSearchOpen} onOpenChange={setProductSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="bg-muted border-border text-foreground w-[260px] justify-between">
                      {pendingProduct ? `${pendingProduct.name} ${pendingProduct.sku ? `(${pendingProduct.sku})` : ''}` : 'Select product...'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[260px] p-0 bg-card border-border" align="start">
                    <Command>
                      <CommandInput placeholder="Search product..." value={productSearchTerm} onValueChange={setProductSearchTerm} className="text-foreground" />
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
                                setPendingPrice(p.cost_price);
                                setPendingPackingDetails(null);
                                if (!p.variations?.length) setPendingVariationId(null);
                              }}
                              className="text-foreground"
                            >
                              {p.name} {p.sku && <span className="text-muted-foreground">({p.sku})</span>}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {pendingProduct?.variations?.length ? (
                  <Select value={pendingVariationId || ''} onValueChange={setPendingVariationId}>
                    <SelectTrigger className="w-[180px] bg-muted border-border text-foreground">
                      <SelectValue placeholder="Select variation" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border text-popover-foreground">
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
                  <Label className="text-xs text-muted-foreground">Qty</Label>
                  <Input type="number" min={0} step={0.01} value={pendingQty} onChange={(e) => setPendingQty(Number(e.target.value) || 0)} className="bg-muted border-border text-foreground h-9" readOnly={!!pendingPackingDetails} />
                </div>
                <div className="w-28">
                  <Label className="text-xs text-muted-foreground">Unit Price (Cost)</Label>
                  <Input type="number" min={0} step={0.01} value={pendingPrice} onChange={(e) => setPendingPrice(Number(e.target.value) || 0)} className="bg-muted border-border text-foreground h-9" />
                </div>
                {enablePacking && pendingProduct && (
                  <div className="flex items-end">
                    {pendingPackingDetails ? (
                      <div className="flex items-center gap-2 h-9">
                        <span className="text-xs text-muted-foreground">
                          {formatBoxesPieces(pendingPackingDetails.total_boxes)} Box, {formatBoxesPieces(pendingPackingDetails.total_pieces)} Pc, {Number(pendingPackingDetails.total_meters).toFixed(2)} M
                        </span>
                        <Button type="button" variant="ghost" size="sm" className="text-orange-400 h-8 px-2" onClick={() => setPendingPackingDetails(null)}>Clear</Button>
                      </div>
                    ) : (
                      <Button type="button" variant="outline" size="sm" className="bg-muted border-border text-orange-400 hover:bg-muted h-9" onClick={openPackingForPending}>
                        <Package size={14} className="mr-1" /> Add Packing
                      </Button>
                    )}
                  </div>
                )}
                <Button onClick={addItem} size="sm" className="bg-orange-600 hover:bg-orange-700">
                  <Plus size={16} className="mr-1" /> Add
                </Button>
              </div>
            </div>

            <div className="border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-2 bg-muted/40 border-b border-border flex items-center gap-2">
                <Package size={16} className="text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Items ({items.length})</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Product</TableHead>
                    <TableHead className="text-muted-foreground">SKU / Variation</TableHead>
                    {enablePacking && <TableHead className="text-muted-foreground w-[140px]">Packing</TableHead>}
                    <TableHead className="text-muted-foreground text-right">Qty</TableHead>
                    <TableHead className="text-muted-foreground text-right">Unit Price</TableHead>
                    <TableHead className="text-muted-foreground text-right">Total</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow className="border-border">
                      <TableCell colSpan={enablePacking ? 7 : 6} className="text-center text-muted-foreground py-8">
                        No items. Add products above.
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((row, idx) => (
                      <TableRow key={idx} className="border-border">
                        <TableCell className="text-foreground font-medium">{row.product_name}</TableCell>
                        <TableCell className="text-muted-foreground">{row.sku}{row.variationLabel ? ` · ${row.variationLabel}` : ''}</TableCell>
                        {enablePacking && (
                          <TableCell>
                            {row.packing_details ? (
                              <button type="button" onClick={() => openPackingForItem(idx)} className="text-xs text-muted-foreground hover:text-orange-400 text-left">
                                {formatBoxesPieces(row.packing_details.total_boxes)} Box, {formatBoxesPieces(row.packing_details.total_pieces)} Pc, {Number(row.packing_details.total_meters).toFixed(2)} M
                              </button>
                            ) : (
                              <Button type="button" variant="ghost" size="sm" className="text-orange-400 h-8 text-xs px-2" onClick={() => openPackingForItem(idx)}>
                                <Package size={12} className="mr-1" /> Add Packing
                              </Button>
                            )}
                          </TableCell>
                        )}
                        <TableCell className="text-right text-foreground">{row.quantity}</TableCell>
                        <TableCell className="text-right text-foreground">{row.unit_price.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-foreground">{row.total.toLocaleString()}</TableCell>
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
                <div className="px-4 py-3 border-t border-border flex justify-end">
                  <span className="text-sm text-muted-foreground">Subtotal: </span>
                  <span className="text-lg font-semibold text-foreground ml-2">{formatCurrency(subtotal)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 border-t border-border px-6 py-4 flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} className="border-border text-muted-foreground">Cancel</Button>
            <Button onClick={handleSave} disabled={saving || items.length === 0 || !supplierId} className="bg-orange-600 hover:bg-orange-700">
              {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
              Finalize Return
            </Button>
          </div>
        </div>
      </div>

      {enablePacking && (
        <PackingEntryModal
          open={packingModalOpen}
          onOpenChange={setPackingModalOpen}
          productName={packingItemIndex === null ? (pendingProduct?.name ?? 'Product') : (items[packingItemIndex ?? 0]?.product_name ?? 'Product')}
          initialData={packingItemIndex === null ? (pendingPackingDetails ?? undefined) : (items[packingItemIndex ?? 0]?.packing_details ?? undefined)}
          onSave={handleSavePacking}
        />
      )}
    </>
  );
};
