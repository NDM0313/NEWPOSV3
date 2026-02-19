import { useState, useEffect } from 'react';
import { ArrowLeft, Search, Plus, Minus, Trash2, Loader2 } from 'lucide-react';
import type { Customer, Product } from './SalesModule';
import * as productsApi from '../../api/products';

interface AddProductsProps {
  companyId: string | null;
  onBack: () => void;
  customer: Customer;
  initialProducts: Product[];
  onProductsUpdate: (products: Product[]) => void;
  onNext: () => void;
}

const FALLBACK_AVAILABLE: { id: string; name: string; price: number }[] = [
  { id: 'p1', name: 'Bridal Dress - Red', price: 15000 },
  { id: 'p2', name: 'Silk Dupatta', price: 5000 },
  { id: 'p3', name: 'Fabric - Silk (Meter)', price: 1200 },
  { id: 'p4', name: 'Wedding Gown - White', price: 25000 },
  { id: 'p5', name: 'Lace Border (Yard)', price: 800 },
];

function toProduct(item: { id: string; name: string; price: number }, qty: number): Product {
  return {
    id: item.id,
    name: item.name,
    price: item.price,
    quantity: qty,
    total: item.price * qty,
  };
}

export function AddProducts({ companyId, onBack, customer, initialProducts, onProductsUpdate, onNext }: AddProductsProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [available, setAvailable] = useState<{ id: string; name: string; price: number }[]>([]);
  const [loading, setLoading] = useState(!!companyId);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!companyId) {
      setAvailable(FALLBACK_AVAILABLE);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    productsApi.getProducts(companyId).then(({ data, error }) => {
      if (cancelled) return;
      setLoading(false);
      if (error || !data.length) setAvailable(FALLBACK_AVAILABLE);
      else setAvailable(data.map((p) => ({ id: p.id, name: p.name, price: p.retailPrice })));
    });
    return () => { cancelled = true; };
  }, [companyId]);

  const list = available.length ? available : FALLBACK_AVAILABLE;
  const subtotal = products.reduce((sum, p) => sum + p.total, 0);
  const filtered = list.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()));

  const addOrUpdate = (item: { id: string; name: string; price: number }, qty: number) => {
    if (qty <= 0) return;
    const existing = products.find((p) => p.id === item.id);
    let next: Product[];
    if (existing) {
      const newQty = existing.quantity + qty;
      next = products.map((p) => (p.id === item.id ? toProduct(item, newQty) : p));
    } else {
      next = [...products, toProduct(item, qty)];
    }
    setProducts(next);
    onProductsUpdate(next);
  };

  const updateQty = (index: number, delta: number) => {
    const p = products[index];
    const newQty = Math.max(0, p.quantity + delta);
    let next: Product[];
    if (newQty === 0) next = products.filter((_, i) => i !== index);
    else next = products.map((pr, i) => (i === index ? { ...pr, quantity: newQty, total: pr.price * newQty } : pr));
    setProducts(next);
    onProductsUpdate(next);
  };

  const remove = (index: number) => {
    const next = products.filter((_, i) => i !== index);
    setProducts(next);
    onProductsUpdate(next);
  };

  return (
    <div className="min-h-screen bg-[#111827] pb-32">
      <div className="bg-[#1F2937] border-b border-[#374151] px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-2">
          <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-white">Add Products</h1>
        </div>
        <p className="text-sm text-[#9CA3AF]">{customer.name}</p>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            className="w-full h-11 bg-[#111827] border border-[#374151] rounded-lg pl-11 pr-4 text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
          />
        </div>
      </div>

      <div className="p-4 space-y-4">
        <h2 className="text-sm font-medium text-[#9CA3AF]">ADD ITEMS</h2>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between bg-[#1F2937] border border-[#374151] rounded-xl p-4"
              >
                <div>
                  <p className="font-medium text-white">{item.name}</p>
                  <p className="text-sm text-[#10B981]">Rs. {item.price.toLocaleString()}</p>
                </div>
                <button
                  onClick={() => addOrUpdate(item, 1)}
                  className="w-10 h-10 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] flex items-center justify-center text-white"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <h2 className="text-sm font-medium text-[#9CA3AF] pt-4">CART ({products.length})</h2>
        {products.length === 0 ? (
          <p className="text-[#6B7280] text-sm">No items added. Tap + on a product above.</p>
        ) : (
          <div className="space-y-2">
            {products.map((p, i) => (
              <div
                key={`${p.id}-${i}`}
                className="flex items-center justify-between bg-[#1F2937] border border-[#374151] rounded-xl p-4"
              >
                <div>
                  <p className="font-medium text-white">{p.name}</p>
                  <p className="text-sm text-[#9CA3AF]">{p.quantity} × Rs. {p.price.toLocaleString()} = Rs. {p.total.toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQty(i, -1)} className="p-2 hover:bg-[#374151] rounded-lg text-white">
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-white font-medium w-8 text-center">{p.quantity}</span>
                  <button onClick={() => updateQty(i, 1)} className="p-2 hover:bg-[#374151] rounded-lg text-white">
                    <Plus className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(i)} className="p-2 hover:bg-[#EF4444]/20 rounded-lg text-[#EF4444]">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-4 border-t border-[#374151] flex justify-between items-center">
          <span className="text-[#9CA3AF]">Subtotal</span>
          <span className="text-xl font-bold text-[#10B981]">Rs. {subtotal.toLocaleString()}</span>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-[#1F2937] border-t border-[#374151] p-4 safe-area-bottom">
        <button
          onClick={onNext}
          disabled={products.length === 0}
          className="w-full h-12 bg-[#3B82F6] hover:bg-[#2563EB] disabled:bg-[#374151] disabled:text-[#6B7280] rounded-lg font-medium text-white transition-colors"
        >
          Next: Summary →
        </button>
      </div>
    </div>
  );
}
