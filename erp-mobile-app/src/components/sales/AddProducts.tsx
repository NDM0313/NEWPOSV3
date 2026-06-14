import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ArrowLeft, Search, Plus, Minus, Package, Edit2, Trash2, Scan, Loader2 } from 'lucide-react';
import type { Customer, Product } from './SalesModule';
import type { PackingDetails } from '../transactions/PackingEntryModal';
import { PackingEntryModal } from '../transactions/PackingEntryModal';
import * as productsApi from '../../api/products';
import { isRealBranchUuid } from '../../utils/branchId';
import * as settingsApi from '../../api/settings';
import { useSettings } from '../../context/SettingsContext';
import {
  formatStockLabel,
  getTotalProductStock,
  isSaleBlockedByStock,
  isVariationSaleBlocked,
  stockLabelClassName,
} from '../../utils/productStockGate';
import type { ProductVariationRow } from '../../api/products';
import { BarcodeCameraModal } from './BarcodeCameraModal';
import { MobileActionBar } from '../shared/MobileActionBar';
import { Capacitor } from '@capacitor/core';
import { useBarcodeScanner } from '../../features/barcode';
import { ProductImage } from '../products/ProductImage';
import { useBespokeEnabled } from '../../hooks/useBespokeEnabled';
import { isBespokeGenericSku } from '../../lib/bespokeCartInjection';
import { canPostStockForSaleStatus } from '../../lib/postingStatusGate';
import { appendFabricToParent } from '../../lib/bespokeCartMobile';
import { resolveFabricMaterialRetailPrice } from '../../lib/bespokeCartInjection';
import { SaleCustomizeModal } from './SaleCustomizeModal';
import { FabricProductGrid } from './FabricProductGrid';
import { mapApiProductToFabricPicker, type FabricPickerProduct } from './fabricPickerTypes';
import type { SaleData } from './SalesModule';
import { NumericInput } from '../common/NumericInput';
import { unitAllowsDecimal } from '../../lib/unitDecimal';

function newCartLineId(): string {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface AddProductsProps {
  companyId: string | null;
  branchId?: string | null;
  saleDocumentStatus?: SaleData['documentStatus'];
  onBack: () => void;
  customer: Customer;
  initialProducts: Product[];
  onProductsUpdate: (products: Product[]) => void;
  onNext: () => void;
}

type AvailableProduct = FabricPickerProduct;

/** Resolve barcode/sku to a single product (base or first variation match). */
function findProductByBarcode(available: AvailableProduct[], code: string): AvailableProduct | null {
  const trimmed = code.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  for (const p of available) {
    if (p.barcode?.toLowerCase() === lower || (p.sku && p.sku.toLowerCase() === lower)) return p;
    for (const v of p.variations ?? []) {
      if (v.sku?.toLowerCase() === lower) return p;
    }
  }
  return null;
}

const mapApiProductToAvailable = mapApiProductToFabricPicker;

/** Add a product to cart with quantity 1 (or increment if same id+variation). */
function addProductToCart(
  product: AvailableProduct,
  existingProducts: Product[],
  onUpdate: (next: Product[]) => void
): void {
  const existing = existingProducts.find(
    (pr) =>
      pr.id === product.id &&
      (pr.variationId ?? '') === '' &&
      !pr.isBespokeInjected &&
      !pr.bespokeParentCartId,
  );
  if (existing) {
    const newQty = existing.quantity + 1;
    const next = existingProducts.map((pr) =>
      pr.id === product.id && (pr.variationId ?? '') === ''
        ? { ...pr, quantity: newQty, total: pr.price * newQty }
        : pr
    );
    onUpdate(next);
  } else {
    const line: Product = {
      id: product.id,
      cartLineId: newCartLineId(),
      name: product.name,
      sku: product.sku,
      price: product.price,
      quantity: 1,
      total: product.price,
    };
    onUpdate([...existingProducts, line]);
  }
}

export function AddProducts({
  companyId,
  branchId,
  saleDocumentStatus = 'order',
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
  const [barcodeMethod, setBarcodeMethod] = useState<settingsApi.BarcodeScannerMethod>('keyboard_wedge');
  const [cameraScanOpen, setCameraScanOpen] = useState(false);
  const [scanMessage, setScanMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [scannerInput, setScannerInput] = useState(''); // dedicated field for keyboard wedge (Speed-X, Sunmi, CS60)
  const [barcodeLookupLoading, setBarcodeLookupLoading] = useState(false);
  const [customizeLine, setCustomizeLine] = useState<Product | null>(null);
  const [fabricAttachParent, setFabricAttachParent] = useState<Product | null>(null);
  const [fabricAttachMode, setFabricAttachMode] = useState(false);
  const scannerInputRef = useRef<HTMLInputElement>(null);
  const barcode = useBarcodeScanner();
  const preferNativeCamera = Capacitor.isNativePlatform();
  const showCameraScan = preferNativeCamera || barcodeMethod === 'camera';
  const { negativeStockAllowed, loaded: settingsLoaded, reload: reloadSettings } = useSettings();
  const { enabled: bespokeEnabled } = useBespokeEnabled(companyId);

  useEffect(() => {
    if (companyId) void reloadSettings(companyId);
  }, [companyId, reloadSettings]);

  const relaxStockForAdd = !canPostStockForSaleStatus(saleDocumentStatus);
  /** Do not block sales until company policy is loaded (avoids false "Out of stock" for staff). */
  const effectiveAllowNegative = !settingsLoaded || negativeStockAllowed;
  const gateAllowNegative = effectiveAllowNegative || relaxStockForAdd;

  const isProductBlocked = useCallback(
    (product: AvailableProduct) =>
      !relaxStockForAdd &&
      settingsLoaded &&
      isSaleBlockedByStock(getTotalProductStock(product), negativeStockAllowed),
    [settingsLoaded, negativeStockAllowed, relaxStockForAdd],
  );

  useEffect(() => {
    if (!companyId) {
      setAvailable([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const saleBranchId = isRealBranchUuid(branchId) ? branchId : undefined;
    productsApi.getProducts(companyId, { branchId: saleBranchId }).then(({ data, error }) => {
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
            barcode: p.barcode,
            unit: p.unit || 'Piece',
            hasVariations: p.hasVariations ?? false,
            variations: p.variations,
            unitAllowDecimal: p.unitAllowDecimal ?? false,
            stock: p.stock ?? 0,
            imageUrl: p.imageUrls?.[0],
          }))
        );
    });
    return () => {
      cancelled = true;
    };
  }, [companyId, branchId]);

  useEffect(() => {
    if (!companyId) return;
    settingsApi.getMobileBarcodeScannerSettings(companyId).then(({ data }) => setBarcodeMethod(data.method));
  }, [companyId]);

  useEffect(() => {
    if (showCameraScan) void barcode.checkStatus();
  }, [showCameraScan, barcode.checkStatus]);

  const searchLower = search.toLowerCase().trim();

  const filtered = useMemo(() => {
    return available.filter((a) => {
      if (!searchLower) return true;
      if (a.name.toLowerCase().includes(searchLower)) return true;
      if (a.barcode?.toLowerCase() === searchLower || a.sku?.toLowerCase() === searchLower) return true;
      if (a.variations?.some((v) => v.sku?.toLowerCase() === searchLower)) return true;
      return false;
    });
  }, [available, searchLower]);

  const filteredCustom = useMemo(
    () => (bespokeEnabled ? filtered.filter((a) => isBespokeGenericSku(a.sku)) : []),
    [filtered, bespokeEnabled],
  );

  const filteredStock = useMemo(
    () => filtered.filter((a) => !isBespokeGenericSku(a.sku)),
    [filtered],
  );

  useEffect(() => {
    if (!scanMessage) return;
    const t = setTimeout(() => setScanMessage(null), 2800);
    return () => clearTimeout(t);
  }, [scanMessage]);

  const processBarcode = useCallback(
    async (code: string) => {
      const trimmed = (code || '').trim();
      if (!trimmed) return;
      const match = findProductByBarcode(available, trimmed);
      if (match) {
        if (isProductBlocked(match)) {
          setScanMessage({ type: 'error', text: `${match.name} is out of stock.` });
          return;
        }
        if (match.hasVariations && (match.variations?.length ?? 0) > 0) {
          openAddModal(match);
        } else {
          addProductToCart(match, products, (next) => {
            setProducts(next);
            onProductsUpdate(next);
          });
          setScanMessage({ type: 'success', text: `Added ${match.name}` });
        }
        setSearch('');
        setScannerInput('');
        return;
      }
      if (!companyId) {
        setScanMessage({ type: 'error', text: 'Product not found.' });
        return;
      }
      setBarcodeLookupLoading(true);
      const { data, error } = await productsApi.getProductByBarcodeOrSku(companyId, trimmed);
      setBarcodeLookupLoading(false);
      if (error || !data) {
        setScanMessage({ type: 'error', text: `Product not found for: ${trimmed}` });
        return;
      }
      const ap = mapApiProductToAvailable(data);
      setAvailable((prev) => (prev.some((x) => x.id === ap.id) ? prev : [...prev, ap]));
      if (isProductBlocked(ap)) {
        setScanMessage({ type: 'error', text: `${ap.name} is out of stock.` });
        return;
      }
      if (ap.hasVariations && (ap.variations?.length ?? 0) > 0) {
        openAddModal(ap);
      } else {
        addProductToCart(ap, products, (next) => {
          setProducts(next);
          onProductsUpdate(next);
        });
        setScanMessage({ type: 'success', text: `Added ${ap.name}` });
      }
      setSearch('');
      setScannerInput('');
    },
    [companyId, available, products, onProductsUpdate, isProductBlocked]
  );

  const handleBarcodeDetected = (code: string) => {
    processBarcode(code);
  };

  const handleScanClick = async () => {
    if (preferNativeCamera || barcode.supported) {
      if (barcode.permissionGranted === false) {
        await barcode.requestPermission();
      }
      if (barcode.error) {
        setScanMessage({ type: 'error', text: barcode.error });
        return;
      }
      const result = await barcode.startScan(handleBarcodeDetected);
      if (!result?.code && barcode.error) {
        setScanMessage({ type: 'error', text: barcode.error });
      }
      return;
    }
    setCameraScanOpen(true);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const raw = search.trim();
    if (raw.length >= 1) processBarcode(raw);
  };

  const handleScannerInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const raw = scannerInput.trim();
    if (raw.length >= 1) processBarcode(raw);
  };
  const subtotal = products.reduce((sum, p) => sum + p.total, 0);

  const openAddModal = (item: AvailableProduct, asFabricAttach = false) => {
    if (isProductBlocked(item)) return;
    setSelectedProduct(item);
    setEditingIndex(null);
    setFabricAttachMode(asFabricAttach);
    setShowModal(true);
  };

  const handleProductGridClick = (item: AvailableProduct) => {
    if (fabricAttachParent && !isBespokeGenericSku(item.sku)) {
      openAddModal(item, true);
      return;
    }
    openAddModal(item, false);
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
    if (fabricAttachMode && fabricAttachParent) {
      const material = {
        product_id: product.id,
        variation_id: product.variationId,
        product_name: product.name,
        sku: product.sku,
        unit_code: 'm',
        quantity: product.quantity,
      };
      const fabricUnitPrice = resolveFabricMaterialRetailPrice(material);
      const next = appendFabricToParent(products, fabricAttachParent, material, fabricUnitPrice);
      setProducts(next);
      onProductsUpdate(next);
      setFabricAttachParent(null);
      setFabricAttachMode(false);
      setShowModal(false);
      setSelectedProduct(null);
      return;
    }

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
    setFabricAttachMode(false);
  };

  const remove = (index: number) => {
    const next = products.filter((_, i) => i !== index);
    setProducts(next);
    onProductsUpdate(next);
  };

  return (
    <div className="min-h-screen bg-[#111827] pb-32">
      {/* Header */}
      <div className="bg-[#1F2937] border-b border-[#374151] px-4 py-3 sticky top-0 z-20 flow-screen-header">
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
        <div className="bg-[#111827] rounded-lg p-3">
          <p className="text-xs text-[#9CA3AF] mb-1">Customer</p>
          <p className="font-medium text-[#F9FAFB]">{customer.name}</p>
          <p className="text-sm text-[#9CA3AF]">Items: {products.length}</p>
        </div>
      </div>

      <BarcodeCameraModal
        open={cameraScanOpen}
        onClose={() => setCameraScanOpen(false)}
        onDetected={handleBarcodeDetected}
      />

      <div className="p-4 space-y-4">
        {/* 1. CART ITEMS — top, always visible (Figma pattern) */}
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <h2 className="text-sm font-medium text-[#9CA3AF] mb-3">CART ({products.length} items)</h2>
          {products.length === 0 ? (
            <p className="text-xs text-[#6B7280] py-2">No items yet. Search and add below.</p>
          ) : (
            <div className="space-y-2">
              {products.map((p, i) => {
                const isAttachTarget = fabricAttachParent === p;
                return (
                <div
                  key={`${p.cartLineId ?? p.id}-${i}`}
                  className={`bg-[#111827] border rounded-xl p-4 ${
                    isAttachTarget ? 'border-[#10B981] ring-1 ring-[#10B981]/50' : 'border-[#374151]'
                  }`}
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
                      {bespokeEnabled && isBespokeGenericSku(p.sku) && !p.isBespokeInjected && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setFabricAttachParent(p);
                              setCustomizeLine(null);
                            }}
                            className={`px-2 py-1 text-xs rounded border ${
                              isAttachTarget
                                ? 'bg-[#10B981]/20 text-[#6EE7B7] border-[#10B981]/50'
                                : 'bg-[#059669]/10 text-[#6EE7B7] border-[#059669]/40'
                            }`}
                          >
                            Add fabric
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCustomizeLine(p);
                              setFabricAttachParent(null);
                            }}
                            className="px-2 py-1 text-xs rounded bg-[#7C3AED]/20 text-[#C4B5FD] border border-[#7C3AED]/40"
                          >
                            Customize
                          </button>
                        </>
                      )}
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
              );
              })}
            </div>
          )}
        </div>

        {relaxStockForAdd && (
          <p className="text-xs text-[#9CA3AF] bg-[#1F2937] border border-[#374151] rounded-lg px-3 py-2">
            Order / quotation / draft: stock is not deducted until the sale is Final.
          </p>
        )}

        {fabricAttachParent && (
          <div className="flex items-center justify-between gap-2 bg-[#064E3B]/40 border border-[#10B981]/40 rounded-lg px-3 py-2">
            <p className="text-xs text-[#6EE7B7]">Tap a stock product below to attach as fabric.</p>
            <button
              type="button"
              onClick={() => setFabricAttachParent(null)}
              className="text-xs text-[#9CA3AF] underline shrink-0"
            >
              Cancel
            </button>
          </div>
        )}

        {/* 2. SEARCH */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={
                showCameraScan ? 'Search or tap Scan for camera…' : 'Search products...'
              }
              className="w-full h-11 bg-[#111827] border border-[#374151] rounded-lg pl-11 pr-4 text-sm text-[#F9FAFB] placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
            />
          </div>
          {showCameraScan && (
            <button
              type="button"
              onClick={() => void handleScanClick()}
              disabled={barcode.loading}
              className="h-11 px-4 bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-60 rounded-lg flex items-center gap-2 text-white font-medium shrink-0"
              title="Scan barcode with camera"
            >
              {barcode.loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Scan className="w-5 h-5" />}
              <span className="hidden sm:inline">Scan</span>
            </button>
          )}
        </div>
        {barcodeMethod === 'keyboard_wedge' && (
          <input
            ref={scannerInputRef}
            type="text"
            value={scannerInput}
            onChange={(e) => setScannerInput(e.target.value)}
            onKeyDown={handleScannerInputKeyDown}
            placeholder="Scan barcode (Speed-X, Sunmi, CS60)..."
            className="w-full h-11 bg-[#111827] border border-[#374151] rounded-lg px-4 text-sm text-[#F9FAFB] placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
            autoComplete="off"
          />
        )}
        {scanMessage && (
          <div
            className={`px-3 py-2 rounded-lg text-sm ${
              scanMessage.type === 'success' ? 'bg-[#064E3B] text-[#6EE7B7]' : 'bg-[#7F1D1D] text-[#FCA5A5]'
            }`}
          >
            {scanMessage.text}
          </div>
        )}
        {barcodeLookupLoading && (
          <div className="flex items-center gap-2 text-sm text-[#9CA3AF]">
            <div className="w-4 h-4 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
            Looking up product...
          </div>
        )}

        {/* 3. PRODUCT GRID */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-[#6B7280] text-sm text-center py-8">
            {search ? 'No products match your search.' : 'No products available.'}
          </p>
        ) : (
          <div className="space-y-4">
            {bespokeEnabled && filteredCustom.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-[#C4B5FD] mb-2">Custom dress</h2>
                <div className="grid grid-cols-2 gap-3">
                  {filteredCustom.map((item) => {
                    const totalStock = getTotalProductStock(item);
                    const blocked = isProductBlocked(item);
                    return (
                      <button
                        key={`custom-${item.id}`}
                        type="button"
                        onClick={() => handleProductGridClick(item)}
                        disabled={blocked}
                        className={`bg-[#1F2937] border border-[#7C3AED]/30 rounded-xl p-3 hover:border-[#7C3AED] transition-all text-left ${blocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        <div className="w-full h-20 bg-[#111827] rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                          <ProductImage src={item.imageUrl} alt={item.name} variant="thumb" deferUntilVisible />
                        </div>
                        <h3 className="font-medium text-sm text-[#F9FAFB] line-clamp-1 mb-1">{item.name}</h3>
                        <p className="text-xs text-[#9CA3AF] mb-1">{item.sku}</p>
                        <p className={`text-xs mb-2 ${stockLabelClassName(totalStock, gateAllowNegative)}`}>
                          {formatStockLabel(totalStock, gateAllowNegative)}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-[#3B82F6]">
                            Rs. {item.price.toLocaleString()}
                          </span>
                          <Plus className="w-4 h-4 text-[#10B981]" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div>
              <h2 className="text-sm font-medium text-[#9CA3AF] mb-2">
                {bespokeEnabled ? 'Stock / fabric products' : 'Available products'}
              </h2>
              <FabricProductGrid
                items={filteredStock}
                onSelect={handleProductGridClick}
                allowNegativeStock={negativeStockAllowed}
                settingsLoaded={settingsLoaded}
                relaxStock={relaxStockForAdd}
              />
            </div>
          </div>
        )}
      </div>

      {products.length === 0 && !search && !loading && (
        <div className="text-center py-12 px-4">
          <div className="w-16 h-16 bg-[#374151] rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-[#6B7280]" />
          </div>
          <p className="text-[#9CA3AF] mb-2">No items in cart</p>
          <p className="text-sm text-[#6B7280]">Search and add products to continue</p>
        </div>
      )}

      {products.length > 0 && (
        <MobileActionBar
          label="Subtotal"
          value={`Rs. ${subtotal.toLocaleString()}`}
          buttonLabel="Continue to Summary →"
          onButtonClick={onNext}
          variant="primary"
        />
      )}

      {/* Add to Cart Modal */}
      {showModal && selectedProduct && (
        <AddToCartModal
          product={selectedProduct}
          existingProduct={editingIndex !== null ? products[editingIndex] : null}
          allowNegativeStock={gateAllowNegative}
          onClose={() => {
            setShowModal(false);
            setSelectedProduct(null);
            setEditingIndex(null);
            setFabricAttachMode(false);
          }}
          onSave={handleSaveFromModal}
        />
      )}

      {customizeLine && companyId && (
        <SaleCustomizeModal
          companyId={companyId}
          branchId={branchId ?? null}
          parentLine={customizeLine}
          cartProducts={products}
          relaxStock={relaxStockForAdd}
          onClose={() => setCustomizeLine(null)}
          onApply={(next) => {
            setProducts(next);
            onProductsUpdate(next);
            setCustomizeLine(null);
          }}
        />
      )}
    </div>
  );
}

interface AddToCartModalProps {
  product: AvailableProduct;
  existingProduct: Product | null;
  allowNegativeStock: boolean;
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
  allowNegativeStock,
  onClose,
  onSave,
}: AddToCartModalProps) {
  const { enablePacking } = useSettings();
  const existingQty = existingProduct?.quantity || 1;
  const existingPacking = existingProduct?.packingDetails;
  const hasPackingMeters = (existingPacking?.total_meters ?? 0) > 0;
  const initialQty = hasPackingMeters ? (existingPacking!.total_meters ?? existingQty) : existingQty;
  const [quantityInput, setQuantityInput] = useState(String(initialQty));
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
  const allowDecimal = unitAllowsDecimal(product.unitAllowDecimal);
  const usePackingQty = !!(packingDetails && (packingDetails.total_meters ?? 0) > 0);
  const parsedQuantity = Number.parseFloat(quantityInput || '0');
  const quantity = Number.isFinite(parsedQuantity) ? parsedQuantity : 0;
  const effectiveSku = selectedVariation ? selectedVariation.sku : product.sku;
  const total = price * quantity;

  const handleQtyChange = (raw: string) => {
    if (raw === '') {
      setQuantityInput('');
      return;
    }
    const parsed = parseFloat(raw);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    if (!allowDecimal && parsed % 1 !== 0) return;
    setQuantityInput(raw);
  };

  const handleSave = () => {
    const qty = Number.parseFloat(quantityInput || '0');
    if (!Number.isFinite(qty) || qty <= 0 || price <= 0) return;
    const finalQty = allowDecimal ? qty : Math.round(qty);
    if (hasVariations && !selectedVariation) return;
    onSave({
      id: product.id,
      cartLineId: existingProduct?.cartLineId ?? newCartLineId(),
      name: product.name,
      sku: effectiveSku ?? product.sku,
      price,
      quantity: finalQty,
      total: price * finalQty,
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
                    const varBlocked = isVariationSaleBlocked(v.stock, allowNegativeStock);
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={varBlocked}
                        onClick={() => {
                          if (varBlocked) return;
                          setSelectedVariation(v);
                          setPrice(v.price || product.price);
                        }}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'border-[#3B82F6] bg-[#3B82F6]/10 text-white'
                            : varBlocked
                              ? 'border-[#374151] bg-[#111827] text-[#6B7280] opacity-60 cursor-not-allowed'
                              : 'border-[#374151] bg-[#111827] text-[#D1D5DB] hover:border-[#4B5563]'
                        }`}
                      >
                        <p className="text-sm font-medium truncate">{label || v.sku}</p>
                        <p className="text-xs text-[#9CA3AF] mt-0.5">Rs. {(v.price || 0).toLocaleString()}</p>
                        <p className={`text-xs mt-0.5 ${stockLabelClassName(v.stock ?? 0, allowNegativeStock)}`}>
                          {formatStockLabel(v.stock ?? 0, allowNegativeStock)}
                        </p>
                      </button>
                    );
                  })}
                </div>
                {!selectedVariation && (
                  <p className="text-xs text-[#F59E0B] mt-2">Please select a variation to continue</p>
                )}
              </div>
            )}

            {/* Packing Entry - Figma style. Gated by company setting enable_packing. */}
            {enablePacking && (
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
            )}

            {/* Quantity - shows total_meters when packing used, disabled when packing present */}
            <div>
              <label className="block text-sm font-medium text-[#9CA3AF] mb-3">
                Quantity {packingDetails && (packingDetails.total_meters ?? 0) > 0 ? '(M)' : allowDecimal ? '(decimals allowed)' : ''}
              </label>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    if (usePackingQty) return;
                    const current = Number.parseFloat(quantityInput || '0');
                    const step = allowDecimal ? 0.01 : 1;
                    const next = Math.max(allowDecimal ? 0.01 : 1, allowDecimal ? current - step : current - step);
                    setQuantityInput(
                      allowDecimal ? String(Number(next.toFixed(2))) : String(Math.round(next))
                    );
                  }}
                  disabled={usePackingQty}
                  className="w-12 h-12 bg-[#111827] border border-[#374151] rounded-lg flex items-center justify-center hover:bg-[#374151] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Minus className="w-5 h-5 text-[#F9FAFB]" />
                </button>
                <NumericInput
                  value={quantityInput}
                  onChange={(raw) => {
                    if (usePackingQty) return;
                    handleQtyChange(raw);
                  }}
                  allowDecimal={allowDecimal}
                  maxDecimals={4}
                  disabled={usePackingQty}
                  placeholder="0"
                  className="flex-1 min-w-0"
                  inputClassName="!h-12 !text-center !text-lg !font-semibold !bg-[#111827] !border-[#374151] !rounded-lg disabled:opacity-70"
                />
                <button
                  onClick={() => {
                    if (usePackingQty) return;
                    const current = Number.parseFloat(quantityInput || '0');
                    const step = allowDecimal ? 0.01 : 1;
                    const next = allowDecimal ? current + step : current + step;
                    setQuantityInput(
                      allowDecimal ? String(Number(next.toFixed(2))) : String(Math.round(next))
                    );
                  }}
                  disabled={usePackingQty}
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
                  inputMode="decimal"
                  pattern="[0-9.]*"
                  min="0"
                  value={price === 0 ? '' : price}
                  onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                  placeholder="0"
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
          if (m > 0) setQuantityInput(String(m));
          setShowPacking(false);
        }}
        initialData={packingDetails}
        productName={product.name}
      />
    </>
  );
}
