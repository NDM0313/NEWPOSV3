import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Search, Plus, Minus, Package, Edit2, Trash2 } from 'lucide-react';
import type { Customer, Product } from './SalesModule';
import type { PackingDetails } from '../transactions/PackingEntryModal';
import { PackingEntryModal } from '../transactions/PackingEntryModal';
import * as productsApi from '../../api/products';
import type { ProductVariationRow } from '../../api/products';

interface AddProductsProps {
  companyId: string | null;
  onBack: () => void;
  customer: Customer;
  initialProducts: Product[];
  onProductsUpdate: (products: Product[]) => void;
  onNext: () => void;
}

type AvailableProduct = {
  id: string;
  name: string;
  price: number;
  wholesalePrice: number;
  sku?: string;
  unit: string;
  hasVariations?: boolean;
  variations?: ProductVariationRow[];
  unitAllowDecimal?: boolean;
};

export function AddProducts({
  companyId,
  onBack,
  customer,
  initialProducts,
  onProductsUpdate,
  onNext,
}: AddProductsProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [available, setAvailable] = useState<AvailableProduct[]>([]);
  const [loading, setLoading] = useState(!!companyId);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<AvailableProduct | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!companyId) {
      setAvailable([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    productsApi.getProducts(companyId).then(({ data, error }) => {
      if (cancelled) return;
      setLoading(false);
      if (error || !data.length) setAvailable([]);
      else
        setAvailable(
          data.map((p) => ({
            id: p.id,
            name: p.name,
            price: p.retailPrice,
            wholesalePrice: p.costPrice || p.retailPrice * 0.8,
            sku: p.sku,
            unit: p.unit || 'Piece',
            hasVariations: p.hasVariations ?? false,
            variations: p.variations,
            unitAllowDecimal: p.unitAllowDecimal ?? false,
          }))
        );
    });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const filtered = available.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );
  const subtotal = products.reduce((sum, p) => sum + p.total, 0);

  const openAddModal = (item: AvailableProduct) => {
    setSelectedProduct(item);
    setEditingIndex(null);
    setShowModal(true);
  };

  const openEditModal = (index: number) => {
    const p = products[index];
    const ap = available.find((a) => a.id === p.id);
    if (ap) {
      setSelectedProduct(ap);
      setEditingIndex(index);
      setShowModal(true);
    }
  };

  const handleSaveFromModal = (product: Product) => {
    if (editingIndex !== null) {
      const next = products.map((pr, i) => (i === editingIndex ? product : pr));
      setProducts(next);
      onProductsUpdate(next);
    } else {
      const existing = products.find(
        (pr) => pr.id === product.id && (pr.variationId ?? '') === (product.variationId ?? '')
      );
      let next: Product[];
      if (existing) {
        const newQty = existing.quantity + product.quantity;
        next = products.map((pr) =>
          pr.id === product.id && (pr.variationId ?? '') === (product.variationId ?? '')
            ? { ...pr, quantity: newQty, total: pr.price * newQty, packingDetails: product.packingDetails }
            : pr
        );
      } else {
        next = [...products, product];
      }
      setProducts(next);
      onProductsUpdate(next);
    }
    setShowModal(false);
    setSelectedProduct(null);
    setEditingIndex(null);
  };

  const remove = (index: number) => {
    const next = products.filter((_, i) => i !== index);
    setProducts(next);
    onProductsUpdate(next);
  };

  return (
    <div className="min-h-screen bg-[#111827] pb-32">
      {/* Header - Figma style */}
      <div className="bg-[#1F2937] border-b border-[#374151] px-4 py-3 sticky top-0 z-20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg text-[#F9FAFB]">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold text-[#F9FAFB]">Add Items</h1>
          </div>
          <button
            onClick={onNext}
            disabled={products.length === 0}
            className="px-4 py-2 bg-[#3B82F6] hover:bg-[#2563EB] disabled:bg-[#374151] disabled:text-[#6B7280] rounded-lg font-medium text-[#F9FAFB] transition-colors"
          >
            Next
          </button>
        </div>

        {/* Customer card - Figma style */}
        <div className="bg-[#111827] rounded-lg p-3 mb-3">
          <p className="text-xs text-[#9CA3AF] mb-1">Customer</p>
          <p className="font-medium text-[#F9FAFB]">{customer.name}</p>
          <p className="text-sm text-[#9CA3AF]">Items: {products.length}</p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            className="w-full h-11 bg-[#111827] border border-[#374151] rounded-lg pl-11 pr-4 text-sm text-[#F9FAFB] placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
          />
        </div>
      </div>

      {/* Cart - when has items */}
      {products.length > 0 && (
        <div className="p-4">
          <h2 className="text-sm font-medium text-[#9CA3AF] mb-3">CART ({products.length} items)</h2>
          <div className="space-y-2">
            {products.map((p, i) => (
              <div
                key={`${p.id}-${i}`}
                className="bg-[#1F2937] border border-[#374151] rounded-xl p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-medium text-[#F9FAFB] mb-1">{p.name}</h3>
                    {(p.variation || p.variationId) && (
                      <p className="text-xs text-[#9CA3AF]">{p.variation || 'Variant'}</p>
                    )}
                    {p.packingDetails && (p.packingDetails.total_meters ?? 0) > 0 && (
                      <p className="text-xs text-[#3B82F6] mt-1">
                        {p.packingDetails.total_boxes ?? 0} Box • {p.packingDetails.total_pieces ?? 0} Pc • {(p.packingDetails.total_meters ?? 0).toFixed(1)} M
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(i)}
                      className="p-2 hover:bg-[#374151] rounded-lg"
                    >
                      <Edit2 className="w-4 h-4 text-[#3B82F6]" />
                    </button>
                    <button
                      onClick={() => remove(i)}
                      className="p-2 hover:bg-[#374151] rounded-lg"
                    >
                      <Trash2 className="w-4 h-4 text-[#EF4444]" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-[#9CA3AF]">
                    Qty: {p.quantity} × Rs. {p.price.toLocaleString()}
                  </div>
                  <div className="font-semibold text-[#10B981]">
                    Rs. {p.total.toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Products - Grid layout Figma style */}
      <div className="p-4">
        <h2 className="text-sm font-medium text-[#9CA3AF] mb-3">AVAILABLE PRODUCTS</h2>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-[#6B7280] text-sm text-center py-8">
            {search ? 'No products match your search.' : 'No products available.'}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((item) => (
              <button
                key={item.id}
                onClick={() => openAddModal(item)}
                className="bg-[#1F2937] border border-[#374151] rounded-xl p-3 hover:border-[#3B82F6] transition-all text-left"
              >
                <div className="w-full h-20 bg-[#111827] rounded-lg mb-2 flex items-center justify-center">
                  <Package className="w-8 h-8 text-[#6B7280]" />
                </div>
                <h3 className="font-medium text-sm text-[#F9FAFB] line-clamp-1 mb-1">{item.name}</h3>
                <p className="text-xs text-[#9CA3AF] mb-2">{item.unit}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#3B82F6]">
                    Rs. {item.price.toLocaleString()}
                  </span>
                  <Plus className="w-4 h-4 text-[#10B981]" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Empty state */}
      {products.length === 0 && !search && !loading && (
        <div className="text-center py-12 px-4">
          <div className="w-16 h-16 bg-[#374151] rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-[#6B7280]" />
          </div>
          <p className="text-[#9CA3AF] mb-2">No items in cart</p>
          <p className="text-sm text-[#6B7280]">Search and add products to continue</p>
        </div>
      )}

      {/* Bottom bar – portal to body so fixed bottom works (avoids transform/overflow ancestors) */}
      {products.length > 0 &&
        createPortal(
          <div className="fixed left-0 right-0 bottom-0 bg-[#1F2937] border-t border-[#374151] p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0))] z-[60]">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[#9CA3AF]">Subtotal</span>
              <span className="text-xl font-bold text-[#F9FAFB]">Rs. {subtotal.toLocaleString()}</span>
            </div>
            <button
              onClick={onNext}
              className="w-full h-12 bg-[#3B82F6] hover:bg-[#2563EB] rounded-lg font-medium text-[#F9FAFB] transition-colors"
            >
              Continue to Summary →
            </button>
          </div>,
          document.body
        )}

      {/* Add to Cart Modal */}
      {showModal && selectedProduct && (
        <AddToCartModal
          product={selectedProduct}
          existingProduct={editingIndex !== null ? products[editingIndex] : null}
          onClose={() => {
            setShowModal(false);
            setSelectedProduct(null);
            setEditingIndex(null);
          }}
          onSave={handleSaveFromModal}
        />
      )}
    </div>
  );
}

interface AddToCartModalProps {
  product: AvailableProduct;
  existingProduct: Product | null;
  onClose: () => void;
  onSave: (product: Product) => void;
}

function formatVariationLabel(attrs: Record<string, string>): string {
  const parts = Object.entries(attrs || {})
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`);
  return parts.length ? parts.join(' • ') : '—';
}

function AddToCartModal({
  product,
  existingProduct,
  onClose,
  onSave,
}: AddToCartModalProps) {
  const existingQty = existingProduct?.quantity ?? 1;
  const existingPacking = existingProduct?.packingDetails;
  const hasPackingMeters = (existingPacking?.total_meters ?? 0) > 0;
  const [quantity, setQuantity] = useState(
    hasPackingMeters ? (existingPacking!.total_meters ?? existingQty) : existingQty
  );
  const [price, setPrice] = useState(existingProduct?.price ?? product.price);
  const [packingDetails, setPackingDetails] = useState<PackingDetails | undefined>(
    existingPacking
  );
  const [showPacking, setShowPacking] = useState(false);
  const [selectedVariation, setSelectedVariation] = useState<ProductVariationRow | null>(
    existingProduct?.variationId && product.variations?.length
      ? product.variations.find((v) => v.id === existingProduct.variationId) ?? null
      : null
  );

  const hasVariations = product.hasVariations && (product.variations?.length ?? 0) > 0;
  const allowDecimal = product.unitAllowDecimal === true;
  const effectiveSku = selectedVariation ? selectedVariation.sku : product.sku;
  const total = price * quantity;

  const handleQtyChange = (raw: string) => {
    const parsed = parseFloat(raw);
    const value = Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
    if (!allowDecimal && value % 1 !== 0) return;
    setQuantity(allowDecimal ? value : Math.round(value));
  };

  const handleSave = () => {
    if (quantity <= 0 || price <= 0) return;
    if (hasVariations && !selectedVariation) return;
    onSave({
      id: product.id,
      name: product.name,
      sku: effectiveSku ?? product.sku,
      price,
      quantity,
      total: price * quantity,
      variation: selectedVariation ? formatVariationLabel(selectedVariation.attributes) : undefined,
      variationId: selectedVariation?.id,
      packingDetails,
    });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
        <div className="bg-[#1F2937] rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto pb-6">

          <div className="px-6 pb-4 border-b border-[#374151]">
            <h2 className="text-lg font-semibold text-[#F9FAFB]">{product.name}</h2>
            <p className="text-sm text-[#9CA3AF]">Unit: {product.unit}</p>
          </div>

          <div className="px-6 pt-6 space-y-6">
            {/* Variation selector - when product has variations */}
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
                          setPrice(v.price || product.price);
                        }}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'border-[#3B82F6] bg-[#3B82F6]/10 text-white'
                            : 'border-[#374151] bg-[#111827] text-[#D1D5DB] hover:border-[#4B5563]'
                        }`}
                      >
                        <p className="text-sm font-medium truncate">{label || v.sku}</p>
                        <p className="text-xs text-[#9CA3AF] mt-0.5">Rs. {(v.price || 0).toLocaleString()}</p>
                        {v.stock != null && v.stock < 10 && (
                          <p className="text-xs text-[#F59E0B] mt-0.5">Stock: {v.stock}</p>
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

            {/* Packing Entry - Figma style */}
            <div className="bg-[#111827] border border-[#3B82F6]/30 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package size={18} className="text-[#3B82F6]" />
                  <span className="text-sm font-medium text-[#F9FAFB]">Packing Entry</span>
                </div>
                <button
                  onClick={() => setShowPacking(true)}
                  className="px-3 py-1.5 bg-[#3B82F6] hover:bg-[#2563EB] text-[#F9FAFB] text-xs rounded-lg font-medium"
                >
                  {packingDetails && (packingDetails.total_meters ?? 0) > 0
                    ? 'Edit Packing'
                    : 'Add Packing'}
                </button>
              </div>
              {packingDetails && (packingDetails.total_meters ?? 0) > 0 && (
                <p className="text-xs text-[#9CA3AF] mt-2">
                  {packingDetails.total_boxes ?? 0} Box • {packingDetails.total_pieces ?? 0} Pc • {(packingDetails.total_meters ?? 0).toFixed(1)} M
                </p>
              )}
            </div>

            {/* Quantity - shows total_meters when packing used, disabled when packing present */}
            <div>
              <label className="block text-sm font-medium text-[#9CA3AF] mb-3">
                Quantity {packingDetails && (packingDetails.total_meters ?? 0) > 0 ? '(M)' : allowDecimal ? '(decimals allowed)' : ''}
              </label>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    if (packingDetails && (packingDetails.total_meters ?? 0) > 0) return;
                    const step = allowDecimal ? 0.01 : 1;
                    setQuantity((q) => Math.max(allowDecimal ? 0 : 1, q - step));
                  }}
                  disabled={!!(packingDetails && (packingDetails.total_meters ?? 0) > 0)}
                  className="w-12 h-12 bg-[#111827] border border-[#374151] rounded-lg flex items-center justify-center hover:bg-[#374151] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Minus className="w-5 h-5 text-[#F9FAFB]" />
                </button>
                <input
                  type="number"
                  min={allowDecimal ? 0 : 1}
                  step={packingDetails && (packingDetails.total_meters ?? 0) > 0 ? 0.1 : allowDecimal ? 0.01 : 1}
                  inputMode={allowDecimal ? 'decimal' : 'numeric'}
                  value={quantity}
                  onChange={(e) => {
                    if (packingDetails && (packingDetails.total_meters ?? 0) > 0) return;
                    handleQtyChange(e.target.value);
                  }}
                  readOnly={!!(packingDetails && (packingDetails.total_meters ?? 0) > 0)}
                  className="flex-1 h-12 bg-[#111827] border border-[#374151] rounded-lg text-center text-lg font-semibold text-[#F9FAFB] focus:outline-none focus:border-[#3B82F6] disabled:opacity-70 disabled:cursor-not-allowed"
                />
                <button
                  onClick={() => {
                    if (packingDetails && (packingDetails.total_meters ?? 0) > 0) return;
                    const step = allowDecimal ? 0.01 : 1;
                    setQuantity((q) => q + step);
                  }}
                  disabled={!!(packingDetails && (packingDetails.total_meters ?? 0) > 0)}
                  className="w-12 h-12 bg-[#111827] border border-[#374151] rounded-lg flex items-center justify-center hover:bg-[#374151] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-5 h-5 text-[#F9FAFB]" />
                </button>
              </div>
            </div>

            {/* Price */}
            <div>
              <label className="block text-sm font-medium text-[#9CA3AF] mb-3">Price</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]">Rs.</span>
                <input
                  type="number"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                  className="w-full h-14 bg-[#111827] border-2 border-[#374151] rounded-lg pl-14 pr-4 text-lg font-semibold text-[#F9FAFB] focus:outline-none focus:border-[#3B82F6]"
                />
              </div>
              <p className="text-xs text-[#6B7280] mt-2">
                {selectedVariation
                  ? `Variant: Rs. ${(selectedVariation.price || 0).toLocaleString()}`
                  : `Base: Rs. ${product.price.toLocaleString()} | Wholesale: Rs. ${product.wholesalePrice.toLocaleString()}`}
              </p>
            </div>

            {/* Item Total */}
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
                  onClick={handleSave}
                  disabled={quantity <= 0 || price <= 0 || (hasVariations && !selectedVariation)}
                  className="flex-1 h-12 bg-[#3B82F6] hover:bg-[#2563EB] disabled:bg-[#374151] disabled:text-[#6B7280] rounded-lg font-medium text-[#F9FAFB]"
                >
                  {existingProduct ? 'Update' : 'Add to Cart'}
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
