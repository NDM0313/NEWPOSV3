import React, { useState } from 'react';
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  CreditCard, 
  Banknote, 
  X, 
  ArrowLeft,
  User,
  Receipt,
  Zap,
  Coffee,
  UtensilsCrossed,
  Cookie,
  Wine
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigation } from '../../context/NavigationContext';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { cn } from "../ui/utils";

const categories = [
  { id: "All", label: "All Items", icon: Zap },
  { id: "Coffee", label: "Coffee", icon: Coffee },
  { id: "Bakery", label: "Bakery", icon: Cookie },
  { id: "Food", label: "Food", icon: UtensilsCrossed },
  { id: "Drinks", label: "Drinks", icon: Wine },
];

const products = [
  { id: 1, name: 'Espresso', retailPrice: 3.50, wholesalePrice: 2.80, category: 'Coffee', color: 'from-orange-600/20 to-orange-900/20', stock: 45 },
  { id: 2, name: 'Cappuccino', retailPrice: 4.50, wholesalePrice: 3.60, category: 'Coffee', color: 'from-amber-600/20 to-amber-900/20', stock: 32 },
  { id: 3, name: 'Latte', retailPrice: 4.75, wholesalePrice: 3.80, category: 'Coffee', color: 'from-yellow-600/20 to-yellow-900/20', stock: 28 },
  { id: 4, name: 'Mocha', retailPrice: 5.00, wholesalePrice: 4.00, category: 'Coffee', color: 'from-yellow-700/20 to-orange-900/20', stock: 18 },
  { id: 5, name: 'Americano', retailPrice: 3.00, wholesalePrice: 2.40, category: 'Coffee', color: 'from-stone-600/20 to-stone-900/20', stock: 50 },
  { id: 6, name: 'Croissant', retailPrice: 3.25, wholesalePrice: 2.50, category: 'Bakery', color: 'from-yellow-500/20 to-yellow-700/20', stock: 22 },
  { id: 7, name: 'Muffin', retailPrice: 2.75, wholesalePrice: 2.20, category: 'Bakery', color: 'from-pink-600/20 to-pink-900/20', stock: 15 },
  { id: 8, name: 'Bagel', retailPrice: 2.50, wholesalePrice: 2.00, category: 'Bakery', color: 'from-orange-500/20 to-orange-700/20', stock: 30 },
  { id: 9, name: 'Sandwich', retailPrice: 8.50, wholesalePrice: 6.80, category: 'Food', color: 'from-green-600/20 to-green-900/20', stock: 12 },
  { id: 10, name: 'Salad', retailPrice: 9.00, wholesalePrice: 7.20, category: 'Food', color: 'from-emerald-600/20 to-emerald-900/20', stock: 8 },
  { id: 11, name: 'Iced Tea', retailPrice: 3.00, wholesalePrice: 2.40, category: 'Drinks', color: 'from-teal-600/20 to-teal-900/20', stock: 40 },
  { id: 12, name: 'Smoothie', retailPrice: 6.50, wholesalePrice: 5.20, category: 'Drinks', color: 'from-purple-600/20 to-purple-900/20', stock: 25 },
];

interface CartItem {
  id: number;
  name: string;
  retailPrice: number;
  wholesalePrice: number;
  qty: number;
}

export const POS = () => {
  const { setCurrentView } = useNavigation();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState("All");
  const [isWholesale, setIsWholesale] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [discount, setDiscount] = useState(0);
  const [isStudioSale, setIsStudioSale] = useState(false);

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(p => p.id === product.id);
      if (existing) {
        return prev.map(p => p.id === product.id ? { ...p, qty: p.qty + 1 } : p);
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const updateQty = (id: number, delta: number) => {
    setCart(prev => prev.map(p => {
      if (p.id === id) {
        const newQty = Math.max(0, p.qty + delta);
        return { ...p, qty: newQty };
      }
      return p;
    }).filter(p => p.qty > 0));
  };

  const removeItem = (id: number) => {
    setCart(prev => prev.filter(p => p.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setCustomerName('');
    setDiscount(0);
  };

  const getPrice = (item: any) => isWholesale ? item.wholesalePrice : item.retailPrice;

  const subtotal = cart.reduce((sum, item) => sum + (getPrice(item) * item.qty), 0);
  const discountAmount = (subtotal * discount) / 100;
  const afterDiscount = subtotal - discountAmount;
  const tax = afterDiscount * 0.10;
  const total = afterDiscount + tax;
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === "All" || p.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div 
      className="flex h-screen w-screen overflow-hidden"
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        color: 'var(--color-text-primary)'
      }}
    >
      {/* Left Section: Products */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Modern Header */}
        <div 
          className="h-20 border-b shrink-0"
          style={{
            borderBottomColor: 'var(--color-border-primary)',
            background: 'linear-gradient(to right, var(--color-bg-primary), rgba(17, 24, 39, 0.95))'
          }}
        >
          <div className="h-full px-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setCurrentView('dashboard')} 
                className="rounded-xl"
                style={{ color: 'var(--color-text-secondary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                  e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <ArrowLeft size={20} />
              </Button>
              <div>
                <h1 
                  className="text-2xl font-bold"
                  style={{
                    background: 'linear-gradient(to right, rgba(96, 165, 250, 1), var(--color-primary))',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}
                >
                  POS Terminal
                </h1>
                <p 
                  className="text-xs"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  Point of Sale System
                </p>
              </div>
            </div>

            {/* Search Bar */}
            <div className="flex-1 max-w-md mx-8">
              <div className="relative">
                <Search 
                  className="absolute left-4 top-1/2 -translate-y-1/2" 
                  size={18}
                  style={{ color: 'var(--color-text-tertiary)' }}
                />
                <Input
                  type="text"
                  placeholder="Search products by name..."
                  className="w-full rounded-xl pl-11 pr-4 h-11"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    backgroundColor: 'rgba(31, 41, 55, 0.5)',
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-primary)',
                    borderRadius: 'var(--radius-xl)'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                    e.currentTarget.style.boxShadow = '0 0 0 1px var(--color-primary)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>

            {/* Stats Badge */}
            <div className="flex items-center gap-3">
              <div 
                className="px-4 py-2 rounded-xl border"
                style={{
                  backgroundColor: 'rgba(31, 41, 55, 0.5)',
                  borderColor: 'var(--color-border-secondary)',
                  borderRadius: 'var(--radius-xl)'
                }}
              >
                <div className="flex items-center gap-2">
                  <Receipt 
                    size={16}
                    style={{ color: 'var(--color-primary)' }}
                  />
                  <span 
                    className="text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Today:
                  </span>
                  <span 
                    className="font-bold"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    42
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Category Pills */}
        <div 
          className="px-6 py-4 border-b shrink-0"
          style={{
            borderBottomColor: 'var(--color-border-primary)',
            backgroundColor: 'rgba(17, 24, 39, 0.3)'
          }}
        >
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap border-2"
                  style={
                    isActive 
                      ? {
                          backgroundColor: 'var(--color-primary)',
                          color: 'var(--color-text-primary)',
                          borderColor: 'var(--color-primary)',
                          boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.3)',
                          borderRadius: 'var(--radius-xl)'
                        }
                      : {
                          backgroundColor: 'rgba(31, 41, 55, 0.5)',
                          color: 'var(--color-text-secondary)',
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-xl)'
                        }
                  }
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = 'var(--color-text-primary)';
                      e.currentTarget.style.borderColor = 'var(--color-text-disabled)';
                      e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = 'var(--color-text-secondary)';
                      e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                      e.currentTarget.style.backgroundColor = 'rgba(31, 41, 55, 0.5)';
                    }
                  }}
                >
                  <Icon size={18} />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Products Grid */}
        <div 
          className="flex-1 overflow-y-auto p-6"
          style={{ backgroundColor: 'var(--color-bg-primary)' }}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 pb-8">
            <AnimatePresence>
              {filteredProducts.map((product) => (
                <motion.button
                  key={product.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={{ scale: 1.02, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => addToCart(product)}
                  className="relative aspect-square p-5 rounded-2xl flex flex-col justify-between items-start text-left transition-all border-2 shadow-lg group overflow-hidden"
                  style={{
                    borderColor: 'rgba(55, 65, 81, 0.5)',
                    background: 'linear-gradient(to bottom right, var(--color-bg-card), var(--color-bg-primary))',
                    borderRadius: 'var(--radius-2xl)',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                    e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(55, 65, 81, 0.5)';
                    e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
                  }}
                >
                  {/* Stock Badge */}
                  <Badge 
                    variant="secondary" 
                    className="absolute top-3 right-3 text-[10px] px-2 py-0.5 border-0 backdrop-blur-sm"
                    style={{
                      backgroundColor: 'rgba(0, 0, 0, 0.4)',
                      color: 'var(--color-text-primary)',
                      borderRadius: 'var(--radius-sm)'
                    }}
                  >
                    {product.stock} left
                  </Badge>

                  {/* Product Name */}
                  <div className="z-10">
                    <h3 
                      className="font-bold text-lg leading-tight mb-1 transition-colors"
                      style={{ color: 'var(--color-text-primary)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'rgba(147, 197, 253, 1)'; // blue-300
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--color-text-primary)';
                      }}
                    >
                      {product.name}
                    </h3>
                    <p 
                      className="text-xs"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {product.category}
                    </p>
                  </div>

                  {/* Price Section */}
                  <div className="z-10 w-full">
                    <div className="flex items-end justify-between">
                      <div>
                        <span 
                          className="text-2xl font-bold"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          ${(isWholesale ? product.wholesalePrice : product.retailPrice).toFixed(2)}
                        </span>
                        {isWholesale && (
                          <Badge 
                            className="ml-2 text-[10px] px-1.5 py-0"
                            style={{
                              backgroundColor: 'rgba(16, 185, 129, 0.2)',
                              color: 'rgba(16, 185, 129, 1)',
                              borderColor: 'rgba(16, 185, 129, 0.3)',
                              borderRadius: 'var(--radius-sm)'
                            }}
                          >
                            W
                          </Badge>
                        )}
                      </div>
                      <div 
                        className="p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{
                          backgroundColor: 'var(--color-primary)',
                          color: 'var(--color-text-primary)',
                          borderRadius: 'var(--radius-lg)'
                        }}
                      >
                        <Plus size={16} />
                      </div>
                    </div>
                  </div>

                  {/* Gradient Overlay */}
                  <div 
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: 'linear-gradient(to top, rgba(0, 0, 0, 0.3), transparent)'
                    }}
                  />
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Right Section: Cart */}
      <div 
        className="w-[460px] flex flex-col border-l shadow-2xl shrink-0 h-full"
        style={{
          backgroundColor: 'var(--color-bg-primary)',
          borderLeftColor: 'var(--color-border-primary)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        }}
      >
        
        {/* Cart Header */}
        <div 
          className="h-20 border-b px-6 flex items-center justify-between shrink-0"
          style={{
            borderBottomColor: 'var(--color-border-primary)',
            background: 'linear-gradient(to bottom, var(--color-bg-primary), rgba(17, 24, 39, 0.95))'
          }}
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <ShoppingCart 
                size={24}
                style={{ color: 'var(--color-primary)' }}
              />
              {cartCount > 0 && (
                <span 
                  className="absolute -top-2 -right-2 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center"
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-text-primary)',
                    borderRadius: '50%'
                  }}
                >
                  {cartCount}
                </span>
              )}
            </div>
            <div>
              <h2 
                className="font-bold text-lg"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Current Order
              </h2>
              <p 
                className="text-xs"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                {cart.length} item(s)
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={clearCart} 
            disabled={cart.length === 0}
            className="rounded-xl disabled:opacity-30"
            style={{ color: 'var(--color-error)' }}
            onMouseEnter={(e) => {
              if (cart.length > 0) {
                e.currentTarget.style.color = 'rgba(248, 113, 113, 1)'; // red-300
                e.currentTarget.style.backgroundColor = 'rgba(127, 29, 29, 0.2)';
              }
            }}
            onMouseLeave={(e) => {
              if (cart.length > 0) {
                e.currentTarget.style.color = 'var(--color-error)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            <Trash2 size={18} />
          </Button>
        </div>

        {/* Customer Input Only (Removed Pricing/Discount) */}
        <div 
          className="px-6 py-4 border-b shrink-0 space-y-3"
          style={{
            borderBottomColor: 'var(--color-border-primary)',
            backgroundColor: 'rgba(31, 41, 55, 0.3)'
          }}
        >
          <div className="relative">
            <User 
              className="absolute left-3 top-1/2 -translate-y-1/2" 
              size={16}
              style={{ color: 'var(--color-text-tertiary)' }}
            />
            <Input
              placeholder="Customer name (optional)"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="pl-10 h-10 text-sm"
              style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                borderColor: 'var(--color-border-secondary)',
                color: 'var(--color-text-primary)'
              }}
            />
          </div>
          
          {/* Studio Sale Checkbox */}
          <label 
            className="flex items-center gap-3 cursor-pointer p-3 rounded-lg transition-colors"
            style={{ borderRadius: 'var(--radius-lg)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(31, 41, 55, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <input
              type="checkbox"
              checked={isStudioSale}
              onChange={(e) => setIsStudioSale(e.target.checked)}
              className="w-5 h-5 rounded"
              style={{
                borderColor: 'var(--color-border-secondary)',
                backgroundColor: 'var(--color-bg-tertiary)',
                borderRadius: 'var(--radius-md)'
              }}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span 
                  className="text-sm font-medium"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Studio Sale
                </span>
                <Badge 
                  className="text-xs"
                  style={{
                    backgroundColor: 'rgba(147, 51, 234, 0.2)',
                    color: 'var(--color-wholesale)',
                    borderColor: 'rgba(147, 51, 234, 0.3)',
                    borderRadius: 'var(--radius-sm)'
                  }}
                >
                  Production
                </Badge>
              </div>
              <div 
                className="text-xs mt-0.5"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                Route to studio workflow for fabric processing
              </div>
            </div>
          </label>
        </div>

        {/* Cart Items (Scroll Fix) */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
          <div className="space-y-3">
            {cart.length === 0 ? (
              <div 
                className="h-64 flex flex-col items-center justify-center gap-4"
                style={{ color: 'var(--color-text-disabled)' }}
              >
                <div 
                  className="w-20 h-20 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: 'rgba(31, 41, 55, 0.5)',
                    borderRadius: '50%'
                  }}
                >
                  <ShoppingCart 
                    size={32}
                    style={{ color: 'var(--color-text-disabled)' }}
                  />
                </div>
                <div className="text-center">
                  <p 
                    className="font-medium"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    Cart is empty
                  </p>
                  <p 
                    className="text-xs mt-1"
                    style={{ color: 'var(--color-text-disabled)' }}
                  >
                    Add items to get started
                  </p>
                </div>
              </div>
            ) : (
              <AnimatePresence>
                {cart.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-4 rounded-xl border transition-all group"
                    style={{
                      backgroundColor: 'rgba(31, 41, 55, 0.5)',
                      borderColor: 'var(--color-border-secondary)',
                      borderRadius: 'var(--radius-xl)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-text-disabled)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                    }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 
                          className="font-semibold mb-1"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          {item.name}
                        </h4>
                        <p 
                          className="text-sm"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          ${getPrice(item).toFixed(2)} × {item.qty}
                        </p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span 
                          className="text-lg font-bold"
                          style={{ color: 'var(--color-primary)' }}
                        >
                          ${(getPrice(item) * item.qty).toFixed(2)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(item.id)}
                          className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ color: 'var(--color-error)' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'rgba(248, 113, 113, 1)'; // red-300
                            e.currentTarget.style.backgroundColor = 'rgba(127, 29, 29, 0.2)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--color-error)';
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <X size={14} />
                        </Button>
                      </div>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => updateQty(item.id, -1)}
                        className="h-9 w-9 rounded-lg"
                        style={{
                          backgroundColor: 'var(--color-bg-primary)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-secondary)',
                          borderRadius: 'var(--radius-lg)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                          e.currentTarget.style.borderColor = 'var(--color-text-disabled)';
                          e.currentTarget.style.color = 'var(--color-text-primary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
                          e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                          e.currentTarget.style.color = 'var(--color-text-secondary)';
                        }}
                      >
                        <Minus size={14} />
                      </Button>
                      <div className="flex-1 text-center">
                        <span 
                          className="font-bold text-lg"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          {item.qty}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => updateQty(item.id, 1)}
                        className="h-9 w-9 rounded-lg"
                        style={{
                          backgroundColor: 'var(--color-primary)',
                          borderColor: 'var(--color-primary)',
                          color: 'var(--color-text-primary)',
                          borderRadius: 'var(--radius-lg)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 1)'; // blue-500
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                        }}
                      >
                        <Plus size={14} />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* Totals & Checkout */}
        <div 
          className="p-6 border-t space-y-4 shrink-0 z-10"
          style={{
            backgroundColor: 'var(--color-bg-tertiary)',
            borderTopColor: 'var(--color-border-primary)',
            boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.5)'
          }}
        >
          {/* Calculation Breakdown */}
          <div className="space-y-2 text-sm">
            <div 
              className="flex justify-between"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <span>Subtotal</span>
              <span className="font-medium">${subtotal.toFixed(2)}</span>
            </div>
            
            {discount > 0 && (
              <div 
                className="flex justify-between"
                style={{ color: 'var(--color-success)' }}
              >
                <span>Discount ({discount}%)</span>
                <span className="font-medium">-${discountAmount.toFixed(2)}</span>
              </div>
            )}
            
            <div 
              className="flex justify-between"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <span>Tax (10%)</span>
              <span className="font-medium">${tax.toFixed(2)}</span>
            </div>
            
            <div 
              className="flex justify-between text-xl font-bold pt-3 border-t"
              style={{
                color: 'var(--color-text-primary)',
                borderTopColor: 'var(--color-border-primary)'
              }}
            >
              <span>Total</span>
              <span 
                style={{
                  background: 'linear-gradient(to right, rgba(96, 165, 250, 1), var(--color-primary))',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}
              >
                ${total.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Payment Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button 
              disabled={cart.length === 0}
              className="py-4 rounded-xl font-bold flex flex-col items-center justify-center gap-2 transition-all active:scale-95 disabled:shadow-none border-2"
              style={
                cart.length === 0
                  ? {
                      background: 'linear-gradient(to bottom right, var(--color-bg-card), var(--color-bg-card))',
                      color: 'var(--color-text-disabled)',
                      borderColor: 'var(--color-border-secondary)',
                      borderRadius: 'var(--radius-xl)'
                    }
                  : {
                      background: 'linear-gradient(to bottom right, var(--color-success), rgba(5, 150, 105, 1))',
                      color: 'var(--color-text-primary)',
                      borderColor: 'rgba(16, 185, 129, 0.2)',
                      borderRadius: 'var(--radius-xl)',
                      boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.3)'
                    }
              }
              onMouseEnter={(e) => {
                if (cart.length > 0) {
                  e.currentTarget.style.background = 'linear-gradient(to bottom right, rgba(16, 185, 129, 1), rgba(5, 150, 105, 1))';
                }
              }}
              onMouseLeave={(e) => {
                if (cart.length > 0) {
                  e.currentTarget.style.background = 'linear-gradient(to bottom right, var(--color-success), rgba(5, 150, 105, 1))';
                }
              }}
            >
              <Banknote size={22} />
              <span>Cash Payment</span>
            </button>
            <button 
              disabled={cart.length === 0}
              className="py-4 rounded-xl font-bold flex flex-col items-center justify-center gap-2 transition-all active:scale-95 disabled:shadow-none border-2"
              style={
                cart.length === 0
                  ? {
                      background: 'linear-gradient(to bottom right, var(--color-bg-card), var(--color-bg-card))',
                      color: 'var(--color-text-disabled)',
                      borderColor: 'var(--color-border-secondary)',
                      borderRadius: 'var(--radius-xl)'
                    }
                  : {
                      background: 'linear-gradient(to bottom right, var(--color-primary), rgba(37, 99, 235, 1))',
                      color: 'var(--color-text-primary)',
                      borderColor: 'rgba(59, 130, 246, 0.2)',
                      borderRadius: 'var(--radius-xl)',
                      boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.3)'
                    }
              }
              onMouseEnter={(e) => {
                if (cart.length > 0) {
                  e.currentTarget.style.background = 'linear-gradient(to bottom right, rgba(59, 130, 246, 1), rgba(37, 99, 235, 1))';
                }
              }}
              onMouseLeave={(e) => {
                if (cart.length > 0) {
                  e.currentTarget.style.background = 'linear-gradient(to bottom right, var(--color-primary), rgba(37, 99, 235, 1))';
                }
              }}
            >
              <CreditCard size={22} />
              <span>Card Payment</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};