import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Plus, Minus, Trash2, Search, Loader2, Package } from 'lucide-react';
import { useResponsive } from '../../hooks/useResponsive';
import { SelectSupplierTablet, type Supplier } from './SelectSupplierTablet';
import type { PackingDetails } from '../transactions/PackingEntryModal';
import { PackingEntryModal } from '../transactions/PackingEntryModal';
import { PackingInputButton } from '../transactions/PackingInputButton';
import * as purchasesApi from '../../api/purchases';
import * as contactsApi from '../../api/contacts';
import * as productsApi from '../../api/products';
import { getBranches } from '../../api/branches';
import { addPending } from '../../lib/offlineStore';
import type { ProductVariationRow } from '../../api/products';
import { TransactionSuccessModal, type TransactionSuccessData } from '../shared/TransactionSuccessModal';
import { PaymentDialog, type PaymentResult } from '../sales/PaymentDialog';
import { MobileActionBar } from '../shared/MobileActionBar';
import { createPortal } from 'react-dom';
import { useSettings } from '../../context/SettingsContext';

interface PurchaseItem {
  id: string;
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  total: number;
  variation?: string;
  variationId?: string;
  packingDetails?: PackingDetails;
}

interface Vendor {
  id: string;
  name: string;
  phone: string;
}

interface ProductForPurchase {
  id: string;
  sku: string;
  name: string;
  costPrice: number;
  hasVariations?: boolean;
  variations?: ProductVariationRow[];
  unitAllowDecimal?: boolean;
}

interface CreatePurchaseFlowProps {
  companyId: string;
  branchId: string;
  userId: string;
  onBack: () => void;
  onDone: () => void;
}

/** Map PaymentDialog label to API payment method */
function paymentLabelToMethod(label: string): 'cash' | 'bank' | 'card' | 'other' {
  const lower = (label || '').toLowerCase();
  if (lower.includes('cash')) return 'cash';
  if (lower.includes('bank')) return 'bank';
  if (lower.includes('card')) return 'card';
  if (lower.includes('wallet')) return 'other';
  return 'cash';
}

export function CreatePurchaseFlow({ companyId, branchId, userId, onBack, onDone }: CreatePurchaseFlowProps) {
  const responsive = useResponsive();
  const { enablePacking } = useSettings();
  const [step, setStep] = useState<'vendor' | 'items' | 'summary' | 'payment'>('vendor');
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  /** User-chosen purchase status at creation time. 'ordered' = stock not posted yet (just a PO/order). 'received' = goods in hand; posts stock + accounting. */
  const [creationStatus, setCreationStatus] = useState<'ordered' | 'received'>('received');
  const [search, setSearch] = useState('');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<ProductForPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductForPurchase | null>(null);
  const [confirmationData, setConfirmationData] = useState<TransactionSuccessData | null>(null);
  const lastItemRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (step === 'vendor') {
      setLoading(true);
      contactsApi.getContacts(companyId, 'supplier').then(({ data, error: err }) => {
        setLoading(false);
        setVendors(err ? [] : data.map((c) => ({ id: c.id, name: c.name, phone: c.phone || '' })));
      });
    } else if (step === 'items' && vendor) {
      setLoading(true);
      productsApi.getProducts(companyId).then(({ data, error: err }) => {
        setLoading(false);
        setProducts(
          err
            ? []
            : data.map((p) => ({
                id: p.id,
                sku: p.sku,
                name: p.name,
                costPrice: p.costPrice,
                hasVariations: p.hasVariations ?? false,
                variations: p.variations,
                unitAllowDecimal: p.unitAllowDecimal ?? false,
              }))
        );
      });
    }
  }, [companyId, step, vendor]);

  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const total = subtotal - discount;
  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const addItem = (
    product: ProductForPurchase,
    qty: number,
    opts?: { unitPrice?: number; variationId?: string; variation?: string; sku?: string; packingDetails?: PackingDetails }
  ) => {
    const price = opts?.unitPrice ?? product.costPrice;
    const totalAmt = qty * price;
    const existing = items.find(
      (i) => i.productId === product.id && (i.variationId ?? '') === (opts?.variationId ?? '')
    );
    if (existing) {
      setItems(
        items.map((i) =>
          i.productId === product.id && (i.variationId ?? '') === (opts?.variationId ?? '')
            ? {
                ...i,
                quantity: i.quantity + qty,
                total: (i.quantity + qty) * i.unitPrice,
                ...(opts?.packingDetails != null ? { packingDetails: opts.packingDetails } : {}),
              }
            : i
        )
      );
    } else {
      setItems([
        ...items,
        {
          id: opts?.variationId ? `${product.id}-${opts.variationId}` : product.id,
          productId: product.id,
          name: product.name,
          sku: opts?.sku ?? product.sku,
          quantity: qty,
          unitPrice: price,
          total: totalAmt,
          variationId: opts?.variationId,
          variation: opts?.variation,
          packingDetails: opts?.packingDetails,
        },
      ]);
    }
  };

  const matchItem = (i: PurchaseItem, productId: string, variationId?: string) =>
    i.productId === productId && (i.variationId ?? '') === (variationId ?? '');

  const updatePacking = (productId: string, details: PackingDetails, variationId?: string) => {
    setItems(items.map((i) => {
      if (!matchItem(i, productId, variationId)) return i;
      const meters = details.total_meters ?? 0;
      const packs = details.packs ?? 0;
      const unitsPerPack = details.units_per_pack ?? 0;
      const qtyFromMeters = meters > 0 ? meters : i.quantity;
      const qtyFromPacks = packs > 0 && unitsPerPack > 0 ? packs * unitsPerPack : i.quantity;
      const newQty = meters > 0 ? qtyFromMeters : (packs > 0 && unitsPerPack > 0 ? qtyFromPacks : i.quantity);
      return {
        ...i,
        packingDetails: details,
        quantity: newQty,
        total: newQty * i.unitPrice,
      };
    }));
  };

  const updateQty = (productId: string, delta: number, variationId?: string) => {
    setItems(
      items
        .map((i) => {
          if (!matchItem(i, productId, variationId)) return i;
          const newQty = Math.max(0, i.quantity + delta);
          if (newQty === 0) return null;
          return { ...i, quantity: newQty, total: newQty * i.unitPrice };
        })
        .filter(Boolean) as PurchaseItem[]
    );
  };

  const removeItem = (productId: string, variationId?: string) =>
    setItems(items.filter((i) => !matchItem(i, productId, variationId)));

  const handleSaveWithPayment = async (result: PaymentResult) => {
    if (!vendor || items.length === 0) return;
    setSaving(true);
    setError('');
    const paid = result.paidAmount ?? 0;
    // If user picked "Order" -> 'ordered' (ignore paid). Else: fully paid -> 'final'; partial/none -> 'received'.
    let status: 'ordered' | 'received' | 'final';
    if (creationStatus === 'ordered') {
      status = 'ordered';
    } else if (paid > 0 && paid >= total - 0.005) {
      status = 'final';
    } else {
      status = 'received';
    }
    const createInput: purchasesApi.CreatePurchaseInput = {
      companyId,
      branchId,
      supplierId: vendor.id,
      supplierName: vendor.name,
      contactNumber: vendor.phone,
      status,
      paidAmount: paid,
      paymentMethod: paid > 0 ? paymentLabelToMethod(result.paymentMethod ?? '') : undefined,
      paymentAccountId: paid > 0 ? (result.accountId ?? undefined) : undefined,
      items: items.map((i) => ({
        productId: i.productId,
        variationId: i.variationId,
        productName: i.name,
        sku: i.sku,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        total: i.total,
        packingDetails:
          i.packingDetails && ((i.packingDetails.total_meters ?? 0) > 0 || ((i.packingDetails.packs ?? 0) > 0 && (i.packingDetails.units_per_pack ?? 0) > 0))
            ? {
                total_boxes: i.packingDetails.total_boxes ?? i.packingDetails.packs,
                total_pieces: i.packingDetails.total_pieces ?? (i.packingDetails.packs != null && i.packingDetails.units_per_pack != null ? i.packingDetails.packs * i.packingDetails.units_per_pack : undefined),
              }
            : undefined,
      })),
      subtotal,
      discountAmount: discount,
      taxAmount: 0,
      shippingCost: 0,
      total,
      notes: notes.trim() || undefined,
      userId,
    };

    if (!navigator.onLine) {
      try {
        await addPending('purchase', { action: 'create', input: createInput }, companyId, branchId);
        let branchName: string | null = null;
        try {
          const { data: branches } = await getBranches(companyId);
          branchName = branches?.find((b) => b.id === branchId)?.name ?? null;
        } catch {
          /* offline — branch label optional */
        }
        setConfirmationData({
          type: 'purchase',
          title: 'Purchase Saved Successfully',
          transactionNo: 'Pending sync',
          amount: total,
          partyName: vendor.name,
          date: new Date().toISOString(),
          branch: branchName ?? undefined,
          entityId: null,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save offline.');
      }
      setSaving(false);
      return;
    }

    const { data: createResult, error: err } = await purchasesApi.createPurchase(createInput);
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    let branchName: string | null = null;
    const { data: branches } = await getBranches(companyId);
    branchName = branches?.find((b) => b.id === branchId)?.name ?? null;
    setConfirmationData({
      type: 'purchase',
      title: 'Purchase Saved Successfully',
      transactionNo: createResult?.poNo ?? null,
      amount: total,
      partyName: vendor.name,
      date: new Date().toISOString(),
      branch: branchName ?? undefined,
      entityId: createResult?.id ?? null,
    });
  };

  const closePurchaseSuccessModal = () => {
    setConfirmationData(null);
    onDone();
  };

  if (confirmationData) {
    return (
      <>
        <div className="fixed inset-0 bg-[#111827]" />
        <TransactionSuccessModal
          isOpen={true}
          data={confirmationData}
          onClose={closePurchaseSuccessModal}
          onViewPurchase={closePurchaseSuccessModal}
          onPrint={closePurchaseSuccessModal}
          onBackToList={closePurchaseSuccessModal}
        />
      </>
    );
  }

  if (step === 'vendor') {
    if (responsive.isTablet && companyId) {
      return (
        <SelectSupplierTablet
          companyId={companyId}
          onBack={onBack}
          onSelect={(s: Supplier) => {
            setVendor({ id: s.id, name: s.name, phone: s.phone });
            setStep('items');
          }}
        />
      );
    }
    return (
      <div className="min-h-screen bg-[#111827] pb-24">
        <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
          <div className="flex items-center gap-3 px-4 h-14">
            <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-semibold text-base text-white">New Purchase</h1>
              <p className="text-xs text-[#9CA3AF]">Step 1: Select Supplier</p>
            </div>
          </div>
        </div>
        <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#10B981] animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {vendors.map((v) => (
              <button
                key={v.id}
                onClick={() => {
                  setVendor(v);
                  setStep('items');
                }}
                className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#10B981] transition-all text-left"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-white mb-1">{v.name}</h3>
                    <p className="text-sm text-[#9CA3AF]">{v.phone}</p>
                  </div>
                  <span className="text-[#6B7280]">→</span>
                </div>
              </button>
            ))}
            {vendors.length === 0 && (
              <p className="text-center text-[#9CA3AF] py-8">No suppliers found. Add suppliers in Contacts first.</p>
            )}
          </div>
        )}
        </div>
      </div>
    );
  }

  if (step === 'items' && vendor) {
    return (
      <div className="min-h-screen bg-[#111827] pb-52">
        <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
          <div className="flex items-center gap-3 px-4 h-14">
            <button onClick={() => setStep('vendor')} className="p-2 hover:bg-[#374151] rounded-lg text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-base text-white">Add Products</h1>
              <p className="text-xs text-[#9CA3AF]">{vendor.name}</p>
            </div>
          </div>
        </div>
        <div className="p-4 space-y-4">
          {/* 1. CART ITEMS — top, always visible (Figma pattern) */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <h2 className="text-sm font-medium text-[#9CA3AF] mb-3">CART ({items.length} items)</h2>
            {items.length === 0 ? (
              <p className="text-xs text-[#6B7280] py-2">No items yet. Search and add below.</p>
            ) : (
              <div className="space-y-3">
          {items.map((i, index) => {
            const hasSimplePacking = i.packingDetails && (i.packingDetails.packs != null && i.packingDetails.units_per_pack != null) && i.packingDetails.packs > 0 && (i.packingDetails.units_per_pack ?? 0) > 0;
            const packingQty = hasSimplePacking ? (i.packingDetails!.packs! * (i.packingDetails!.units_per_pack ?? 0)) : null;
            const showPackingFormula = hasSimplePacking && packingQty != null && packingQty > 0;
            const qtyLockedByPacking = showPackingFormula;
            const isLast = index === items.length - 1;
            return (
            <div key={i.id} ref={isLast ? lastItemRef : undefined} className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 space-y-3 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white break-words">{i.name}</p>
                  {i.variation && <p className="text-xs text-[#9CA3AF] break-words">{i.variation}</p>}
                  <p className="text-sm text-[#9CA3AF]">
                    {i.quantity} × Rs. {i.unitPrice.toLocaleString()} = Rs. {i.total.toLocaleString()}
                  </p>
                  {showPackingFormula && (
                    <p className="text-xs text-[#10B981] mt-0.5">
                      {i.packingDetails!.packs} packs × {i.packingDetails!.units_per_pack} = {i.quantity} units
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!qtyLockedByPacking && (
                    <>
                      <button
                        onClick={() => updateQty(i.productId, -1, i.variationId)}
                        className="p-2 hover:bg-[#374151] rounded-lg text-white"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="text-white font-medium min-w-[2.5rem] text-center">{i.quantity}</span>
                      <button
                        onClick={() => updateQty(i.productId, 1, i.variationId)}
                        className="p-2 hover:bg-[#374151] rounded-lg text-white"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {qtyLockedByPacking && <span className="text-white font-medium min-w-[2.5rem] text-center">{i.quantity}</span>}
                  <button
                    onClick={() => removeItem(i.productId, i.variationId)}
                    className="p-2 text-[#EF4444] hover:bg-[#EF4444]/20 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {enablePacking && (
                <div className="pt-3 border-t border-[#374151] w-full">
                  <p className="text-xs text-[#9CA3AF] mb-2">Packing (optional)</p>
                  <PackingInputButton
                    packingDetails={i.packingDetails}
                    onPackingChange={(d) => updatePacking(i.productId, d, i.variationId)}
                    productName={i.name}
                    className="w-full justify-center sm:justify-start"
                  />
                </div>
              )}
            </div>
          );})}
              </div>
            )}
          </div>

          {/* 2. SEARCH */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full h-11 bg-[#111827] border border-[#374151] rounded-lg pl-10 pr-4 text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#10B981]"
            />
          </div>

          {/* 3. PRODUCT GRID */}
          <h2 className="text-sm font-medium text-[#9CA3AF]">Add from list</h2>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-[#10B981] animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredProducts.map((prod) => (
                <button
                  key={prod.id}
                  onClick={() => {
                    if (prod.hasVariations && (prod.variations?.length ?? 0) > 0) {
                      setSelectedProduct(prod);
                      setShowAddModal(true);
                    } else {
                      addItem(prod, 1);
                    }
                  }}
                  className="bg-[#1F2937] border border-[#374151] rounded-xl p-3 hover:border-[#10B981] active:scale-95 transition-all text-left"
                >
                  <div className="w-full h-20 bg-[#111827] rounded-lg mb-2 flex items-center justify-center">
                    <Package className="w-8 h-8 text-[#6B7280]" />
                  </div>
                  <h4 className="font-medium text-sm mb-1 text-white line-clamp-1">{prod.name}</h4>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#10B981]">Rs. {prod.costPrice.toLocaleString()}</span>
                    <Plus className="w-4 h-4 text-[#10B981]" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="fixed left-0 right-0 bg-[#1F2937] border-t border-[#374151] p-4 safe-area-bottom fixed-bottom-above-nav z-40">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[#9CA3AF]">Subtotal</span>
            <span className="text-xl font-bold text-[#10B981]">Rs. {subtotal.toLocaleString()}</span>
          </div>
          <button
            onClick={() => setStep('summary')}
            disabled={items.length === 0}
            className="w-full h-12 bg-[#10B981] hover:bg-[#059669] disabled:bg-[#374151] disabled:text-[#6B7280] rounded-lg font-medium text-white"
          >
            Next: Summary →
          </button>
        </div>

        {showAddModal && selectedProduct && (
          <AddToPurchaseModal
            product={selectedProduct}
            onClose={() => {
              setShowAddModal(false);
              setSelectedProduct(null);
            }}
            onAdd={(qty, unitPrice, variationId, variation, sku, packingDetails) => {
              addItem(selectedProduct, qty, { unitPrice, variationId, variation, sku, packingDetails });
              setShowAddModal(false);
              setSelectedProduct(null);
              setTimeout(() => lastItemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 150);
            }}
          />
        )}
      </div>
    );
  }

  if (step === 'summary' && vendor) {
    return (
      <div className="min-h-screen bg-[#111827] pb-32">
        <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
          <div className="flex items-center gap-3 px-4 h-14">
            <button onClick={() => setStep('items')} className="p-2 hover:bg-[#374151] rounded-lg text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-semibold text-base text-white">Purchase Summary</h1>
              <p className="text-xs text-[#9CA3AF]">Step 1: Review Order</p>
            </div>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <p className="text-xs text-[#9CA3AF]">Vendor</p>
            <p className="font-medium text-white">{vendor.name}</p>
          </div>

          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <h3 className="text-sm font-medium text-[#9CA3AF] mb-3">Items ({items.length})</h3>
            {items.map((i) => (
              <div key={i.id} className="py-2 border-b border-[#374151] last:border-0">
                <div className="flex justify-between text-sm">
                  <span className="text-white">
                    {i.name}
                    {i.variation ? ` (${i.variation})` : ''} × {i.quantity}
                  </span>
                  <span className="text-white">Rs. {i.total.toLocaleString()}</span>
                </div>
                {i.packingDetails && (i.packingDetails.total_meters ?? 0) > 0 && (
                  <p className="text-xs text-[#10B981] mt-0.5">
                    {i.packingDetails.total_boxes ?? 0} Box / {i.packingDetails.total_pieces ?? 0} Pc /{' '}
                    {(i.packingDetails.total_meters ?? 0).toFixed(1)} M
                  </p>
                )}
              </div>
            ))}
          </div>
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-[#9CA3AF]">Subtotal</span>
              <span className="font-semibold text-white">Rs. {subtotal.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#9CA3AF]">Discount</span>
              <input
                type="number"
                inputMode="decimal"
                pattern="[0-9.]*"
                value={discount}
                onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                placeholder="0"
                className="w-32 h-9 bg-[#111827] border border-[#374151] rounded-lg px-3 text-sm text-right text-white max-w-full"
              />
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-[#374151]">
              <span className="text-white">Total</span>
              <span className="text-[#10B981]">Rs. {total.toLocaleString()}</span>
            </div>
          </div>

          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <label className="text-sm font-medium text-[#9CA3AF] mb-2 block">Purchase Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCreationStatus('ordered')}
                className={`py-3 px-3 rounded-lg border text-sm font-medium transition-all ${
                  creationStatus === 'ordered'
                    ? 'border-[#F59E0B] bg-[#F59E0B]/10 text-[#F59E0B]'
                    : 'border-[#374151] bg-[#111827] text-[#9CA3AF] hover:border-[#4B5563]'
                }`}
              >
                Order
                <span className="block text-[10px] mt-0.5 opacity-80 font-normal">PO only · no stock yet</span>
              </button>
              <button
                type="button"
                onClick={() => setCreationStatus('received')}
                className={`py-3 px-3 rounded-lg border text-sm font-medium transition-all ${
                  creationStatus === 'received'
                    ? 'border-[#10B981] bg-[#10B981]/10 text-[#10B981]'
                    : 'border-[#374151] bg-[#111827] text-[#9CA3AF] hover:border-[#4B5563]'
                }`}
              >
                Received / Final
                <span className="block text-[10px] mt-0.5 opacity-80 font-normal">Goods in hand · updates stock</span>
              </button>
            </div>
          </div>

          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <label className="text-sm font-medium text-[#9CA3AF] mb-2 block">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes..."
              rows={3}
              className="w-full bg-[#111827] border border-[#374151] rounded-lg px-3 py-2 text-sm text-white placeholder-[#6B7280] resize-none focus:outline-none focus:border-[#10B981]"
            />
          </div>
        </div>
        {error && <p className="text-sm text-red-400 px-4">{error}</p>}
        <MobileActionBar
          buttonLabel={creationStatus === 'ordered' ? (saving ? 'Saving…' : 'Save Order') : 'Proceed to Payment →'}
          onButtonClick={() => {
            setError('');
            if (creationStatus === 'ordered') {
              void handleSaveWithPayment({ paidAmount: 0, paymentMethod: '', accountId: null });
            } else {
              setStep('payment');
            }
          }}
          variant="success"
        />
      </div>
    );
  }

  if (step === 'payment' && vendor) {
    const paymentRoot = typeof document !== 'undefined' ? document.body : null;
    if (!paymentRoot) return null;
    return createPortal(
      <div className="fixed inset-0 z-[100] overflow-auto bg-[#111827]">
        <PaymentDialog
          totalAmount={total}
          companyId={companyId}
          onBack={() => setStep('summary')}
          onComplete={(result) => handleSaveWithPayment(result)}
          saving={saving}
          saveError={error}
          showCreditOption={true}
        />
      </div>,
      paymentRoot
    );
  }

  return null;
}

function formatVariationLabel(attrs: Record<string, string>): string {
  const parts = Object.entries(attrs || {})
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`);
  return parts.length ? parts.join(' • ') : '—';
}

interface AddToPurchaseModalProps {
  product: ProductForPurchase;
  onClose: () => void;
  onAdd: (qty: number, unitPrice: number, variationId?: string, variation?: string, sku?: string, packingDetails?: PackingDetails) => void;
}

function AddToPurchaseModal({ product, onClose, onAdd }: AddToPurchaseModalProps) {
  const { enablePacking } = useSettings();
  const allowDecimal = product.unitAllowDecimal === true;
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState(product.costPrice);
  const [selectedVariation, setSelectedVariation] = useState<ProductVariationRow | null>(null);
  const [packingDetails, setPackingDetails] = useState<PackingDetails | undefined>(undefined);
  const [showPacking, setShowPacking] = useState(false);

  const hasVariations = product.hasVariations && (product.variations?.length ?? 0) > 0;
  const usePackingQty = packingDetails != null && (packingDetails.total_meters ?? 0) > 0;
  const total = unitPrice * quantity;

  const handleQtyChange = (raw: string) => {
    const parsed = parseFloat(raw);
    const value = Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
    if (!allowDecimal && value % 1 !== 0) return; // Reject decimals when unit doesn't allow
    setQuantity(allowDecimal ? value : Math.round(value));
  };

  const handleAdd = () => {
    if (quantity <= 0 || unitPrice <= 0) return;
    if (hasVariations && !selectedVariation) return;
    onAdd(
      quantity,
      unitPrice,
      selectedVariation?.id,
      selectedVariation ? formatVariationLabel(selectedVariation.attributes) : undefined,
      selectedVariation?.sku ?? product.sku,
      packingDetails
    );
  };

  return (
    <>
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-end sm:items-center justify-center">
      <div className="bg-[#1F2937] rounded-t-3xl sm:rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto pb-6">
        <div className="flex justify-center pt-2 pb-4 sm:hidden">
          <div className="w-12 h-1 bg-[#374151] rounded-full" />
        </div>

        <div className="px-6 pb-4 border-b border-[#374151]">
          <h2 className="text-lg font-semibold text-[#F9FAFB]">{product.name}</h2>
          <p className="text-sm text-[#9CA3AF]">Cost Price</p>
        </div>

        <div className="px-6 pt-6 space-y-6">
          {hasVariations && (
            <div>
              <label className="block text-sm font-medium text-[#9CA3AF] mb-3">Select Variation</label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {product.variations!.map((v) => {
                  const label = formatVariationLabel(v.attributes);
                  const isSelected = selectedVariation?.id === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        setSelectedVariation(v);
                        setUnitPrice(v.price || product.costPrice);
                      }}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-[#10B981] bg-[#10B981]/10 text-white'
                          : 'border-[#374151] bg-[#111827] text-[#D1D5DB] hover:border-[#4B5563]'
                      }`}
                    >
                      <p className="text-sm font-medium truncate">{label || v.sku}</p>
                      <p className="text-xs text-[#9CA3AF] mt-0.5">Rs. {(v.price || 0).toLocaleString()}</p>
                      {typeof v.stock === 'number' && (
                        <p className={`text-xs mt-0.5 ${v.stock < 10 ? 'text-[#F59E0B]' : 'text-[#9CA3AF]'}`}>Stock: {v.stock}</p>
                      )}
                    </button>
                  );
                })}
              </div>
              {!selectedVariation && (
                <p className="text-xs text-[#F59E0B] mt-2">Please select a variation to continue</p>
              )}
            </div>
          )}

          {/* Packing (optional): single button opens PackingEntryModal → Boxes / Pieces / Meters; quantity = meters. Gated by company enable_packing setting. */}
          {enablePacking && (
            <div className="bg-[#111827] border border-[#374151] rounded-xl p-4">
              <p className="text-sm font-medium text-[#9CA3AF] mb-3">Packing (optional)</p>
              <button
                type="button"
                onClick={() => setShowPacking(true)}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg border border-[#10B981]/50 bg-[#10B981]/10 text-[#10B981] font-medium hover:bg-[#10B981]/20 transition-colors"
              >
                <Package className="w-4 h-4" />
                {packingDetails && (packingDetails.total_meters ?? 0) > 0
                  ? `${packingDetails.total_boxes ?? 0} Box / ${packingDetails.total_pieces ?? 0} Pc / ${(packingDetails.total_meters ?? 0).toFixed(1)} M — Edit`
                  : 'Add Packing'}
              </button>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[#9CA3AF] mb-3">
              Quantity{usePackingQty ? ' (from packing)' : allowDecimal ? ' (decimals allowed)' : ''}
            </label>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => {
                  if (usePackingQty) return;
                  setQuantity((q) => Math.max(allowDecimal ? 0.01 : 1, allowDecimal ? q - 0.01 : q - 1));
                }}
                disabled={usePackingQty}
                className="w-12 h-12 bg-[#111827] border border-[#374151] rounded-lg flex items-center justify-center hover:bg-[#374151] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Minus className="w-5 h-5 text-[#F9FAFB]" />
              </button>
              <input
                type="number"
                min={allowDecimal ? 0.01 : 1}
                step={usePackingQty ? 1 : allowDecimal ? 0.01 : 1}
                inputMode={allowDecimal ? 'decimal' : 'numeric'}
                pattern={allowDecimal ? '[0-9.]*' : '[0-9]*'}
                value={quantity}
                onChange={(e) => {
                  if (usePackingQty) return;
                  handleQtyChange(e.target.value);
                }}
                readOnly={usePackingQty}
                className="flex-1 h-12 bg-[#111827] border border-[#374151] rounded-lg text-center text-lg font-semibold text-[#F9FAFB] focus:outline-none focus:border-[#10B981] disabled:opacity-70 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={() => {
                  if (usePackingQty) return;
                  setQuantity((q) => allowDecimal ? q + 0.01 : q + 1);
                }}
                disabled={usePackingQty}
                className="w-12 h-12 bg-[#111827] border border-[#374151] rounded-lg flex items-center justify-center hover:bg-[#374151] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-5 h-5 text-[#F9FAFB]" />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#9CA3AF] mb-3">Unit Price (Rs.)</label>
            <input
              type="number"
              inputMode="decimal"
              pattern="[0-9.]*"
              min="0"
              value={unitPrice}
              onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
              className="w-full h-14 bg-[#111827] border-2 border-[#374151] rounded-lg px-4 text-lg font-semibold text-[#F9FAFB] focus:outline-none focus:border-[#10B981]"
            />
            <p className="text-xs text-[#6B7280] mt-2">Base cost: Rs. {product.costPrice.toLocaleString()}</p>
          </div>

          <div className="pt-4 border-t border-[#374151]">
            <div className="flex items-center justify-between mb-6">
              <span className="text-[#9CA3AF]">Item Total</span>
              <span className="text-2xl font-bold text-[#10B981]">
                Rs. {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 h-12 border border-[#374151] rounded-lg font-medium hover:bg-[#374151] text-[#F9FAFB]"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={quantity <= 0 || unitPrice <= 0 || (hasVariations && !selectedVariation)}
                className="flex-1 h-12 bg-[#10B981] hover:bg-[#059669] disabled:bg-[#374151] disabled:text-[#6B7280] rounded-lg font-medium text-[#F9FAFB]"
              >
                Add to Order
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

      <PackingEntryModal
        open={showPacking}
        onOpenChange={setShowPacking}
        onSave={(d) => {
          setPackingDetails(d);
          const m = d.total_meters ?? 0;
          if (m > 0) setQuantity(m);
          setShowPacking(false);
        }}
        initialData={packingDetails}
        productName={product.name}
      />
    </>
  );
}

