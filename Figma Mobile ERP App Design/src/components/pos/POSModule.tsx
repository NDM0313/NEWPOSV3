import { useState } from 'react';
import { ArrowLeft, CreditCard, Plus, Minus, Trash2, Search, User as UserIcon } from 'lucide-react';
import { User } from '../../App';

interface POSModuleProps {
  onBack: () => void;
  user: User;
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

export function POSModule({ onBack, user }: POSModuleProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [customer, setCustomer] = useState<string>('Walk-in Customer');

  // Mock products
  const products: POSProduct[] = [
    { id: '1', name: 'Bridal Lehenga', price: 15000, sku: 'BRD-001' },
    { id: '2', name: 'Dupatta Gold', price: 5000, sku: 'DUP-002' },
    { id: '3', name: 'Jewelry Set', price: 12000, sku: 'JWL-004' },
    { id: '4', name: 'Bridal Shoes', price: 4500, sku: 'SHO-005' },
    { id: '5', name: 'Silk Fabric', price: 1200, sku: 'FAB-003' },
  ];

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const addToCart = (product: POSProduct) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
          : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: 1, total: product.price }]);
    }
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty, total: newQty * item.price };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const tax = subtotal * 0.16; // 16% GST
  const total = subtotal + tax;

  const handleCheckout = () => {
    if (cart.length === 0) {
      alert('Cart is empty!');
      return;
    }
    alert(`Total: Rs. ${total.toLocaleString()}\n\nPayment processing...`);
    // Clear cart after checkout
    setCart([]);
  };

  return (
    <div className="min-h-screen pb-0 bg-[#111827]">
      {/* Header */}
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 bg-[#10B981] rounded-lg flex items-center justify-center">
              <CreditCard size={18} className="text-white" />
            </div>
            <h1 className="text-white font-semibold text-base">Point of Sale</h1>
          </div>
          <button className="text-xs text-[#3B82F6]">{user.name}</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 h-[calc(100vh-56px)]">
        {/* Left: Products */}
        <div className="overflow-y-auto p-4">
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg pl-10 pr-4 text-sm text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
            />
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-2 gap-3">
            {filteredProducts.map(product => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#3B82F6] active:scale-95 transition-all text-left"
              >
                <div className="w-full h-24 bg-[#111827] rounded-lg mb-3 flex items-center justify-center">
                  <div className="text-4xl">📦</div>
                </div>
                <h3 className="text-white font-medium text-sm mb-1">{product.name}</h3>
                <p className="text-[#6B7280] text-xs mb-2">{product.sku}</p>
                <p className="text-[#10B981] font-semibold">Rs. {product.price.toLocaleString()}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Cart & Checkout */}
        <div className="bg-[#1F2937] border-l border-[#374151] flex flex-col">
          {/* Customer */}
          <div className="p-4 border-b border-[#374151]">
            <div className="flex items-center gap-2 text-sm">
              <UserIcon size={16} className="text-[#6B7280]" />
              <span className="text-[#9CA3AF]">Customer:</span>
              <span className="text-white font-medium">{customer}</span>
            </div>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-4">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-[#6B7280]">
                <CreditCard size={48} className="mb-4" />
                <p>Cart is empty</p>
                <p className="text-xs mt-2">Add products to start billing</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map(item => (
                  <div key={item.id} className="bg-[#111827] rounded-lg p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="text-white font-medium text-sm">{item.name}</h4>
                        <p className="text-[#6B7280] text-xs">Rs. {item.price.toLocaleString()} each</p>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="p-1 text-[#EF4444] hover:bg-[#1F2937] rounded"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-8 h-8 bg-[#1F2937] rounded flex items-center justify-center hover:bg-[#374151]"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-12 text-center text-white font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-8 h-8 bg-[#1F2937] rounded flex items-center justify-center hover:bg-[#374151]"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <span className="text-white font-semibold">Rs. {item.total.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Checkout Section */}
          <div className="p-4 border-t border-[#374151] space-y-3">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Subtotal</span>
                <span className="text-white">Rs. {subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Tax (16%)</span>
                <span className="text-white">Rs. {tax.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-lg font-semibold pt-2 border-t border-[#374151]">
                <span className="text-white">Total</span>
                <span className="text-[#10B981]">Rs. {total.toLocaleString()}</span>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              disabled={cart.length === 0}
              className="w-full h-12 bg-[#10B981] hover:bg-[#059669] disabled:bg-[#374151] disabled:text-[#6B7280] text-white rounded-lg font-semibold transition-colors"
            >
              Checkout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
