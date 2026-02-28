import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  X, 
  Search, 
  Plus, 
  Trash2, 
  Calendar as CalendarIcon, 
  Save, 
  CreditCard, 
  Banknote,
  FileText,
  User,
  Package,
  ArrowRight,
  Check, 
  ChevronsUpDown,
  Box,
  Layers,
  Ruler,
  Wallet,
  ArrowDownCircle,
  AlertCircle,
  ShoppingBag,
  DollarSign,
  Truck,
  Percent,
  UserCheck,
  Printer,
  Paperclip,
  Palette,
  Scissors,
  Sparkles,
  Building2,
  Lock,
  Edit,
  ChevronRight,
  Hash,
  Tag,
  Upload
} from 'lucide-react';
import { format, parseISO } from "date-fns";
import { cn, formatDateWithTimezone } from "../ui/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Separator } from "../ui/separator";
import { Badge } from "../ui/badge";
import { CalendarDatePicker } from "../ui/CalendarDatePicker";
import { SearchableSelect } from "../ui/searchable-select";
import { InlineVariationSelector, Variation } from "../ui/inline-variation-selector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
  } from "../ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "../ui/popover";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "../ui/alert-dialog";
import { PackingDetails } from '../transactions/PackingEntryModal';
import { toast } from "sonner";
import { BranchSelector, currentUser } from '@/app/components/layout/BranchSelector';
import { SaleItemsSection } from './SaleItemsSection';
import { PaymentAttachments, PaymentAttachment } from '../payments/PaymentAttachments';
import { UnifiedPaymentDialog } from '@/app/components/shared/UnifiedPaymentDialog';
import { uploadSaleAttachments } from '@/app/utils/uploadTransactionAttachments';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useSettings } from '@/app/context/SettingsContext';
import { formatCurrency, getCurrencySymbol } from '@/app/utils/formatCurrency';
import { contactService } from '@/app/services/contactService';
import { saleService } from '@/app/services/saleService';
import { productService } from '@/app/services/productService';
import { inventoryService } from '@/app/services/inventoryService';
import { branchService, Branch } from '@/app/services/branchService';
import { useSales, convertFromSupabaseSale, Sale } from '@/app/context/SalesContext';
import { InvoicePrintLayout } from '@/app/components/shared/InvoicePrintLayout';
import { useNavigation } from '@/app/context/NavigationContext';
import { Loader2 } from 'lucide-react';
import { useDocumentNumbering } from '@/app/hooks/useDocumentNumbering';
import { userService, User as UserType } from '@/app/services/userService';

// Variation options come from backend (product.variations) - no dummy data.
// Built in useMemo below from products loaded from productService.

interface SaleItem {
    id: number;
    productId: number | string;
    name: string;
    sku: string;
    price: number;
    qty: number;
    // Standard Variation Fields (from backend product_variations)
    size?: string;
    color?: string;
    variationId?: string; // Backend variation id - for ledger/reporting/stock
    // Standard Packing Fields (Wholesale)
    thaans?: number;
    meters?: number;
    packingDetails?: PackingDetails;
    packing_quantity?: number; // Backend-ready: total_meters
    packing_unit?: string; // Backend-ready: 'meters' etc.
    unit?: string; // Short code (pcs, m, yd) – from DB on edit, from product on new
    // Stock and Purchase Info
    stock?: number;
    lastPurchasePrice?: number;
    lastSupplier?: string;
    unitAllowDecimal?: boolean; // From product's unit
    // UI State
    showVariations?: boolean; // Flag to show variation selector inline under this item
    selectedVariationId?: string; // Currently selected variation ID
    /** Set when user opens packing modal; cleared on save. Used to block submit if packing not saved. */
    packingTouched?: boolean;
}

interface PartialPayment {
    id: string;
    method: 'cash' | 'bank' | 'Mobile Wallet';
    amount: number;
    reference?: string;
    notes?: string;
    attachments?: PaymentAttachment[];
}

interface ExtraExpense {
    id: string;
    type: 'stitching' | 'lining' | 'dying' | 'cargo' | 'other';
    amount: number;
    notes?: string;
}

interface SaleFormProps {
  sale?: any; // Sale data for edit mode
  onClose: () => void;
}

export const SaleForm = ({ sale: initialSale, onClose }: SaleFormProps) => {
    // Supabase & Context
    const { companyId, branchId: contextBranchId, user, userRole, accessibleBranchIds } = useSupabase();
    const { inventorySettings, loading: settingsLoading, company } = useSettings();
    const enablePacking = inventorySettings.enablePacking;
    const { createSale, updateSale } = useSales();
    const { openDrawer, closeDrawer, activeDrawer, createdContactId, createdContactType, setCreatedContactId, openPackingModal, setCurrentView, setSelectedStudioSaleId } = useNavigation();
    
    // TASK 4 FIX - Check if user is admin
    const isAdmin = userRole === 'admin' || userRole === 'Admin';
    
    // Data State
    const [customers, setCustomers] = useState<Array<{ id: number | string; name: string; dueBalance: number }>>([]);
    const [products, setProducts] = useState<Array<{ id: number | string; name: string; sku: string; price: number; stock: number; lastPurchasePrice?: number; lastSupplier?: string; hasVariations: boolean; needsPacking: boolean; variations?: Array<{ id: string; attributes?: Record<string, unknown>; size?: string; color?: string }> }>>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Salesmen - Load from userService
    const [salesmen, setSalesmen] = useState<Array<{ id: string; name: string; code?: string }>>([
        { id: 'none', name: "No Salesman" }
    ]);
    
    // Header State
    const [customerId, setCustomerId] = useState("");
    const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
    const [customerSearchTerm, setCustomerSearchTerm] = useState("");
    const [pendingCustomerId, setPendingCustomerId] = useState<string | null>(null);
    const dataLoadedRef = useRef(false); // Track if initial data load has completed
    const [saleDate, setSaleDate] = useState<Date>(new Date());
    const [refNumber, setRefNumber] = useState("");
    const [saleNotes, setSaleNotes] = useState(""); // Notes field for sale (saves to database)
    const [invoiceNumber, setInvoiceNumber] = useState("");
    
    // Branch State - Locked for regular users, open for admin
    const [branchId, setBranchId] = useState<string>(contextBranchId || '');
    const [branches, setBranches] = useState<Branch[]>([]);
    const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
    const [salesmanDropdownOpen, setSalesmanDropdownOpen] = useState(false);
    const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
    const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
    
    // Items List State
    const [items, setItems] = useState<SaleItem[]>([]);
    
    // --- New Entry Row State (The "Stage") ---
    const [productSearchOpen, setProductSearchOpen] = useState(false);
    const [productSearchTerm, setProductSearchTerm] = useState("");
    const [pendingProduct, setPendingProduct] = useState<any | null>(null);
    const [pendingQty, setPendingQty] = useState<number>(1);
    const [pendingPrice, setPendingPrice] = useState<number>(0);
    // Standard Variation States
    const [pendingSize, setPendingSize] = useState<string>("");
    const [pendingColor, setPendingColor] = useState<string>("");
    // Inline Variation Selection
    const [showVariationSelector, setShowVariationSelector] = useState(false);
    const [selectedProductForVariation, setSelectedProductForVariation] = useState<any | null>(null);
    // Standard Packing States
    const [pendingThaans, setPendingThaans] = useState<number>(0);
    const [pendingMeters, setPendingMeters] = useState<number>(0);
    const [pendingPackingDetails, setPendingPackingDetails] = useState<PackingDetails | undefined>(undefined);
    
    // Focus Refs
    const searchInputRef = useRef<HTMLInputElement>(null);
    const qtyInputRef = useRef<HTMLInputElement>(null);
    const priceInputRef = useRef<HTMLInputElement>(null);
    const addBtnRef = useRef<HTMLButtonElement>(null);
    
    // Keyboard navigation state - tracks last added item for auto-focus
    const [lastAddedItemId, setLastAddedItemId] = useState<number | null>(null);
    
    // Refs for item inputs (keyed by item ID)
    const itemQtyRefs = useRef<Record<number, HTMLInputElement | null>>({});
    const itemPriceRefs = useRef<Record<number, HTMLInputElement | null>>({});
    const itemVariationRefs = useRef<Record<number, HTMLButtonElement | null>>({});

    // Payment State
    const [partialPayments, setPartialPayments] = useState<PartialPayment[]>([]);
    
    // Payment Form State
    const [newPaymentMethod, setNewPaymentMethod] = useState<'cash' | 'bank' | 'Mobile Wallet'>('cash');
    const [newPaymentAmount, setNewPaymentAmount] = useState<number>(0);
    
    // Payment Dialog State
    const [paymentChoiceDialogOpen, setPaymentChoiceDialogOpen] = useState(false);
    const [pendingSaveAction, setPendingSaveAction] = useState<{ print: boolean } | null>(null);
    const [unifiedPaymentDialogOpen, setUnifiedPaymentDialogOpen] = useState(false);
    const [savedSaleId, setSavedSaleId] = useState<string | null>(null);
    const [savedSaleInvoiceNo, setSavedSaleInvoiceNo] = useState<string | null>(null);
    const [newPaymentReference, setNewPaymentReference] = useState<string>("");
    
    // Payment Attachments State
    const [paymentAttachments, setPaymentAttachments] = useState<PaymentAttachment[]>([]);
    const [saleAttachmentFiles, setSaleAttachmentFiles] = useState<File[]>([]);
    const saleAttachmentInputRef = useRef<HTMLInputElement>(null);
    const [savedSaleAttachments, setSavedSaleAttachments] = useState<{ url: string; name: string }[]>([]);

    // Print layout after Save & Print
    const [showPrintLayout, setShowPrintLayout] = useState(false);
    const [saleForPrint, setSaleForPrint] = useState<Sale | null>(null);

    // Extra Expenses State
    const [extraExpenses, setExtraExpenses] = useState<ExtraExpense[]>([]);
    const [newExpenseType, setNewExpenseType] = useState<'stitching' | 'lining' | 'dying' | 'cargo' | 'other'>('stitching');
    const [newExpenseAmount, setNewExpenseAmount] = useState<number>(0);
    const [newExpenseNotes, setNewExpenseNotes] = useState<string>("");

    // Discount State
    const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
    const [discountValue, setDiscountValue] = useState<number>(0);

    // Salesman State (moved to header) - TASK 4 FIX
    // For normal users: auto-assign to logged-in user
    // For admin: allow selection
    const [salesmanId, setSalesmanId] = useState<string>(() => {
      // TASK 4 FIX - Auto-assign to logged-in user if not admin
      if (!isAdmin && user) {
        // Find user in salesmen list or add them
        const userSalesman = salesmen.find(s => s.name === user.email || s.name === (user.user_metadata?.full_name || ''));
        return userSalesman ? userSalesman.id.toString() : "1"; // Default to "No Salesman" if not found
      }
      return "1"; // Default to "No Salesman" for admin
    });
    const [commissionType, setCommissionType] = useState<'percentage' | 'fixed'>('percentage');
    const [commissionValue, setCommissionValue] = useState<number>(0);
    
    // TASK 4 FIX - Auto-assign salesman for normal users on mount
    useEffect(() => {
      if (!isAdmin && user && salesmanId === "1") {
        // Try to find user in salesmen list
        const userSalesman = salesmen.find(s => 
          s.name === user.email || 
          s.name === (user.user_metadata?.full_name || '') ||
          s.name === (user.user_metadata?.name || '')
        );
        if (userSalesman) {
          setSalesmanId(userSalesman.id.toString());
        }
      }
    }, [isAdmin, user, salesmanId]);

    // Shipping State (Optional - enabled via checkbox)
    const [shippingEnabled, setShippingEnabled] = useState<boolean>(false);
    const [shippingAddress, setShippingAddress] = useState<string>("");
    const [shippingCharges, setShippingCharges] = useState<number>(0);

    // Studio Sale State
    const [isStudioSale, setIsStudioSale] = useState<boolean>(false);
    const [studioNotes, setStudioNotes] = useState<string>("");

    // Status State (Draft, Quotation, Final, etc.)
    const [saleStatus, setSaleStatus] = useState<'draft' | 'quotation' | 'order' | 'final'>('draft');
    const [studioDeadline, setStudioDeadline] = useState<Date | undefined>(undefined);

    // Packing Modal State - Now using global modal via NavigationContext
    const [activePackingItemId, setActivePackingItemId] = useState<number | null>(null);

    // Document numbering (must be before displayInvoiceNumber useMemo)
    const { generateDocumentNumber, incrementNextNumber } = useDocumentNumbering();

    // Calculations
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const expensesTotal = extraExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    
    // Calculate discount amount
    const discountAmount = discountType === 'percentage' 
        ? (subtotal * discountValue) / 100 
        : discountValue;
    
    // Calculate shipping (only if enabled)
    const finalShippingCharges = shippingEnabled ? shippingCharges : 0;
    
    // Calculate total after discount and expenses
    const afterDiscountTotal = subtotal - discountAmount + expensesTotal;
    const totalAmount = afterDiscountTotal + finalShippingCharges;
    
    // Calculate salesman commission
    const commissionAmount = commissionType === 'percentage'
        ? (subtotal * commissionValue) / 100
        : commissionValue;
    
    // Automatic Payment Status Detection
    const totalPaid = partialPayments.reduce((sum, p) => sum + p.amount, 0);
    const balanceDue = totalAmount - totalPaid;
    
    // Auto-detect payment status
    // CRITICAL FIX: Use 'unpaid' instead of 'credit' to match database enum (paid, partial, unpaid)
    const paymentStatus = totalPaid === 0 ? 'unpaid' : totalPaid >= totalAmount ? 'paid' : 'partial';

    const getSalesmanName = () => salesmen.find(s => s.id.toString() === salesmanId)?.name || "No Salesman";

    // Helper: Extract numeric part from SKU (keep leading zeros)
    const extractNumericPart = (sku: string): string => {
        return sku.replace(/\D/g, '');
    };

    // Helper: Normalize numeric part (remove leading zeros for comparison)
    const normalizeNumeric = (numStr: string): string => {
        return numStr.replace(/^0+/, '') || '0';
    };

    // Helper: Check if search term matches SKU (including numeric-only search)
    const matchesSku = (sku: string, searchTerm: string): boolean => {
        if (!sku || !searchTerm) return false;
        
        const lowerSku = sku.toLowerCase();
        const lowerSearch = searchTerm.toLowerCase();
        
        // 1. Direct text match (full SKU or partial)
        if (lowerSku.includes(lowerSearch)) {
            return true;
        }
        
        // 2. Numeric matching (handle leading zeros)
        const skuNumeric = extractNumericPart(sku);
        const searchNumeric = extractNumericPart(searchTerm);
        
        // If search term has numbers, check numeric matching
        if (searchNumeric.length > 0) {
            // If SKU has no numeric part, skip numeric matching
            if (skuNumeric.length === 0) {
                return false;
            }
            
            // Match with leading zeros preserved (e.g., "0001" matches "REG-0001")
            // Special handling for "0" - only match if SKU numeric part starts with "0"
            if (searchNumeric === '0') {
                // "0" should match SKUs that have "0" in their numeric part
                // But be more precise: match if SKU starts with "0" (like "0001", "001", "002")
                if (skuNumeric.startsWith('0')) {
                    return true;
                }
            } else {
                // For other numeric searches, use includes check
                if (skuNumeric.includes(searchNumeric) || searchNumeric.includes(skuNumeric)) {
                    return true;
                }
            }
            
            // Match normalized (without leading zeros) - e.g., "1" matches "0001"
            const normalizedSku = normalizeNumeric(skuNumeric);
            const normalizedSearch = normalizeNumeric(searchNumeric);
            
            // Special case: if search normalizes to "0", it means search was all zeros
            // In this case, we already checked with includes() above, so skip normalized check
            // Only do normalized matching if search is not all zeros
            if (normalizedSearch !== '0') {
                // Check if normalized values match (exact or partial)
                if (normalizedSku === normalizedSearch) {
                    return true;
                }
                
                // Check if one contains the other (for partial matches)
                // But avoid "0" matching everything
                if (normalizedSku !== '0' && normalizedSearch !== '0') {
                    if (normalizedSku.includes(normalizedSearch) || normalizedSearch.includes(normalizedSku)) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    };

    // Enhanced search with SKU numeric matching (parent products only, no variations in results)
    const filteredProducts = useMemo(() => {
        if (!productSearchTerm.trim()) return products;
        
        const searchTerm = productSearchTerm.trim();
        const searchLower = searchTerm.toLowerCase();
        const isNumericOnly = /^\d+$/.test(searchTerm);
        
        const results = products.filter(p => {
            // Match product name
            const nameMatch = p.name.toLowerCase().includes(searchLower);
            
            // Match SKU (full or numeric part)
            const skuMatch = matchesSku(p.sku, searchTerm);
            
            return nameMatch || skuMatch;
        });
        
        // Debug: Log results for numeric search
        if (isNumericOnly) {
            console.log(`[SKU SEARCH] Search: "${searchTerm}", Results: ${results.length}/${products.length}`);
            if (results.length > 0) {
                console.log(`[SKU SEARCH] ✅ Matched:`, results.map(p => `${p.name} (${p.sku})`));
            } else {
                console.log(`[SKU SEARCH] ❌ No matches. Sample products:`, products.slice(0, 3).map(p => ({ 
                    name: p.name, 
                    sku: p.sku, 
                    numeric: extractNumericPart(p.sku),
                    normalized: normalizeNumeric(extractNumericPart(p.sku))
                })));
            }
        }
        
        return results;
    }, [products, productSearchTerm]);
    
    // Variation options from backend only (product.variations) - no dummy data
    // Variation options from backend - for inline selection
    const productVariationsFromBackend = useMemo(() => {
        const map: Record<string | number, Array<{ id?: string; size?: string; color?: string; sku?: string; price?: number; stock?: number; attributes?: Record<string, unknown> }>> = {};
        products.forEach((p) => {
            if (!p.variations?.length) return;
            const productId = p.id;
            const stringKey = String(productId);
            const numKey = typeof productId === 'number' ? productId : (/^\d+$/.test(stringKey) ? parseInt(stringKey, 10) : null);
            
            // Normalize variations to ensure consistent structure
            const normalizedVariations = p.variations.map((v: any) => {
                // Extract size and color from various possible structures
                let size = v.size || '';
                let color = v.color || '';
                
                // If not found directly, check attributes object
                if (!size && v.attributes) {
                    size = v.attributes.size || 
                           v.attributes.Size || 
                           v.attributes.SIZE || 
                           (typeof v.attributes === 'object' ? Object.values(v.attributes).find((val: any) => typeof val === 'string' && ['s', 'm', 'l', 'xl', 'xs'].includes(val.toLowerCase())) : '') || 
                           '';
                }
                
                if (!color && v.attributes) {
                    color = v.attributes.color || 
                            v.attributes.Color || 
                            v.attributes.COLOR || 
                            (typeof v.attributes === 'object' ? Object.values(v.attributes).find((val: any) => typeof val === 'string' && ['red', 'blue', 'green', 'white', 'black'].some(c => val.toLowerCase().includes(c))) : '') || 
                            '';
                }
                
                return {
                    id: v.id,
                    size: String(size || '').trim(),
                    color: String(color || '').trim(),
                    sku: v.sku,
                    price: v.price,
                    stock: v.stock,
                    attributes: v.attributes || {},
                };
            });
            
            map[stringKey] = normalizedVariations;
            if (numKey !== null) {
                map[numKey] = normalizedVariations;
            }
        });
        return map;
    }, [products]);
    
    // Load data from Supabase
    // CRITICAL: Only load on initial mount, not on every companyId change
    // This prevents remount/reload from resetting customer selection
    useEffect(() => {
        const loadData = async () => {
            if (!companyId) return;
            
            // CRITICAL: Don't reload if data has already been loaded (prevents state reset)
            // This prevents remount/reload from resetting customer selection
            if (dataLoadedRef.current) {
                console.log('[SALE FORM] Skipping loadData - data already loaded (prevents state reset)');
                return;
            }
            
            try {
                setLoading(true);
                
                // Load customers (contacts with type='customer') and their due balance from sales
                const [contactsData, salesData] = await Promise.all([
                    contactService.getAllContacts(companyId),
                    saleService.getAllSales(companyId, contextBranchId === 'all' ? undefined : contextBranchId || undefined).catch(() => [])
                ]);
                const salesList = Array.isArray(salesData) ? salesData : [];
                const customerContacts = (contactsData || [])
                    .filter((c: any) => c.type === 'customer' || c.type === 'both')
                    .map((c: any) => {
                        const cId = c.id || c.uuid || '';
                        const dueBalance = salesList
                            .filter((s: any) => (s.customer_id || s.customer_name) && (String(s.customer_id) === String(cId) || (s.customer_name && s.customer_name === c.name)))
                            .reduce((sum: number, s: any) => sum + (Number(s.due_amount) ?? 0), 0);
                        return {
                            id: cId,
                            name: c.name || '',
                            dueBalance
                        };
                    });
                
                // Mandatory default (Walk-in) customer for auto-selection
                let defaultCustomerId: string | null = null;
                try {
                    const defaultCustomer = await contactService.getDefaultCustomer(companyId);
                    if (defaultCustomer) {
                        defaultCustomerId = defaultCustomer.id || null;
                        console.log('[SALE FORM] Found default customer:', defaultCustomerId);
                    }
                } catch (error) {
                    console.warn('[SALE FORM] Could not fetch default customer:', error);
                }
                if (!defaultCustomerId) {
                    try {
                        const walkingCustomer = await contactService.getWalkingCustomer(companyId);
                        if (walkingCustomer) defaultCustomerId = walkingCustomer.id || null;
                    } catch (_) {}
                }

                // Build list: include walk-in placeholder for backward compat; prefer actual default if exists
                const customerList = [
                    { id: 'walk-in', name: "Walk-in Customer", dueBalance: 0 },
                    ...customerContacts
                ];
                if (defaultCustomerId && !customerContacts.some(c => c.id === defaultCustomerId)) {
                    customerList.push({
                        id: defaultCustomerId,
                        name: "Walk-in Customer",
                        dueBalance: 0
                    });
                }

                setCustomers(customerList);

                // Auto-select default customer for new sale
                if (!customerId && !initialSale) {
                    if (defaultCustomerId) {
                        console.log('[SALE FORM] Auto-selecting default customer:', defaultCustomerId);
                        setCustomerId(defaultCustomerId);
                    } else {
                        console.log('[SALE FORM] Auto-selecting walk-in (fallback)');
                        setCustomerId('walk-in');
                    }
                }
                
                // CRITICAL FIX: Load products with calculated stock from movements
                // Instead of using products.current_stock, calculate from stock_movements
                const productsData = await productService.getAllProducts(companyId);
                
                // Load units for decimal validation
                const { unitService } = await import('@/app/services/unitService');
                const unitsData = await unitService.getAll(companyId);
                const unitsMap = new Map(unitsData.map(u => [u.id, u]));
                
                // Calculate stock for each product from movements (async batch)
                const productsList = await Promise.all(
                  productsData.map(async (p) => {
                    let calculatedStock = p.current_stock || 0; // Fallback to current_stock
                    
                    try {
                      // Get stock movements for this product (branch-aware)
                      // For products with variations, calculate total stock across all variations
                      const movements = await productService.getStockMovements(
                        p.id,
                        companyId,
                        undefined, // No variation filter for product search - get all variations
                        contextBranchId || undefined // Use current branch if available
                      );
                      
                      // Calculate stock from movements using unified calculation
                      if (movements && movements.length > 0) {
                        const { calculateStockFromMovements } = await import('@/app/utils/stockCalculation');
                        const stockCalc = calculateStockFromMovements(movements);
                        calculatedStock = Math.max(0, stockCalc.currentBalance); // Ensure non-negative
                      } else {
                        // If no movements found, use current_stock if available
                        // Don't default to 0 if current_stock exists
                        if (p.current_stock !== null && p.current_stock !== undefined) {
                          calculatedStock = Math.max(0, p.current_stock);
                        }
                      }
                    } catch (stockError) {
                      console.warn(`[SALE FORM] Could not calculate stock for product ${p.id}, using current_stock:`, stockError);
                      // Use current_stock as fallback, but don't default to 0 if it's null
                      if (p.current_stock !== null && p.current_stock !== undefined) {
                        calculatedStock = Math.max(0, p.current_stock);
                      }
                    }
                    
                    // Get unit data for decimal validation
                    const unit = p.unit_id ? unitsMap.get(p.unit_id) : null;
                    
                    return {
                      id: p.id || p.uuid || '',
                      name: p.name || '',
                      sku: p.sku || '',
                      price: (p.retail_price ?? p.sellingPrice ?? p.salePrice ?? p.price) || 0,
                      stock: calculatedStock, // This will show actual stock or current_stock, not forced 0
                      lastPurchasePrice: (p.cost_price ?? p.costPrice) ?? undefined,
                      lastSupplier: undefined, // Can be enhanced later
                      hasVariations: (p.variations && p.variations.length > 0) || false,
                      needsPacking: false, // Can be enhanced based on product type
                      variations: p.variations || [], // Backend variations for inline selector (no dummy data)
                      unitAllowDecimal: unit?.allow_decimal ?? false // Default to false if no unit
                    };
                  })
                );
                
                setProducts(productsList);
                
                // Mark data as loaded to prevent future reloads
                dataLoadedRef.current = true;
                console.log('[SALE FORM] Initial data load completed');
            } catch (error) {
                console.error('[SALE FORM] Error loading data:', error);
                toast.error('Failed to load data');
            } finally {
                setLoading(false);
            }
        };
        
        loadData();
    }, [companyId]); // Only run on companyId change, but skip if data already loaded

    // Accessible branches: for admin = all company branches; for others = branches user has access to
    const accessibleBranches = React.useMemo(() => {
        if (!branches.length) return [];
        if (isAdmin) return branches;
        const idSet = new Set(accessibleBranchIds.map((id: string) => String(id)));
        return branches.filter((b: Branch) => idSet.has(String(b.id)));
    }, [branches, accessibleBranchIds, isAdmin]);

    const showBranchSelector = accessibleBranches.length > 1;
    const singleBranchAutoSelected = accessibleBranches.length === 1;

    // Load branches
    const [branchesError, setBranchesError] = useState<unknown>(null);
    useEffect(() => {
        const loadBranches = async () => {
            if (!companyId) return;
            try {
                setBranchesError(null);
                const branchesData = await branchService.getAllBranches(companyId);
                setBranches(branchesData);
            } catch (error) {
                console.error('[SALE FORM] Error loading branches:', error);
                setBranchesError(error);
            }
        };
        loadBranches();
    }, [companyId]);

    // STEP 0 — Debug log (branch/salesman diagnostics)
    useEffect(() => {
        if (!companyId || !import.meta.env?.DEV) return;
        console.log('[SALE FORM BRANCH DEBUG]', {
            role: userRole,
            uid: user?.id,
            companyId,
            profileBranchId: contextBranchId,
            branchesCount: branches?.length ?? 0,
            accessibleBranchesCount: accessibleBranches?.length ?? 0,
            accessibleBranchIdsLength: accessibleBranchIds?.length ?? 0,
            branchesError: branchesError ? String(branchesError) : null,
        });
    }, [companyId, userRole, user?.id, contextBranchId, branches?.length, accessibleBranches?.length, accessibleBranchIds?.length, branchesError]);

    // Smart branch auto-selection: when only one accessible branch, set it; sync from context when needed
    useEffect(() => {
        if (!branches.length) return;
        const ids = isAdmin ? branches.map((b: Branch) => String(b.id)) : accessibleBranchIds.map((id: string) => String(id));
        const filtered = branches.filter((b: Branch) => ids.includes(String(b.id)));
        setBranchId((prev) => {
            if (filtered.length === 1) return filtered[0].id;
            if (contextBranchId && contextBranchId !== 'all' && ids.includes(String(contextBranchId))) return contextBranchId;
            if (!prev || prev === 'all') {
                const main = branches.find((b: Branch) => (b as any).is_default === true) || filtered[0];
                return main ? main.id : prev;
            }
            if (ids.length && !ids.includes(String(prev))) return ids[0]; // current selection not in accessible, pick first
            return prev;
        });
    }, [branches, accessibleBranchIds, isAdmin, contextBranchId]);

    // Merge live stock from inventory overview (same source as Inventory page) into products for search dropdown
    useEffect(() => {
        if (!companyId || !products.length) return;
        const rawBranch = branchId || contextBranchId;
        const branchToUse = (rawBranch && rawBranch !== 'all') ? rawBranch : null;
        let cancelled = false;
        (async () => {
            try {
                const overview = await inventoryService.getInventoryOverview(companyId, branchToUse || undefined);
                if (cancelled || !overview?.length) return;
                const overviewByProductId: Record<string, { stock: number; hasVariations?: boolean; variations?: Array<{ id: string; stock: number }> }> = {};
                overview.forEach((row: any) => {
                    const key = String(row.id ?? row.productId);
                    overviewByProductId[key] = {
                        stock: row.stock ?? 0,
                        hasVariations: row.hasVariations,
                        variations: row.variations?.map((v: any) => ({ id: v.id, stock: v.stock ?? 0 })),
                    };
                });
                setProducts(prev => prev.map(p => {
                    const key = String(p.id);
                    const row = overviewByProductId[key];
                    if (!row) return p;
                    if (row.hasVariations && row.variations?.length) {
                        return {
                            ...p,
                            stock: row.stock,
                            variations: (p.variations || []).map(v => {
                                const vStock = row.variations?.find((vv: any) => String(vv.id) === String(v.id));
                                return { ...v, stock: vStock?.stock ?? (v as any).stock };
                            }),
                        };
                    }
                    return { ...p, stock: row.stock };
                }));
            } catch {
                if (!cancelled) { /* keep existing product stock on error */ }
            }
        })();
        return () => { cancelled = true; };
    }, [companyId, branchId, contextBranchId, products.length]);

    // Load salesmen from userService
    useEffect(() => {
        const loadSalesmen = async () => {
            if (!companyId) return;
            
            try {
                const users = await userService.getSalesmen(companyId);
                const salesmenList = [
                    { id: 'none', name: "No Salesman", code: '' },
                    ...users.map((user: UserType) => ({
                        id: user.id,
                        name: user.full_name || user.email,
                        code: user.user_code || ''
                    }))
                ];
                setSalesmen(salesmenList);
            } catch (error) {
                console.error('[SALE FORM] Error loading salesmen:', error);
                // Keep default "No Salesman" option on error
            }
        };
        
        loadSalesmen();
    }, [companyId]);

    // Reload customers when contact is created (IMMEDIATELY, not waiting for drawer to close)
    useEffect(() => {
        const reloadCustomers = async () => {
            // Reload when:
            // 1. A contact was created (createdContactId is not null)
            // 2. AND the contact type is relevant (customer or both)
            // 3. AND we have companyId
            // This triggers IMMEDIATELY when customer is created, without waiting for drawer to close
            if (companyId && createdContactId !== null && 
                (createdContactType === 'customer' || createdContactType === 'both')) {
                try {
                    // Store the contact ID before clearing (for auto-selection)
                    const contactIdToSelect = createdContactId;
                    const contactTypeToSelect = createdContactType;
                    
                    // Clear immediately to prevent duplicate reloads
                    if (setCreatedContactId) {
                        setCreatedContactId(null, null);
                    }
                    
                    // CRITICAL: Reload IMMEDIATELY when drawer closes
                    console.log('[SALE FORM] Reloading customers IMMEDIATELY, createdContactId:', contactIdToSelect, 'Type:', contactTypeToSelect);
                    
                    // Small delay to ensure DB commit (reduced since we're not waiting for drawer close)
                    await new Promise(resolve => setTimeout(resolve, 300));
                    
                    const [contactsDataReload, salesDataReload] = await Promise.all([
                        contactService.getAllContacts(companyId),
                        saleService.getAllSales(companyId, contextBranchId === 'all' ? undefined : contextBranchId || undefined).catch(() => [])
                    ]);
                    const salesListReload = Array.isArray(salesDataReload) ? salesDataReload : [];
                    const customerContacts = (contactsDataReload || [])
                        .filter((c: any) => c.type === 'customer' || c.type === 'both')
                        .map((c: any) => {
                            const cId = c.id || c.uuid || '';
                            const dueBalance = salesListReload
                                .filter((s: any) => (s.customer_id || s.customer_name) && (String(s.customer_id) === String(cId) || (s.customer_name && s.customer_name === c.name)))
                                .reduce((sum: number, s: any) => sum + (Number(s.due_amount) ?? 0), 0);
                            return { id: cId, name: c.name || '', dueBalance };
                        });
                    
                    console.log('[SALE FORM] Reloaded customers:', customerContacts.length, 'IDs:', customerContacts.map(c => c.id));
                    
                    // Prepare updated customers list
                    const updatedCustomers = [
                        { id: 'walk-in', name: "Walk-in Customer", dueBalance: 0 },
                        ...customerContacts
                    ];
                    
                    // Auto-select newly created contact
                    const contactIdStr = contactIdToSelect.toString();
                    const foundContact = customerContacts.find(c => {
                        const cId = c.id?.toString() || '';
                        // Exact match first
                        if (cId === contactIdStr || c.id === contactIdToSelect) {
                            return true;
                        }
                        // UUID format matching (handle with/without dashes)
                        const normalizedCId = cId.replace(/-/g, '').toLowerCase();
                        const normalizedCreatedId = contactIdStr.replace(/-/g, '').toLowerCase();
                        if (normalizedCId === normalizedCreatedId) {
                            return true;
                        }
                        return false;
                    });
                    
                    if (foundContact) {
                        const selectedId = foundContact.id.toString();
                        
                        // CRITICAL: Update customers array first
                        setCustomers(updatedCustomers);
                        
                        // Store pending customer ID - separate useEffect will handle the selection
                        // This ensures customers array is fully updated before we try to select
                        setPendingCustomerId(selectedId);
                        console.log('[SALE FORM] Set pending customer ID:', selectedId, foundContact.name);
                    } else {
                        console.warn('[SALE FORM] ❌ Could not find created contact:', contactIdStr, 'Available IDs:', customerContacts.map(c => c.id));
                        // Try one more time after a longer delay (DB might need more time)
                        setTimeout(async () => {
                            const [retryContactsData, retrySalesData] = await Promise.all([
                                contactService.getAllContacts(companyId),
                                saleService.getAllSales(companyId, contextBranchId === 'all' ? undefined : contextBranchId || undefined).catch(() => [])
                            ]);
                            const retrySalesList = Array.isArray(retrySalesData) ? retrySalesData : [];
                            const retryContacts = (retryContactsData || [])
                                .filter((c: any) => c.type === 'customer' || c.type === 'both')
                                .map((c: any) => {
                                    const cId = c.id || c.uuid || '';
                                    const dueBalance = retrySalesList
                                        .filter((s: any) => (s.customer_id || s.customer_name) && (String(s.customer_id) === String(cId) || (s.customer_name && s.customer_name === c.name)))
                                        .reduce((sum: number, s: any) => sum + (Number(s.due_amount) ?? 0), 0);
                                    return { id: cId, name: c.name || '', dueBalance };
                                });
                            const retryFound = retryContacts.find(c => {
                                const cId = c.id?.toString() || '';
                                return cId === contactIdStr || c.id === contactIdToSelect;
                            });
                            if (retryFound) {
                                setCustomers([
                                    { id: 'walk-in', name: "Walk-in Customer", dueBalance: 0 },
                                    ...retryContacts
                                ]);
                                const retrySelectedId = retryFound.id.toString();
                                // Auto-select immediately
                                setCustomerId(retrySelectedId);
                                setCustomerSearchOpen(false);
                                setCustomerSearchTerm('');
                                toast.success(`Customer "${retryFound.name}" selected`);
                                console.log('[SALE FORM] ✅ Retry successful - Auto-selected customer');
                            }
                        }, 1000);
                    }
                } catch (error) {
                    console.error('[SALE FORM] Error reloading customers:', error);
                }
            } else if (createdContactId !== null && 
                       (createdContactType === 'supplier' || createdContactType === 'worker')) {
                // Clear the ID if supplier/worker was created (no reload needed)
                if (setCreatedContactId) {
                    setCreatedContactId(null, null);
                }
            }
        };
        
        reloadCustomers();
    }, [companyId, createdContactId, createdContactType, setCreatedContactId]);

    // Separate useEffect to handle customer auto-selection AFTER customers array is updated
    // This ensures proper state sequencing - customers array updates first, then customerId
    useEffect(() => {
        if (pendingCustomerId && customers.length > 0) {
            // Find the customer in the updated array
            const foundCustomer = customers.find(c => {
                const cId = c.id?.toString() || '';
                const pendingIdStr = pendingCustomerId.toString();
                return cId === pendingIdStr || c.id === pendingCustomerId;
            });
            
            if (foundCustomer) {
                console.log('[SALE FORM] Found customer in array, setting customerId:', {
                    pendingId: pendingCustomerId,
                    foundId: foundCustomer.id,
                    foundName: foundCustomer.name,
                    customersCount: customers.length
                });
                
                // CRITICAL: Use the exact ID from foundCustomer to ensure consistency
                const customerIdToSet = foundCustomer.id.toString();
                
                // Set customerId - this will trigger selectedCustomer memo recalculation
                setCustomerId(customerIdToSet);
                
                // Force close popover and clear search immediately
                setCustomerSearchOpen(false);
                setCustomerSearchTerm('');
                
                // Clear pending AFTER setting customerId
                setPendingCustomerId(null);
                
                // Show toast
                toast.success(`Customer "${foundCustomer.name}" selected`);
                
                console.log('[SALE FORM] ✅ Auto-selected customer (via useEffect):', customerIdToSet, foundCustomer.name);
                
                // CRITICAL: Force a re-render by using requestAnimationFrame
                // This ensures React processes all state updates before next render
                requestAnimationFrame(() => {
                    // Verify state after React has processed updates
                    console.log('[SALE FORM] State verification after auto-select (RAF):', {
                        customerId,
                        selectedCustomerName: selectedCustomer?.name,
                        customersHasCustomer: customers.some(c => c.id.toString() === customerIdToSet),
                        foundCustomerInMemo: selectedCustomer?.id === customerIdToSet
                    });
                });
            } else {
                // Customer not found yet, might need more time
                console.warn('[SALE FORM] Pending customer not found in array yet:', {
                    pendingId: pendingCustomerId,
                    customersCount: customers.length,
                    customerIds: customers.map(c => c.id)
                });
            }
        }
    }, [pendingCustomerId, customers]);
    
    // 🔒 CRITICAL FIX: Set customer ID when editing, AFTER customers are loaded
    // This ensures the customer dropdown shows the correct selected customer
    useEffect(() => {
        if (initialSale && initialSale.customer) {
            const customerIdValue = initialSale.customer || '';
            
            // If customers are not loaded yet, set customerId anyway (will be validated when customers load)
            if (customers.length === 0) {
                console.log('[SALE FORM] Setting customer ID (customers not loaded yet):', customerIdValue);
                setCustomerId(customerIdValue);
                return; // Exit early, will re-run when customers load
            }
            
            // Customers are loaded, now find and set the exact match
            console.log('[SALE FORM] Setting customer ID in edit mode:', {
                customerIdValue,
                customersCount: customers.length,
                availableIds: customers.map(c => ({ id: c.id, idType: typeof c.id, idString: c.id?.toString() }))
            });
            
            // Find customer using multiple matching strategies (handle UUID format variations)
            const foundCustomer = customers.find(c => {
                const cId = c.id?.toString() || '';
                const cIdNormalized = cId.replace(/-/g, '').toLowerCase();
                const valueNormalized = customerIdValue.toString().replace(/-/g, '').toLowerCase();
                
                // Try multiple matching strategies
                return (
                    cId === customerIdValue.toString() ||           // Exact string match
                    c.id === customerIdValue ||                    // Direct comparison
                    String(c.id) === String(customerIdValue) ||    // String conversion match
                    cIdNormalized === valueNormalized              // Normalized UUID match (handles with/without dashes)
                );
            });
            
            if (foundCustomer) {
                // Use the exact ID from foundCustomer to ensure consistency with dropdown options
                const customerIdToSet = foundCustomer.id.toString();
                setCustomerId(customerIdToSet);
                console.log('[SALE FORM] ✅ Customer found and set in edit mode:', {
                    name: foundCustomer.name,
                    setId: customerIdToSet,
                    originalId: customerIdValue,
                    match: 'SUCCESS'
                });
            } else {
                // Customer ID not found in list - still set it but log detailed warning
                setCustomerId(customerIdValue);
                console.warn('[SALE FORM] ⚠️ Customer ID not found in customers array:', {
                    customerIdValue,
                    customerIdType: typeof customerIdValue,
                    availableIds: customers.map(c => ({
                        id: c.id,
                        idString: c.id?.toString(),
                        name: c.name
                    }))
                });
            }
        } else if (initialSale && !initialSale.customer) {
            // Sale exists but no customer (walk-in) - clear customer selection
            console.log('[SALE FORM] Sale has no customer (walk-in), clearing selection');
            setCustomerId('');
        }
    }, [initialSale, customers]); // Run when initialSale or customers change

    // Pre-populate form when editing (TASK 3 FIX) – date must come from DB, not current date
    useEffect(() => {
        if (initialSale) {
            // Pre-fill header fields – use DB date so picker shows saved date (never current for saved sale)
            const dateRaw = initialSale.date || (initialSale as any).createdAt || (initialSale as any).invoice_date;
            if (dateRaw) {
                try {
                    if (typeof dateRaw === 'object' && dateRaw instanceof Date) {
                        setSaleDate(dateRaw);
                    } else {
                        const dateStr = typeof dateRaw === 'string' ? dateRaw.trim() : String(dateRaw);
                        const parsed = /^\d{4}-\d{2}-\d{2}T/.test(dateStr) ? parseISO(dateStr) : parseISO(dateStr);
                        setSaleDate(parsed);
                    }
                } catch {
                    setSaleDate(new Date(dateRaw));
                }
            } else {
                setSaleDate(new Date());
            }
            setSavedSaleAttachments(Array.isArray((initialSale as any)?.attachments) ? (initialSale as any).attachments : []);
            setInvoiceNumber(initialSale.invoiceNo || '');
            setRefNumber('');
            // CRITICAL FIX: Load notes from initialSale
            setSaleNotes(initialSale.notes || '');
            
            // Pre-fill items (from initialSale or fetch if missing)
            const mapItemsToForm = (list: any[]) => {
                if (!list || list.length === 0) return;
                const baseTimestamp = Date.now();
                // CRITICAL: Preselect variation when editing – use variation_id from DB so dropdown is not blank
                const convertedItems: SaleItem[] = list.map((item: any, index: number) => {
                    const variationId = item.variation_id ?? item.variationId ?? undefined;
                    const hasVariation = Boolean(variationId);
                    
                    // CRITICAL: packing_details might be JSONB (object) or JSON string
                    // Load complete structure, not just totals
                    let packingDetails = item.packing_details || item.packingDetails || null;
                    
                    // If packing_details is a string, parse it
                    if (typeof packingDetails === 'string') {
                        try {
                            packingDetails = JSON.parse(packingDetails);
                        } catch (e) {
                            console.warn('[SALE FORM] Failed to parse packing_details as JSON:', e);
                            packingDetails = null;
                        }
                    }
                    
                    // DEBUG: Log what we're loading
                    if (packingDetails) {
                        console.log('[SALE FORM] Loading packing details for item:', {
                            productName: item.productName || item.product_name,
                            packingDetails,
                            boxes: packingDetails.boxes,
                            boxesType: Array.isArray(packingDetails.boxes) ? 'array' : typeof packingDetails.boxes,
                            boxesLength: Array.isArray(packingDetails.boxes) ? packingDetails.boxes.length : 'N/A',
                            loose_pieces: packingDetails.loose_pieces
                        });
                        
                        if (packingDetails.boxes && Array.isArray(packingDetails.boxes)) {
                            packingDetails.boxes.forEach((box: any, idx: number) => {
                                console.log(`[SALE FORM] Box ${idx + 1} from DB:`, {
                                    box_no: box.box_no,
                                    pieces: box.pieces,
                                    piecesType: Array.isArray(box.pieces) ? 'array' : typeof box.pieces,
                                    piecesLength: Array.isArray(box.pieces) ? box.pieces.length : 'N/A'
                                });
                            });
                        }
                    }
                    
                    return {
                        id: baseTimestamp + index,
                        productId: item.productId || item.product_id || '',
                        name: item.productName || item.product_name || '',
                        sku: item.sku || '',
                        price: item.price ?? item.unit_price ?? 0,
                        qty: item.quantity || 0,
                        size: item.size,
                        color: item.color,
                        variationId,
                        selectedVariationId: variationId,
                        showVariations: hasVariation || Boolean(item.product?.has_variations),
                        stock: 0,
                        lastPurchasePrice: undefined,
                        lastSupplier: undefined,
                        unit: item.unit ?? undefined,
                        packingDetails: packingDetails, // CRITICAL: Pass complete structure
                        thaans: packingDetails?.total_boxes || packingDetails?.boxes || 0,
                        meters: packingDetails?.total_meters || packingDetails?.meters || 0,
                    };
                });
                console.log('[SALE FORM] ✅ Converted items for edit mode:', convertedItems.length, 'items');
                console.log('[SALE FORM] Item IDs:', convertedItems.map((item, idx) => ({ index: idx, id: item.id, name: item.name, qty: item.qty, price: item.price })));
                setItems(convertedItems);
            };
            // 🔒 LOCK CHECK: Prevent editing if sale has returns
            if (initialSale.id) {
                    saleService.getSaleById(initialSale.id)
                    .then((full) => {
                        // Check if sale has returns (LOCKED)
                        if (full.hasReturn) {
                            toast.error('Cannot edit sale: This sale has a return and is locked. Returns cannot be edited or deleted.');
                            onClose();
                            return;
                        }
                        // Same as Purchase: use raw API items so packing_details from DB is available for edit form
                        if (full.items && full.items.length > 0) {
                            mapItemsToForm(full.items);
                        } else {
                            const saleWithItems = convertFromSupabaseSale(full);
                            if (saleWithItems.items && saleWithItems.items.length > 0) {
                                mapItemsToForm(saleWithItems.items);
                            } else if (initialSale.items && initialSale.items.length > 0) {
                                mapItemsToForm(initialSale.items);
                            }
                        }
                    })
                    .catch((err: any) => {
                        console.warn('[SaleForm] Could not load sale items for edit:', err);
                        if (err.message?.includes('return') || err.message?.includes('locked')) {
                            toast.error(err.message);
                            onClose();
                        }
                    });
            } else if (initialSale.items && initialSale.items.length > 0) {
                mapItemsToForm(initialSale.items);
            }

            // CRITICAL FIX: Pre-fill payments from existing payments (split by method)
            if (initialSale.paid > 0) {
                // Fetch existing payments to show split
                const loadExistingPayments = async () => {
                    try {
                        const { saleService } = await import('@/app/services/saleService');
                        const existingPayments = await saleService.getSalePayments(initialSale.id);
                        
                        if (existingPayments && existingPayments.length > 0) {
                            // Convert to partialPayments format (read-only for existing)
                            const paymentRows = existingPayments.map((p: any, index: number) => ({
                                id: `existing-${p.id || index}`,
                                method: (p.method === 'cash' ? 'cash' : 
                                        p.method === 'bank' || p.method === 'card' ? 'bank' : 
                                        'Mobile Wallet') as 'cash' | 'bank' | 'Mobile Wallet',
                                amount: p.amount,
                                reference: p.referenceNo || '',
                                attachments: [],
                                isExisting: true // Mark as existing (read-only)
                            }));
                            setPartialPayments(paymentRows);
                        } else {
                            // Fallback: Single payment if no breakdown available
                            setPartialPayments([{
                                id: '1',
                                method: (initialSale.paymentMethod || 'cash') as 'cash' | 'bank' | 'Mobile Wallet',
                                amount: initialSale.paid,
                                reference: '',
                                attachments: []
                            }]);
                        }
                    } catch (error) {
                        console.error('[SALE FORM] Error loading existing payments:', error);
                        // Fallback: Single payment
                        setPartialPayments([{
                            id: '1',
                            method: (initialSale.paymentMethod || 'cash') as 'cash' | 'bank' | 'other',
                            amount: initialSale.paid,
                            reference: '',
                            attachments: []
                        }]);
                    }
                };
                
                loadExistingPayments();
            }
            
            // Pre-fill expenses
            if (initialSale.expenses > 0) {
                setExtraExpenses([{
                    id: '1',
                    type: 'other',
                    amount: initialSale.expenses,
                    notes: 'Shipping/Other charges'
                }]);
                setShippingCharges(initialSale.expenses);
                setShippingEnabled(true);
            }
            
            // Pre-fill discount
            if (initialSale.discount > 0) {
                setDiscountValue(initialSale.discount);
                setDiscountType('fixed'); // Default to fixed, can be enhanced
            }
            
            // Pre-fill status
            if (initialSale.type === 'quotation') {
                setSaleStatus('quotation');
            } else {
                setSaleStatus('final');
            }
            // Pre-fill Studio type when editing a studio sale
            if ((initialSale as any).is_studio) {
                setIsStudioSale(true);
            }
        }
    }, [initialSale]);

    // Status helper functions
    const getStatusColor = () => {
        switch(saleStatus) {
            case 'draft': return 'text-gray-500 bg-gray-900/50 border-gray-700';
            case 'quotation': return 'text-yellow-500 bg-yellow-900/20 border-yellow-600/50';
            case 'order': return 'text-blue-500 bg-blue-900/20 border-blue-600/50';
            case 'final': return 'text-green-500 bg-green-900/20 border-green-600/50';
            default: return 'text-gray-500 bg-gray-900/50 border-gray-700';
        }
    };

    // Chip-style status color for top header
    const getStatusChipColor = () => {
        switch(saleStatus) {
            case 'draft': return 'bg-gray-500/20 text-gray-400 border-gray-600/50';
            case 'quotation': return 'bg-yellow-500/20 text-yellow-400 border-yellow-600/50';
            case 'order': return 'bg-blue-500/20 text-blue-400 border-blue-600/50';
            case 'final': return 'bg-green-500/20 text-green-400 border-green-600/50';
            default: return 'bg-gray-500/20 text-gray-400 border-gray-600/50';
        }
    };

    const getStatusIcon = () => {
        switch(saleStatus) {
            case 'draft': return <FileText size={14} />;
            case 'quotation': return <FileText size={14} />;
            case 'order': return <ShoppingBag size={14} />;
            case 'final': return <Check size={14} />;
            default: return <FileText size={14} />;
        }
    };

    // Get branch display (code + name)
    const getBranchName = () => {
        const branch = branches.find(b => b.id === branchId || b.id.toString() === branchId.toString());
        if (!branch) return "Select Branch";
        return branch.code ? `${branch.code} | ${branch.name}` : branch.name;
    };

    // Get selected customer - memoized to ensure it updates when customers or customerId changes
    // CRITICAL: This must update immediately when either customers array or customerId changes
    // Using JSON.stringify for customers array to ensure deep equality check
    // 🔒 CRITICAL FIX: Enhanced customer matching with UUID normalization
    const selectedCustomer = useMemo(() => {
        if (!customerId || !customers.length) {
            console.log('[SALE FORM] selectedCustomer memo: No customerId or customers empty', {
                customerId,
                customersCount: customers.length
            });
            return null;
        }
        
        const customerIdStr = customerId.toString();
        const customerIdNormalized = customerIdStr.replace(/-/g, '').toLowerCase();
        
        // Try multiple matching strategies to handle UUID format variations
        const customer = customers.find(c => {
            const cId = c.id?.toString() || '';
            const cIdNormalized = cId.replace(/-/g, '').toLowerCase();
            
            return (
                cId === customerIdStr ||                    // Exact string match
                c.id === customerId ||                      // Direct comparison
                String(c.id) === customerIdStr ||          // String conversion match
                cIdNormalized === customerIdNormalized      // Normalized UUID match (handles with/without dashes)
            );
        });
        
        console.log('[SALE FORM] selectedCustomer memo recalculated:', {
            customerId,
            customerIdType: typeof customerId,
            customersCount: customers.length,
            found: customer ? customer.name : 'NOT FOUND',
            foundId: customer ? customer.id : null,
            matchType: customer ? 'SUCCESS' : 'FAILED'
        });
        
        return customer || null;
    }, [customers, customerId]);
    
    const getSelectedCustomer = () => selectedCustomer;

    // Filter customers based on search term
    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(customerSearchTerm.toLowerCase())
    );

    // Helper to format due balance as currency (compact for header & dropdown). Uses Rs. for PKR globally.
    const formatDueBalanceCompact = (due: number) => {
        const code = company?.currency || 'PKR';
        const prec = company?.decimalPrecision ?? 2;
        return formatCurrency(due, code, prec);
    };

    // Helper to get due balance color: green = customer owes us, red = we owe customer
    const getDueBalanceColor = (due: number) => {
        if (due > 0) return 'text-green-400'; // Customer owes us (we took)
        if (due < 0) return 'text-red-400';   // We owe customer (we gave)
        return 'text-gray-500'; // Zero
    };

    // Display invoice number: actual when editing, preview when new (draft/final/studio)
    const displayInvoiceNumber = useMemo(() => {
        if (initialSale?.invoiceNo) return initialSale.invoiceNo;
        if (typeof generateDocumentNumber !== 'function') return 'SL-0001';
        if (isStudioSale) return generateDocumentNumber('studio');
        const docType = saleStatus === 'final' ? 'invoice' : saleStatus === 'quotation' ? 'quotation' : saleStatus === 'order' ? 'order' : 'draft';
        return generateDocumentNumber(docType);
    }, [initialSale?.invoiceNo, isStudioSale, saleStatus, generateDocumentNumber]);

    // Get selected customer's due balance
    const selectedCustomerDue = selectedCustomer?.dueBalance || 0;

    // --- Workflow Handlers ---

    // 1. Select Product -> Immediately add to items list (Selection = Add)
    const handleSelectProduct = (product: any) => {
        const newItemId = Date.now();
        
        // Check if product has variations
        if (product.hasVariations) {
            // Add product with variation selector flag
            const newItem: SaleItem = {
                id: newItemId,
                productId: product.id,
                name: product.name,
                sku: product.sku,
                price: product.price,
                qty: 1,
                size: undefined,
                color: undefined,
                stock: product.stock,
                lastPurchasePrice: product.lastPurchasePrice,
                lastSupplier: product.lastSupplier,
                showVariations: true, // Show variation selector inline
                unitAllowDecimal: product.unitAllowDecimal ?? false, // Pass unit decimal setting
            };

            setItems(prev => [newItem, ...prev]);
            toast.success("Item added - Select variation");
            
            // Set focus tracking for variation section
            setLastAddedItemId(newItemId);
        } else {
            // No variations - add directly
            const newItem: SaleItem = {
                id: newItemId,
                productId: product.id,
                name: product.name,
                sku: product.sku,
                price: product.price,
                qty: 1,
                size: undefined,
                color: undefined,
                stock: product.stock,
                lastPurchasePrice: product.lastPurchasePrice,
                lastSupplier: product.lastSupplier,
                unitAllowDecimal: product.unitAllowDecimal ?? false, // Pass unit decimal setting
            };

            setItems(prev => [newItem, ...prev]);
            toast.success("Item added");
            
            // Set focus tracking for quantity input
            setLastAddedItemId(newItemId);
        }
        
        // Close search and reset
        setProductSearchOpen(false);
        setProductSearchTerm("");
    };
    
    // Handle variation selection from inline row (variation from backend product.variations)
    const handleInlineVariationSelect = (itemId: number, variation: { id?: string; size?: string; color?: string; sku?: string; price?: number; stock?: number; attributes?: Record<string, unknown> }) => {
        setItems(prev => prev.map(item => {
            if (item.id === itemId) {
                const size = variation.size || variation.attributes?.size as string;
                const color = variation.color || variation.attributes?.color as string;
                const variationSku = variation.sku || `${item.sku}-${size}-${color}`.replace(/\s+/g, '-').toUpperCase();
                
                return {
                    ...item,
                    variationId: variation.id,
                    size: size,
                    color: color,
                    sku: variationSku, // Update SKU to variation-specific SKU
                    price: variation.price || item.price,
                    stock: variation.stock ?? item.stock,
                    showVariations: false, // Hide variation selector
                    selectedVariationId: variation.id,
                };
            }
            return item;
        }));
        toast.success("Variation selected");
        
        // After variation is selected, focus quantity input
        setTimeout(() => {
            itemQtyRefs.current[itemId]?.focus();
        }, 50);
    };
    
    // Handle variation selection (deprecated - kept for compatibility)
    const handleVariationSelect = (variation: Variation) => {
        // Deprecated - variations now handled inline in item rows
    };

    // 2. Clear Pending Row (Reset to Search) - Deprecated, kept for compatibility
    const resetEntryRow = () => {
        setPendingProduct(null);
        setProductSearchTerm("");
        setPendingQty(1);
        setPendingPrice(0);
        setPendingSize("");
        setPendingColor("");
        setPendingThaans(0);
        setPendingMeters(0);
        setPendingPackingDetails(undefined);
        
        // Focus Search Input
        setTimeout(() => {
            searchInputRef.current?.focus();
        }, 50);
    };

    // 3. Add to List - Deprecated (items are now added immediately on selection)
    const commitPendingItem = () => {
        // This function is deprecated - items are added immediately on selection
        // Kept for compatibility but does nothing
    };

    // Items List Handlers
    // CRITICAL FIX: Ensure updateItem correctly updates the right item by ID
    const updateItem = (id: number, field: keyof SaleItem, value: number) => {
        setItems(prev => {
            const updated = prev.map(item => {
                if (item.id === id) {
                    const updatedItem = { ...item, [field]: value };
                    console.log(`[SALE FORM] ✅ Updated item ID ${id} field ${field}:`, {
                        oldValue: item[field],
                        newValue: value,
                        itemName: item.name,
                        itemIndex: prev.findIndex(i => i.id === id)
                    });
                    return updatedItem;
                }
                return item;
            });
            console.log(`[SALE FORM] ✅ State updated. Total items: ${updated.length}, Updated item count: ${updated.filter((item, idx) => {
                const original = prev[idx];
                return original && item[field] !== original[field];
            }).length}`);
            return updated;
        });
    };

    const removeItem = (id: number) => {
        setItems(prev => prev.filter(item => item.id !== id));
    };

    // Packing normalization: backend-ready shape (first-time save)
    const normalizePacking = (details: PackingDetails): PackingDetails => ({
        total_boxes: details.total_boxes ?? 0,
        total_pieces: details.total_pieces ?? 0,
        total_meters: details.total_meters ?? 0,
        boxes: (details.boxes && details.boxes.length > 0) ? details.boxes : [],
    });

    // Packing Handlers – single source of truth = sale item. On first save, commit immediately to item.
    const handleSavePacking = (itemId: number, details: PackingDetails) => {
        // DEBUG: Log what we're receiving and saving
        console.log('[SALE FORM] handleSavePacking called:', {
            itemId,
            details,
            boxes: details.boxes,
            boxesCount: details.boxes?.length,
            loose_pieces: details.loose_pieces,
            totals: {
                total_boxes: details.total_boxes,
                total_pieces: details.total_pieces,
                total_meters: details.total_meters
            }
        });
        
        // Verify structure integrity
        if (details.boxes && details.boxes.length > 0) {
            details.boxes.forEach((box, idx) => {
                console.log(`[SALE FORM] Box ${idx + 1} in details:`, {
                    box_no: box.box_no,
                    pieces: box.pieces,
                    piecesCount: box.pieces.length
                });
            });
        }
        
        // CRITICAL: Do NOT normalize - save complete structure as-is
        // normalizePacking might be filtering/reshaping data
        setItems(prev => prev.map(item => {
            if (item.id === itemId) {
                const updatedItem = {
                    ...item,
                    packingDetails: details, // CRITICAL: Save complete structure, not normalized
                    packing_quantity: details.total_meters,
                    packing_unit: 'meters',
                    qty: details.total_meters,
                    thaans: details.total_boxes,
                    meters: details.total_meters,
                    packingTouched: false,
                };
                
                console.log('[SALE FORM] Updated item packingDetails:', {
                    itemId: item.id,
                    packingDetails: updatedItem.packingDetails,
                    boxes: updatedItem.packingDetails?.boxes,
                    boxesCount: updatedItem.packingDetails?.boxes?.length
                });
                
                return updatedItem;
            }
            return item;
        }));
        toast.success("Packing details saved");
        setActivePackingItemId(null);
    };

    const openPackingModalLocal = (item: SaleItem) => {
        setActivePackingItemId(item.id);
        // Mark that user opened packing (for submit validation: block if not saved)
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, packingTouched: true } : i));
        if (openPackingModal) {
            openPackingModal({
                itemId: item.id,
                productName: item.name,
                initialData: item.packingDetails, // Pre-fill with existing data if editing
                onSave: (details) => handleSavePacking(item.id, details), // Pass itemId in closure – no reliance on state
            });
        }
    };

    const handleOpenPackingModalById = (itemId: number) => {
        if (!enablePacking) return;
        const item = items.find(i => i.id === itemId);
        if (item) openPackingModalLocal(item);
    };

    // Payment Handlers
    const addPartialPayment = () => {
        if (newPaymentAmount <= 0) return;
        
        // 🔧 FIX: Auto-generate unique reference number for each payment
        // Each payment method gets its own sequential reference number
        const autoReferenceNumber = generateDocumentNumber('payment');
        incrementNextNumber('payment');
        
        setPartialPayments(prev => [...prev, {
            id: Date.now().toString(),
            method: newPaymentMethod,
            amount: newPaymentAmount,
            reference: newPaymentReference || autoReferenceNumber, // Use manual reference if provided, otherwise auto-generate
            attachments: paymentAttachments
        }]);
        setNewPaymentAmount(0); // Reset input
        setNewPaymentReference(""); // Clear manual reference input
        setPaymentAttachments([]);
    };

    const removePartialPayment = (id: string) => {
        setPartialPayments(prev => prev.filter(p => p.id !== id));
    };

    // Extra Expenses Handlers
    const addExtraExpense = () => {
        if (newExpenseAmount <= 0) return;
        
        setExtraExpenses(prev => [...prev, {
            id: Date.now().toString(),
            type: newExpenseType,
            amount: newExpenseAmount,
            notes: newExpenseNotes
        }]);
        setNewExpenseAmount(0); // Reset input
        setNewExpenseNotes("");
        toast.success("Expense added");
    };

    const removeExtraExpense = (id: string) => {
        setExtraExpenses(prev => prev.filter(exp => exp.id !== id));
    };

    const getCustomerName = () => customers.find(c => c.id.toString() === customerId)?.name || "Select Customer";
    
    // Handle Save
    const handleSave = async (print: boolean = false) => {
        if (!customerId || customerId === '') {
            toast.error('Please select a customer');
            return;
        }
        
        // CRITICAL FIX: Validate unit decimal rules before save
        for (const item of items) {
            if (item.unitAllowDecimal === false && item.qty % 1 !== 0) {
                toast.error(`Item "${item.name}": This product unit does not allow decimal quantities. Please enter a whole number.`);
                return;
            }
        }
        
        if (items.length === 0) {
            toast.error('Please add at least one item');
            return;
        }

        // HARD validation: packing opened but not saved → block submit (only when packing is enabled)
        if (enablePacking) {
            const packingOpenedNotSaved = items.some(i => i.packingTouched && !i.packingDetails);
            if (packingOpenedNotSaved) {
                toast.error('Please save packing for all items where packing was opened.');
                setSaving(false);
                return;
            }
        }

        // RULE 4: Variation selection required when product has variations
        const itemWithoutVariation = items.find(i => i.showVariations && !i.selectedVariationId && !i.variationId);
        if (itemWithoutVariation) {
            toast.error(`Variation selection required for "${itemWithoutVariation.name}". Please select a size/color (or combination) before saving.`);
            setSaving(false);
            return;
        }

        // If status is final, show payment choice dialog – only for NEW sale, not when updating
        if (saleStatus === 'final' && !initialSale) {
            setPendingSaveAction({ print });
            setPaymentChoiceDialogOpen(true);
            return;
        }

        // For draft/quotation/order, or when editing, save directly without payment
        await proceedWithSave(print);
    };

    // Actual save logic (extracted from handleSave)
    // Returns the created/updated sale ID and invoice number if payment dialog should open
    const proceedWithSave = async (print: boolean = false, shouldOpenPaymentDialog: boolean = false): Promise<{ saleId: string | null; invoiceNo: string | null }> => {
        try {
            setSaving(true);
            
            const selectedCustomer = customers.find(c => c.id.toString() === customerId);
            const customerName = selectedCustomer?.name || 'Walk-in Customer';
            let customerUuid: string | undefined;
            if (customerId === 'walk-in') {
                const walkIn = await contactService.getWalkingCustomer(companyId);
                customerUuid = walkIn?.id ?? undefined;
            } else {
                customerUuid = customerId.toString();
            }
            
            // CRITICAL FIX: Convert items to SaleItem format with variationId
            // Need to find variation_id from size/color if product has variations
            console.log('[SALE FORM] 🔄 Converting items for save. Total items:', items.length);
            console.log('[SALE FORM] Items state before conversion:', items.map((item, idx) => ({
              index: idx,
              id: item.id,
              productId: item.productId,
              name: item.name,
              qty: item.qty,
              price: item.price
            })));
            
            const saleItems = await Promise.all(
              items.map(async (item, index) => {
                let variationId: string | undefined = undefined;
                
                // Use variationId from inline selector (backend) if set; else resolve from size/color
                if (item.variationId) {
                  variationId = item.variationId;
                } else if (item.size || item.color) {
                  try {
                    const product = await productService.getProduct(item.productId.toString());
                    if (product && product.variations && product.variations.length > 0) {
                      const matchingVariation = product.variations.find((v: any) => {
                        const vSize = v.size || v.attributes?.size;
                        const vColor = v.color || v.attributes?.color;
                        return vSize === item.size && vColor === item.color;
                      });
                      if (matchingVariation) variationId = matchingVariation.id;
                    }
                  } catch (variationError) {
                    console.warn(`[SALE FORM] Could not find variation for item ${item.id}:`, variationError);
                  }
                }
                
                // Same as Purchase: context expects packingDetails (camelCase); it maps to packing_details for DB
                const saleItem = {
                  id: item.id.toString(),
                  productId: item.productId.toString(),
                  productName: item.name,
                  sku: item.sku,
                  quantity: item.qty,
                  price: item.price,
                  discount: 0,
                  tax: 0,
                  total: item.price * item.qty,
                  variationId: variationId,
                  ...(enablePacking ? {
                    packingDetails: item.packingDetails, // CRITICAL: context reads item.packingDetails for DB packing_details
                    packing_type: item.packingDetails?.packing_type || undefined,
                    packing_quantity: item.packingDetails?.total_meters || item.meters || undefined,
                    packing_unit: item.packingDetails?.packing_unit || 'meters',
                    thaans: item.thaans,
                    meters: item.meters
                  } : { packingDetails: undefined, packing_type: undefined, packing_quantity: undefined, packing_unit: undefined, thaans: undefined, meters: undefined })
                };
                
                console.log(`[SALE FORM] ✅ Converted item ${index}:`, {
                  id: saleItem.id,
                  productId: saleItem.productId,
                  name: saleItem.productName,
                  qty: saleItem.quantity,
                  price: saleItem.price
                });
                
                return saleItem;
              })
            );
            
            console.log('[SALE FORM] ✅ Final saleItems array length:', saleItems.length);
            console.log('[SALE FORM] Final saleItems payload:', saleItems.map((item, idx) => ({
              index: idx,
              id: item.id,
              productId: item.productId,
              qty: item.quantity,
              price: item.price
            })));
            
            // CRITICAL FIX: Map sale status correctly
            // Draft → status: 'draft', type: 'quotation'
            // Quotation → status: 'quotation', type: 'quotation'
            // Order → status: 'order', type: 'quotation'
            // Final → status: 'final', type: 'invoice'
            const saleType: 'invoice' | 'quotation' = saleStatus === 'final' ? 'invoice' : 'quotation';
            const mappedStatus: 'draft' | 'quotation' | 'order' | 'final' = saleStatus;
            
            // INVOICE PREFIX RULE: Regular sale → generateDocumentNumber('invoice') → SL. Studio → generateDocumentNumber('studio') → STD. Separate counters; never mix.
            // If editing existing sale, preserve original invoice number unless type was changed to Studio.
            let documentNumber: string;
            let documentType: 'draft' | 'quotation' | 'order' | 'invoice' | 'studio';
            
            if (initialSale && initialSale.invoiceNo) {
                // EDIT MODE: Preserve existing invoice number UNLESS type was changed to Studio (then use next STD-XXXX)
                const existingIsStudio = initialSale.invoiceNo.startsWith('STD-') || initialSale.invoiceNo.startsWith('ST-');
                if (isStudioSale && !existingIsStudio) {
                    // Type changed to Studio → regenerate invoice number (STD-XXXX) and persist via update
                    documentType = 'studio';
                    documentNumber = generateDocumentNumber('studio');
                } else {
                    documentNumber = initialSale.invoiceNo;
                    // Determine document type from existing invoice number prefix
                    if (documentNumber.startsWith('DRAFT-')) {
                        documentType = 'draft';
                    } else if (documentNumber.startsWith('QT-')) {
                        documentType = 'quotation';
                    } else if (documentNumber.startsWith('SO-')) {
                        documentType = 'order';
                    } else if (documentNumber.startsWith('SL-') || documentNumber.startsWith('INV-')) {
                        documentType = 'invoice';
                    } else if (documentNumber.startsWith('STD-') || documentNumber.startsWith('ST-')) {
                        documentType = 'studio'; // STD is canonical; ST- for legacy
                    } else {
                        documentType = saleStatus === 'final' ? (isStudioSale ? 'studio' : 'invoice') : 
                                      saleStatus === 'quotation' ? 'quotation' :
                                      saleStatus === 'order' ? 'order' : 'draft';
                    }
                }
            } else {
                // NEW SALE: Regular → SL (invoice). Studio → STD (studio). No shared counter.
                if (isStudioSale) {
                    documentType = 'studio';
                    documentNumber = generateDocumentNumber('studio');
                } else {
                    switch (saleStatus) {
                        case 'draft':
                            documentType = 'draft';
                            documentNumber = generateDocumentNumber('draft');
                            break;
                        case 'quotation':
                            documentType = 'quotation';
                            documentNumber = generateDocumentNumber('quotation');
                            break;
                        case 'order':
                            documentType = 'order';
                            documentNumber = generateDocumentNumber('order');
                            break;
                        case 'final':
                            documentType = 'invoice';
                            documentNumber = generateDocumentNumber('invoice');
                            break;
                        default:
                            documentType = 'draft';
                            documentNumber = generateDocumentNumber('draft');
                    }
                }
            }
            
            // CRITICAL FIX: For draft/quotation/order, force payment to 0 and payment_status to 'unpaid'
            // Payment should only be allowed for final sales
            const finalPaid = (saleStatus === 'final') ? totalPaid : 0;
            const finalDue = (saleStatus === 'final') ? balanceDue : totalAmount;
            const finalPaymentStatus: 'paid' | 'partial' | 'unpaid' = (saleStatus === 'final') 
                ? paymentStatus 
                : 'unpaid';
            
            // Branch: only require selection when user has multiple branches; otherwise use single accessible branch
            const singleBranchId = accessibleBranches.length === 1 ? accessibleBranches[0]?.id : null;
            const finalBranchId = singleBranchId
                ? singleBranchId
                : (isAdmin ? (branchId || contextBranchId || '') : (contextBranchId || branchId || ''));
            const isValidBranch = finalBranchId && finalBranchId !== 'all' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(finalBranchId);
            const branchSelectionRequired = accessibleBranches.length > 1;
            if (branchSelectionRequired && !isValidBranch) {
                toast.error('Please select a branch before saving');
                setSaving(false);
                return;
            }
            if (!branchSelectionRequired && !singleBranchId) {
                toast.error(
                    accessibleBranches.length === 0 && !isAdmin
                        ? 'Your user is not assigned to any branch. Ask admin to assign a branch.'
                        : 'No branch available. Please contact admin.'
                );
                setSaving(false);
                return;
            }
            
            // Create sale data
            const saleData = {
                type: saleType,
                status: mappedStatus,
                invoiceNo: documentNumber, // Status-based document number (draft/final/studio)
                customer: customerUuid || '',
                customerName: customerName,
                contactNumber: '', // Can be enhanced to get from customer
                date: formatDateWithTimezone(saleDate),
                location: finalBranchId, // CRITICAL: Always use validated branch ID
                items: saleItems,
                itemsCount: items.length,
                subtotal: subtotal,
                discount: discountAmount,
                tax: 0, // Can be enhanced later
                expenses: expensesTotal + finalShippingCharges,
                total: totalAmount,
                paid: finalPaid,
                due: finalDue,
                returnDue: 0,
                paymentStatus: finalPaymentStatus,
                paymentMethod: (saleStatus === 'final' && partialPayments.length > 0) ? partialPayments[0].method : 'cash',
                shippingStatus: shippingEnabled ? 'pending' as const : 'pending' as const,
                notes: saleNotes || studioNotes || refNumber || undefined, // CRITICAL: Use saleNotes (saves to database)
                // CRITICAL: Include extra expenses, commission for accounting
                extraExpenses: extraExpenses,
                commissionAmount: commissionAmount,
                salesmanId: (salesmanId && salesmanId !== "1" && salesmanId !== "none") ? salesmanId : null,
                // CRITICAL FIX: Pass partialPayments array for splitting into separate payment records
                partialPayments: (saleStatus === 'final' && partialPayments.length > 0) ? partialPayments : [],
                // Studio sale: show on Studio page and use studio invoice numbering
                isStudioSale: isStudioSale,
                is_studio: isStudioSale
            };
            
            // CRITICAL FIX: Check if editing existing sale
            if (initialSale && initialSale.id) {
                // EDIT MODE: Update existing sale (invoice number updated when converting to Studio)
                await updateSale(initialSale.id, saleData);
                if (saleAttachmentFiles.length > 0 && companyId) {
                    try {
                        const uploaded = await uploadSaleAttachments(companyId, initialSale.id, saleAttachmentFiles);
                        const existing = (initialSale as any)?.attachments || [];
                        const merged = Array.isArray(existing) ? [...existing, ...uploaded] : uploaded;
                        if (merged.length > 0) await updateSale(initialSale.id, { attachments: merged } as any);
                        setSaleAttachmentFiles([]);
                        setSavedSaleAttachments(merged);
                    } catch (e) {
                        console.warn('[SALE FORM] Attachment upload failed:', e);
                        toast.warning('Sale saved but some attachments could not be uploaded.');
                    }
                }
                // If we regenerated invoice for Studio conversion, consume studio number so next studio sale gets next STD
                if (isStudioSale && !initialSale.invoiceNo.startsWith('STD-') && !initialSale.invoiceNo.startsWith('ST-')) {
                    incrementNextNumber('studio');
                }
                toast.success(`Sale ${documentNumber} updated successfully!`);
                
                // Store sale ID and invoice number for payment dialog (edit mode)
                setSavedSaleId(initialSale.id);
                setSavedSaleInvoiceNo(documentNumber);
                
                if (print) {
                    try {
                        const full = await saleService.getSaleById(initialSale.id);
                        const saleToPrint = full ? convertFromSupabaseSale(full) : null;
                        if (saleToPrint) {
                            setSaleForPrint(saleToPrint);
                            setShowPrintLayout(true);
                        }
                    } catch (e) {
                        toast.warning('Sale saved. Open it from the list to print.');
                    }
                    return { saleId: initialSale.id, invoiceNo: documentNumber };
                }
                
                // If payment dialog should open, don't close form yet
                if (shouldOpenPaymentDialog) {
                    // Don't close form - payment dialog will open
                    return { saleId: initialSale.id, invoiceNo: documentNumber };
                }
                
                // Close form
                onClose();
                return { saleId: initialSale.id, invoiceNo: documentNumber };
            } else {
                // NEW SALE: Create new sale
                const created = await createSale(saleData);
                if (created?.id && saleAttachmentFiles.length > 0 && companyId) {
                    try {
                        const uploaded = await uploadSaleAttachments(companyId, created.id, saleAttachmentFiles);
                        if (uploaded.length > 0) await updateSale(created.id, { attachments: uploaded } as any);
                        setSaleAttachmentFiles([]);
                        setSavedSaleAttachments(uploaded);
                    } catch (e) {
                        console.warn('[SALE FORM] Attachment upload failed:', e);
                        toast.warning('Sale created but some attachments could not be uploaded.');
                    }
                }
                // Increment document number after successful save
                incrementNextNumber(documentType);
                toast.success(`${saleType === 'invoice' ? 'Invoice' : 'Quotation'} created successfully!`);
                
                // Store sale ID and invoice number for payment dialog
                if (created?.id) {
                    setSavedSaleId(created.id);
                    setSavedSaleInvoiceNo(documentNumber);
                }
                
                // Studio sale: after save, open Studio Sale Detail for this sale (single master page)
                if (isStudioSale && created?.id && setSelectedStudioSaleId && setCurrentView) {
                  setSelectedStudioSaleId(created.id);
                  closeDrawer();
                  setCurrentView('studio-sale-detail-new');
                  return { saleId: null, invoiceNo: null, studioRedirect: true }; // Don't open payment dialog – we navigated to studio
                }
                
                if (print && created) {
                    setSaleForPrint(created);
                    setShowPrintLayout(true);
                }
                
                // If payment dialog should open, don't close form yet
                if (shouldOpenPaymentDialog && created?.id) {
                    // Don't close form - payment dialog will open
                    return { saleId: created.id, invoiceNo: documentNumber };
                }
                
                // Close form (unless payment dialog will open or print view is showing)
                if (!shouldOpenPaymentDialog && !print) {
                    onClose();
                }
                
                // Return sale ID and invoice number for payment dialog
                return { saleId: created?.id || null, invoiceNo: documentNumber || null };
            }
        } catch (error: any) {
            console.error('[SALE FORM] Error saving sale:', error);
            toast.error(`Failed to save sale: ${error.message || 'Unknown error'}`);
            return null;
        } finally {
            setSaving(false);
        }
    };

    // Keyboard navigation: Auto-focus after item is added
    useEffect(() => {
        if (lastAddedItemId !== null) {
            setTimeout(() => {
                const item = items.find(i => i.id === lastAddedItemId);
                if (item) {
                    if (item.showVariations) {
                        // Focus first variation button
                        itemVariationRefs.current[lastAddedItemId]?.focus();
                    } else {
                        // Focus quantity input
                        itemQtyRefs.current[lastAddedItemId]?.focus();
                    }
                }
                setLastAddedItemId(null);
            }, 100);
        }
    }, [lastAddedItemId, items]);
    
    // Keyboard handlers for navigation
    const handleQtyKeyDown = (e: React.KeyboardEvent, itemId: number) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            itemPriceRefs.current[itemId]?.focus();
        }
    };
    
    const handlePriceKeyDown = (e: React.KeyboardEvent, itemId: number) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            // Return focus to search input
            setProductSearchOpen(true);
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 50);
        }
    };

    // Show loader while loading data
    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-[#111827]">
                <Loader2 size={48} className="text-blue-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-[#111827] text-white overflow-hidden">
            {/* ============ LAYER 1: FIXED HEADER ============ */}
            <div className="shrink-0 bg-[#0B1019] border-b border-gray-800 z-20">
                {/* Top Bar - Single Row with Invoice, Status, Salesman, Branch */}
                <div className="h-12 flex items-center justify-between px-6 border-b border-gray-800/50">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-400 hover:text-white h-8 w-8">
                            <X size={18} />
                        </Button>
                        <div>
                            <h2 className="text-sm font-bold text-white">New Sale Invoice</h2>
                            <p className="text-[10px] text-gray-500">Standard Entry</p>
                        </div>
                        {/* Invoice Number - Moved to LEFT side after title (wait for settings so studio number comes from DB) */}
                        <div className="flex items-center gap-2 ml-4 pl-4 border-l border-gray-800">
                            <Hash size={14} className="text-cyan-500" />
                            <span className="text-sm font-mono text-cyan-400">
                                {displayInvoiceNumber === '' && isStudioSale && !initialSale?.invoiceNo
                                    ? (settingsLoading ? 'Loading...' : '...')
                                    : displayInvoiceNumber}
                            </span>
                    </div>
                </div>

                    {/* Right side: Status, Salesman, Branch */}
                    <div className="flex items-center gap-4">
                        
                        {/* Status - Chip Style */}
                        <Popover open={statusDropdownOpen} onOpenChange={(open) => {
                            if (!(initialSale && initialSale.type !== 'quotation')) {
                                setStatusDropdownOpen(open);
                            }
                        }}>
                            <PopoverTrigger asChild>
                                <button
                                    type="button"
                                    disabled={initialSale && initialSale.type !== 'quotation'}
                                    className={cn(
                                        "px-3 py-1 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5",
                                        getStatusChipColor(),
                                        initialSale && initialSale.type !== 'quotation' 
                                            ? "opacity-50 cursor-not-allowed" 
                                            : "hover:opacity-80 cursor-pointer"
                                    )}
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                                    {saleStatus.charAt(0).toUpperCase() + saleStatus.slice(1)}
                                </button>
                            </PopoverTrigger>
                            <PopoverContent 
                                className="w-48 bg-gray-900 border-gray-800 text-white p-2"
                                align="start"
                            >
                                <div className="space-y-1">
                                    {(['draft', 'quotation', 'order', 'final'] as const).map((s) => {
                                        const isFinalSale = initialSale && initialSale.type !== 'quotation';
                                        const isDisabled = isFinalSale && s === 'draft';
                                        return (
                                        <button
                                            key={s}
                                            type="button"
                                            disabled={isDisabled}
                                            onClick={() => {
                                                if (!isDisabled) {
                                                    setSaleStatus(s);
                                                    setStatusDropdownOpen(false);
                                                }
                                            }}
                                            className={cn(
                                                "w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center gap-2",
                                                saleStatus === s
                                                    ? "bg-gray-800 text-white"
                                                    : "text-gray-400 hover:bg-gray-800 hover:text-white",
                                                isDisabled && "opacity-50 cursor-not-allowed"
                                            )}
                                        >
                                            <span className={cn(
                                                "w-1.5 h-1.5 rounded-full",
                                                s === 'draft' && "bg-gray-500",
                                                s === 'quotation' && "bg-yellow-500",
                                                s === 'order' && "bg-blue-500",
                                                s === 'final' && "bg-green-500"
                                            )}></span>
                                            {s.charAt(0).toUpperCase() + s.slice(1)}
                                        </button>
                                    )})}
                                        </div>
                            </PopoverContent>
                        </Popover>

                        {/* Salesman: only admin sees selector; salesman sees read-only label */}
                        {isAdmin ? (
                            <Popover open={salesmanDropdownOpen} onOpenChange={setSalesmanDropdownOpen}>
                                <PopoverTrigger asChild>
                                    <button
                                        type="button"
                                        className="flex items-center gap-2 bg-gray-900/50 border border-gray-800 rounded-lg px-2.5 py-1 hover:bg-gray-800 transition-colors cursor-pointer"
                                    >
                                        <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-semibold">
                                            {getSalesmanName().charAt(0).toUpperCase()}
                                        </div>
                                        <span className="text-xs text-white">{getSalesmanName()}</span>
                                        <ChevronRight size={12} className="text-gray-500 rotate-90" />
                                    </button>
                                </PopoverTrigger>
                                <PopoverContent 
                                    className="w-56 bg-gray-900 border-gray-800 text-white p-2"
                                    align="start"
                                >
                                    <div className="space-y-1">
                                        {salesmen.map((s) => (
                                            <button
                                                key={s.id}
                                                type="button"
                                                onClick={() => {
                                                    setSalesmanId(s.id.toString());
                                                    setSalesmanDropdownOpen(false);
                                                }}
                                                className={cn(
                                                    "w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center gap-2",
                                                    salesmanId === s.id.toString()
                                                        ? "bg-gray-800 text-white"
                                                        : "text-gray-400 hover:bg-gray-800 hover:text-white"
                                                )}
                                            >
                                                <div className={cn(
                                                    "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold",
                                                    salesmanId === s.id.toString() ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300"
                                                )}>
                                                    {s.name.charAt(0).toUpperCase()}
                                                </div>
                                                <span>{s.code ? `${s.code} | ${s.name}` : s.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </PopoverContent>
                            </Popover>
                        ) : (
                            <div className="flex items-center gap-2 bg-gray-900/50 border border-gray-800 rounded-lg px-2.5 py-1 text-gray-400">
                                <div className="w-5 h-5 rounded-full bg-blue-600/70 flex items-center justify-center text-white text-[10px] font-semibold">
                                    {getSalesmanName().charAt(0).toUpperCase()}
                                </div>
                                <span className="text-xs">Salesperson: {getSalesmanName()}</span>
                            </div>
                        )}

                        {/* Branch - Chip: dropdown only when multiple accessible branches */}
                        {showBranchSelector ? (
                        <Popover open={branchDropdownOpen} onOpenChange={setBranchDropdownOpen}>
                            <PopoverTrigger asChild>
                                <button
                                    type="button"
                                    className="flex items-center gap-2 bg-gray-900/50 border border-gray-800 rounded-lg px-2.5 py-1 hover:bg-gray-800 transition-colors cursor-pointer"
                                >
                                    <Building2 size={14} className="text-gray-500 shrink-0" />
                                    <span className="text-xs text-white">{getBranchName()}</span>
                                    <ChevronRight size={12} className="text-gray-500 rotate-90" />
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 bg-gray-900 border-gray-800 text-white p-2" align="end">
                                <div className="space-y-1">
                                    {accessibleBranches.map((b) => (
                                        <button
                                            key={b.id}
                                            type="button"
                                            onClick={() => {
                                                setBranchId(b.id);
                                                setBranchDropdownOpen(false);
                                            }}
                                            className={cn(
                                                "w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center gap-2",
                                                branchId === b.id || branchId === b.id.toString()
                                                    ? "bg-gray-800 text-white"
                                                    : "text-gray-400 hover:bg-gray-800 hover:text-white"
                                            )}
                                        >
                                            <Building2 size={16} className={cn(
                                                branchId === b.id || branchId === b.id.toString() ? "text-blue-400" : "text-gray-500"
                                            )} />
                                            <span>{b.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </PopoverContent>
                        </Popover>
                        ) : (
                        <div className="flex items-center gap-2 bg-gray-900/50 border border-gray-800 rounded-lg px-2.5 py-1 opacity-90">
                            <Building2 size={14} className="text-gray-500 shrink-0" />
                            <span className="text-xs text-white">{getBranchName()}</span>
                        </div>
                        )}
                                </div>
                            </div>

                {/* FORM HEADER: Customer, Date, Ref #, Type */}
                <div className="px-6 py-4 bg-[#0F1419]">
                    <div className="invoice-container mx-auto w-full max-w-[1151px]">
                        <div className="bg-gray-900/30 border border-gray-800/50 rounded-lg p-3 min-h-[85px] w-full">
                            <div className="flex items-end gap-3 w-full flex-wrap">
                                {/* Customer – same layout as Purchase Supplier */}
                                <div className="flex flex-col flex-1 min-w-0 min-w-[200px]">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <Label className="text-orange-400 font-medium text-[10px] uppercase tracking-wide h-[14px]">Customer</Label>
                                        {customerId && (
                                            <span className={cn("absolute left-[672px] text-[15px] font-semibold tabular-nums", getDueBalanceColor(selectedCustomerDue))}>
                                                {formatDueBalanceCompact(selectedCustomerDue)}
                                            </span>
                                        )}
                                    </div>
                            <Popover 
                                key={`customer-select-${customerId || 'none'}-${customers.length}-${selectedCustomer?.id || 'none'}`} 
                                open={customerSearchOpen} 
                                onOpenChange={setCustomerSearchOpen}
                            >
                                <PopoverTrigger asChild>
                                    <div className="flex items-center gap-2 bg-gray-900/50 border border-gray-800 rounded-lg px-2.5 py-1 hover:bg-gray-800 transition-colors cursor-pointer w-[748px] h-10 min-h-[40px]">
                                        <User size={14} className="text-gray-500 shrink-0" />
                                        <span 
                                            className="text-xs text-white flex-1 truncate text-left"
                                            key={`customer-name-display-${customerId || 'none'}-${selectedCustomer?.name || 'none'}`}
                                        >
                                            {selectedCustomer?.name || "Select Customer"}
                                        </span>
                                        {/* Plus icon inside search field - NOT a button to avoid nesting */}
                                        <div
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openDrawer('addContact', 'addSale', { 
                                                    contactType: 'customer',
                                                    prefillName: customerSearchTerm || undefined
                                                });
                                                setCustomerSearchOpen(false);
                                                setCustomerSearchTerm('');
                                            }}
                                            className="p-0.5 hover:bg-gray-700 rounded transition-colors cursor-pointer"
                                        >
                                            <Plus size={12} className="text-gray-400 hover:text-blue-400" />
                                            </div>
                                        <ChevronRight size={12} className="text-gray-500 rotate-90 shrink-0" />
                                            </div>
                                </PopoverTrigger>
                                <PopoverContent 
                                    className="w-80 bg-gray-900 border-gray-800 text-white p-2 flex flex-col overflow-hidden max-h-[320px]"
                                    align="start"
                                    onOpenAutoFocus={(e) => e.preventDefault()}
                                >
                                    <div className="space-y-2 flex flex-col min-h-0 flex-1 overflow-hidden">
                                        {/* Search Input */}
                                        <Input
                                            placeholder="Search customers..."
                                            value={customerSearchTerm}
                                            onChange={(e) => setCustomerSearchTerm(e.target.value)}
                                            className="bg-gray-800 border-gray-700 text-white text-sm h-9 shrink-0"
                                        />
                                        {/* Customer List - scrollable; wheel + touch scroll */}
                                        <div
                                            className="space-y-1 overflow-y-auto overflow-x-hidden overscroll-contain max-h-64"
                                            style={{ WebkitOverflowScrolling: 'touch' }}
                                            tabIndex={0}
                                            onWheel={(e) => e.stopPropagation()}
                                        >
                                            {filteredCustomers.length === 0 ? (
                                                <div className="px-3 py-2 text-sm text-gray-400 text-center">
                                                    No customers found
                                            </div>
                                            ) : (
                                                <>
                                                    {filteredCustomers.map((cust) => (
                                                        <button
                                                            key={cust.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setCustomerId(cust.id.toString());
                                                                setCustomerSearchOpen(false);
                                                                setCustomerSearchTerm('');
                                                            }}
                                                            className={cn(
                                                                "w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center justify-between",
                                                                // 🔒 CRITICAL FIX: Use normalized comparison for UUID matching
                                                                (customerId === cust.id.toString() || 
                                                                 customerId === String(cust.id) ||
                                                                 (customerId && cust.id && 
                                                                  customerId.replace(/-/g, '').toLowerCase() === cust.id.toString().replace(/-/g, '').toLowerCase()))
                                                                    ? "bg-gray-800 text-white"
                                                                    : "text-gray-400 hover:bg-gray-800 hover:text-white"
                                                            )}
                                                        >
                                                            <span className="font-medium">{cust.name}</span>
                                                            <span className={cn(
                                                                "text-xs font-semibold tabular-nums ml-2",
                                                                cust.dueBalance > 0 && "text-green-400",
                                                                cust.dueBalance < 0 && "text-red-400",
                                                                cust.dueBalance === 0 && "text-gray-500"
                                                            )}>
                                                                {formatDueBalanceCompact(cust.dueBalance)}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </>
                                            )}
                                            </div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                                </div>
                                {/* Date – same as Purchase */}
                                <div className="flex flex-col w-[184px] absolute left-[798px] top-[77px] z-0">
                                    <Label className="text-gray-500 font-medium text-xs uppercase tracking-wide h-[14px] mb-1.5">Date</Label>
                                    <div className="[&>div>button]:bg-gray-900/50 [&>div>button]:border-gray-800 [&>div>button]:text-white [&>div>button]:text-xs [&>div>button]:h-10 [&>div>button]:min-h-[40px] [&>div>button]:px-2.5 [&>div>button]:py-1 [&>div>button]:rounded-lg [&>div>button]:border [&>div>button]:hover:bg-gray-800 [&>div>button]:w-full [&>div>button]:justify-start" style={{ width: '209px' }}>
                                        <CalendarDatePicker
                                            value={saleDate}
                                            onChange={(date) => setSaleDate(date || new Date())}
                                            showTime={true}
                                            required
                                        />
                                    </div>
                                </div>
                                {/* Type – same slot as Purchase Ref # */}
                                <div className="flex flex-col absolute left-[987px] w-[132px]">
                                    <Label className="text-gray-500 font-medium text-xs uppercase tracking-wide h-[14px] mb-1.5" style={{ position: 'absolute', top: '-59px', left: '30px' }}>Type</Label>
                                    <Popover open={typeDropdownOpen} onOpenChange={setTypeDropdownOpen}>
                                        <PopoverTrigger asChild>
                                            <button
                                                type="button"
                                                className="flex items-center gap-2 bg-gray-900/50 border border-gray-800 rounded-lg px-2.5 py-1 hover:bg-gray-800 transition-colors cursor-pointer w-full h-10 min-h-[40px] justify-start text-sm"
                                                style={{ position: 'absolute', top: '-41px', left: '26px', width: '107px', height: '40px' }}
                                            >
                                                <Tag size={14} className="text-gray-500 shrink-0" />
                                                <span className="text-xs text-white capitalize">{isStudioSale ? 'studio' : 'regular'}</span>
                                                <ChevronRight size={12} className="text-gray-500 rotate-90 shrink-0 ml-auto" />
                                            </button>
                                        </PopoverTrigger>
                                <PopoverContent 
                                    className="w-48 bg-gray-900 border-gray-800 text-white p-2"
                                    align="start"
                                >
                                    <div className="space-y-1">
                                        {(['regular', 'studio'] as const).map((t) => (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => {
                                                    setIsStudioSale(t === 'studio');
                                                    if (t === 'studio') setShippingEnabled(false);
                                                    setTypeDropdownOpen(false);
                                                }}
                                                className={cn(
                                                    "w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center gap-2",
                                                    (isStudioSale ? 'studio' : 'regular') === t
                                                        ? "bg-gray-800 text-white"
                                                        : "text-gray-400 hover:bg-gray-800 hover:text-white"
                                                )}
                                            >
                                                <Tag size={16} className={cn(
                                                    (isStudioSale ? 'studio' : 'regular') === t ? "text-blue-400" : "text-gray-500"
                                                )} />
                                                <span className="capitalize">{t}</span>
                                            </button>
                                        ))}
                                    </div>
                                </PopoverContent>
                            </Popover>
                                </div>

                                {/* Shipping Toggle (only for regular sales) */}
                                {!isStudioSale && (
                                    <div className="w-auto flex items-end">
                                        <button
                                            onClick={() => setShippingEnabled(!shippingEnabled)}
                                    className={`${shippingEnabled ? 'w-fit min-w-[38px] max-w-[100px]' : 'w-[28px]'} h-[42px] rounded-lg transition-all flex items-center justify-center shrink-0 ${ 
                                                shippingEnabled
                                                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                                    : 'bg-gray-800 text-gray-500 border border-gray-700 hover:bg-gray-750'
                                            }`}
                                            style={{ transform: 'none' }}
                                            title="Shipping"
                                        >
                                            <Truck size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Studio Details - Inline when active */}
                    {isStudioSale && (
                        <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-2 flex items-center gap-2 flex-wrap mt-3">
                            <div className="flex items-center gap-1.5 text-xs text-purple-400">
                                <Palette size={12} />
                                <Scissors size={12} />
                                <Sparkles size={12} />
                            </div>
                            <div className="w-40">
                                <CalendarDatePicker
                                    value={studioDeadline}
                                    onChange={setStudioDeadline}
                                    placeholder="Deadline"
                                    showTime={false}
                                />
                            </div>
                            <Input 
                                placeholder="Notes..."
                                value={studioNotes}
                                onChange={(e) => setStudioNotes(e.target.value)}
                                className="flex-1 min-w-[150px] h-7 bg-gray-950 border-purple-500/30 text-white text-xs placeholder:text-purple-400/30"
                            />
                        </div>
                    )}
            </div>
            </div>

            {/* ============ LAYER 2: SCROLLABLE MAIN CONTENT (DUAL PANEL) ============ */}
            <div className="flex-1 overflow-hidden">
                <div className="invoice-container mx-auto px-6 h-full">
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-3 h-full py-3">
                        
                        {/* LEFT PANEL - Items Entry (Independent Scroll) */}
                        <div className="flex flex-col h-full overflow-hidden">
                            <SaleItemsSection
                    items={items}
                    setItems={setItems}
                    productSearchOpen={productSearchOpen}
                    setProductSearchOpen={setProductSearchOpen}
                    productSearchTerm={productSearchTerm}
                    setProductSearchTerm={setProductSearchTerm}
                    pendingProduct={pendingProduct}
                    setPendingProduct={setPendingProduct}
                    pendingQty={pendingQty}
                    setPendingQty={setPendingQty}
                    pendingPrice={pendingPrice}
                    setPendingPrice={setPendingPrice}
                    pendingSize={pendingSize}
                    setPendingSize={setPendingSize}
                    pendingColor={pendingColor}
                    setPendingColor={setPendingColor}
                    pendingThaans={pendingThaans}
                    setPendingThaans={setPendingThaans}
                    pendingMeters={pendingMeters}
                    setPendingMeters={setPendingMeters}
                    filteredProducts={filteredProducts}
                    handleSelectProduct={handleSelectProduct}
                    handleAddItem={commitPendingItem}
                    handleOpenPackingModal={handleOpenPackingModalById}
                    enablePacking={enablePacking}
                    searchInputRef={searchInputRef}
                    qtyInputRef={qtyInputRef}
                    priceInputRef={priceInputRef}
                    addBtnRef={addBtnRef}
                    showVariationSelector={showVariationSelector}
                    selectedProductForVariation={selectedProductForVariation}
                    productVariations={productVariationsFromBackend}
                    handleVariationSelect={handleVariationSelect}
                    setShowVariationSelector={setShowVariationSelector}
                    setSelectedProductForVariation={setSelectedProductForVariation}
                    handleInlineVariationSelect={handleInlineVariationSelect}
                    isEditMode={Boolean(initialSale)}
                    updateItem={updateItem}
                    itemQtyRefs={itemQtyRefs}
                    itemPriceRefs={itemPriceRefs}
                    itemVariationRefs={itemVariationRefs}
                    handleQtyKeyDown={handleQtyKeyDown}
                    handlePriceKeyDown={handlePriceKeyDown}
                    lastAddedItemId={lastAddedItemId}
                            />
                        </div>

                        {/* RIGHT PANEL - Summary + Payment (Independent Scroll) */}
                        <div className="flex flex-col h-full overflow-y-auto space-y-3 pb-3">
                            {/* Shipping Section (if enabled) */}
                            {shippingEnabled && (
                                <div className="bg-gray-900/50 border border-blue-500/30 rounded-lg p-3 shrink-0">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wide flex items-center gap-2">
                                            <Truck size={14} />
                                            Shipping Details
                                        </h3>
                                        <button 
                                            onClick={() => setShippingEnabled(false)}
                                            className="text-xs text-gray-500 hover:text-red-400"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        <Input 
                                            type="text" 
                                            placeholder="Shipping Address"
                                            className="bg-gray-950 border-gray-700 text-white h-8 text-xs md:col-span-2"
                                            value={shippingAddress}
                                            onChange={(e) => setShippingAddress(e.target.value)}
                                        />
                                        <Input 
                                            type="number" 
                                            placeholder="Shipping Charges"
                                            className="bg-gray-950 border-gray-700 text-white h-8 text-xs"
                                            value={shippingCharges > 0 ? shippingCharges : ''}
                                            onChange={(e) => setShippingCharges(parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Extra Expenses - Compact Inline */}
                            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 shrink-0">
                                <div className="flex items-center justify-between mb-3">
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
                                    <DollarSign size={14} className="text-purple-500" />
                                    Extra Expenses
                                </h3>
                                {extraExpenses.length > 0 && (
                                    <Badge className="bg-purple-600 text-white text-sm px-2 py-0.5">
                                        {expensesTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </Badge>
                                )}
                                </div>

                                {/* Add Expense Form - More Compact */}
                                <div className="flex gap-2 mb-3">
                                    <Select value={newExpenseType} onValueChange={(v: any) => setNewExpenseType(v)}>
                                        <SelectTrigger className="w-[110px] bg-gray-950 border-gray-700 text-white h-8 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-gray-950 border-gray-800 text-white">
                                            <SelectItem value="stitching">Stitching</SelectItem>
                                            <SelectItem value="lining">Lining</SelectItem>
                                            <SelectItem value="dying">Dying</SelectItem>
                                            <SelectItem value="cargo">Cargo</SelectItem>
                                            <SelectItem value="Mobile Wallet">Mobile Wallet</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Input 
                                        type="number" 
                                        placeholder="Amount" 
                                        className="bg-gray-950 border-gray-700 text-white h-8 w-[90px] text-xs"
                                        value={newExpenseAmount > 0 ? newExpenseAmount : ''}
                                        onChange={(e) => setNewExpenseAmount(parseFloat(e.target.value) || 0)}
                                    />
                                    <Input 
                                        type="text" 
                                        placeholder="Notes (optional)" 
                                        className="bg-gray-950 border-gray-700 text-white h-8 flex-1 text-xs"
                                        value={newExpenseNotes}
                                        onChange={(e) => setNewExpenseNotes(e.target.value)}
                                    />
                                    <Button onClick={addExtraExpense} className="bg-purple-600 hover:bg-purple-500 h-8 w-8 p-0">
                                        <Plus size={14} />
                                    </Button>
                                </div>

                                {/* Expenses List - Only show if exists */}
                                {extraExpenses.length > 0 && (
                                    <div className="space-y-1.5">
                                        {extraExpenses.map((expense) => (
                                            <div key={expense.id} className="flex justify-between items-center p-2 bg-gray-950 rounded border border-gray-800/50 hover:border-purple-500/30 transition-colors">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded bg-purple-600/20 flex items-center justify-center">
                                                        <DollarSign size={10} className="text-purple-400" />
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-medium text-white capitalize">{expense.type}</div>
                                                        {expense.notes && <div className="text-[10px] text-gray-500">{expense.notes}</div>}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-white">{expense.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                    <button onClick={() => removeExtraExpense(expense.id)} className="text-gray-500 hover:text-red-400">
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Summary Card - Compact with Inline Controls */}
                            <div className="bg-gradient-to-br from-gray-900/80 to-gray-900/50 border border-gray-800 rounded-lg p-4 shrink-0">
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Invoice Summary</h3>
                                <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-400">Items Subtotal</span>
                                    <span className="text-white font-medium text-sm">{subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                
                                {/* Discount - Inline Input */}
                                <div className="flex items-center justify-between gap-2 py-1">
                                    <div className="flex items-center gap-1.5">
                                        <Percent size={12} className="text-red-400" />
                                        <span className="text-xs text-gray-400">Discount</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Select value={discountType} onValueChange={(v: any) => setDiscountType(v)}>
                                            <SelectTrigger className="w-14 h-8 bg-gray-950 border-gray-700 text-white text-xs px-2">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-gray-950 border-gray-800 text-white min-w-[60px]">
                                                <SelectItem value="percentage">%</SelectItem>
                                                <SelectItem value="fixed">{getCurrencySymbol(company?.currency)}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Input 
                                            type="number" 
                                            placeholder="0"
                                            className="w-20 h-8 bg-gray-950 border-gray-700 text-white text-xs text-right px-2"
                                            value={discountValue > 0 ? discountValue : ''}
                                            onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                                        />
                                        {discountAmount > 0 && (
                                            <span className="text-sm text-red-400 font-medium min-w-[60px] text-right">
                                                -{discountAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {expensesTotal > 0 && (
                                    <div className="flex justify-between text-xs">
                                        <span className="text-purple-400">Extra Expenses</span>
                                        <span className="text-purple-400 font-medium text-sm">+{expensesTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                )}
                                
                                {/* Shipping - Optional, show button or charges */}
                                {!shippingEnabled ? (
                                    <button 
                                        onClick={() => setShippingEnabled(true)}
                                        className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors py-1"
                                    >
                                        <Truck size={12} />
                                        <span>Add Shipping</span>
                                    </button>
                                ) : finalShippingCharges > 0 && (
                                    <div className="flex justify-between text-xs">
                                        <span className="text-blue-400">Shipping</span>
                                        <span className="text-blue-400 font-medium text-sm">+{finalShippingCharges.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                )}
                                
                                <Separator className="bg-gray-800" />

                                {/* Payment history – same as Purchase */}
                                {partialPayments.length > 0 && (
                                    <>
                                        <div className="pt-1">
                                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                                                <Wallet size={14} />
                                                Payment history ({partialPayments.length})
                                            </h4>
                                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                                {partialPayments.map((p) => (
                                                    <div key={p.id} className="flex items-center justify-between gap-2 bg-gray-950/80 rounded-md px-2.5 py-2 border border-gray-800/50">
                                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                                            {p.method === 'cash' && <Banknote size={14} className="text-green-500 shrink-0" />}
                                                            {p.method === 'bank' && <CreditCard size={14} className="text-blue-500 shrink-0" />}
                                                            {p.method === 'Mobile Wallet' && <Wallet size={14} className="text-amber-500 shrink-0" />}
                                                            <span className="text-sm text-white capitalize truncate">{p.method}</span>
                                                            {(p.reference || p.notes || (p.attachments?.length ?? 0) > 0) && (
                                                                <span className="text-xs text-gray-500 truncate">
                                                                    {p.reference && `Ref: ${p.reference}`}
                                                                    {p.reference && (p.notes || (p.attachments?.length ?? 0) > 0) && ' · '}
                                                                    {(p.attachments?.length ?? 0) > 0 && `${p.attachments!.length} file(s)`}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="text-base font-semibold text-green-400 shrink-0 tabular-nums">{Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <Separator className="bg-gray-800" />
                                    </>
                                )}

                                <div className="flex justify-between items-center pt-1">
                                    <span className="text-sm font-semibold text-white">Grand Total</span>
                                    <span className="text-xl font-bold text-blue-500">{totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between items-center pt-1">
                                    <span className="text-sm font-semibold text-white">Due balance</span>
                                    <span className="text-xl font-semibold text-orange-500">{Math.max(0, balanceDue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>

                                {/* Salesman Commission - Info Only (not added to total) */}
                                {salesmanId !== "1" && (
                                    <>
                                        <Separator className="bg-gray-800/50" />
                                        <div className="pt-2 space-y-1.5">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-1.5">
                                                    <UserCheck size={12} className="text-green-400" />
                                                    <span className="text-xs text-gray-400">Commission</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <Select value={commissionType} onValueChange={(v: any) => setCommissionType(v)}>
                                                        <SelectTrigger className="w-12 h-6 bg-gray-950 border-gray-700 text-white text-[10px] px-1">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent className="bg-gray-950 border-gray-800 text-white min-w-[60px]">
                                                            <SelectItem value="percentage">%</SelectItem>
                                                            <SelectItem value="fixed">{getCurrencySymbol(company?.currency)}</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <Input 
                                                        type="number" 
                                                        placeholder="0"
                                                        className="w-16 h-6 bg-gray-950 border-gray-700 text-white text-xs text-right px-2"
                                                        value={commissionValue > 0 ? commissionValue : ''}
                                                        onChange={(e) => setCommissionValue(parseFloat(e.target.value) || 0)}
                                                    />
                                                </div>
                                            </div>
                                            {commissionAmount > 0 && (
                                                <div className="text-xs text-green-400 font-medium text-right bg-green-500/10 px-2 py-1 rounded">
                                                    Commission: {commissionAmount.toLocaleString()}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                                </div>
                            </div>

                            {/* Attachments Card – same as Purchase; saved with payment when you Pay Now */}
                            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 space-y-3 shrink-0">
                                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
                                    <Paperclip size={14} />
                                    Attachments
                                </h3>
                                <input
                                    ref={saleAttachmentInputRef}
                                    type="file"
                                    accept="image/*,.pdf,application/pdf"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => {
                                        const files = e.target.files;
                                        if (files?.length) {
                                            const valid = Array.from(files).filter((f) => f.type.startsWith('image/') || f.type === 'application/pdf');
                                            setSaleAttachmentFiles((prev) => [...prev, ...valid]);
                                            if (valid.length < (files.length || 0)) toast.error('Only images and PDF allowed.');
                                        }
                                        e.target.value = '';
                                    }}
                                />
                                <label className="block cursor-pointer">
                                    <div
                                        className="border-2 border-dashed border-gray-700 rounded-lg p-3 hover:border-blue-500/50 hover:bg-gray-800/30 transition-all text-center"
                                        onClick={() => saleAttachmentInputRef.current?.click()}
                                        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-blue-500/50', 'bg-gray-800/30'); }}
                                        onDragLeave={(e) => { e.currentTarget.classList.remove('border-blue-500/50', 'bg-gray-800/30'); }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            e.currentTarget.classList.remove('border-blue-500/50', 'bg-gray-800/30');
                                            const files = e.dataTransfer.files;
                                            if (files?.length) {
                                                const valid = Array.from(files).filter((f) => f.type.startsWith('image/') || f.type === 'application/pdf');
                                                setSaleAttachmentFiles((prev) => [...prev, ...valid]);
                                            }
                                        }}
                                    >
                                        <Upload className="mx-auto mb-1 text-gray-500" size={20} />
                                        <p className="text-xs text-gray-400">Click or drop files (images, PDF)</p>
                                        <p className="text-[10px] text-gray-500 mt-0.5">Saved with sale when you save</p>
                                    </div>
                                </label>
                                {saleAttachmentFiles.length > 0 && (
                                    <div className="space-y-1.5 max-h-28 overflow-y-auto">
                                        {saleAttachmentFiles.map((file, idx) => (
                                            <div key={idx} className="flex items-center justify-between gap-2 bg-gray-950 rounded-md px-2.5 py-2 border border-gray-800/50">
                                                <FileText size={14} className="text-gray-500 shrink-0" />
                                                <span className="text-sm text-gray-300 truncate flex-1 min-w-0">{file.name}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setSaleAttachmentFiles((prev) => prev.filter((_, i) => i !== idx))}
                                                    className="text-red-400 hover:text-red-300 shrink-0 p-0.5"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {savedSaleAttachments.length > 0 && (
                                    <div className="space-y-1.5 pt-1 border-t border-gray-800">
                                        <p className="text-[10px] text-gray-500 uppercase tracking-wide">Saved with sale</p>
                                        <div className="space-y-1.5 max-h-24 overflow-y-auto">
                                            {savedSaleAttachments.map((att, idx) => (
                                                <div key={idx} className="flex items-center justify-between gap-2 bg-gray-950 rounded-md px-2.5 py-1.5 border border-gray-800/50">
                                                    <FileText size={12} className="text-gray-500 shrink-0" />
                                                    <span className="text-xs text-gray-300 truncate flex-1 min-w-0">{att.name || 'Attachment'}</span>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 text-xs text-blue-400 hover:text-blue-300 shrink-0"
                                                        onClick={async () => {
                                                            const { getAttachmentOpenUrl } = await import('@/app/utils/paymentAttachmentUrl');
                                                            const url = await getAttachmentOpenUrl(att.url);
                                                            window.open(url, '_blank');
                                                        }}
                                                    >
                                                        Open
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {(() => {
                                    const fromPayments = partialPayments.flatMap((p) => (p.attachments || []).map((a) => ({ ...a, paymentMethod: p.method })));
                                    return fromPayments.length > 0 ? (
                                        <div className="space-y-1.5 pt-1 border-t border-gray-800">
                                            <p className="text-[10px] text-gray-500 uppercase tracking-wide">From payments</p>
                                            <div className="space-y-1.5 max-h-24 overflow-y-auto">
                                                {fromPayments.map((att, idx) => (
                                                    <div key={idx} className="flex items-center justify-between gap-2 bg-gray-950 rounded-md px-2.5 py-1.5 border border-gray-800/50">
                                                        <FileText size={12} className="text-gray-500 shrink-0" />
                                                        <span className="text-xs text-gray-300 truncate flex-1 min-w-0">{att.name || 'Attachment'}</span>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-6 text-xs text-blue-400 hover:text-blue-300 shrink-0"
                                                            onClick={async () => {
                                                                const { getAttachmentOpenUrl } = await import('@/app/utils/paymentAttachmentUrl');
                                                                const url = await getAttachmentOpenUrl(att.url);
                                                                window.open(url, '_blank');
                                                            }}
                                                        >
                                                            Open
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : null;
                                })()}
                                {saleAttachmentFiles.length === 0 && partialPayments.flatMap((p) => p.attachments || []).length === 0 && savedSaleAttachments.length === 0 && (
                                    <p className="text-xs text-gray-500">No files yet. Add above; they’ll be saved with the sale when you save.</p>
                                )}
                            </div>

                        </div>
                    </div>
                </div>
            </div>

            {/* ============ PAYMENT CHOICE DIALOG ============ */}
            <AlertDialog open={paymentChoiceDialogOpen} onOpenChange={setPaymentChoiceDialogOpen}>
                <AlertDialogContent className="bg-gray-900 border-gray-700 text-white max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-bold flex items-center gap-2">
                            <DollarSign size={20} className="text-blue-400" />
                            Payment Option
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-gray-400 pt-2">
                            How would you like to handle payment for this sale?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-3 py-4">
                        <Button
                            onClick={async () => {
                                setPaymentChoiceDialogOpen(false);
                                const printFlag = pendingSaveAction?.print || false;
                                setPendingSaveAction(null);
                                
                                try {
                                    // Save first, then open payment dialog
                                    // Pass shouldOpenPaymentDialog=true so form doesn't close
                                    const result = await proceedWithSave(printFlag, true);
                                    if (!result) {
                                        toast.error('Sale save failed. Please try again.');
                                        return;
                                    }
                                    if ((result as any)?.studioRedirect) {
                                        toast.success('Sale saved. Add payment from the sale detail if needed.');
                                        return;
                                    }
                                    // If sale was created/updated, open payment dialog
                                    if (result.saleId) {
                                        console.log('[SALE FORM] ✅ Sale saved, opening payment dialog:', {
                                            saleId: result.saleId,
                                            invoiceNo: result.invoiceNo
                                        });
                                        setSavedSaleId(result.saleId);
                                        setSavedSaleInvoiceNo(result.invoiceNo);
                                        setUnifiedPaymentDialogOpen(true);
                                    } else {
                                        console.warn('[SALE FORM] ⚠️ Sale saved but no saleId returned');
                                        toast.error('Sale saved but could not open payment dialog. Please add payment manually.');
                                    }
                                } catch (error) {
                                    console.error('[SALE FORM] Error saving sale for payment:', error);
                                    toast.error('Failed to save sale. Please try again.');
                                }
                            }}
                            className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white text-base font-semibold flex items-center justify-center gap-2"
                        >
                            <DollarSign size={20} />
                            Pay Now
                        </Button>
                        <Button
                            onClick={async () => {
                                setPaymentChoiceDialogOpen(false);
                                if (pendingSaveAction) {
                                    await proceedWithSave(pendingSaveAction.print);
                                }
                                setPendingSaveAction(null);
                            }}
                            className="w-full h-14 bg-gray-700 hover:bg-gray-600 text-white text-base font-semibold flex items-center justify-center gap-2"
                        >
                            <CreditCard size={20} />
                            Credit Bill (Save without payment)
                        </Button>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel 
                            onClick={() => {
                                setPendingSaveAction(null);
                            }}
                            className="bg-gray-800 hover:bg-gray-700 text-white border-gray-700"
                        >
                            Cancel
                        </AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ============ UNIFIED PAYMENT DIALOG ============ */}
            <UnifiedPaymentDialog
                isOpen={unifiedPaymentDialogOpen && !!savedSaleId}
                onClose={() => {
                    setUnifiedPaymentDialogOpen(false);
                    setSavedSaleId(null);
                    setSavedSaleInvoiceNo(null);
                    onClose(); // Close sale form after payment
                }}
                context="customer"
                entityName={customers.find(c => c.id.toString() === customerId)?.name || 'Customer'}
                entityId={customerId === 'walk-in' ? undefined : customerId.toString()}
                outstandingAmount={totalAmount}
                totalAmount={totalAmount}
                paidAmount={0}
                previousPayments={[]}
                referenceNo={savedSaleInvoiceNo || undefined}
                referenceId={savedSaleId || undefined}
                onSuccess={() => {
                    console.log('[SALE FORM] ✅ Payment saved successfully, refreshing sales list');
                    setUnifiedPaymentDialogOpen(false);
                    setSavedSaleId(null);
                    setSavedSaleInvoiceNo(null);
                    setSaleAttachmentFiles([]);
                    window.dispatchEvent(new CustomEvent('paymentAdded'));
                    if (customerId && customerId !== 'walk-in') {
                        window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'customer', entityId: customerId } }));
                    }
                    onClose();
                }}
            />

            {/* ============ LAYER 3: FIXED FOOTER ============ */}
            <div className="shrink-0 bg-[#0B1019] border-t border-gray-800">
                {/* No-branch-assignment warning for non-admin */}
                {!isAdmin && accessibleBranches.length === 0 && (
                    <div className="px-6 py-2 bg-red-950/50 border-b border-red-900/50 flex items-center gap-2 text-red-200 text-sm">
                        <span className="font-medium">Your user is not assigned to any branch.</span>
                        <span>Ask admin to assign a branch so you can save sales.</span>
                    </div>
                )}
                {/* Totals Summary Row */}
                <div className="h-10 flex items-center justify-between px-6 border-b border-gray-800/50 bg-gray-950/30">
                    <div className="flex items-center gap-2.5 text-[11px] text-gray-400">
                        {/* Items Count */}
                        <span className="font-medium">{items.length} Items</span>
                        <span className="w-0.5 h-0.5 rounded-full bg-gray-600" />
                        
                        {/* Total Quantity */}
                        <span>Qty: <span className="font-semibold text-white">{items.reduce((sum, item) => sum + item.qty, 0).toLocaleString()}</span></span>
                        
                        {/* Packing Summary - Only show non-zero values */}
                        {enablePacking && items.some(item => item.packingDetails) && (() => {
                            const totalBoxes = items.reduce((sum, item) => sum + (item.packingDetails?.total_boxes || 0), 0);
                            const totalPieces = items.reduce((sum, item) => sum + (item.packingDetails?.total_pieces || 0), 0);
                            const totalMeters = items.reduce((sum, item) => sum + (item.packingDetails?.total_meters || 0), 0);
                            const parts = [];
                            if (totalBoxes > 0) parts.push(<span key="box">Box: <span className="font-semibold text-white">{totalBoxes}</span></span>);
                            if (totalPieces > 0) parts.push(<span key="pcs">Pcs: <span className="font-semibold text-white">{totalPieces}</span></span>);
                            if (totalMeters > 0) parts.push(<span key="mtr">Mtr: <span className="font-semibold text-white">{totalMeters.toLocaleString()}</span></span>);
                            return parts.length > 0 ? (
                                <span className="flex items-center gap-2">
                                    <span className="w-0.5 h-0.5 rounded-full bg-gray-600" />
                                    {parts.map((part, i) => (
                                        <span key={i} className="contents">
                                            {part}
                                            {i < parts.length - 1 && <span className="text-gray-600">|</span>}
                                        </span>
                                    ))}
                                </span>
                            ) : null;
                        })()}
                        
                        <span className="w-0.5 h-0.5 rounded-full bg-gray-600" />
                        
                        {/* Grand Total */}
                        <span className="text-xs font-bold text-green-400">Total: {totalAmount.toLocaleString()}</span>
                    </div>
                </div>

                {/* Action Buttons Row - FIXED 2 BUTTONS ONLY */}
                <div className="h-14 px-6 flex items-center justify-center">
                    <div className="invoice-container mx-auto w-full">
                        <div className="flex gap-3 justify-center">
                            <Button 
                                type="button"
                                variant="outline"
                                className="h-10 bg-transparent border border-gray-700 hover:border-gray-600 hover:bg-gray-800 text-white text-sm font-semibold"
                                onClick={() => handleSave(false)}
                                disabled={saving}
                            >
                                <Save size={15} className="mr-1.5" />
                                {saving ? (initialSale ? 'Updating...' : 'Saving...') : (initialSale ? 'Update' : 'Save')}
                            </Button>
                            <Button 
                                type="button"
                                className="h-10 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold shadow-lg shadow-blue-900/20"
                                onClick={() => handleSave(true)}
                                disabled={saving}
                            >
                                <Printer size={15} className="mr-1.5" />
                                {saving ? (initialSale ? 'Updating...' : 'Saving...') : (initialSale ? 'Update & Print' : 'Save & Print')}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Hidden - Old Footer (Replaced by Sticky Action Bar) */}
            <div className="hidden h-16 shrink-0 bg-[#0B1019] border-t border-gray-800 flex items-center justify-between px-6">
                <div className="flex items-center gap-3 text-xs text-gray-400">
                    {/* Items Count */}
                    <span>{items.length} Items</span>
                    <span className="w-1 h-1 rounded-full bg-gray-600" />
                    
                    {/* Total Quantity */}
                    <span>Qty: {items.reduce((sum, item) => sum + item.qty, 0).toLocaleString()}</span>
                    
                    {/* Packing Summary - Only when Enable Packing is ON and at least one item has packing */}
                    {enablePacking && items.some(item => item.packingDetails) && (
                        <>
                            <span className="w-1 h-1 rounded-full bg-gray-600" />
                            <span>
                                Box: {items.reduce((sum, item) => sum + (item.packingDetails?.total_boxes || 0), 0)} | 
                                Pcs: {items.reduce((sum, item) => sum + (item.packingDetails?.total_pieces || 0), 0)} | 
                                Mtr: {items.reduce((sum, item) => sum + (item.packingDetails?.total_meters || 0), 0).toLocaleString()}
                            </span>
                        </>
                    )}
                    
                    <span className="w-1 h-1 rounded-full bg-gray-600" />
                    
                    {/* Grand Total */}
                    <span>Total: {totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={onClose} className="border-gray-700 text-gray-300 h-10">
                        Cancel
                    </Button>
                    <Button 
                        className="bg-blue-600 hover:bg-blue-500 text-white h-10 gap-2"
                        onClick={() => toast.success("Sale saved!")}
                    >
                        <Save size={16} />
                        Save
                    </Button>
                    <Button 
                        className="bg-blue-600 hover:bg-blue-500 text-white h-10 gap-2"
                        onClick={() => toast.success("Sale saved and printing!")}
                    >
                        <Printer size={16} />
                        Save & Print
                    </Button>
                </div>
            </div>

            {/* Print Layout Modal - after Save & Print */}
            {showPrintLayout && saleForPrint && (
                <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
                        <InvoicePrintLayout
                            sale={saleForPrint}
                            onClose={() => {
                                setShowPrintLayout(false);
                                setSaleForPrint(null);
                                onClose();
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Packing Modal - Now rendered globally in GlobalDrawer */}
        </div>
    );
};