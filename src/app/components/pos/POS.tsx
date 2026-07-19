import { getCurrentLocalTimestamp, localNowDateString } from '@/app/utils/localDate';
import { rankProductSearchHit, preferExactSkuHits, PRODUCT_SEARCH_RESULT_CAP } from '@/app/utils/productSearchRank';
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
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
  Scissors,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FileEdit,
  Building2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigation } from '../../context/NavigationContext';
import { useSupabase } from '../../context/SupabaseContext';
import { useGlobalFilterOptional } from '../../context/GlobalFilterContext';
import { productService } from '../../services/productService';
import { branchService, type Branch } from '../../services/branchService';
import { fetchBranchStockMaps } from '../../services/inventoryService';
import { contactService } from '../../services/contactService';
import { saleService } from '../../services/saleService';
import { useSales } from '../../context/SalesContext';
import { useSettings } from '../../context/SettingsContext';
import { settingsService } from '../../services/settingsService';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { cn } from "../ui/utils";
import { formatQty } from '@/app/utils/quantity';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { toast } from 'sonner';
import { UnifiedPaymentDialog } from '../shared/UnifiedPaymentDialog';
import type { Sale, SaleItem } from '@/app/context/SalesContext';
import { BespokeDetailsModal } from '../bespoke/BespokeDetailsModal';
import type { CustomizationDetails } from '@/app/types/bespoke';
import { buildBespokeMetadataForPersist } from '@/app/types/bespoke';
import { ProductImage } from '../products/ProductImage';
import { getPrimaryProductImageUrl } from '@/app/utils/productImageResolve';
import type { BespokeInjectionPayload } from '@/app/lib/bespokeCartInjection';
import {
  syncFabricChildLines,
  orderSaleLinesForPersist,
  hydrateFabricDraftsFromChildren,
  isInjectedBespokeLine,
  resolveFabricMaterialRetailPrice,
} from '@/app/lib/bespokeCartInjection';

interface POSVariation {
  id: string;
  name?: string;
  sku?: string;
  current_stock?: number;
  retail_price?: number;
  wholesale_price?: number;
}

interface POSProduct {
  id: string;
  name: string;
  retailPrice: number;
  wholesalePrice: number;
  category: string;
  stock: number;
  color: string;
  imageUrl?: string;
  variations?: POSVariation[];
}

interface POSCustomer {
  id: string;
  name: string;
}

interface CartItem {
  id: string;
  name: string;
  sku?: string;
  retailPrice: number;
  wholesalePrice: number;
  qty: number;
  customPrice?: number;
  productId: string;
  variationId?: string;
  customizationDetails?: CustomizationDetails;
  bespokeParentCartId?: string;
  bespokeRole?: 'fabric';
  isBespokeInjected?: boolean;
  parentLineIndex?: number;
}

interface POSExtraExpense {
  id: string;
  type: 'stitching' | 'lining' | 'dying' | 'cargo' | 'other';
  amount: number;
  notes?: string;
}

export const POS = () => {
  const { setCurrentView } = useNavigation();
  const { companyId, branchId, setBranchId, accessibleBranchIds, user } = useSupabase();
  const globalFilter = useGlobalFilterOptional();
  const { sales, createSale, updateSale, refreshSales, getSaleById } = useSales();
  const { posSettings, businessSettings } = useSettings();
  const enableBespoke = businessSettings.enableBespokeOrders;
  const bespokeFormConfig = businessSettings.bespokeFormConfig;
  // Company-level setting from DB (same for all users — not context)
  const [allowNegativeStock, setAllowNegativeStock] = useState(false);
  const { formatCurrency, currencySymbol } = useFormatCurrency();
  const [products, setProducts] = useState<POSProduct[]>([]);
  const [customers, setCustomers] = useState<POSCustomer[]>([
    { id: "walk-in", name: "Walk-in Customer" }
  ]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [bespokeCartId, setBespokeCartId] = useState<string | null>(null);
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
  // Proceed to Payment flow: create sale first, then open payment dialog (same as Sales)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentDialogSaleId, setPaymentDialogSaleId] = useState<string | null>(null);
  const [paymentDialogInvoiceNo, setPaymentDialogInvoiceNo] = useState<string | null>(null);
  const [paymentDialogTotal, setPaymentDialogTotal] = useState(0);
  const [posSaveInProgress, setPosSaveInProgress] = useState(false);
  const posSaveInProgressRef = React.useRef(false);
  const [extraExpenses, setExtraExpenses] = useState<POSExtraExpense[]>([]);
  const [newExpenseType, setNewExpenseType] = useState<POSExtraExpense['type']>('stitching');
  const [newExpenseAmount, setNewExpenseAmount] = useState(0);
  const [newExpenseNotes, setNewExpenseNotes] = useState('');

  const [posBranches, setPosBranches] = useState<Branch[]>([]);
  const [loadingPosBranches, setLoadingPosBranches] = useState(false);
  const prevBranchIdRef = useRef<string | null>(branchId);

  const posBranchReady = Boolean(branchId && branchId !== 'all');
  const showPosBranchPicker = posBranches.length > 1;

  const applyPosBranchId = useCallback(
    (id: string) => {
      if (!id || id === 'all') return;
      setBranchId(id);
      globalFilter?.setBranchId(id);
    },
    [setBranchId, globalFilter],
  );

  const loadPosBranches = useCallback(async () => {
    if (!companyId) {
      setPosBranches([]);
      return;
    }
    setLoadingPosBranches(true);
    try {
      const all = await branchService.getBranchesCached(companyId);
      const filtered =
        accessibleBranchIds.length > 0
          ? all.filter((b) => accessibleBranchIds.includes(b.id))
          : all;
      setPosBranches(filtered.filter((b) => b.is_active !== false));
    } catch (e) {
      console.error('[POS] Failed to load branches:', e);
      toast.error('Failed to load branches');
      setPosBranches([]);
    } finally {
      setLoadingPosBranches(false);
    }
  }, [companyId, accessibleBranchIds]);

  useEffect(() => {
    loadPosBranches();
  }, [loadPosBranches]);

  useEffect(() => {
    if (posBranches.length !== 1) return;
    const onlyId = posBranches[0].id;
    if (branchId === onlyId) return;
    if (!branchId || branchId === 'all') {
      applyPosBranchId(onlyId);
    }
  }, [posBranches, branchId, applyPosBranchId]);

  useEffect(() => {
    const prev = prevBranchIdRef.current;
    if (
      prev &&
      prev !== 'all' &&
      branchId &&
      branchId !== 'all' &&
      prev !== branchId &&
      cart.length > 0
    ) {
      toast.info('Branch changed — cart cleared; stock is branch-specific');
      setCart([]);
      setBespokeCartId(null);
    }
    prevBranchIdRef.current = branchId;
  }, [branchId, cart.length]);

  const isViewMode = selectedSaleIndex >= 0 && !editMode;
  const isEditable = editMode || selectedSaleIndex === -1;

  // Variation selection modal: when product has variations, pick one before adding to cart
  const [variationModalProduct, setVariationModalProduct] = useState<POSProduct | null>(null);

  // Load company-level negative stock setting from DB (single source of truth for all users)
  useEffect(() => {
    if (!companyId) return;
    settingsService.getAllowNegativeStock(companyId).then(setAllowNegativeStock);
  }, [companyId]);

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
    const parentCartIds = new Map<string, string>();
    viewingSale.items.forEach((item: SaleItem) => {
      if (!item.bespokeParentItemId) {
        parentCartIds.set(item.id, item.id);
      }
    });
    const cartItems: CartItem[] = viewingSale.items.map((item: SaleItem) => {
      const isFabricChild = !!item.bespokeParentItemId;
      const cartId = item.id;
      if (isFabricChild) {
        const parentCartId = parentCartIds.get(item.bespokeParentItemId!) ?? item.bespokeParentItemId!;
        return {
          id: cartId,
          name: item.productName || '',
          sku: item.sku,
          retailPrice: item.price || 0,
          wholesalePrice: item.price || 0,
          qty: item.quantity,
          productId: item.productId,
          variationId: item.variationId,
          bespokeParentCartId: parentCartId,
          bespokeRole: 'fabric' as const,
          isBespokeInjected: true,
        };
      }
      return {
        id: cartId,
        name: item.productName || '',
        sku: item.sku,
        retailPrice: item.price || 0,
        wholesalePrice: item.price || 0,
        qty: item.quantity,
        productId: item.productId,
        variationId: item.variationId,
        customizationDetails: item.customizationDetails as CustomizationDetails | undefined,
      };
    });
    setCart(cartItems);
    const chargeRows = (viewingSale.charges || []).filter(
      (c) => {
        const t = (c.charge_type || c.chargeType || '').toLowerCase();
        return t !== 'shipping' && t !== 'discount';
      },
    );
    setExtraExpenses(
      chargeRows.map((c, idx) => ({
        id: `exp-${idx}`,
        type: ((c.charge_type || c.chargeType || 'other') as POSExtraExpense['type']),
        amount: Number(c.amount) || 0,
      })),
    );
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

  const getPrice = (item: CartItem) => isWholesale ? item.wholesalePrice : item.retailPrice;

  const getLineUnitPrice = (item: CartItem) => {
    if (item.customPrice !== undefined) return item.customPrice;
    return getPrice(item);
  };

  const buildPosSaleItems = useCallback((cartItems: CartItem[]) => {
    const ordered = orderSaleLinesForPersist(
      cartItems.map((c) => ({
        id: c.id,
        productId: c.productId,
        name: c.name,
        sku: c.sku ?? 'N/A',
        price: getLineUnitPrice(c),
        qty: c.qty,
        variationId: c.variationId,
        customizationDetails: c.customizationDetails as Record<string, unknown> | undefined,
        bespokeParentCartId: c.bespokeParentCartId,
        bespokeRole: c.bespokeRole,
        isBespokeInjected: c.isBespokeInjected,
      })),
    );
    return ordered.map((item) => {
      const unit = item.price;
      const meta = buildBespokeMetadataForPersist(item.customizationDetails);
      return {
        id: '',
        productId: item.productId,
        variationId: item.variationId,
        productName: item.name,
        sku: item.sku ?? 'N/A',
        quantity: item.qty,
        price: unit,
        discount: 0,
        tax: 0,
        total: unit * item.qty,
        customizationDetails: meta ?? item.customizationDetails,
        parentLineIndex: item.parentLineIndex,
        bespokeParentCartId: item.bespokeParentCartId,
      };
    });
  }, []);

  const handleBespokeSave = (cartId: string, payload: BespokeInjectionPayload) => {
    const { items: nextCart } = syncFabricChildLines(
      cart,
      cartId,
      payload.fabrics,
      resolveFabricMaterialRetailPrice,
      () => `fabric-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    );
    setCart(
      nextCart.map((row) => {
        if (row.isBespokeInjected) {
          const unit = Number((row as { price?: number }).price) || 0;
          return {
            ...row,
            retailPrice: unit,
            wholesalePrice: unit,
          } as CartItem;
        }
        if (row.id !== cartId) return row;
        const meta = buildBespokeMetadataForPersist(payload.metadata);
        return { ...row, customizationDetails: meta ?? undefined };
      }),
    );
    setBespokeCartId(null);
    toast.success('Customization saved');
  };

  // Calculate subtotal with custom prices (must be before handleSavePosEdit)
  const subtotal = cart.reduce((sum, item) => sum + getLineUnitPrice(item) * item.qty, 0);

  const discountAmount = useMemo(() => {
    const value = parseFloat(discountValue) || 0;
    if (discountType === 'percentage') {
      return (subtotal * value) / 100;
    }
    return value;
  }, [discountValue, discountType, subtotal]);

  const expensesTotal = extraExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  const afterDiscount = subtotal - discountAmount;
  const tax = 0;
  const total = afterDiscount + expensesTotal;

  const selectedCustomerData = customers.find(c => c.id === selectedCustomer);

  // Save POS sale (update only, no new invoice). Backend safety: only allow update when mode === edit.
  const handleSavePosEdit = useCallback(async () => {
    if (!editMode || !selectedSaleId || !viewingSale || cart.length === 0) return;
    try {
      const saleItems = buildPosSaleItems(cart);
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
        extraExpenses,
        replaceSaleCharges: true,
        expenses: expensesTotal,
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
  }, [editMode, selectedSaleId, viewingSale, cart, subtotal, discountAmount, tax, total, expensesTotal, extraExpenses, editPaidAmount, editPaymentMethod, selectedCustomer, selectedCustomerData, updateSale, refreshSales, buildPosSaleItems]);

  // Load products and customers from Supabase; when branchId set, overlay branch-scoped stock from stock_movements
  const loadData = useCallback(async () => {
    if (!companyId) return;
    
    try {
      setLoading(true);
      
      const productsData = await productService.getAllProducts(companyId);
      const convertedProducts: POSProduct[] = productsData
        .filter((p: any) => p.is_sellable !== false && p.is_active !== false)
        .map((p: any) => {
          const variations = (p.variations || []).filter((v: any) => v && v.id);
          const hasVariations = variations.length > 0;
          const baseStock = p.stock ?? 0;
          return {
            id: p.id,
            name: p.name || '',
            retailPrice: p.retail_price || 0,
            wholesalePrice: p.wholesale_price || p.retail_price || 0,
            category: p.category?.name || 'Uncategorized',
            stock: hasVariations ? 0 : baseStock,
            color: 'from-blue-600/20 to-blue-900/20',
            imageUrl: getPrimaryProductImageUrl(p as Record<string, unknown>) || undefined,
            variations: hasVariations ? variations.map((v: any) => ({
              id: v.id,
              name: v.name || v.sku,
              sku: v.sku,
              current_stock: (v as any).stock ?? 0,
              retail_price: v.retail_price ?? v.price ?? p.retail_price ?? 0,
              wholesale_price: v.wholesale_price ?? v.retail_price ?? p.wholesale_price ?? 0,
            })) : undefined,
          };
        });
      setProducts(convertedProducts);

      if (branchId && branchId !== 'all') {
        try {
          const stockMeta = convertedProducts.map((p) => ({
            id: p.id,
            hasVariations: Boolean(p.variations?.length),
          }));
          const { productStockMap, variationStockMap } = await fetchBranchStockMaps(
            companyId,
            branchId,
            stockMeta,
          );
          setProducts((prev) =>
            prev.map((p) => {
              if (p.variations?.length) {
                return {
                  ...p,
                  variations: p.variations.map((v) => ({
                    ...v,
                    current_stock: variationStockMap[v.id] ?? (v as { current_stock?: number }).current_stock ?? 0,
                  })),
                };
              }
              return { ...p, stock: productStockMap[p.id] ?? p.stock };
            }),
          );
        } catch (e) {
          console.warn('[POS] Branch stock overlay failed, using product stock:', e);
        }
      }
      
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
  }, [companyId, branchId]);

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
      const today = localNowDateString();
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

  const addToCart = (product: POSProduct, variation?: POSVariation) => {
    const effectiveId = variation ? `${product.id}_${variation.id}` : product.id;
    const effectiveName = variation ? `${product.name} (${variation.name || variation.sku || 'Variation'})` : product.name;
    const effectiveRetail = variation ? (variation.retail_price ?? product.retailPrice) : product.retailPrice;
    const effectiveWholesale = variation ? (variation.wholesale_price ?? product.wholesalePrice) : product.wholesalePrice;
    setCart(prev => {
      const existing = prev.find(p => p.id === effectiveId);
      if (existing) {
        return prev.map(p => p.id === effectiveId ? { ...p, qty: p.qty + 1 } : p);
      }
      return [...prev, {
        id: effectiveId,
        name: effectiveName,
        retailPrice: effectiveRetail,
        wholesalePrice: effectiveWholesale,
        qty: 1,
        productId: product.id,
        variationId: variation?.id,
      }];
    });
    setVariationModalProduct(null);
  };

  const onProductClick = (product: POSProduct) => {
    if (isViewMode) return;
    if (product.variations && product.variations.length > 0) {
      setVariationModalProduct(product);
    } else {
      addToCart(product);
    }
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

  // Update line price (fabric injected lines: retail; others: customPrice override)
  const updateCustomPrice = (id: string, price: string) => {
    const priceValue = parseFloat(price);
    setCart(prev => prev.map(p => {
      if (p.id !== id) return p;
      if (isNaN(priceValue)) {
        if (p.isBespokeInjected) {
          return { ...p, retailPrice: 0, wholesalePrice: 0, customPrice: undefined };
        }
        return { ...p, customPrice: undefined };
      }
      if (p.isBespokeInjected) {
        return {
          ...p,
          retailPrice: priceValue,
          wholesalePrice: priceValue,
          customPrice: priceValue,
        };
      }
      return { ...p, customPrice: priceValue };
    }));
  };

  const removeItem = (id: string) => {
    setCart(prev => prev.filter(p => p.id !== id && p.bespokeParentCartId !== id));
  };

  const addExtraExpense = () => {
    if (newExpenseAmount <= 0) return;
    setExtraExpenses(prev => [...prev, {
      id: Date.now().toString(),
      type: newExpenseType,
      amount: newExpenseAmount,
      notes: newExpenseNotes || undefined,
    }]);
    setNewExpenseAmount(0);
    setNewExpenseNotes('');
    toast.success('Expense added');
  };

  const removeExtraExpense = (expId: string) => {
    setExtraExpenses(prev => prev.filter(e => e.id !== expId));
  };

  const clearCart = () => {
    setCart([]);
    setExtraExpenses([]);
    setSelectedCustomer("walk-in");
    setDiscountValue('');
  };

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);

  const filteredProducts = useMemo(() => {
    const term = search.trim();
    const results = products.filter((p) => {
      const matchesCategory = activeCategory === 'All' || p.category === activeCategory;
      if (!matchesCategory) return false;
      if (!term) return true;
      return rankProductSearchHit(p, term) < 99;
    });
    if (!term) return results;
    let sorted = [...results].sort((a, b) => {
      const ra = rankProductSearchHit(a, term);
      const rb = rankProductSearchHit(b, term);
      if (ra !== rb) return ra - rb;
      return String(a.name).localeCompare(String(b.name));
    });
    sorted = preferExactSkuHits(sorted, term);
    if (sorted.length > PRODUCT_SEARCH_RESULT_CAP) {
      sorted = sorted.slice(0, PRODUCT_SEARCH_RESULT_CAP);
    }
    return sorted;
  }, [products, search, activeCategory]);

  // Get current date and time
  const currentDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  // Proceed to Payment: create sale (unpaid), then open payment dialog (same flow as Sales)
  const handleProceedToPayment = async () => {
    if (posSaveInProgressRef.current) return;
    if (!companyId || !user || cart.length === 0) {
      toast.error('Missing required information');
      return;
    }
    if (!branchId || branchId === 'all') {
      toast.error('Please select a branch. POS requires a specific branch.');
      return;
    }
    posSaveInProgressRef.current = true;
    setPosSaveInProgress(true);

    // Company-level setting from DB: block only when negative stock not allowed
    if (!allowNegativeStock) {
      const key = (pid: string, vid?: string) => vid ? `${pid}_${vid}` : pid;
      const qtyByKey = cart.reduce<Record<string, number>>((acc, item) => {
        const k = key(item.productId, item.variationId);
        acc[k] = (acc[k] ?? 0) + item.qty;
        return acc;
      }, {});
      for (const [k, totalQty] of Object.entries(qtyByKey)) {
        const idx = k.indexOf('_');
        const pid = idx >= 0 ? k.slice(0, idx) : k;
        const vid = idx >= 0 ? k.slice(idx + 1) : undefined;
        const product = products.find(p => p.id === pid);
        if (!product) continue;
        let stock: number;
        if (vid && product.variations?.length) {
          const v = product.variations.find((vr: POSVariation) => vr.id === vid);
          stock = (v as any)?.current_stock ?? (v as any)?.stock ?? 0;
        } else {
          stock = product.stock;
        }
        if (totalQty > stock) {
          toast.error(`${product.name}: total quantity (${totalQty}) exceeds available stock (${stock})`);
          posSaveInProgressRef.current = false;
          setPosSaveInProgress(false);
          return;
        }
      }
    }

    try {
      const customerId = selectedCustomer === 'walk-in' ? null : selectedCustomer;
      const customerName = selectedCustomerData?.name || 'Walk-in Customer';
      const saleItems = buildPosSaleItems(cart);

      const saleData = {
        isPOS: true as const,
        customer: customerId ?? '',
        customerName,
        contactNumber: '',
        date: localNowDateString(),
        location: branchId,
        type: 'invoice' as const,
        status: 'final' as const,
        paymentStatus: 'unpaid' as const,
        paymentMethod: 'Cash',
        shippingStatus: 'delivered' as const,
        itemsCount: saleItems.length,
        subtotal,
        discount: discountAmount,
        tax: 0,
        expenses: expensesTotal,
        total,
        paid: 0,
        due: total,
        returnDue: 0,
        items: saleItems,
        extraExpenses,
        salesmanId: (user as any)?.id ?? null,
        commissionAmount: 0,
        commissionPercent: null,
      };

      const newSale = await createSale(saleData);
      setPaymentDialogSaleId(newSale.id);
      setPaymentDialogInvoiceNo(newSale.invoiceNo);
      setPaymentDialogTotal(total);
      setPaymentDialogOpen(true);
    } catch (error: any) {
      console.error('[POS] Error creating sale for payment:', error);
      toast.error('Failed to create sale: ' + (error.message || 'Unknown error'));
    } finally {
      posSaveInProgressRef.current = false;
      setPosSaveInProgress(false);
    }
  };

  const onPaymentSuccess = useCallback(() => {
    const saleId = paymentDialogSaleId;
    const invoiceNo = paymentDialogInvoiceNo;
    clearCart();
    if (saleId) setPendingSelectSaleId(saleId);
    refreshSales();
    loadTodayStats();
    setPaymentDialogOpen(false);
    setPaymentDialogSaleId(null);
    setPaymentDialogInvoiceNo(null);
    setPaymentDialogTotal(0);
    toast.success(`Payment recorded. Invoice: ${invoiceNo || '—'}`);
  }, [paymentDialogSaleId, paymentDialogInvoiceNo]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-white">
      {/* Left Section: Products */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* TOP DASHBOARD STATS */}
        <div className="h-auto border-b border-border bg-gradient-to-r from-gray-900 to-gray-900/95 backdrop-blur-sm shrink-0">
          {/* Header Row */}
          <div className="px-6 py-3 flex items-center justify-between border-b border-border">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setCurrentView('dashboard')} 
                className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl"
              >
                <ArrowLeft size={20} />
              </Button>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
                  POS Terminal
                </h1>
                <p className="text-xs text-muted-foreground">Point of Sale System</p>
              </div>
            </div>

            {/* Branch (POS has no TopHeader — required for checkout) */}
            <div className="flex items-center gap-3 min-w-0">
              {showPosBranchPicker ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg border border-border">
                  <Building2 size={14} className="text-blue-400 shrink-0" />
                  <Select
                    key={posBranchReady ? branchId! : 'pos-branch-unset'}
                    value={posBranchReady ? branchId! : undefined}
                    onValueChange={applyPosBranchId}
                    disabled={loadingPosBranches || posBranches.length === 0}
                  >
                    <SelectTrigger className="h-7 min-w-[140px] max-w-[200px] border-0 bg-transparent p-0 text-xs text-gray-200 shadow-none focus:ring-0">
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent className="bg-input-background border-border text-white">
                      {posBranches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : posBranches.length === 1 && posBranchReady ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg border border-border">
                  <Building2 size={14} className="text-blue-400 shrink-0" />
                  <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                    {posBranches[0].name}
                  </span>
                </div>
              ) : null}
              {!posBranchReady && posBranches.length > 0 && (
                <span className="text-xs text-amber-400 whitespace-nowrap">
                  Select a branch to enable checkout
                </span>
              )}
            </div>

            {/* Date & Time */}
            <div className="flex items-center gap-4 shrink-0">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg border border-border">
                <Calendar size={14} className="text-blue-400" />
                <span className="text-xs text-muted-foreground">{currentDate}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg border border-border">
                <Clock size={14} className="text-[var(--erp-money-positive)]" />
                <span className="text-xs text-muted-foreground">{currentTime}</span>
              </div>
            </div>
          </div>

          {/* Stats Row - from DB */}
          <div className="px-6 py-3 grid grid-cols-4 gap-4">
            {/* Total Sales Today (from DB) */}
            <div className="bg-gradient-to-br from-blue-900/30 to-blue-900/10 border border-blue-900/50 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground uppercase font-medium">Total Sales Today</span>
                <TrendingUp size={14} className="text-blue-400" />
              </div>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(todayStats.total)}</p>
              <p className="text-xs text-blue-400 mt-0.5">{todayStats.count} transactions</p>
            </div>

            {/* Category Count */}
            <div className="bg-gradient-to-br from-purple-900/30 to-purple-900/10 border border-purple-900/50 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground uppercase font-medium">Categories</span>
                <Tag size={14} className="text-purple-400" />
              </div>
              <p className="text-2xl font-bold text-foreground">{categories.length - 1}</p>
              <p className="text-xs text-purple-400 mt-0.5">Active categories</p>
            </div>

            {/* Products Count */}
            <div className="bg-gradient-to-br from-green-900/30 to-green-900/10 border border-green-900/50 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground uppercase font-medium">Products</span>
                <Package size={14} className="text-[var(--erp-money-positive)]" />
              </div>
              <p className="text-2xl font-bold text-foreground">{products.length}</p>
              <p className="text-xs text-[var(--erp-money-positive)] mt-0.5">In stock</p>
            </div>

            {/* Current Cart */}
            <div className="bg-gradient-to-br from-orange-900/30 to-orange-900/10 border border-orange-900/50 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground uppercase font-medium">Current Cart</span>
                <ShoppingCart size={14} className="text-orange-400" />
              </div>
              <p className="text-2xl font-bold text-foreground">{cartCount}</p>
              <p className="text-xs text-orange-400 mt-0.5">{formatCurrency(total)} total</p>
            </div>
          </div>
        </div>

        {/* Search Bar & Customer Selection */}
        <div className="px-6 py-4 border-b border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-3">
            {/* Product Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                type="text"
                placeholder="Search products by name..."
                className="w-full bg-muted/50 border-border rounded-xl pl-10 pr-4 h-10 text-white placeholder:text-muted-foreground"
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
                    "w-[280px] justify-between bg-muted/50 border-border text-white h-10",
                    isViewMode ? "opacity-60 cursor-not-allowed" : "hover:bg-muted"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-muted-foreground" />
                    <span className="text-sm">
                      {isViewMode && viewingSale ? (viewingSale.customerName || 'Walk-in Customer') : (selectedCustomerData?.name || "Select customer")}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0 bg-card border-border" align="start">
                <Command className="bg-card border-0">
                  <CommandInput 
                    placeholder="Search customer..." 
                    className="h-9 bg-input-background border-border text-white placeholder:text-muted-foreground"
                  />
                  <CommandList>
                    <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">No customer found.</CommandEmpty>
                    <CommandGroup>
                      {customers.map((customer) => (
                        <CommandItem
                          key={customer.id}
                          value={customer.name}
                          onSelect={() => {
                            setSelectedCustomer(customer.id);
                            setCustomerOpen(false);
                          }}
                          className="text-white hover:bg-muted cursor-pointer"
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
        <div className="px-6 py-3 border-b border-border bg-muted/30 shrink-0">
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
                      : "bg-muted/50 text-muted-foreground hover:text-foreground border-border hover:border-gray-600 hover:bg-muted"
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
        <div className="flex-1 overflow-y-auto p-6 bg-background">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 size={48} className="text-blue-500 animate-spin" />
            </div>
          ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 pb-8">
            <AnimatePresence>
                {filteredProducts.length === 0 ? (
                  <div className="col-span-full text-center py-12">
                    <Package size={48} className="mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground text-sm">No products found</p>
                    <p className="text-muted-foreground text-xs mt-1">Try adjusting your search or category</p>
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
                  onClick={() => onProductClick(product)}
                  disabled={isViewMode}
                  className={cn(
                    "relative aspect-square p-4 rounded-xl flex flex-col justify-between items-start text-left transition-all border border-border bg-gradient-to-br group overflow-hidden",
                    isViewMode ? "opacity-60 cursor-not-allowed" : "hover:border-blue-500/50 shadow-lg hover:shadow-xl hover:shadow-blue-900/30",
                    product.imageUrl ? 'from-gray-900 to-gray-950' : (product.color || 'from-gray-800 to-gray-900')
                  )}
                >
                  {product.imageUrl ? (
                    <div className="absolute inset-0 z-0">
                      <ProductImage
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover opacity-90"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/70 to-transparent" />
                    </div>
                  ) : null}
                  {/* Stock Badge (for products without variations; with variations show in modal) */}
                  {!product.variations?.length && (
                    <Badge variant="secondary" className="absolute top-2 right-2 bg-black/40 text-white text-[10px] px-1.5 py-0.5 border-0 backdrop-blur-sm">
                      {formatQty(product.stock)} left
                    </Badge>
                  )}
                  {product.variations?.length ? (
                    <Badge variant="secondary" className="absolute top-2 right-2 bg-purple-900/50 text-purple-200 text-[10px] px-1.5 py-0.5 border-0">
                      {product.variations.length} options
                    </Badge>
                  ) : null}

                  {/* Product Name */}
                  <div className="z-10">
                    <h3 className="font-bold text-white text-base leading-tight mb-0.5 group-hover:text-blue-300 transition-colors">
                      {product.name}
                    </h3>
                    <p className="text-[10px] text-muted-foreground">{product.category}</p>
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
      <div className="w-[420px] bg-card border-l border-border flex flex-col shrink-0">
        
        {/* Invoice: number + Prev/Next + Edit (inline only) + New sale */}
        <div className={cn(
          "px-5 py-3 border-b border-border shrink-0",
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
              <span className="text-xs text-muted-foreground uppercase font-medium shrink-0">Invoice</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
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
                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
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
            <div className="flex items-center gap-2 px-3 py-1.5 bg-card/70 rounded-lg border border-purple-900/50 min-w-0 flex-1">
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
                  className="h-8 shrink-0 text-xs text-muted-foreground hover:text-foreground"
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
            <p className="text-[10px] text-muted-foreground mt-1.5">
              {selectedSaleIndex === -1 ? 'New order' : `${selectedSaleIndex + 1} / ${posSalesList.length} POS sales`}
            </p>
          )}
        </div>

        {/* Cart / View Header */}
        <div className="h-14 px-5 flex items-center justify-between border-b border-border bg-muted/40 shrink-0">
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
              <p className="text-muted-foreground text-sm">Loading sale...</p>
            </div>
          ) : selectedSaleIndex >= 0 && viewingSale?.items?.length && !editMode ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground mb-2">Read-only. Click Edit to modify this invoice.</p>
              {viewingSale.items.map((item: SaleItem, i: number) => (
                <div key={item.productId + i} className="bg-muted/50 border border-border rounded-xl p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-foreground text-sm mb-1">{item.productName}</h4>
                      <p className="text-xs text-muted-foreground">{formatCurrency(item.price || 0)} × {item.quantity}</p>
                    </div>
                    <p className="font-bold text-blue-400 text-sm">{formatCurrency(item.total || 0)}</p>
                  </div>
                </div>
              ))}
              <div className="pt-3 border-t border-border space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatCurrency(viewingSale.subtotal || 0)}</span></div>
                {(viewingSale.discount || 0) > 0 && <div className="flex justify-between text-[var(--erp-money-positive)]"><span>Discount</span><span>-{formatCurrency(viewingSale.discount || 0)}</span></div>}
                <div className="flex justify-between font-bold text-white pt-2"><span>Total</span><span>{formatCurrency(viewingSale.total || 0)}</span></div>
                <div className="flex justify-between text-[var(--erp-money-positive)]"><span>Paid</span><span>{formatCurrency(viewingSalePayments.length > 0 ? viewingSalePayments.reduce((s, p) => s + (p.amount || 0), 0) : (viewingSale.paid || 0))}</span></div>
              </div>
            </div>
          ) : cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="bg-muted/50 rounded-full p-6 mb-4">
                <ShoppingCart size={48} className="text-muted-foreground" />
              </div>
              <p className="text-muted-foreground font-medium">Cart is empty</p>
              <p className="text-xs text-muted-foreground mt-1">Add products or select a POS sale to edit</p>
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
                  className="bg-muted/50 border border-border rounded-xl p-3"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground text-sm mb-1">{item.name}</h4>
                      {/* EDITABLE PRICE */}
                      <div className="flex items-center gap-2">
                        <DollarSign size={12} className="text-muted-foreground" />
                        <Input
                          type="number"
                          step="0.01"
                          value={getLineUnitPrice(item)}
                          onChange={(e) => updateCustomPrice(item.id, e.target.value)}
                          className="bg-card border-border text-white h-7 w-20 text-xs px-2"
                          placeholder="Price"
                        />
                        <span className="text-xs text-muted-foreground">× {item.qty}</span>
                        {item.isBespokeInjected && (
                          <span className="text-[10px] text-amber-400/90">Fabric line</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <p className="font-bold text-blue-400 text-sm">
                        {formatCurrency(getLineUnitPrice(item) * item.qty)}
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
                    <div className="flex items-center gap-2 bg-card rounded-lg border border-border p-1">
                      <button
                        onClick={() => updateQty(item.id, -1)}
                        className="text-white hover:bg-muted rounded p-1.5 transition-colors"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="font-bold text-white text-sm min-w-[24px] text-center">
                        {item.qty}
                      </span>
                      <button
                        onClick={() => updateQty(item.id, 1)}
                        className="text-white hover:bg-muted rounded p-1.5 transition-colors"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {item.customizationDetails && (
                        <span className="text-[10px] text-violet-400 flex items-center gap-1">
                          <Scissors size={10} />
                          Customized
                        </span>
                      )}
                      {item.customPrice !== undefined && (
                        <span className="text-[10px] text-yellow-400 flex items-center gap-1">
                          <Edit2 size={10} />
                          Custom Price
                        </span>
                      )}
                    </div>
                  </div>
                  {enableBespoke && !isInjectedBespokeLine(item) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full mt-2 h-7 text-xs border-violet-500/40 text-violet-300 hover:bg-violet-500/10"
                      onClick={() => setBespokeCartId(item.id)}
                    >
                      <Scissors size={12} className="mr-1" />
                      Customize / Add Details
                    </Button>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* PAYMENT SECTION: New order (Cash/Card) or Edit mode (Save/Cancel) */}
        {(editMode && cart.length > 0) || (selectedSaleIndex === -1 && cart.length > 0) ? (
          <div className="border-t border-border bg-input-background/70 backdrop-blur-sm shrink-0">
            {/* Extra Expenses (stitching etc. → sale_charges) */}
            <div className="px-5 py-4 border-b border-border">
              <Label className="text-xs text-muted-foreground uppercase font-medium mb-2 block flex items-center gap-2">
                <DollarSign size={12} className="text-purple-400" />
                Extra Expenses
                {expensesTotal > 0 && (
                  <span className="text-purple-400 normal-case">({formatCurrency(expensesTotal)})</span>
                )}
              </Label>
              <div className="flex gap-2 mb-2 flex-wrap">
                <Select value={newExpenseType} onValueChange={(v) => setNewExpenseType(v as POSExtraExpense['type'])}>
                  <SelectTrigger className="w-[110px] bg-card border-border text-white h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-input-background border-border text-white">
                    <SelectItem value="stitching">Stitching</SelectItem>
                    <SelectItem value="lining">Lining</SelectItem>
                    <SelectItem value="dying">Dying</SelectItem>
                    <SelectItem value="cargo">Cargo</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="Amount"
                  className="bg-card border-border text-white h-8 w-[90px] text-xs"
                  value={newExpenseAmount > 0 ? newExpenseAmount : ''}
                  onChange={(e) => setNewExpenseAmount(parseFloat(e.target.value) || 0)}
                />
                <Button onClick={addExtraExpense} className="bg-purple-600 hover:bg-purple-500 h-8 px-3 text-xs">
                  <Plus size={14} className="mr-1" /> Add
                </Button>
              </div>
              {extraExpenses.length > 0 && (
                <div className="space-y-1">
                  {extraExpenses.map((exp) => (
                    <div key={exp.id} className="flex justify-between items-center text-xs bg-card rounded px-2 py-1.5 border border-border">
                      <span className="text-muted-foreground capitalize">{exp.type}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-foreground">{formatCurrency(exp.amount)}</span>
                        <button type="button" onClick={() => removeExtraExpense(exp.id)} className="text-muted-foreground hover:text-red-400">
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Discount Section */}
            <div className="px-5 py-4 border-b border-border">
              <Label className="text-xs text-muted-foreground uppercase font-medium mb-2 block">Discount</Label>
              <div className="flex gap-2">
                <div className="flex bg-card rounded-lg border border-border p-1">
                  <button
                    onClick={() => setDiscountType('percentage')}
                    className={cn(
                      "px-3 py-1.5 rounded text-xs font-medium transition-all",
                      discountType === 'percentage' ? "bg-blue-600 text-white" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Percent size={12} className="inline mr-1" />%
                  </button>
                  <button
                    onClick={() => setDiscountType('amount')}
                    className={cn(
                      "px-3 py-1.5 rounded text-xs font-medium transition-all",
                      discountType === 'amount' ? "bg-blue-600 text-white" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <DollarSign size={12} className="inline mr-1" />{currencySymbol}
                  </button>
                </div>
                <div className="flex-1 relative">
                  {discountType === 'percentage' ? <Percent size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /> : <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />}
                  <Input
                    type="number"
                    placeholder={discountType === 'percentage' ? "0" : "0.00"}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="bg-card border-border text-white h-9 pl-8 pr-3"
                  />
                </div>
              </div>
              {discountAmount > 0 && (
                <p className="text-xs text-[var(--erp-money-positive)] mt-2">Discount applied: -{formatCurrency(discountAmount)}{discountType === 'percentage' && ` (${discountValue}%)`}</p>
              )}
            </div>

            {/* Totals (no automatic tax; same as standard Sale module) */}
            <div className="px-5 py-4 space-y-2 border-b border-border">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="text-white font-medium">{formatCurrency(subtotal)}</span></div>
              {discountAmount > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Discount</span><span className="text-[var(--erp-money-positive)] font-medium">-{formatCurrency(discountAmount)}</span></div>}
              {expensesTotal > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Extra expenses</span><span className="text-purple-300 font-medium">{formatCurrency(expensesTotal)}</span></div>}
              <div className="flex justify-between items-center pt-2 border-t border-border">
                <span className="text-base font-semibold text-foreground">Total</span>
                <span className="text-2xl font-bold text-blue-400">{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Amount Difference + Editable Payment – only in EDIT MODE (view mode = hidden) */}
            {editMode && viewingSale && (
              <div className="px-5 py-3 border-b border-border bg-amber-900/10 border-amber-800/30 rounded-lg mx-2 mb-2">
                <p className="text-xs text-amber-400/90 font-semibold uppercase mb-2">Amount difference</p>
                <div className="space-y-1.5 text-sm mb-3">
                  <div className="flex justify-between text-muted-foreground"><span>Old total</span><span>{formatCurrency(viewingSale.total ?? 0)}</span></div>
                  <div className="flex justify-between text-white"><span>New total</span><span>{formatCurrency(total)}</span></div>
                  <div className={cn(
                    "flex justify-between font-semibold pt-1.5 border-t border-amber-800/40",
                    total - (viewingSale.total ?? 0) >= 0 ? "text-[var(--erp-money-positive)]" : "text-red-400"
                  )}>
                    <span>Difference</span>
                    <span>{total - (viewingSale.total ?? 0) >= 0 ? '+' : ''}{(total - (viewingSale.total ?? 0)).toFixed(2)}</span>
                  </div>
                </div>
                <p className="text-xs text-amber-400/90 font-semibold uppercase mb-2">Payment received (editable)</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <DollarSign size={14} className="text-muted-foreground shrink-0" />
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={editPaidAmount}
                      onChange={(e) => setEditPaidAmount(parseFloat(e.target.value) || 0)}
                      className="bg-card border-border text-white h-9 flex-1"
                      placeholder="Amount received"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn("flex-1 h-8 text-xs", editPaymentMethod === 'Cash' ? "bg-green-900/40 border-green-700 text-green-300" : "border-gray-600 text-muted-foreground")}
                      onClick={() => setEditPaymentMethod('Cash')}
                    >
                      <Banknote size={12} className="mr-1" /> Cash
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn("flex-1 h-8 text-xs", editPaymentMethod === 'Card' ? "bg-blue-900/40 border-blue-700 text-blue-300" : "border-gray-600 text-muted-foreground")}
                      onClick={() => setEditPaymentMethod('Card')}
                    >
                      <CreditCard size={12} className="mr-1" /> Card
                    </Button>
                  </div>
                  <div className="flex justify-between text-sm pt-1 border-t border-amber-800/40">
                    <span className="text-muted-foreground">Due</span>
                    <span className={cn(Math.max(0, total - editPaidAmount) > 0 ? "text-amber-400 font-medium" : "text-[var(--erp-money-positive)]")}>
                      {formatCurrency(Math.max(0, total - editPaidAmount))}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Buttons: Edit mode = Save + Cancel; New order = Proceed to Payment (same flow as Sales) */}
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
                    className="border-gray-600 text-muted-foreground hover:bg-muted h-12 rounded-xl"
                    onClick={exitEditMode}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  className="col-span-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold h-12 rounded-xl shadow-lg shadow-blue-900/30"
                  onClick={handleProceedToPayment}
                  disabled={loading || posSaveInProgress || !companyId || !user || !branchId || branchId === 'all' || cart.length === 0}
                >
                  {posSaveInProgress ? (
                    <>
                      <Loader2 size={18} className="mr-2 animate-spin" />
                      Creating sale...
                    </>
                  ) : (
                    <>
                      <CreditCard size={18} className="mr-2" />
                      Proceed to Payment
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Variation selection modal */}
      {variationModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setVariationModalProduct(null)}>
          <div className="bg-card border border-border rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-bold text-white">Select variation</h3>
              <p className="text-sm text-muted-foreground mt-0.5">{variationModalProduct.name}</p>
            </div>
            <div className="overflow-y-auto p-4 space-y-2">
              {variationModalProduct.variations?.map((v) => {
                const stock = (v as any).current_stock ?? (v as any).stock ?? 0;
                const disabled = !allowNegativeStock && stock <= 0;
                return (
                  <button
                    key={v.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => addToCart(variationModalProduct, v)}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all",
                      disabled ? "opacity-50 cursor-not-allowed border-border bg-muted/50" : "border-border hover:border-blue-500 bg-muted/50 hover:bg-muted"
                    )}
                  >
                    <div>
                      <span className="font-medium text-foreground">{v.name || v.sku || 'Variation'}</span>
                      {v.sku && <span className="text-xs text-muted-foreground ml-2">{v.sku}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">Stock: {stock}</span>
                      <span className="font-semibold text-blue-400">{formatCurrency(isWholesale ? (v.wholesale_price ?? 0) : (v.retail_price ?? 0))}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="px-5 py-3 border-t border-border">
              <Button variant="outline" className="w-full border-gray-600" onClick={() => setVariationModalProduct(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {enableBespoke && companyId && (
        <BespokeDetailsModal
          open={bespokeCartId != null}
          onOpenChange={(open) => { if (!open) setBespokeCartId(null); }}
          productName={cart.find((c) => c.id === bespokeCartId)?.name}
          config={bespokeFormConfig}
          initial={cart.find((c) => c.id === bespokeCartId)?.customizationDetails}
          initialFabrics={
            bespokeCartId ? hydrateFabricDraftsFromChildren(bespokeCartId, cart) : undefined
          }
          companyId={companyId}
          branchId={branchId}
          onSave={(payload) => {
            if (bespokeCartId) handleBespokeSave(bespokeCartId, payload);
          }}
        />
      )}

      <UnifiedPaymentDialog
        isOpen={paymentDialogOpen && !!paymentDialogSaleId}
        onClose={() => {
          setPaymentDialogOpen(false);
          setPaymentDialogSaleId(null);
          setPaymentDialogInvoiceNo(null);
          setPaymentDialogTotal(0);
        }}
        context="customer"
        entityName={selectedCustomerData?.name || 'Walk-in Customer'}
        entityId={selectedCustomer === 'walk-in' ? undefined : selectedCustomer}
        outstandingAmount={paymentDialogTotal}
        totalAmount={paymentDialogTotal}
        paidAmount={0}
        referenceNo={paymentDialogInvoiceNo || undefined}
        referenceId={paymentDialogSaleId || undefined}
        onSuccess={onPaymentSuccess}
      />
    </div>
  );
};