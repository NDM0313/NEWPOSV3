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
  Loader2,
  ChevronLeft,
  ChevronRight,
  FileEdit
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigation } from '../../context/NavigationContext';
import { useSupabase } from '../../context/SupabaseContext';
import { productService } from '../../services/productService';
import { contactService } from '../../services/contactService';
import { saleService } from '../../services/saleService';
import { useSales } from '../../context/SalesContext';
import { useSettings } from '../../context/SettingsContext';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { cn } from "../ui/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { Label } from "../ui/label";
import { toast } from 'sonner';
import type { Sale, SaleItem } from '@/app/context/SalesContext';

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
  const { sales, createSale, updateSale, refreshSales, getSaleById } = useSales();
  const { posSettings } = useSettings();
  const { formatCurrency, currencySymbol } = useFormatCurrency();
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

  // Invoice number: "New" for new order, or selected POS sale's number
  const [invoiceNumber, setInvoiceNumber] = useState('New');
  // Today's sales stats (from DB)
  const [todayStats, setTodayStats] = useState<{ total: number; count: number }>({ total: 0, count: 0 });
  // POS sales list (invoice_no starts with POS-) for Prev/Next navigation
  const posSalesList = useMemo(() => 
    [...sales].filter(s => (s.invoiceNo || '').startsWith('POS-')).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
    [sales]
  );
  // Selected sale index: -1 = new order, 0..length-1 = viewing that POS sale
  const [selectedSaleIndex, setSelectedSaleIndex] = useState(-1);
  const selectedSale = selectedSaleIndex >= 0 && selectedSaleIndex < posSalesList.length ? posSalesList[selectedSaleIndex] : null;
  const selectedSaleId = selectedSale?.id ?? null;
  // Full sale for viewing (backend-driven: get by ID so items/totals are current)
  const [viewingSale, setViewingSale] = useState<Sale | null>(null);
  const [viewingSalePayments, setViewingSalePayments] = useState<{ amount: number }[]>([]);
  const [loadingSale, setLoadingSale] = useState(false);
  // Edit mode: cart refilled from sale, inline edit only (no regular sale drawer)
  const [editMode, setEditMode] = useState(false);
  // Edit mode: editable payment (amount received + method)
  const [editPaidAmount, setEditPaidAmount] = useState(0);
  const [editPaymentMethod, setEditPaymentMethod] = useState<'Cash' | 'Card'>('Cash');
  // After checkout, select the new sale once list has refreshed
  const [pendingSelectSaleId, setPendingSelectSaleId] = useState<string | null>(null);

  // Clear mode: view = read-only (saved sale), edit = inline edit. Next/Previous → view.
  const isViewMode = selectedSaleIndex >= 0 && !editMode; // viewing a saved sale, read-only
  const isEditable = editMode || selectedSaleIndex === -1;  // can add/edit products only in edit or new order

  // Sync invoice number display with selected sale
  useEffect(() => {
    if (selectedSaleIndex >= 0 && posSalesList[selectedSaleIndex]) {
      setInvoiceNumber(posSalesList[selectedSaleIndex].invoiceNo);
    } else if (selectedSaleIndex === -1) {
      setInvoiceNumber('New');
    }
  }, [selectedSaleIndex, posSalesList]);

  // After checkout: when sales refresh, select the new sale
  useEffect(() => {
    if (!pendingSelectSaleId || posSalesList.length === 0) return;
    const idx = posSalesList.findIndex(s => s.id === pendingSelectSaleId);
    if (idx >= 0) setSelectedSaleIndex(idx);
    setPendingSelectSaleId(null);
  }, [pendingSelectSaleId, posSalesList]);

  // Backend-driven: when selected POS sale changes, fetch full sale + payments (Paid = sum of payments)
  useEffect(() => {
    if (!selectedSaleId) {
      setViewingSale(null);
      setViewingSalePayments([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoadingSale(true);
      try {
        const [raw, paymentsList] = await Promise.all([
          saleService.getSaleById(selectedSaleId),
          saleService.getSalePayments(selectedSaleId),
        ]);
        if (cancelled) return;
        if (raw) {
          const { convertFromSupabaseSale } = await import('@/app/context/SalesContext');
          setViewingSale(convertFromSupabaseSale(raw));
        } else {
          setViewingSale(null);
        }
        if (!cancelled) setViewingSalePayments(paymentsList || []);
      } catch (e) {
        if (!cancelled) toast.error('Failed to load sale');
        if (!cancelled) setViewingSalePayments([]);
      } finally {
        if (!cancelled) setLoadingSale(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [selectedSaleId]);

  // Enter edit mode: refill cart from viewing sale (POS inline edit only). Use sum of payments as Paid when available.
  const enterEditMode = useCallback(() => {
    if (!viewingSale?.items?.length) return;
    const cartItems: CartItem[] = viewingSale.items.map((item: SaleItem, i: number) => ({
      id: item.productId + (i ? `-${i}` : ''),
      name: item.productName || '',
      retailPrice: item.price || 0,
      wholesalePrice: item.price || 0,
      qty: item.quantity,
      customPrice: item.price,
      productId: item.productId,
    }));
    setCart(cartItems);
    setDiscountValue(String(viewingSale.discount || 0));
    setDiscountType('amount');
    setSelectedCustomer(viewingSale.customer || 'walk-in');
    const paidFromPayments = viewingSalePayments.length > 0 ? viewingSalePayments.reduce((s, p) => s + (p.amount || 0), 0) : null;
    setEditPaidAmount(paidFromPayments ?? viewingSale.paid ?? viewingSale.total ?? 0);
    setEditPaymentMethod((viewingSale.paymentMethod === 'Card' || viewingSale.paymentMethod === 'card') ? 'Card' : 'Cash');
    setEditMode(true);
  }, [viewingSale, viewingSalePayments]);

  // Exit edit mode (Cancel): go back to view, panel shows sale items read-only
  const exitEditMode = useCallback(() => {
    setEditMode(false);
    setCart([]);
  }, []);

  const getPrice = (item: any) => isWholesale ? item.wholesalePrice : item.retailPrice;

  // Calculate subtotal with custom prices (must be before handleSavePosEdit)
  const subtotal = cart.reduce((sum, item) => {
    const price = item.customPrice !== undefined ? item.customPrice : getPrice(item);
    return sum + (price * item.qty);
  }, 0);

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

  const selectedCustomerData = customers.find(c => c.id === selectedCustomer);

  // Save POS sale (update only, no new invoice). Backend safety: only allow update when mode === edit.
  const handleSavePosEdit = useCallback(async () => {
    if (!editMode || !selectedSaleId || !viewingSale || cart.length === 0) return;
    try {
      const saleItems = cart.map(item => ({
        id: '',
        productId: item.productId,
        productName: item.name,
        sku: 'N/A',
        quantity: item.qty,
        price: item.customPrice !== undefined ? item.customPrice : getPrice(item),
        discount: 0,
        tax: 0,
        total: (item.customPrice !== undefined ? item.customPrice : getPrice(item)) * item.qty,
      }));
      const paid = Math.max(0, Number(editPaidAmount) || 0);
      const due = Math.max(0, total - paid);
      const paymentStatus = due <= 0 ? 'paid' : 'partial';
      await updateSale(selectedSaleId, {
        items: saleItems,
        subtotal,
        discount: discountAmount,
        tax,
        total,
        paid,
        due,
        customer: selectedCustomer === 'walk-in' ? '' : selectedCustomer,
        customerName: selectedCustomerData?.name || 'Walk-in Customer',
        paymentStatus,
        paymentMethod: editPaymentMethod,
      });
      toast.success('POS invoice updated');
      refreshSales();
      setEditMode(false);
      setCart([]);
      // Reload viewing sale so panel shows updated data
      const raw = await saleService.getSaleById(selectedSaleId);
      if (raw) {
        const { convertFromSupabaseSale } = await import('@/app/context/SalesContext');
        setViewingSale(convertFromSupabaseSale(raw));
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update');
    }
  }, [editMode, selectedSaleId, viewingSale, cart, subtotal, discountAmount, tax, total, editPaidAmount, editPaymentMethod, selectedCustomer, selectedCustomerData, updateSale, refreshSales]);

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

  // Load sales when POS opens so Prev/Next list is up to date
  useEffect(() => {
    if (companyId) refreshSales();
  }, [companyId]);

  // Load today's sales stats from DB
  const loadTodayStats = useCallback(async () => {
    if (!companyId) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const sales = await saleService.getSalesReport(companyId, today, today);
      const total = (sales || []).reduce((sum: number, s: any) => sum + (Number(s.total) || 0), 0);
      setTodayStats({ total, count: (sales || []).length });
    } catch {
      setTodayStats({ total: 0, count: 0 });
    }
  }, [companyId]);

  useEffect(() => {
    if (companyId) loadTodayStats();
  }, [companyId, loadTodayStats]);

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

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === "All" || p.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  // Get current date and time
  const currentDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  // Handle checkout
  const handleCheckout = async (paymentMethod: 'cash' | 'card', totalAmount: number) => {
    if (!companyId || !user || cart.length === 0) {
      toast.error('Missing required information');
      return;
    }

    // Stock validation: when negativeStockAllowed=false, block if qty exceeds stock
    if (!posSettings.negativeStockAllowed) {
      const qtyByProduct = cart.reduce<Record<string, number>>((acc, item) => {
        acc[item.productId] = (acc[item.productId] ?? 0) + item.qty;
        return acc;
      }, {});
      for (const [pid, totalQty] of Object.entries(qtyByProduct)) {
        const product = products.find(p => p.id === pid);
        if (product && totalQty > product.stock) {
          toast.error(`${product.name}: total quantity (${totalQty}) exceeds available stock (${product.stock})`);
          return;
        }
      }
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

      // Create sale – POS uses POS-0001 numbering; paymentMethod stored for payments
      const saleData = {
        isPOS: true as const,
        customer: customerId ?? '',
        customerName,
        contactNumber: '',
        date: new Date().toISOString().split('T')[0],
        location: '',
        type: 'invoice' as const,
        status: 'final' as const,
        paymentStatus: 'paid' as const,
        paymentMethod: paymentMethod === 'cash' ? 'Cash' : 'Card',
        shippingStatus: 'delivered' as const,
        itemsCount: saleItems.length,
        subtotal,
        discount: discountAmount,
        tax: tax,
        expenses: 0,
        total: totalAmount,
        paid: totalAmount,
        due: 0,
        returnDue: 0,
        items: saleItems,
      };

      const newSale = await createSale(saleData);
      
      toast.success(`Sale completed! Invoice: ${newSale.invoiceNo}`);
      clearCart();
      setInvoiceNumber(newSale.invoiceNo);
      setPendingSelectSaleId(newSale.id);
      refreshSales();
      loadTodayStats(); // Refresh today's stats from DB
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

          {/* Stats Row - from DB */}
          <div className="px-6 py-3 grid grid-cols-4 gap-4">
            {/* Total Sales Today (from DB) */}
            <div className="bg-gradient-to-br from-blue-900/30 to-blue-900/10 border border-blue-900/50 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400 uppercase font-medium">Total Sales Today</span>
                <TrendingUp size={14} className="text-blue-400" />
              </div>
              <p className="text-2xl font-bold text-white">{formatCurrency(todayStats.total)}</p>
              <p className="text-xs text-blue-400 mt-0.5">{todayStats.count} transactions</p>
            </div>

            {/* Category Count */}
            <div className="bg-gradient-to-br from-purple-900/30 to-purple-900/10 border border-purple-900/50 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400 uppercase font-medium">Categories</span>
                <Tag size={14} className="text-purple-400" />
              </div>
              <p className="text-2xl font-bold text-white">{categories.length - 1}</p>
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
              <p className="text-xs text-orange-400 mt-0.5">{formatCurrency(total)} total</p>
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

            {/* Customer Selector (disabled in view mode – saved sale read-only) */}
            <Popover open={customerOpen} onOpenChange={(open) => !isViewMode && setCustomerOpen(open)}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={customerOpen}
                  disabled={isViewMode}
                  className={cn(
                    "w-[280px] justify-between bg-gray-800/50 border-gray-700 text-white h-10",
                    isViewMode ? "opacity-60 cursor-not-allowed" : "hover:bg-gray-800"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-gray-400" />
                    <span className="text-sm">
                      {isViewMode && viewingSale ? (viewingSale.customerName || 'Walk-in Customer') : (selectedCustomerData?.name || "Select customer")}
                    </span>
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
                  type="button"
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={isViewMode ? undefined : { scale: 1.02, y: -4 }}
                  whileTap={isViewMode ? undefined : { scale: 0.98 }}
                  onClick={() => !isViewMode && addToCart(product)}
                  disabled={isViewMode}
                  className={cn(
                    "relative aspect-square p-4 rounded-xl flex flex-col justify-between items-start text-left transition-all border border-gray-700/50 bg-gradient-to-br group overflow-hidden",
                    isViewMode ? "opacity-60 cursor-not-allowed" : "hover:border-blue-500/50 shadow-lg hover:shadow-xl hover:shadow-blue-900/30",
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
                          {formatCurrency(isWholesale ? product.wholesalePrice : product.retailPrice)}
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
        
        {/* Invoice: number + Prev/Next + Edit (inline only) + New sale */}
        <div className={cn(
          "px-5 py-3 border-b border-gray-800 shrink-0",
          editMode ? "bg-amber-900/20 border-amber-800/50" : "bg-gradient-to-r from-purple-900/20 to-blue-900/20"
        )}>
          {editMode && (
            <div className="flex items-center gap-2 mb-2 text-amber-400 text-xs font-semibold">
              <FileEdit size={14} />
              Editing POS Invoice
            </div>
          )}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <Hash size={16} className="text-purple-400 shrink-0" />
              <span className="text-xs text-gray-400 uppercase font-medium shrink-0">Invoice</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg"
                disabled={posSalesList.length === 0 || editMode}
                onClick={() => {
                  if (posSalesList.length === 0 || editMode) return;
                  setEditMode(false);
                  setCart([]);
                  const next = selectedSaleIndex <= 0 ? posSalesList.length - 1 : selectedSaleIndex - 1;
                  setSelectedSaleIndex(next);
                }}
                title="Previous sale"
              >
                <ChevronLeft size={18} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg"
                disabled={posSalesList.length === 0 || editMode}
                onClick={() => {
                  if (posSalesList.length === 0 || editMode) return;
                  setEditMode(false);
                  setCart([]);
                  const next = selectedSaleIndex >= posSalesList.length - 1 ? 0 : selectedSaleIndex + 1;
                  setSelectedSaleIndex(next);
                }}
                title="Next sale"
              >
                <ChevronRight size={18} />
              </Button>
          </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900/70 rounded-lg border border-purple-900/50 min-w-0 flex-1">
              <Receipt size={14} className="text-purple-400 shrink-0" />
              <span className="text-sm font-mono font-bold text-white truncate">{invoiceNumber}</span>
            </div>
            {selectedSaleId && !editMode ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 text-xs border-purple-700 text-purple-300 hover:bg-purple-900/30"
                  onClick={enterEditMode}
                  disabled={!viewingSale?.items?.length || loadingSale}
                >
                  <FileEdit size={12} className="mr-1" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 shrink-0 text-xs text-gray-400 hover:text-white"
                  onClick={() => {
                    setEditMode(false);
                    setSelectedSaleIndex(-1);
                    setCart([]);
                    setDiscountValue('');
                    setSelectedCustomer('walk-in');
                  }}
                >
                  New
                </Button>
              </>
            ) : null}
          </div>
          {posSalesList.length > 0 && (
            <p className="text-[10px] text-gray-500 mt-1.5">
              {selectedSaleIndex === -1 ? 'New order' : `${selectedSaleIndex + 1} / ${posSalesList.length} POS sales`}
            </p>
          )}
        </div>

        {/* Cart / View Header */}
        <div className="h-14 px-5 flex items-center justify-between border-b border-gray-800 bg-gray-950/50 shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-blue-400" />
            <h2 className="font-bold text-white text-lg">
              {editMode ? 'Editing' : selectedSaleIndex >= 0 && viewingSale ? 'Viewing' : 'Current Order'}
            </h2>
            <Badge variant="secondary" className="bg-blue-900/30 text-blue-400 border-blue-900/50 text-xs">
              {editMode || selectedSaleIndex === -1 ? cartCount : (viewingSale?.items?.length ?? 0)} {editMode || selectedSaleIndex === -1 ? (cartCount === 1 ? 'item' : 'items') : 'items'}
            </Badge>
          </div>
          {cart.length > 0 && (editMode || selectedSaleIndex === -1) && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={editMode ? exitEditMode : clearCart}
              className="text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg h-8 w-8"
            >
              <Trash2 size={16} />
            </Button>
          )}
        </div>

        {/* Cart Items or Viewing Sale (read-only) - Scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loadingSale && selectedSaleId ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Loader2 size={40} className="text-blue-500 animate-spin mb-3" />
              <p className="text-gray-400 text-sm">Loading sale...</p>
            </div>
          ) : selectedSaleIndex >= 0 && viewingSale?.items?.length && !editMode ? (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 mb-2">Read-only. Click Edit to modify this invoice.</p>
              {viewingSale.items.map((item: SaleItem, i: number) => (
                <div key={item.productId + i} className="bg-gray-800/50 border border-gray-700 rounded-xl p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-white text-sm mb-1">{item.productName}</h4>
                      <p className="text-xs text-gray-500">{formatCurrency(item.price || 0)} × {item.quantity}</p>
                    </div>
                    <p className="font-bold text-blue-400 text-sm">{formatCurrency(item.total || 0)}</p>
                  </div>
                </div>
              ))}
              <div className="pt-3 border-t border-gray-700 space-y-1 text-sm">
                <div className="flex justify-between text-gray-400"><span>Subtotal</span><span>{formatCurrency(viewingSale.subtotal || 0)}</span></div>
                {(viewingSale.discount || 0) > 0 && <div className="flex justify-between text-green-400"><span>Discount</span><span>-{formatCurrency(viewingSale.discount || 0)}</span></div>}
                <div className="flex justify-between text-gray-400"><span>Tax</span><span>{formatCurrency(viewingSale.tax || 0)}</span></div>
                <div className="flex justify-between font-bold text-white pt-2"><span>Total</span><span>{formatCurrency(viewingSale.total || 0)}</span></div>
                <div className="flex justify-between text-green-400"><span>Paid</span><span>{formatCurrency(viewingSalePayments.length > 0 ? viewingSalePayments.reduce((s, p) => s + (p.amount || 0), 0) : (viewingSale.paid || 0))}</span></div>
              </div>
            </div>
          ) : cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="bg-gray-800/50 rounded-full p-6 mb-4">
                <ShoppingCart size={48} className="text-gray-600" />
              </div>
              <p className="text-gray-500 font-medium">Cart is empty</p>
              <p className="text-xs text-gray-600 mt-1">Add products or select a POS sale to edit</p>
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
                        {formatCurrency((item.customPrice !== undefined ? item.customPrice : getPrice(item)) * item.qty)}
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

        {/* PAYMENT SECTION: New order (Cash/Card) or Edit mode (Save/Cancel) */}
        {(editMode && cart.length > 0) || (selectedSaleIndex === -1 && cart.length > 0) ? (
          <div className="border-t border-gray-800 bg-gray-950/70 backdrop-blur-sm shrink-0">
            {/* Discount Section */}
            <div className="px-5 py-4 border-b border-gray-800">
              <Label className="text-xs text-gray-400 uppercase font-medium mb-2 block">Discount</Label>
              <div className="flex gap-2">
                <div className="flex bg-gray-900 rounded-lg border border-gray-700 p-1">
                  <button
                    onClick={() => setDiscountType('percentage')}
                    className={cn(
                      "px-3 py-1.5 rounded text-xs font-medium transition-all",
                      discountType === 'percentage' ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
                    )}
                  >
                    <Percent size={12} className="inline mr-1" />%
                  </button>
                  <button
                    onClick={() => setDiscountType('amount')}
                    className={cn(
                      "px-3 py-1.5 rounded text-xs font-medium transition-all",
                      discountType === 'amount' ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
                    )}
                  >
                    <DollarSign size={12} className="inline mr-1" />{currencySymbol}
                  </button>
                </div>
                <div className="flex-1 relative">
                  {discountType === 'percentage' ? <Percent size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" /> : <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />}
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
                <p className="text-xs text-green-400 mt-2">Discount applied: -{formatCurrency(discountAmount)}{discountType === 'percentage' && ` (${discountValue}%)`}</p>
              )}
            </div>

            {/* Totals */}
            <div className="px-5 py-4 space-y-2 border-b border-gray-800">
              <div className="flex justify-between text-sm"><span className="text-gray-400">Subtotal</span><span className="text-white font-medium">{formatCurrency(subtotal)}</span></div>
              {discountAmount > 0 && <div className="flex justify-between text-sm"><span className="text-gray-400">Discount</span><span className="text-green-400 font-medium">-{formatCurrency(discountAmount)}</span></div>}
              <div className="flex justify-between text-sm"><span className="text-gray-400">Tax (10%)</span><span className="text-white font-medium">{formatCurrency(tax)}</span></div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-700">
                <span className="text-base font-semibold text-white">Total</span>
                <span className="text-2xl font-bold text-blue-400">{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Amount Difference + Editable Payment – only in EDIT MODE (view mode = hidden) */}
            {editMode && viewingSale && (
              <div className="px-5 py-3 border-b border-gray-800 bg-amber-900/10 border-amber-800/30 rounded-lg mx-2 mb-2">
                <p className="text-xs text-amber-400/90 font-semibold uppercase mb-2">Amount difference</p>
                <div className="space-y-1.5 text-sm mb-3">
                  <div className="flex justify-between text-gray-400"><span>Old total</span><span>{formatCurrency(viewingSale.total ?? 0)}</span></div>
                  <div className="flex justify-between text-white"><span>New total</span><span>{formatCurrency(total)}</span></div>
                  <div className={cn(
                    "flex justify-between font-semibold pt-1.5 border-t border-amber-800/40",
                    total - (viewingSale.total ?? 0) >= 0 ? "text-green-400" : "text-red-400"
                  )}>
                    <span>Difference</span>
                    <span>{total - (viewingSale.total ?? 0) >= 0 ? '+' : ''}{(total - (viewingSale.total ?? 0)).toFixed(2)}</span>
                  </div>
                </div>
                <p className="text-xs text-amber-400/90 font-semibold uppercase mb-2">Payment received (editable)</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <DollarSign size={14} className="text-gray-500 shrink-0" />
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={editPaidAmount}
                      onChange={(e) => setEditPaidAmount(parseFloat(e.target.value) || 0)}
                      className="bg-gray-900 border-gray-700 text-white h-9 flex-1"
                      placeholder="Amount received"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn("flex-1 h-8 text-xs", editPaymentMethod === 'Cash' ? "bg-green-900/40 border-green-700 text-green-300" : "border-gray-600 text-gray-400")}
                      onClick={() => setEditPaymentMethod('Cash')}
                    >
                      <Banknote size={12} className="mr-1" /> Cash
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn("flex-1 h-8 text-xs", editPaymentMethod === 'Card' ? "bg-blue-900/40 border-blue-700 text-blue-300" : "border-gray-600 text-gray-400")}
                      onClick={() => setEditPaymentMethod('Card')}
                    >
                      <CreditCard size={12} className="mr-1" /> Card
                    </Button>
                  </div>
                  <div className="flex justify-between text-sm pt-1 border-t border-amber-800/40">
                    <span className="text-gray-400">Due</span>
                    <span className={cn(Math.max(0, total - editPaidAmount) > 0 ? "text-amber-400 font-medium" : "text-green-400")}>
                      {formatCurrency(Math.max(0, total - editPaidAmount))}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Buttons: Edit mode = Save + Cancel; New order = Cash + Card */}
            <div className="px-5 py-4 grid grid-cols-2 gap-3">
              {editMode ? (
                <>
                  <Button
                    className="bg-green-600 hover:bg-green-500 text-white font-semibold h-12 rounded-xl"
                    onClick={handleSavePosEdit}
                  >
                    Save
                  </Button>
                  <Button
                    variant="outline"
                    className="border-gray-600 text-gray-300 hover:bg-gray-800 h-12 rounded-xl"
                    onClick={exitEditMode}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
              <Button 
                className="bg-green-600 hover:bg-green-500 text-white font-semibold h-12 rounded-xl shadow-lg shadow-green-900/30"
                    onClick={async () => { await handleCheckout('cash', total); }}
                disabled={loading || !companyId || !user}
              >
                <Banknote size={18} className="mr-2" />
                Cash Payment
              </Button>
              <Button 
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold h-12 rounded-xl shadow-lg shadow-blue-900/30"
                    onClick={async () => { await handleCheckout('card', total); }}
                disabled={loading || !companyId || !user}
              >
                <CreditCard size={18} className="mr-2" />
                Card Payment
              </Button>
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};