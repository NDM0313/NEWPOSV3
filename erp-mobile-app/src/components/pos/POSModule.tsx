import { useState, useEffect } from 'react';
import { ArrowLeft, CreditCard, Plus, Minus, Trash2, Search, User as UserIcon, Loader2, CheckCircle2 } from 'lucide-react';
import type { User } from '../../types';
import * as productsApi from '../../api/products';
import * as salesApi from '../../api/sales';

interface POSModuleProps {
  onBack: () => void;
  user: User;
  companyId: string | null;
  branchId: string | null;
}

interface POSProduct {
  id: string;
  name: string;
  price: number;
  sku: string;
}

interface CartItem extends POSProduct {
  quantity: number;
  total: number;
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

  useEffect(() => {
    if (!companyId) {
      setProducts([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    productsApi.getProducts(companyId).then(({ data, error }) => {
      if (cancelled) return;
      setLoading(false);
      setProducts(error ? [] : data.map((p) => ({ id: p.id, name: p.name, price: p.retailPrice, sku: p.sku })));
    });
    return () => { cancelled = true; };
  }, [companyId]);

  const list = products;
  const filtered = list.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const addToCart = (product: POSProduct) => {
    const existing = cart.find((item) => item.id === product.id);
    if (existing) {
      setCart(
        cart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
            : item
        )
      );
    } else {
      setCart([...cart, { ...product, quantity: 1, total: product.price }]);
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

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const tax = Math.round(subtotal * 0.16);
  const total = subtotal + tax;

  const handleCheckout = async (): Promise<boolean> => {
    if (cart.length === 0) return false;
    if (!companyId || !branchId || branchId === 'all' || !user?.id) {
      setCheckoutError('Select a specific branch to checkout.');
      return false;
    }
    setCheckoutLoading(true);
    setCheckoutError(null);
    const items = cart.map((item) => ({
      productId: item.id,
      productName: item.name,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: item.price,
      total: item.total,
    }));
    const { data, error } = await salesApi.createSale({
      companyId,
      branchId,
      customerId: null,
      customerName: 'Walk-in',
      items,
      subtotal,
      discountAmount: 0,
      taxAmount: tax,
      expenses: 0,
      total,
      paymentMethod: 'Cash',
      isStudio: false,
      userId: user.id,
    });
    setCheckoutLoading(false);
    if (error) {
      setCheckoutError(error);
      return false;
    }
    setLastInvoiceNo(data?.invoiceNo ?? null);
    setCart([]);
    setShowCart(false);
    return true;
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
          <div className="mb-4 flex items-center gap-3 bg-[#10B981]/20 border border-[#10B981]/50 rounded-xl p-3">
            <CheckCircle2 className="w-6 h-6 text-[#10B981] flex-shrink-0" />
            <div>
              <p className="font-medium text-[#10B981]">Sale complete</p>
              <p className="text-sm text-[#9CA3AF]">Invoice {lastInvoiceNo}</p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm text-[#9CA3AF] mb-4">
          <UserIcon size={16} />
          <span>Customer:</span>
          <span className="text-white font-medium">{customer}</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#10B981] animate-spin" />
          </div>
        ) : (
        <>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products..."
            className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg pl-10 pr-4 text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {filtered.map((product) => (
            <button
              key={product.id}
              onClick={() => addToCart(product)}
              className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#3B82F6] active:scale-95 transition-all text-left"
            >
              <div className="w-full h-20 bg-[#111827] rounded-lg mb-3 flex items-center justify-center text-3xl">
                📦
              </div>
              <h3 className="text-white font-medium text-sm mb-1 line-clamp-2">{product.name}</h3>
              <p className="text-[#6B7280] text-xs mb-2">{product.sku}</p>
              <p className="text-[#10B981] font-semibold">Rs. {product.price.toLocaleString()}</p>
            </button>
          ))}
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
            <p className="text-xs text-[#9CA3AF]">incl. tax</p>
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
                <div className="flex justify-between text-sm">
                  <span className="text-[#9CA3AF]">Tax (16%)</span>
                  <span className="text-white">Rs. {tax.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-lg font-semibold pt-2 border-t border-[#374151]">
                  <span className="text-white">Total</span>
                  <span className="text-[#10B981]">Rs. {total.toLocaleString()}</span>
                </div>
                <button
                  onClick={async () => { await handleCheckout(); }}
                  disabled={checkoutLoading}
                  className="w-full h-12 bg-[#10B981] hover:bg-[#059669] disabled:opacity-50 text-white rounded-lg font-semibold mt-2 flex items-center justify-center gap-2"
                >
                  {checkoutLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                  {checkoutLoading ? 'Processing...' : 'Complete Checkout'}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
