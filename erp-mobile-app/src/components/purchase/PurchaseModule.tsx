import { useState } from 'react';
import { ArrowLeft, ShoppingBag, Plus, Minus, Trash2, Search } from 'lucide-react';
import type { User } from '../../types';

interface PurchaseModuleProps {
  onBack: () => void;
  user: User;
}

interface PurchaseItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Vendor {
  id: string;
  name: string;
  phone: string;
}

const VENDORS: Vendor[] = [
  { id: '1', name: 'ABC Textiles', phone: '+92 300 1111111' },
  { id: '2', name: 'XYZ Suppliers', phone: '+92 321 2222222' },
  { id: '3', name: 'Premium Fabrics Ltd', phone: '+92 333 3333333' },
];

const PRODUCTS_FOR_PURCHASE = [
  { id: '1', name: 'Cotton Fabric - White', defaultPrice: 500 },
  { id: '2', name: 'Silk Fabric - Red', defaultPrice: 1200 },
  { id: '3', name: 'Thread - Black', defaultPrice: 50 },
  { id: '4', name: 'Buttons - Pearl', defaultPrice: 25 },
  { id: '5', name: 'Zippers', defaultPrice: 80 },
];

export function PurchaseModule({ onBack, user: _user }: PurchaseModuleProps) {
  const [view, setView] = useState<'list' | 'create'>('list');
  const [orders, setOrders] = useState<{ id: string; vendor: string; total: number; date: string }[]>([
    { id: 'PO-001', vendor: 'ABC Textiles', total: 60000, date: '2026-01-15' },
    { id: 'PO-002', vendor: 'XYZ Suppliers', total: 14000, date: '2026-01-12' },
  ]);

  if (view === 'create') {
    return (
      <CreatePurchaseFlow
        onBack={() => setView('list')}
        onDone={(vendorName, total) => {
          setOrders([{ id: `PO-${Date.now().toString().slice(-4)}`, vendor: vendorName, total, date: new Date().toISOString().slice(0, 10) }, ...orders]);
          setView('list');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 bg-[#10B981] rounded-lg flex items-center justify-center">
              <ShoppingBag size={18} className="text-white" />
            </div>
            <h1 className="text-white font-semibold text-base">Purchases</h1>
          </div>
          <button onClick={() => setView('create')} className="p-2 bg-[#10B981] hover:bg-[#059669] rounded-lg text-white">
            <Plus size={20} />
          </button>
        </div>
      </div>
      <div className="p-4 space-y-3">
        {orders.map((o) => (
          <div key={o.id} className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium text-white">{o.id}</p>
                <p className="text-sm text-[#9CA3AF]">{o.vendor}</p>
                <p className="text-xs text-[#6B7280]">{o.date}</p>
              </div>
              <p className="text-[#10B981] font-semibold">Rs. {o.total.toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreatePurchaseFlow({ onBack, onDone }: { onBack: () => void; onDone: (vendorName: string, total: number) => void }) {
  const [step, setStep] = useState<'vendor' | 'items' | 'summary'>('vendor');
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [search, setSearch] = useState('');

  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const filteredProducts = PRODUCTS_FOR_PURCHASE.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  const addItem = (product: (typeof PRODUCTS_FOR_PURCHASE)[0], qty: number, unitPrice?: number) => {
    const price = unitPrice ?? product.defaultPrice;
    const total = qty * price;
    const existing = items.find((i) => i.id === product.id);
    if (existing) {
      setItems(items.map((i) => (i.id === product.id ? { ...i, quantity: i.quantity + qty, total: (i.quantity + qty) * i.unitPrice } : i)));
    } else {
      setItems([...items, { id: product.id, name: product.name, quantity: qty, unitPrice: price, total }]);
    }
  };

  const updateQty = (id: string, delta: number) => {
    setItems(
      items
        .map((i) => {
          if (i.id !== id) return i;
          const newQty = Math.max(0, i.quantity + delta);
          if (newQty === 0) return null;
          return { ...i, quantity: newQty, total: newQty * i.unitPrice };
        })
        .filter(Boolean) as PurchaseItem[]
    );
  };

  const removeItem = (id: string) => setItems(items.filter((i) => i.id !== id));

  if (step === 'vendor') {
    return (
      <div className="min-h-screen bg-[#111827] p-4 pb-24">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-white">Select Vendor</h1>
        </div>
        <div className="space-y-2">
          {VENDORS.map((v) => (
            <button key={v.id} onClick={() => { setVendor(v); setStep('items'); }} className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#10B981] text-left">
              <p className="font-medium text-white">{v.name}</p>
              <p className="text-sm text-[#9CA3AF]">{v.phone}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (step === 'items' && vendor) {
    return (
      <div className="min-h-screen bg-[#111827] pb-32">
        <div className="bg-[#1F2937] border-b border-[#374151] px-4 py-3 sticky top-0 z-10">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => setStep('vendor')} className="p-2 hover:bg-[#374151] rounded-lg text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold text-white">Add Items</h1>
          </div>
          <p className="text-sm text-[#9CA3AF]">{vendor.name}</p>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="w-full h-11 bg-[#111827] border border-[#374151] rounded-lg pl-10 pr-4 text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#10B981]" />
          </div>
        </div>
        <div className="p-4 space-y-4">
          <h2 className="text-sm font-medium text-[#9CA3AF]">Add from list</h2>
          {filteredProducts.map((prod) => (
            <div key={prod.id} className="flex items-center justify-between bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <div>
                <p className="font-medium text-white">{prod.name}</p>
                <p className="text-sm text-[#10B981]">Rs. {prod.defaultPrice.toLocaleString()}</p>
              </div>
              <button onClick={() => addItem(prod, 1)} className="w-10 h-10 rounded-lg bg-[#10B981] flex items-center justify-center text-white">
                <Plus className="w-5 h-5" />
              </button>
            </div>
          ))}
          <h2 className="text-sm font-medium text-[#9CA3AF] pt-4">Order items ({items.length})</h2>
          {items.map((i) => (
            <div key={i.id} className="flex items-center justify-between bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <div>
                <p className="font-medium text-white">{i.name}</p>
                <p className="text-sm text-[#9CA3AF]">{i.quantity} × Rs. {i.unitPrice.toLocaleString()} = Rs. {i.total.toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => updateQty(i.id, -1)} className="p-2 hover:bg-[#374151] rounded-lg text-white"><Minus className="w-4 h-4" /></button>
                <span className="text-white font-medium w-8 text-center">{i.quantity}</span>
                <button onClick={() => updateQty(i.id, 1)} className="p-2 hover:bg-[#374151] rounded-lg text-white"><Plus className="w-4 h-4" /></button>
                <button onClick={() => removeItem(i.id)} className="p-2 text-[#EF4444] hover:bg-[#EF4444]/20 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
        <div className="fixed bottom-0 left-0 right-0 bg-[#1F2937] border-t border-[#374151] p-4 safe-area-bottom">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[#9CA3AF]">Subtotal</span>
            <span className="text-xl font-bold text-[#10B981]">Rs. {subtotal.toLocaleString()}</span>
          </div>
          <button onClick={() => setStep('summary')} disabled={items.length === 0} className="w-full h-12 bg-[#10B981] hover:bg-[#059669] disabled:bg-[#374151] disabled:text-[#6B7280] rounded-lg font-medium text-white">
            Next: Summary →
          </button>
        </div>
      </div>
    );
  }

  if (step === 'summary' && vendor) {
    return (
      <div className="min-h-screen bg-[#111827] pb-32">
        <div className="bg-[#1F2937] border-b border-[#374151] px-4 py-3 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <button onClick={() => setStep('items')} className="p-2 hover:bg-[#374151] rounded-lg text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold text-white">Summary</h1>
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
              <div key={i.id} className="flex justify-between text-sm py-2 border-b border-[#374151] last:border-0">
                <span className="text-white">{i.name} × {i.quantity}</span>
                <span className="text-white">Rs. {i.total.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-lg font-bold pt-2">
            <span className="text-white">Total</span>
            <span className="text-[#10B981]">Rs. {subtotal.toLocaleString()}</span>
          </div>
        </div>
        <div className="fixed bottom-0 left-0 right-0 bg-[#1F2937] border-t border-[#374151] p-4 safe-area-bottom">
          <button onClick={() => onDone(vendor.name, subtotal)} className="w-full h-12 bg-[#10B981] hover:bg-[#059669] rounded-lg font-medium text-white">
            Save Purchase Order
          </button>
        </div>
      </div>
    );
  }

  return null;
}
