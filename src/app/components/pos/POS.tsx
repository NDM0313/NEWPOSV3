import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  Wine,
  Percent,
  DollarSign,
  Calendar,
  Clock,
  TrendingUp,
  Package,
  Tag,
  ChevronDown,
  Hash,
  Edit2,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigation } from '../../context/NavigationContext';
import { useSupabase } from '../../context/SupabaseContext';
import { productService } from '../../services/productService';
import { contactService } from '../../services/contactService';
import { useSales } from '../../context/SalesContext';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { cn } from "../ui/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { Label } from "../ui/label";
import { toast } from 'sonner';

interface POSProduct {
  id: string;
  name: string;
  retailPrice: number;
  wholesalePrice: number;
  category: string;
  stock: number;
  color: string;
}

interface POSCustomer {
  id: string;
  name: string;
}

interface CartItem {
  id: string;
  name: string;
  retailPrice: number;
  wholesalePrice: number;
  qty: number;
  customPrice?: number;
  productId: string; // Supabase product ID
}

export const POS = () => {
  const { setCurrentView } = useNavigation();
  const { companyId, branchId, user } = useSupabase();
  const { createSale } = useSales();
  const [products, setProducts] = useState<POSProduct[]>([]);
  const [customers, setCustomers] = useState<POSCustomer[]>([
    { id: "walk-in", name: "Walk-in Customer" }
  ]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState("All");
  const [isWholesale, setIsWholesale] = useState(false);
  
  // Customer selection state
  const [customerOpen, setCustomerOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState("walk-in"); // Default: Walk-in

  // Discount state
  const [discountType, setDiscountType] = useState<'percentage' | 'amount'>('percentage');
  const [discountValue, setDiscountValue] = useState('');

  // Invoice number (auto-generated)
  const [invoiceNumber] = useState(() => {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    const randomNum = Math.floor(Math.random() * 9000) + 1000;
    return `INV-${dateStr}-${randomNum}`;
  });

  // Load products and customers from Supabase
  const loadData = useCallback(async () => {
    if (!companyId) return;
    
    try {
      setLoading(true);
      
      // Load products
      const productsData = await productService.getAllProducts(companyId);
      const convertedProducts: POSProduct[] = productsData
        .filter((p: any) => p.is_sellable && p.is_active)
        .map((p: any) => ({
          id: p.id,
          name: p.name || '',
          retailPrice: p.retail_price || 0,
          wholesalePrice: p.wholesale_price || p.retail_price || 0,
          category: p.category?.name || 'Uncategorized',
          stock: p.current_stock || 0,
          color: 'from-blue-600/20 to-blue-900/20', // Default color
        }));
      setProducts(convertedProducts);
      
      // Load customers
      const contactsData = await contactService.getAllContacts(companyId);
      const convertedCustomers: POSCustomer[] = [
        { id: "walk-in", name: "Walk-in Customer" },
        ...contactsData
          .filter((c: any) => c.type === 'customer' && c.is_active)
          .map((c: any) => ({
            id: c.id,
            name: c.name || '',
          }))
      ];
      setCustomers(convertedCustomers);
    } catch (error: any) {
      console.error('[POS] Error loading data:', error);
      toast.error('Failed to load POS data: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (companyId) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [companyId, loadData]);

  // Get unique categories from products
  const categories = useMemo(() => {
    const uniqueCategories = Array.from(new Set(products.map(p => p.category)));
    return [
      { id: "All", label: "All Items", icon: Zap },
      ...uniqueCategories.map(cat => ({
        id: cat,
        label: cat,
        icon: Package,
      })),
    ];
  }, [products]);

  const addToCart = (product: POSProduct) => {
    setCart(prev => {
      const existing = prev.find(p => p.id === product.id);
      if (existing) {
        return prev.map(p => p.id === product.id ? { ...p, qty: p.qty + 1 } : p);
      }
      return [...prev, { 
        ...product, 
        qty: 1,
        productId: product.id,
      }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(p => {
      if (p.id === id) {
        const newQty = Math.max(0, p.qty + delta);
        return { ...p, qty: newQty };
      }
      return p;
    }).filter(p => p.qty > 0));
  };

  // NEW: Update custom price
  const updateCustomPrice = (id: string, price: string) => {
    const priceValue = parseFloat(price);
    setCart(prev => prev.map(p => 
      p.id === id 
        ? { ...p, customPrice: isNaN(priceValue) ? undefined : priceValue }
        : p
    ));
  };

  const removeItem = (id: string) => {
    setCart(prev => prev.filter(p => p.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCustomer("walk-in");
    setDiscountValue('');
  };

  const getPrice = (item: any) => isWholesale ? item.wholesalePrice : item.retailPrice;

  // Calculate subtotal with custom prices
  const subtotal = cart.reduce((sum, item) => {
    const price = item.customPrice !== undefined ? item.customPrice : getPrice(item);
    return sum + (price * item.qty);
  }, 0);
  
  // Calculate discount
  const discountAmount = useMemo(() => {
    const value = parseFloat(discountValue) || 0;
    if (discountType === 'percentage') {
      return (subtotal * value) / 100;
    }
    return value;
  }, [discountValue, discountType, subtotal]);

  const afterDiscount = subtotal - discountAmount;
  const tax = afterDiscount * 0.10;
  const total = afterDiscount + tax;
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === "All" || p.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  // Get current date and time
  const currentDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const selectedCustomerData = customers.find(c => c.id === selectedCustomer);

  // Handle checkout
  const handleCheckout = async (paymentMethod: 'cash' | 'card', totalAmount: number) => {
    if (!companyId || !user || cart.length === 0) {
      toast.error('Missing required information');
      return;
    }

    try {
      // Get customer ID (or null for walk-in)
      const customerId = selectedCustomer === 'walk-in' ? null : selectedCustomer;
      const customerName = selectedCustomerData?.name || 'Walk-in Customer';

      // Convert cart items to sale items
      const saleItems = cart.map(item => ({
        productId: item.productId,
        productName: item.name,
        quantity: item.qty,
        unitPrice: item.customPrice !== undefined ? item.customPrice : getPrice(item),
        total: (item.customPrice !== undefined ? item.customPrice : getPrice(item)) * item.qty,
      }));

      // Create sale
      const saleData = {
        companyId,
        branchId: branchId || undefined,
        customerId: customerId || undefined,
        customerName,
        date: new Date().toISOString().split('T')[0],
        type: 'invoice' as const,
        status: 'final' as const,
        paymentStatus: 'paid' as const,
        subtotal,
        discount: discountAmount,
        tax: tax,
        expenses: 0,
        total: totalAmount,
        paid: totalAmount,
        due: 0,
        items: saleItems,
      };

      await createSale(saleData);
      
      toast.success(`Sale completed! Invoice: ${invoiceNumber}`);
      clearCart();
    } catch (error: any) {
      console.error('[POS] Error processing checkout:', error);
      toast.error('Failed to process payment: ' + (error.message || 'Unknown error'));
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#111827] text-white">
      {/* Left Section: Products */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* TOP DASHBOARD STATS */}
        <div className="h-auto border-b border-gray-800 bg-gradient-to-r from-gray-900 to-gray-900/95 backdrop-blur-sm shrink-0">
          {/* Header Row */}
          <div className="px-6 py-3 flex items-center justify-between border-b border-gray-800/50">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setCurrentView('dashboard')} 
                className="text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl"
              >
                <ArrowLeft size={20} />
              </Button>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
                  POS Terminal
                </h1>
                <p className="text-xs text-gray-500">Point of Sale System</p>
              </div>
            </div>

            {/* Date & Time */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/50 rounded-lg border border-gray-700">
                <Calendar size={14} className="text-blue-400" />
                <span className="text-xs text-gray-300">{currentDate}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/50 rounded-lg border border-gray-700">
                <Clock size={14} className="text-green-400" />
                <span className="text-xs text-gray-300">{currentTime}</span>
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="px-6 py-3 grid grid-cols-4 gap-4">
            {/* Total Sales Today */}
            <div className="bg-gradient-to-br from-blue-900/30 to-blue-900/10 border border-blue-900/50 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400 uppercase font-medium">Total Sales</span>
                <TrendingUp size={14} className="text-blue-400" />
              </div>
              <p className="text-2xl font-bold text-white">$1,245</p>
              <p className="text-xs text-blue-400 mt-0.5">42 transactions</p>
            </div>

            {/* Category Count */}
            <div className="bg-gradient-to-br from-purple-900/30 to-purple-900/10 border border-purple-900/50 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400 uppercase font-medium">Categories</span>
                <Tag size={14} className="text-purple-400" />
              </div>
              <p className="text-2xl font-bold text-white">5</p>
              <p className="text-xs text-purple-400 mt-0.5">Active categories</p>
            </div>

            {/* Products Count */}
            <div className="bg-gradient-to-br from-green-900/30 to-green-900/10 border border-green-900/50 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400 uppercase font-medium">Products</span>
                <Package size={14} className="text-green-400" />
              </div>
              <p className="text-2xl font-bold text-white">{products.length}</p>
              <p className="text-xs text-green-400 mt-0.5">In stock</p>
            </div>

            {/* Current Cart */}
            <div className="bg-gradient-to-br from-orange-900/30 to-orange-900/10 border border-orange-900/50 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400 uppercase font-medium">Current Cart</span>
                <ShoppingCart size={14} className="text-orange-400" />
              </div>
              <p className="text-2xl font-bold text-white">{cartCount}</p>
              <p className="text-xs text-orange-400 mt-0.5">${total.toFixed(2)} total</p>
            </div>
          </div>
        </div>

        {/* Search Bar & Customer Selection */}
        <div className="px-6 py-4 border-b border-gray-800 bg-gray-900/30 shrink-0">
          <div className="flex items-center gap-3">
            {/* Product Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
              <Input
                type="text"
                placeholder="Search products by name..."
                className="w-full bg-gray-800/50 border-gray-700 rounded-xl pl-10 pr-4 h-10 text-white placeholder:text-gray-500"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Customer Selector (Same as Sale Page) */}
            <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={customerOpen}
                  className="w-[280px] justify-between bg-gray-800/50 border-gray-700 text-white hover:bg-gray-800 h-10"
                >
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-gray-400" />
                    <span className="text-sm">{selectedCustomerData?.name || "Select customer"}</span>
                  </div>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0 bg-gray-900 border-gray-800" align="start">
                <Command className="bg-gray-900 border-0">
                  <CommandInput 
                    placeholder="Search customer..." 
                    className="h-9 bg-gray-950 border-gray-800 text-white placeholder:text-gray-500"
                  />
                  <CommandList>
                    <CommandEmpty className="py-6 text-center text-sm text-gray-500">No customer found.</CommandEmpty>
                    <CommandGroup>
                      {customers.map((customer) => (
                        <CommandItem
                          key={customer.id}
                          value={customer.name}
                          onSelect={() => {
                            setSelectedCustomer(customer.id);
                            setCustomerOpen(false);
                          }}
                          className="text-white hover:bg-gray-800 cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedCustomer === customer.id ? "opacity-100 text-blue-400" : "opacity-0"
                            )}
                          />
                          {customer.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Category Pills */}
        <div className="px-6 py-3 border-b border-gray-800 bg-gray-900/30 shrink-0">
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap border",
                    isActive 
                      ? "bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-900/30" 
                      : "bg-gray-800/50 text-gray-400 hover:text-white border-gray-700 hover:border-gray-600 hover:bg-gray-800"
                  )}
                >
                  <Icon size={16} />
                  <span className="text-sm">{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#111827]">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 size={48} className="text-blue-500 animate-spin" />
            </div>
          ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 pb-8">
            <AnimatePresence>
                {filteredProducts.length === 0 ? (
                  <div className="col-span-full text-center py-12">
                    <Package size={48} className="mx-auto text-gray-600 mb-3" />
                    <p className="text-gray-400 text-sm">No products found</p>
                    <p className="text-gray-600 text-xs mt-1">Try adjusting your search or category</p>
                  </div>
                ) : (
                  filteredProducts.map((product) => (
                <motion.button
                  key={product.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={{ scale: 1.02, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => addToCart(product)}
                  className={cn(
                    "relative aspect-square p-4 rounded-xl flex flex-col justify-between items-start text-left transition-all border border-gray-700/50 bg-gradient-to-br hover:border-blue-500/50 shadow-lg hover:shadow-xl group overflow-hidden",
                    product.color || 'from-gray-800 to-gray-900'
                  )}
                >
                  {/* Stock Badge */}
                  <Badge 
                    variant="secondary" 
                    className="absolute top-2 right-2 bg-black/40 text-white text-[10px] px-1.5 py-0.5 border-0 backdrop-blur-sm"
                  >
                    {product.stock} left
                  </Badge>

                  {/* Product Name */}
                  <div className="z-10">
                    <h3 className="font-bold text-white text-base leading-tight mb-0.5 group-hover:text-blue-300 transition-colors">
                      {product.name}
                    </h3>
                    <p className="text-[10px] text-gray-400">{product.category}</p>
                  </div>

                  {/* Price Section */}
                  <div className="z-10 w-full">
                    <div className="flex items-end justify-between">
                      <div>
                        <span className="text-xl font-bold text-white">
                          ${(isWholesale ? product.wholesalePrice : product.retailPrice).toFixed(2)}
                        </span>
                      </div>
                      <div className="bg-blue-600 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                        <Plus size={14} />
                      </div>
                    </div>
                  </div>

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
                </motion.button>
                  ))
                )}
            </AnimatePresence>
          </div>
          )}
        </div>
      </div>

      {/* RIGHT SECTION: CART & PAYMENT (RED MARKED AREA) */}
      <div className="w-[420px] bg-gray-900 border-l border-gray-800 flex flex-col shrink-0">
        
        {/* INVOICE NUMBER HEADER (NEW!) */}
        <div className="px-5 py-3 border-b border-gray-800 bg-gradient-to-r from-purple-900/20 to-blue-900/20 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Hash size={16} className="text-purple-400" />
              <span className="text-xs text-gray-400 uppercase font-medium">Invoice</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900/70 rounded-lg border border-purple-900/50">
              <Receipt size={14} className="text-purple-400" />
              <span className="text-sm font-mono font-bold text-white">{invoiceNumber}</span>
            </div>
          </div>
        </div>

        {/* Cart Header */}
        <div className="h-14 px-5 flex items-center justify-between border-b border-gray-800 bg-gray-950/50 shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-blue-400" />
            <h2 className="font-bold text-white text-lg">Current Order</h2>
            <Badge variant="secondary" className="bg-blue-900/30 text-blue-400 border-blue-900/50 text-xs">
              {cartCount} {cartCount === 1 ? 'item' : 'items'}
            </Badge>
          </div>
          {cart.length > 0 && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={clearCart}
              className="text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg h-8 w-8"
            >
              <Trash2 size={16} />
            </Button>
          )}
        </div>

        {/* Cart Items - Scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="bg-gray-800/50 rounded-full p-6 mb-4">
                <ShoppingCart size={48} className="text-gray-600" />
              </div>
              <p className="text-gray-500 font-medium">Cart is empty</p>
              <p className="text-xs text-gray-600 mt-1">Add products to start an order</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-gray-800/50 border border-gray-700 rounded-xl p-3"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-white text-sm mb-1">{item.name}</h4>
                      {/* EDITABLE PRICE */}
                      <div className="flex items-center gap-2">
                        <DollarSign size={12} className="text-gray-500" />
                        <Input
                          type="number"
                          step="0.01"
                          value={item.customPrice !== undefined ? item.customPrice : getPrice(item)}
                          onChange={(e) => updateCustomPrice(item.id, e.target.value)}
                          className="bg-gray-900 border-gray-700 text-white h-7 w-20 text-xs px-2"
                          placeholder="Price"
                        />
                        <span className="text-xs text-gray-500">× {item.qty}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <p className="font-bold text-blue-400 text-sm">
                        ${((item.customPrice !== undefined ? item.customPrice : getPrice(item)) * item.qty).toFixed(2)}
                      </p>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-red-400 hover:text-red-300 p-1 hover:bg-red-900/20 rounded transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                  
                  {/* Quantity Controls */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 bg-gray-900 rounded-lg border border-gray-700 p-1">
                      <button
                        onClick={() => updateQty(item.id, -1)}
                        className="text-white hover:bg-gray-800 rounded p-1.5 transition-colors"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="font-bold text-white text-sm min-w-[24px] text-center">
                        {item.qty}
                      </span>
                      <button
                        onClick={() => updateQty(item.id, 1)}
                        className="text-white hover:bg-gray-800 rounded p-1.5 transition-colors"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    {item.customPrice !== undefined && (
                      <span className="text-[10px] text-yellow-400 flex items-center gap-1">
                        <Edit2 size={10} />
                        Custom Price
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* PAYMENT SECTION (Fixed at Bottom) */}
        {cart.length > 0 && (
          <div className="border-t border-gray-800 bg-gray-950/70 backdrop-blur-sm shrink-0">
            
            {/* Discount Section */}
            <div className="px-5 py-4 border-b border-gray-800">
              <Label className="text-xs text-gray-400 uppercase font-medium mb-2 block">Discount</Label>
              <div className="flex gap-2">
                {/* Discount Type Toggle */}
                <div className="flex bg-gray-900 rounded-lg border border-gray-700 p-1">
                  <button
                    onClick={() => setDiscountType('percentage')}
                    className={cn(
                      "px-3 py-1.5 rounded text-xs font-medium transition-all",
                      discountType === 'percentage'
                        ? "bg-blue-600 text-white"
                        : "text-gray-400 hover:text-white"
                    )}
                  >
                    <Percent size={12} className="inline mr-1" />%
                  </button>
                  <button
                    onClick={() => setDiscountType('amount')}
                    className={cn(
                      "px-3 py-1.5 rounded text-xs font-medium transition-all",
                      discountType === 'amount'
                        ? "bg-blue-600 text-white"
                        : "text-gray-400 hover:text-white"
                    )}
                  >
                    <DollarSign size={12} className="inline mr-1" />$
                  </button>
                </div>

                {/* Discount Input */}
                <div className="flex-1 relative">
                  {discountType === 'percentage' ? (
                    <Percent size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  ) : (
                    <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  )}
                  <Input
                    type="number"
                    placeholder={discountType === 'percentage' ? "0" : "0.00"}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="bg-gray-900 border-gray-700 text-white h-9 pl-8 pr-3"
                  />
                </div>
              </div>
              {discountAmount > 0 && (
                <p className="text-xs text-green-400 mt-2">
                  Discount applied: -${discountAmount.toFixed(2)}
                  {discountType === 'percentage' && ` (${discountValue}%)`}
                </p>
              )}
            </div>

            {/* Totals Section */}
            <div className="px-5 py-4 space-y-2 border-b border-gray-800">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Subtotal</span>
                <span className="text-white font-medium">${subtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Discount</span>
                  <span className="text-green-400 font-medium">-${discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Tax (10%)</span>
                <span className="text-white font-medium">${tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-700">
                <span className="text-base font-semibold text-white">Total</span>
                <span className="text-2xl font-bold text-blue-400">${total.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Buttons */}
            <div className="px-5 py-4 grid grid-cols-2 gap-3">
              <Button 
                className="bg-green-600 hover:bg-green-500 text-white font-semibold h-12 rounded-xl shadow-lg shadow-green-900/30"
                onClick={async () => {
                  await handleCheckout('cash', total);
                }}
                disabled={loading || !companyId || !user}
              >
                <Banknote size={18} className="mr-2" />
                Cash Payment
              </Button>
              <Button 
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold h-12 rounded-xl shadow-lg shadow-blue-900/30"
                onClick={async () => {
                  await handleCheckout('card', total);
                }}
                disabled={loading || !companyId || !user}
              >
                <CreditCard size={18} className="mr-2" />
                Card Payment
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};