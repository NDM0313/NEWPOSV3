import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, CreditCard, Plus, Minus, Trash2, Search, User as UserIcon, Loader2, CheckCircle2, X } from 'lucide-react';
import type { User } from '../../types';
import * as productsApi from '../../api/products';
import * as salesApi from '../../api/sales';
import { addPending } from '../../lib/offlineStore';
import { supabase } from '../../lib/supabase';
import { balanceFromMovements } from '../../utils/stockBalance';
import { PaymentDialog, type PaymentResult } from '../sales/PaymentDialog';
import { BarcodeScanner } from '../../features/barcode';

interface POSModuleProps {
  onBack: () => void;
  user: User;
  companyId: string | null;
  branchId: string | null;
}

/** Product as shown in POS grid: base + optional variations with stock */
interface POSProduct {
  id: string;
  name: string;
  price: number;
  sku: string;
  stock: number;
  variations?: { id: string; sku: string; attributes: Record<string, string>; price: number; stock: number }[];
}

/** Cart line id = productId or productId_variationId for uniqueness */
interface CartItem {
  id: string;
  productId: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  total: number;
  variationId?: string;
  variationName?: string;
}

export function POSModule({ onBack, user, companyId, branchId }: POSModuleProps) {
  const [products, setProducts] = useState<POSProduct[]>([]);
  const [loading, setLoading] = useState(!!companyId);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [customer] = useState('Walk-in Customer');
  const [showCart, setShowCart] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [lastInvoiceNo, setLastInvoiceNo] = useState<string | null>(null);
  const [variationModalProduct, setVariationModalProduct] = useState<POSProduct | null>(null);
  const [showPaymentStep, setShowPaymentStep] = useState(false);
  const [scanMessage, setScanMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [scannerInput, setScannerInput] = useState(''); // keyboard wedge (Speed-X, Sunmi, CS60)

  useEffect(() => {
    if (!scanMessage) return;
    const t = setTimeout(() => setScanMessage(null), 3000);
    return () => clearTimeout(t);
  }, [scanMessage]);

  const loadProducts = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const { data, error } = await productsApi.getProducts(companyId);
    if (error) {
      setProducts([]);
      setLoading(false);
      return;
    }
    const mapped: POSProduct[] = (data || []).map((p) => ({
      id: p.id,
      name: p.name,
      price: p.retailPrice ?? 0,
      sku: p.sku ?? '—',
      stock: p.stock ?? 0,
      variations: p.variations?.length
        ? p.variations.map((v) => ({
            id: v.id,
            sku: v.sku,
            attributes: v.attributes ?? {},
            price: v.price ?? p.retailPrice ?? 0,
            stock: v.stock ?? 0,
          }))
        : undefined,
    }));
    setProducts(mapped);

    if (branchId && branchId !== 'all') {
      try {
        const { data: movements } = await supabase
          .from('stock_movements')
          .select('product_id, variation_id, quantity')
          .eq('company_id', companyId)
          .eq('branch_id', branchId);
        if (movements?.length) {
          const balanceByKey = balanceFromMovements(
            movements as { product_id: string; variation_id: string | null; quantity: number }[]
          );
          setProducts((prev) =>
            prev.map((p) => {
              if (p.variations?.length) {
                return {
                  ...p,
                  variations: p.variations.map((v) => ({
                    ...v,
                    stock: balanceByKey.get(`${p.id}_${v.id}`) ?? v.stock ?? 0,
                  })),
                };
              }
              return { ...p, stock: balanceByKey.get(p.id) ?? p.stock ?? 0 };
            })
          );
        }
      } catch (e) {
        console.warn('[POS] Branch stock overlay failed:', e);
      }
    }
    setLoading(false);
  }, [companyId, branchId]);

  useEffect(() => {
    if (!companyId) {
      setProducts([]);
      setLoading(false);
      return;
    }
    loadProducts();
  }, [companyId, loadProducts]);

  const list = products;
  const filtered = list.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const addToCart = (product: POSProduct, variation?: { id: string; sku: string; attributes: Record<string, string>; price: number; stock: number }) => {
    const cartId = variation ? `${product.id}_${variation.id}` : product.id;
    const price = variation ? variation.price : product.price;
    const variationName = variation
      ? Object.entries(variation.attributes || {})
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ') || variation.sku
      : undefined;
    const existing = cart.find((item) => item.id === cartId);
    if (existing) {
      setCart(
        cart.map((item) =>
          item.id === cartId
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * price }
            : item
        )
      );
    } else {
      setCart([
        ...cart,
        {
          id: cartId,
          productId: product.id,
          name: product.name,
          sku: variation ? variation.sku : product.sku,
          price,
          quantity: 1,
          total: price,
          variationId: variation?.id,
          variationName: variationName || undefined,
        },
      ]);
    }
    setVariationModalProduct(null);
  };

  const onProductClick = (product: POSProduct) => {
    if (product.variations && product.variations.length > 0) {
      setVariationModalProduct(product);
    } else {
      addToCart(product);
    }
  };

  const updateQty = (id: string, delta: number) => {
    setCart(
      cart
        .map((item) => {
          if (item.id !== id) return item;
          const newQty = Math.max(0, item.quantity + delta);
          if (newQty === 0) return null;
          return { ...item, quantity: newQty, total: newQty * item.price };
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const remove = (id: string) => setCart(cart.filter((item) => item.id !== id));

  /** Map API Product to POSProduct for cart. */
  const productToPOS = (p: productsApi.Product): POSProduct => ({
    id: p.id,
    name: p.name,
    price: p.retailPrice ?? 0,
    sku: p.sku ?? '—',
    stock: p.stock ?? 0,
    variations: p.variations?.length
      ? p.variations.map((v) => ({
          id: v.id,
          sku: v.sku,
          attributes: v.attributes ?? {},
          price: v.price ?? p.retailPrice ?? 0,
          stock: v.stock ?? 0,
        }))
      : undefined,
  });

  const handleBarcodeScanned = useCallback(
    async (code: string) => {
      if (!companyId) return;
      setScanMessage(null);
      const { data: product, error } = await productsApi.getProductByBarcodeOrSku(companyId, code, { branchId: branchId ?? undefined });
      if (error || !product) {
        setScanMessage({ type: 'error', text: 'Product not found' });
        return;
      }
      const posProduct = productToPOS(product);
      if (posProduct.variations && posProduct.variations.length > 0) {
        addToCart(posProduct, posProduct.variations[0]);
      } else {
        addToCart(posProduct);
      }
      setScanMessage({ type: 'success', text: `Added ${product.name}` });
      setScannerInput('');
    },
    [companyId]
  );

  const handleScannerInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const code = scannerInput.trim();
    if (code.length >= 1) handleBarcodeScanned(code);
  };

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const tax = 0;
  const total = subtotal;

  const openPaymentStep = () => {
    setCheckoutError(null);
    setShowCart(false);
    setShowPaymentStep(true);
  };

  /** Map PaymentDialog label to createSale paymentMethod (API accepts Cash, Bank, Card, etc.) */
  const mapPaymentMethodForApi = (label: string): string => {
    const s = (label || '').toLowerCase();
    if (s.includes('bank')) return 'Bank';
    if (s.includes('card')) return 'Card';
    if (s.includes('wallet')) return 'Mobile Wallet';
    if (s.includes('due') || s.includes('credit')) return 'Credit';
    return 'Cash';
  };

  const handlePaymentComplete = async (result: PaymentResult): Promise<void> => {
    if (cart.length === 0 || !companyId || !branchId || branchId === 'all' || !user?.id) {
      setCheckoutError('Select a specific branch.');
      return;
    }
    const paid = result.paidAmount ?? 0;
    const due = result.dueAmount ?? total - paid;
    if (paid > 0 && !result.accountId) {
      setCheckoutError('Please select a payment account for accounting.');
      return;
    }
    setCheckoutLoading(true);
    setCheckoutError(null);
    const items = cart.map((item) => ({
      productId: item.productId,
      variationId: item.variationId,
      productName: item.name,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: item.price,
      total: item.total,
    }));
    const salePayload = {
      companyId,
      branchId,
      customerId: null,
      customerName: 'Walk-in',
      items,
      subtotal,
      discountAmount: 0,
      taxAmount: 0,
      expenses: 0,
      total,
      paymentMethod: mapPaymentMethodForApi(result.paymentMethod),
      paidAmount: paid,
      dueAmount: due,
      paymentAccountId: result.accountId ?? null,
      isStudio: false,
      userId: user.id,
    };

    if (!navigator.onLine) {
      try {
        await addPending('sale', salePayload, companyId, branchId);
        setLastInvoiceNo('Pending sync');
        setCart([]);
        setShowPaymentStep(false);
      } catch (e) {
        setCheckoutError(e instanceof Error ? e.message : 'Failed to save offline.');
      }
      setCheckoutLoading(false);
      return;
    }

    const { data, error } = await salesApi.createSale(salePayload);
    setCheckoutLoading(false);
    if (error) {
      setCheckoutError(error);
      return;
    }
    setLastInvoiceNo(data?.invoiceNo ?? null);
    setCart([]);
    setShowPaymentStep(false);
  };

  return (
    <div className="min-h-screen bg-[#111827] pb-28">
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 bg-[#10B981] rounded-lg flex items-center justify-center">
              <CreditCard size={18} className="text-white" />
            </div>
            <h1 className="text-white font-semibold text-base">Point of Sale</h1>
          </div>
        </div>
      </div>

      <div className="p-4">
        {lastInvoiceNo && (
          <div className={`mb-4 flex items-center gap-3 rounded-xl p-3 ${lastInvoiceNo === 'Pending sync' ? 'bg-amber-500/20 border border-amber-500/50' : 'bg-[#10B981]/20 border border-[#10B981]/50'}`}>
            <CheckCircle2 className={`w-6 h-6 flex-shrink-0 ${lastInvoiceNo === 'Pending sync' ? 'text-amber-400' : 'text-[#10B981]'}`} />
            <div>
              <p className={`font-medium ${lastInvoiceNo === 'Pending sync' ? 'text-amber-400' : 'text-[#10B981]'}`}>
                {lastInvoiceNo === 'Pending sync' ? 'Queued for sync' : 'Sale complete'}
              </p>
              <p className="text-sm text-[#9CA3AF]">{lastInvoiceNo === 'Pending sync' ? 'Will upload when online' : `Invoice ${lastInvoiceNo}`}</p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm text-[#9CA3AF] mb-4">
          <UserIcon size={16} />
          <span>Customer:</span>
          <span className="text-white font-medium">{customer}</span>
        </div>

        {scanMessage && (
          <div
            className={`mb-4 rounded-lg px-4 py-2 text-sm ${
              scanMessage.type === 'success' ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#EF4444]/20 text-[#EF4444]'
            }`}
          >
            {scanMessage.text}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#10B981] animate-spin" />
          </div>
        ) : (
        <>
        <div className="space-y-2 mb-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg pl-10 pr-4 text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
              />
            </div>
            <BarcodeScanner onScan={handleBarcodeScanned} buttonLabel="Scan" checkOnMount={true} />
          </div>
          {/* Keyboard wedge: hardware scanners (Speed-X, Sunmi, CS60) inject barcode + Enter here */}
          <input
            type="text"
            value={scannerInput}
            onChange={(e) => setScannerInput(e.target.value)}
            onKeyDown={handleScannerInputKeyDown}
            placeholder="Or scan barcode here (Speed-X, Sunmi, CS60)..."
            className="w-full h-11 bg-[#1F2937] border border-[#374151] rounded-lg px-4 text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
            autoComplete="off"
          />
          {scanMessage && (
            <div
              className={`px-3 py-2 rounded-lg text-sm ${
                scanMessage.type === 'success' ? 'bg-[#064E3B] text-[#6EE7B7]' : 'bg-[#7F1D1D] text-[#FCA5A5]'
              }`}
            >
              {scanMessage.text}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {filtered.map((product) => {
            const hasVariations = product.variations && product.variations.length > 0;
            const totalStock = hasVariations
              ? (product.variations?.reduce((s, v) => s + (v.stock ?? 0), 0) ?? 0)
              : (product.stock ?? 0);
            const outOfStock = totalStock <= 0;
            return (
              <button
                key={product.id}
                onClick={() => !outOfStock && onProductClick(product)}
                disabled={outOfStock}
                className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#3B82F6] active:scale-95 transition-all text-left disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <div className="w-full h-20 bg-[#111827] rounded-lg mb-3 flex items-center justify-center text-3xl">
                  📦
                </div>
                <h3 className="text-white font-medium text-sm mb-1 line-clamp-2">{product.name}</h3>
                <p className="text-[#6B7280] text-xs mb-2">{product.sku}</p>
                <p className="text-[#10B981] font-semibold">Rs. {product.price.toLocaleString()}</p>
                {outOfStock ? (
                  <p className="text-xs text-[#EF4444] mt-1">Out of stock</p>
                ) : hasVariations ? (
                  <p className="text-xs text-[#9CA3AF] mt-1">Stock: {totalStock} (options)</p>
                ) : (
                  <p className="text-xs text-[#9CA3AF] mt-1">Stock: {totalStock}</p>
                )}
              </button>
            );
          })}
        </div>
        </>
        )}
      </div>

      {/* Sticky cart bar */}
      <div className="fixed left-0 right-0 bg-[#1F2937] border-t border-[#374151] p-4 safe-area-bottom z-30 fixed-bottom-above-nav">
        <button
          onClick={() => cart.length > 0 && setShowCart(true)}
          className="w-full flex items-center justify-between rounded-xl bg-[#111827] border border-[#374151] p-4 text-left"
        >
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#10B981]" />
            <span className="text-white font-medium">
              Cart · {cart.length} {cart.length === 1 ? 'item' : 'items'}
            </span>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-[#10B981]">Rs. {total.toLocaleString()}</p>
          </div>
        </button>
        <button
          onClick={() => cart.length > 0 && setShowCart(true)}
          disabled={cart.length === 0}
          className="mt-3 w-full h-12 bg-[#10B981] hover:bg-[#059669] disabled:bg-[#374151] disabled:text-[#6B7280] text-white rounded-lg font-semibold transition-colors"
        >
          Checkout
        </button>
      </div>

      {/* Cart drawer */}
      {showCart && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setShowCart(false)} aria-hidden />
          <div className="fixed inset-x-0 bottom-0 bg-[#1F2937] rounded-t-2xl z-50 max-h-[80vh] overflow-hidden flex flex-col animate-slide-up">
            <div className="p-4 border-b border-[#374151] flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Cart</h2>
              <button onClick={() => setShowCart(false)} className="p-2 hover:bg-[#374151] rounded-lg text-white">
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <p className="text-[#6B7280] text-center py-8">Cart is empty</p>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="bg-[#111827] rounded-lg p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="text-white font-medium text-sm">{item.name}</h4>
                        {item.variationName ? (
                          <p className="text-[#A78BFA] text-xs mt-0.5">{item.variationName}</p>
                        ) : null}
                        <p className="text-[#6B7280] text-xs">Rs. {item.price.toLocaleString()} each</p>
                      </div>
                      <button onClick={() => remove(item.id)} className="p-1 text-[#EF4444] hover:bg-[#1F2937] rounded">
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQty(item.id, -1)}
                          className="w-8 h-8 bg-[#374151] rounded flex items-center justify-center text-white hover:bg-[#4B5563]"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-10 text-center text-white font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQty(item.id, 1)}
                          className="w-8 h-8 bg-[#374151] rounded flex items-center justify-center text-white hover:bg-[#4B5563]"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <span className="text-white font-semibold">Rs. {item.total.toLocaleString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            {cart.length > 0 && (
              <div className="p-4 border-t border-[#374151] space-y-2">
                {checkoutError && (
                  <div className="p-3 bg-[#EF4444]/20 border border-[#EF4444] rounded-lg text-[#FCA5A5] text-sm">{checkoutError}</div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-[#9CA3AF]">Subtotal</span>
                  <span className="text-white">Rs. {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-lg font-semibold pt-2 border-t border-[#374151]">
                  <span className="text-white">Total</span>
                  <span className="text-[#10B981]">Rs. {total.toLocaleString()}</span>
                </div>
                <button
                  onClick={openPaymentStep}
                  className="w-full h-12 bg-[#10B981] hover:bg-[#059669] text-white rounded-lg font-semibold mt-2"
                >
                  Proceed to Payment
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Payment: same flow as Sales — PaymentDialog (method → account → amount → post) */}
      {showPaymentStep && (
        <div className="fixed inset-0 z-[60] bg-[#111827]">
          <PaymentDialog
            onBack={() => { setShowPaymentStep(false); setShowCart(true); }}
            totalAmount={total}
            companyId={companyId}
            onComplete={handlePaymentComplete}
            saving={checkoutLoading}
            saveError={checkoutError}
          />
        </div>
      )}

      {/* Variation selection modal */}
      {variationModalProduct && (
        <>
          <div className="fixed inset-0 bg-black/60 z-[60]" onClick={() => setVariationModalProduct(null)} aria-hidden />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 bg-[#1F2937] border border-[#374151] rounded-2xl z-[70] max-h-[70vh] overflow-hidden flex flex-col shadow-xl">
            <div className="p-4 border-b border-[#374151] flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Select variation</h2>
              <button onClick={() => setVariationModalProduct(null)} className="p-2 hover:bg-[#374151] rounded-lg text-white">
                <X size={20} />
              </button>
            </div>
            <p className="px-4 pt-2 text-[#9CA3AF] text-sm">{variationModalProduct.name}</p>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {variationModalProduct.variations?.map((v) => {
                const outOfStock = (v.stock ?? 0) <= 0;
                const label = Object.keys(v.attributes || {}).length
                  ? Object.entries(v.attributes).map(([k, val]) => `${k}: ${val}`).join(', ')
                  : v.sku;
                return (
                  <button
                    key={v.id}
                    onClick={() => !outOfStock && addToCart(variationModalProduct, v)}
                    disabled={outOfStock}
                    className="w-full text-left bg-[#111827] border border-[#374151] rounded-xl p-3 hover:border-[#3B82F6] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-white font-medium text-sm">{label}</span>
                      <span className="text-[#10B981] font-semibold">Rs. {v.price.toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-[#9CA3AF] mt-1">
                      {outOfStock ? 'Out of stock' : `Stock: ${v.stock ?? 0}`}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
