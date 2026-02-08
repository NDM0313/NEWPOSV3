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
  Upload,
  Palette,
  Scissors,
  Sparkles,
  Lock,
  Hash
} from 'lucide-react';
import { cn } from "../ui/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Separator } from "../ui/separator";
import { Badge } from "../ui/badge";
import { CalendarDatePicker } from "../ui/CalendarDatePicker";
import { SearchableSelect } from "../ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
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
import { PackingDetails } from '../transactions/PackingEntryModal';
import { toast } from "sonner";
import { BranchSelector, currentUser } from '@/app/components/layout/BranchSelector';
import { PurchaseItemsSection } from './PurchaseItemsSection';
import { PaymentAttachments, PaymentAttachment } from '../payments/PaymentAttachments';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useSettings } from '@/app/context/SettingsContext';
import { formatCurrency } from '@/app/utils/formatCurrency';
import { contactService } from '@/app/services/contactService';
import { productService } from '@/app/services/productService';
import { branchService } from '@/app/services/branchService';
import { purchaseService } from '@/app/services/purchaseService';
import { inventoryService } from '@/app/services/inventoryService';
import { usePurchases } from '@/app/context/PurchaseContext';
import { useNavigation } from '@/app/context/NavigationContext';
import { useDocumentNumbering } from '@/app/hooks/useDocumentNumbering';
import { Loader2 } from 'lucide-react';
import { format, parseISO } from "date-fns";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogCancel,
} from "@/app/components/ui/alert-dialog";
import { UnifiedPaymentDialog } from '@/app/components/shared/UnifiedPaymentDialog';
import { uploadPurchaseAttachments } from '@/app/utils/uploadTransactionAttachments';

interface PurchaseItem {
    id: number;
    productId: number | string;
    name: string;
    sku: string;
    price: number;
    qty: number;
    receivedQty?: number;
    // Standard Variation Fields
    size?: string;
    color?: string;
    variationId?: string; // Variation UUID for database
    // Standard Packing Fields (Wholesale)
    thaans?: number;
    meters?: number;
    packingDetails?: PackingDetails;
    // Stock and Purchase Info
    stock?: number;
    lastPurchasePrice?: number;
    lastSupplier?: string;
    // UI State
    showVariations?: boolean; // Flag to show variation selector inline
    selectedVariationId?: string; // Currently selected variation ID
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
    type: 'freight' | 'loading' | 'unloading' | 'customs' | 'other';
    amount: number;
    notes?: string;
}

interface PurchaseFormProps {
  purchase?: any; // Purchase data for edit mode
  onClose: () => void;
}

export const PurchaseForm = ({ purchase: initialPurchase, onClose }: PurchaseFormProps) => {
    // Supabase & Context
    const { companyId, branchId: contextBranchId, userRole, supabaseClient } = useSupabase();
    const { inventorySettings, company } = useSettings();
    const enablePacking = inventorySettings.enablePacking;
    // CRITICAL FIX: Check if user is admin
    const isAdmin = userRole === 'admin' || userRole === 'Admin';
    const { createPurchase, updatePurchase } = usePurchases();
    const { openDrawer, activeDrawer, createdContactId, createdContactType, setCreatedContactId, openPackingModal } = useNavigation();
    const { generateDocumentNumber, generateDocumentNumberSafe } = useDocumentNumbering();
    
    // STEP 1: Detect edit mode - check for purchase ID in multiple possible fields
    // CRITICAL FIX: Database uses UUID, but frontend might pass numeric id
    // Priority: uuid (database UUID) > id (if it's a valid UUID string) > purchaseId
    let purchaseId: string | null = null;
    if (initialPurchase?.uuid) {
        purchaseId = initialPurchase.uuid;
    } else if (initialPurchase?.id) {
        // Check if id is a UUID (contains dashes) or numeric
        const idStr = String(initialPurchase.id);
        if (idStr.includes('-') && idStr.length > 30) {
            // Looks like a UUID
            purchaseId = idStr;
        } else {
            // Numeric ID - this won't work with UUID database, log warning
            console.warn('[PURCHASE FORM] Numeric purchase ID detected, but database expects UUID. Purchase might not load correctly.');
        }
    } else if (initialPurchase?.purchaseId) {
        purchaseId = initialPurchase.purchaseId;
    }
    const isEditMode = Boolean(purchaseId);
    
    // State to track loaded purchase data from backend
    const [loadedPurchaseData, setLoadedPurchaseData] = useState<any>(null);
    
    // Data State
    const [suppliers, setSuppliers] = useState<Array<{ id: number | string; name: string; dueBalance: number }>>([]);
    const [products, setProducts] = useState<Array<{ id: number | string; name: string; sku: string; price: number; stock: number; lastPurchasePrice?: number; lastSupplier?: string; hasVariations: boolean; needsPacking: boolean; variations?: Array<{ id: string; attributes?: Record<string, unknown>; size?: string; color?: string }> }>>([]);
    /** Edit mode: variations for products in loaded purchase (so strip has options even before products list loads) */
    const [editModeProductVariations, setEditModeProductVariations] = useState<Record<string, Array<{ id?: string; size?: string; color?: string; sku?: string; price?: number; stock?: number; attributes?: Record<string, unknown> }>>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Header State
    const [supplierId, setSupplierId] = useState("");
    const [supplierSearchOpen, setSupplierSearchOpen] = useState(false);
    const [supplierSearchTerm, setSupplierSearchTerm] = useState("");
    const [purchaseDate, setPurchaseDate] = useState<Date>(new Date());
    const [refNumber, setRefNumber] = useState(""); // Reference number (optional, user-entered)
    const [poNumber, setPoNumber] = useState<string>(""); // Auto-generated PO number (read-only)
    
    // Add Supplier Modal State - REMOVED (using GlobalDrawer contact form instead)
    
    // Branch State
    const [branchId, setBranchId] = useState<string>(contextBranchId || '');
    const [branches, setBranches] = useState<Branch[]>([]);
    const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
    
    // Items List State
    const [items, setItems] = useState<PurchaseItem[]>([]);
    
    // --- New Entry Row State (The "Stage") ---
    const [productSearchOpen, setProductSearchOpen] = useState(false);
    const [productSearchTerm, setProductSearchTerm] = useState("");
    const [pendingProduct, setPendingProduct] = useState<any | null>(null);
    const [pendingQty, setPendingQty] = useState<number>(1);
    const [pendingPrice, setPendingPrice] = useState<number>(0);
    // Standard Variation States
    const [pendingSize, setPendingSize] = useState<string>("");
    const [pendingColor, setPendingColor] = useState<string>("");
    // Standard Packing States
    const [pendingThaans, setPendingThaans] = useState<number>(0);
    const [pendingMeters, setPendingMeters] = useState<number>(0);
    
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
    const [paymentChoiceDialogOpen, setPaymentChoiceDialogOpen] = useState(false);
    const [pendingSaveAction, setPendingSaveAction] = useState<{ print: boolean } | null>(null);
    const [savedPurchaseIdForPayment, setSavedPurchaseIdForPayment] = useState<string | null>(null);
    const [unifiedPaymentDialogOpen, setUnifiedPaymentDialogOpen] = useState(false);
    
    // Payment Form State
    const [newPaymentMethod, setNewPaymentMethod] = useState<'cash' | 'bank' | 'Mobile Wallet'>('cash');
    const [newPaymentAmount, setNewPaymentAmount] = useState<number>(0);
    const [newPaymentReference, setNewPaymentReference] = useState<string>("");
    
    // Payment Attachments State
    const [paymentAttachments, setPaymentAttachments] = useState<PaymentAttachment[]>([]);
    // Purchase-level attachments (bill, etc.) – uploaded in form, included when user records payment
    const [purchaseAttachmentFiles, setPurchaseAttachmentFiles] = useState<File[]>([]);
    const purchaseAttachmentInputRef = useRef<HTMLInputElement>(null);

    // Extra Expenses State
    const [extraExpenses, setExtraExpenses] = useState<ExtraExpense[]>([]);
    const [newExpenseType, setNewExpenseType] = useState<'freight' | 'loading' | 'unloading' | 'customs' | 'other'>('freight');
    const [newExpenseAmount, setNewExpenseAmount] = useState<number>(0);
    const [newExpenseNotes, setNewExpenseNotes] = useState<string>("");

    // Discount State
    const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
    const [discountValue, setDiscountValue] = useState<number>(0);

    // Status State
    const [purchaseStatus, setPurchaseStatus] = useState<'draft' | 'ordered' | 'received' | 'final'>('draft');
    const [statusOpen, setStatusOpen] = useState(false);

    // Packing Modal State - Now using global modal via NavigationContext
    const [activePackingItemId, setActivePackingItemId] = useState<number | null>(null);

    // Calculations
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const expensesTotal = extraExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    
    // Calculate discount amount
    const discountAmount = discountType === 'percentage' 
        ? (subtotal * discountValue) / 100 
        : discountValue;
    
    // Calculate total after discount and expenses
    const afterDiscountTotal = subtotal - discountAmount + expensesTotal;
    const totalAmount = afterDiscountTotal;
    
    // Automatic Payment Status Detection
    const totalPaid = partialPayments.reduce((sum, p) => sum + p.amount, 0);
    const balanceDue = totalAmount - totalPaid;
    
    // Auto-detect payment status
    // CRITICAL FIX: Use 'unpaid' instead of 'credit' to match database enum (paid, partial, unpaid)
    const paymentStatus = totalPaid === 0 ? 'unpaid' : totalPaid >= totalAmount ? 'paid' : 'partial';

    const getSupplierName = () => suppliers.find(s => s.id.toString() === supplierId)?.name || "Select Supplier";

    const selectedSupplierDue = suppliers.find(s => s.id.toString() === supplierId)?.dueBalance ?? 0;
    // STEP 2 FIX: Payment enabled for both 'received' and 'final' status
    const isPaymentEnabled = purchaseStatus === 'received' || purchaseStatus === 'final';
    const isFinal = purchaseStatus === 'final';

    // STEP 2 FIX: When status changes away from Received/Final: clear temp payments
    useEffect(() => {
        if (purchaseStatus !== 'received' && purchaseStatus !== 'final') {
            setPartialPayments([]);
            setNewPaymentAmount(0);
            setNewPaymentReference('');
            setPaymentAttachments([]);
        }
    }, [purchaseStatus]);

    // Format supplier due balance as currency; green = they owe us, red = we owe them
    const formatDueBalanceCompact = (due: number) => {
        const currency = company?.currency || 'Rs';
        if (due === 0) return formatCurrency(0, currency);
        if (due < 0) return `-${formatCurrency(Math.abs(due), currency)}`;
        return formatCurrency(due, currency);
    };
    const getDueBalanceColor = (due: number) => {
        if (due < 0) return 'text-green-400'; // Supplier owes us (credit)
        if (due > 0) return 'text-red-400';   // We owe supplier
        return 'text-gray-500';
    };


    // Status helper functions
    const getStatusColor = () => {
        switch(purchaseStatus) {
            case 'draft': return 'text-gray-500 bg-gray-900/50 border-gray-700';
            case 'ordered': return 'text-yellow-500 bg-yellow-900/20 border-yellow-600/50';
            case 'received': return 'text-blue-500 bg-blue-900/20 border-blue-600/50';
            case 'final': return 'text-green-500 bg-green-900/20 border-green-600/50';
            default: return 'text-gray-500 bg-gray-900/50 border-gray-700';
        }
    };
    const getStatusChipColor = () => {
        switch(purchaseStatus) {
            case 'draft': return 'bg-gray-500/20 text-gray-400 border-gray-600/50';
            case 'ordered': return 'bg-yellow-500/20 text-yellow-400 border-yellow-600/50';
            case 'received': return 'bg-blue-500/20 text-blue-400 border-blue-600/50';
            case 'final': return 'bg-green-500/20 text-green-400 border-green-600/50';
            default: return 'bg-gray-500/20 text-gray-400 border-gray-600/50';
        }
    };

    const getStatusIcon = () => {
        switch(purchaseStatus) {
            case 'draft': return <FileText size={14} />;
            case 'ordered': return <ShoppingBag size={14} />;
            case 'received': return <Box size={14} />;
            case 'final': return <Check size={14} />;
            default: return <FileText size={14} />;
        }
    };

    // Display purchase number: actual when editing, generated safe number when new
    const displayPurchaseNumber = useMemo(() => {
        if (initialPurchase?.po_no || initialPurchase?.purchaseNo || initialPurchase?.poNo) {
            return initialPurchase.po_no || initialPurchase.purchaseNo || initialPurchase.poNo;
        }
        // CRITICAL FIX: Use the pre-generated safe number from state (generated on form open)
        if (poNumber) {
            return poNumber;
        }
        // Fallback (shouldn't happen if useEffect ran correctly)
        if (typeof generateDocumentNumber !== 'function') return 'PO-0001';
        return generateDocumentNumber('purchase');
    }, [initialPurchase?.po_no, initialPurchase?.purchaseNo, initialPurchase?.poNo, poNumber, generateDocumentNumber]);

    // --- Workflow Handlers ---

    // Helper: Extract numeric part from SKU (keep leading zeros for matching)
    const extractNumericPart = (sku: string): string => {
        // Extract numeric part (keep leading zeros)
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
            // Special handling for "0" - only match if SKU numeric part starts with "0" or contains "0" as a digit
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
            
            // Special case: if search is "0" after normalization, it should match any SKU with leading zeros
            // But we already handled this above with includes() check
            // So only do normalized matching if both are non-zero
            if (normalizedSearch !== '0' && normalizedSku !== '0') {
                // Check if normalized values match (exact or partial)
                if (normalizedSku === normalizedSearch) {
                    return true;
                }
                
                // Check if one contains the other (for partial matches)
                if (normalizedSku.includes(normalizedSearch) || normalizedSearch.includes(normalizedSku)) {
                    return true;
                }
            }
        }
        
        return false;
    };

    // Helper to normalize a single variation (shared by products list and edit-mode fetch)
    const normalizeVariation = (v: any) => {
        let size = v.size || '';
        let color = v.color || '';
        if (!size && v.attributes) {
            size = v.attributes.size || v.attributes.Size || v.attributes.SIZE ||
                (typeof v.attributes === 'object' ? Object.values(v.attributes).find((val: any) => typeof val === 'string' && ['s', 'm', 'l', 'xl', 'xs'].includes((val as string).toLowerCase())) : '') || '';
        }
        if (!color && v.attributes) {
            color = v.attributes.color || v.attributes.Color || v.attributes.COLOR ||
                (typeof v.attributes === 'object' ? Object.values(v.attributes).find((val: any) => typeof val === 'string' && ['red', 'blue', 'green', 'white', 'black'].some(c => (val as string).toLowerCase().includes(c))) : '') || '';
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
    };

    // Variation options from backend - for inline selection (products list + edit-mode loaded variations)
    const productVariationsFromBackend = useMemo(() => {
        const map: Record<string | number, Array<{ id?: string; size?: string; color?: string; sku?: string; price?: number; stock?: number; attributes?: Record<string, unknown> }>> = {};
        products.forEach((p) => {
            if (!p.variations?.length) return;
            const productId = p.id;
            const stringKey = String(productId);
            const numKey = typeof productId === 'number' ? productId : (/^\d+$/.test(stringKey) ? parseInt(stringKey, 10) : null);
            const normalizedVariations = p.variations.map((v: any) => normalizeVariation(v));
            map[stringKey] = normalizedVariations;
            if (numKey !== null) map[numKey] = normalizedVariations;
        });
        // Edit mode: merge variations for products in loaded purchase (so strip has options even before products list loads)
        Object.entries(editModeProductVariations).forEach(([productIdKey, list]) => {
            if (!list?.length) return;
            map[productIdKey] = list;
            const numKey = /^\d+$/.test(productIdKey) ? parseInt(productIdKey, 10) : null;
            if (numKey !== null) map[numKey] = list;
        });
        return map;
    }, [products, editModeProductVariations]);

    // 1. Select Product -> Add to items, show variation strip if needed
    const handleSelectProduct = (product: any) => {
        const newItemId = Date.now();
        
        // Check if product has variations
        if (product.hasVariations && product.variations && product.variations.length > 0) {
            // Add product with variation selector flag
            const newItem: PurchaseItem = {
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
            setLastAddedItemId(newItemId);
        } else {
            // No variations - add directly
            const newItem: PurchaseItem = {
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
            setLastAddedItemId(newItemId);
        }
        
        // Close search and reset
        setProductSearchOpen(false);
        setProductSearchTerm("");
    };
    
    // Handle variation selection from inline strip
    const handleInlineVariationSelect = (itemId: number, variation: { id?: string; size?: string; color?: string; sku?: string; price?: number; stock?: number; attributes?: Record<string, unknown> }) => {
        setItems(prev => prev.map(item => {
            if (item.id === itemId) {
                const size = variation.size || variation.attributes?.size as string;
                const color = variation.color || variation.attributes?.color as string;
                const variationSku = variation.sku || `${item.sku}-${size}-${color}`.replace(/\s+/g, '-').toUpperCase();
                
                return {
                    ...item,
                    size: size,
                    color: color,
                    sku: variationSku, // Update SKU to variation-specific SKU
                    price: variation.price || item.price,
                    variationId: variation.id,
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
    const updateItem = (id: number, field: keyof PurchaseItem, value: number) => {
        setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const removeItem = (id: number) => {
        setItems(prev => prev.filter(item => item.id !== id));
    };

    // Packing Handlers - Bind itemId in onSave so first-time save works (no stale activePackingItemId)
    const openPackingModalLocal = (item: PurchaseItem) => {
        setActivePackingItemId(item.id);
        if (openPackingModal) {
            openPackingModal({
                itemId: item.id,
                productName: item.name,
                initialData: item.packingDetails,
                onSave: (details: PackingDetails) => handleSavePacking(item.id, details)
            });
        }
    };

    const handleOpenPackingModalById = (itemId: number) => {
        if (!enablePacking) return;
        const item = items.find(i => i.id === itemId);
        if (item) openPackingModalLocal(item);
    };

    const handleSavePacking = (itemId: number, details: PackingDetails) => {
        setItems(prev => prev.map(item => {
            if (item.id !== itemId) return item;
            return {
                ...item,
                packingDetails: details,
                qty: details.total_meters ?? item.qty,
                thaans: details.total_boxes,
                meters: details.total_meters
            };
        }));
        toast.success("Packing details saved");
        setActivePackingItemId(null);
    };

    // Add Payment
    const handleAddPayment = () => {
        if (newPaymentAmount <= 0) {
            toast.error("Enter a valid amount");
            return;
        }

        const payment: PartialPayment = {
            id: Date.now().toString(),
            method: newPaymentMethod,
            amount: newPaymentAmount,
            reference: newPaymentReference || undefined,
            attachments: paymentAttachments,
        };

        setPartialPayments([...partialPayments, payment]);
        setNewPaymentAmount(0);
        setNewPaymentReference("");
        setPaymentAttachments([]);
        toast.success("Payment added!");
    };

    // Add Expense
    const handleAddExpense = () => {
        if (newExpenseAmount <= 0) {
            toast.error("Enter a valid amount");
            return;
        }

        const expense: ExtraExpense = {
            id: Date.now().toString(),
            type: newExpenseType,
            amount: newExpenseAmount,
            notes: newExpenseNotes || undefined,
        };

        setExtraExpenses([...extraExpenses, expense]);
        setNewExpenseAmount(0);
        setNewExpenseNotes("");
        toast.success("Expense added!");
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
            
            // Debug for "0" search
            if (isNumericOnly && searchTerm === '0' && skuMatch) {
                console.log(`[FILTER DEBUG] Product: ${p.name}, SKU: ${p.sku}, nameMatch: ${nameMatch}, skuMatch: ${skuMatch}, Will include: ${nameMatch || skuMatch}`);
            }
            
            return nameMatch || skuMatch;
        });
        
        // Debug: Log results for numeric search
        if (isNumericOnly) {
            console.log(`[SKU SEARCH] Search: "${searchTerm}", Results: ${results.length}, Total Products: ${products.length}`);
            if (results.length === 0) {
                console.log(`[SKU SEARCH] No matches. Available products:`, products.map(p => ({ 
                    name: p.name, 
                    sku: p.sku, 
                    numeric: extractNumericPart(p.sku),
                    normalized: normalizeNumeric(extractNumericPart(p.sku))
                })));
            } else {
                console.log(`[SKU SEARCH] Matched products:`, results.map(p => ({ name: p.name, sku: p.sku })));
            }
        }
        
        return results;
    }, [products, productSearchTerm]);
    
    // Load data from Supabase
    useEffect(() => {
        const loadData = async () => {
            if (!companyId) return;
            
            try {
                setLoading(true);
                
                // Load suppliers (contacts with type='supplier')
                const contactsData = await contactService.getAllContacts(companyId);
                
                // Load purchases to calculate supplier due balances
                const purchasesData = await purchaseService.getAllPurchases(companyId);
                
                // Calculate due balance for each supplier from purchases
                const supplierDueMap = new Map<string, number>();
                purchasesData.forEach((p: any) => {
                    const supplierId = p.supplier_id || p.supplier?.id;
                    if (supplierId) {
                        const currentDue = supplierDueMap.get(supplierId) || 0;
                        const purchaseDue = p.due_amount || (p.total || 0) - (p.paid_amount || 0);
                        supplierDueMap.set(supplierId, currentDue + purchaseDue);
                    }
                });
                
                const supplierContacts = contactsData
                    .filter(c => c.type === 'supplier' || c.type === 'both')
                    .map(c => {
                        const contactId = c.id || c.uuid || '';
                        const dueBalance = supplierDueMap.get(contactId) || 
                                          c.supplier_opening_balance || 
                                          c.current_balance || 
                                          c.opening_balance || 
                                          0;
                        return {
                            id: contactId,
                            name: c.name || '',
                            dueBalance: dueBalance
                        };
                    });
                setSuppliers(supplierContacts);
                
                // Load products
                const productsData = await productService.getAllProducts(companyId);
                // Load units for decimal validation
                const { unitService } = await import('@/app/services/unitService');
                const unitsData = await unitService.getAll(companyId);
                const unitsMap = new Map(unitsData.map(u => [u.id, u]));
                
                const productsList = productsData.map(p => {
                    const unit = p.unit_id ? unitsMap.get(p.unit_id) : null;
                    return {
                        id: p.id || p.uuid || '',
                        name: p.name || '',
                        sku: p.sku || '',
                        price: (p.cost_price ?? p.costPrice ?? p.price) || 0,
                        stock: (p.current_stock ?? p.stock) ?? 0,
                        lastPurchasePrice: (p.cost_price ?? p.costPrice) ?? undefined,
                        lastSupplier: undefined, // Can be enhanced later
                        hasVariations: (p.variations && p.variations.length > 0) || false,
                        needsPacking: false, // Can be enhanced based on product type
                        variations: p.variations || [],
                        unitId: p.unit_id || null,
                        unitAllowDecimal: unit?.allow_decimal ?? false // Default to false if no unit
                    };
                });
                setProducts(productsList);
            } catch (error) {
                console.error('[PURCHASE FORM] Error loading data:', error);
                toast.error('Failed to load data');
            } finally {
                setLoading(false);
            }
        };
        
        loadData();
    }, [companyId]);

    // Load branches
    useEffect(() => {
        const loadBranches = async () => {
            if (!companyId) return;
            try {
                const branchesData = await branchService.getAllBranches(companyId);
                setBranches(branchesData);
                
                // Default to Main Branch (is_default = true) or first branch
                if (!branchId) {
                    if (contextBranchId) {
                        setBranchId(contextBranchId);
                    } else {
                        // Find main branch (is_default = true) or use first branch
                        const mainBranch = branchesData.find((b: Branch) => (b as any).is_default === true);
                        if (mainBranch) {
                            setBranchId(mainBranch.id);
                        } else if (branchesData.length > 0) {
                            setBranchId(branchesData[0].id);
                        }
                    }
                }
            } catch (error) {
                console.error('[PURCHASE FORM] Error loading branches:', error);
            }
        };
        loadBranches();
    }, [companyId, branchId, contextBranchId]);

    // Merge live stock from inventory overview (same source as Inventory page) into products for search dropdown
    useEffect(() => {
        if (!companyId || !products.length) return;
        const branchToUse = branchId && branchId !== 'all' ? branchId : null;
        let cancelled = false;
        (async () => {
            try {
                const overview = await inventoryService.getInventoryOverview(companyId, branchToUse);
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
    }, [companyId, branchId, products.length]);

    // Reload suppliers when contact drawer closes (in case a new contact was added)
    useEffect(() => {
        const reloadSuppliers = async () => {
            // Only reload when:
            // 1. Contact drawer was just closed (activeDrawer changed from 'addContact' to 'none')
            // 2. AND a contact was actually created (createdContactId is not null)
            // 3. AND the contact type is relevant (supplier or both)
            // This prevents unnecessary reloads when other drawers close or when customer/worker is created
            if (activeDrawer === 'none' && companyId && createdContactId !== null && 
                (createdContactType === 'supplier' || createdContactType === 'both')) {
                try {
                    // Store the contact ID before clearing (for auto-selection)
                    const contactIdToSelect = createdContactId;
                    const contactTypeToSelect = createdContactType;
                    
                    // Clear immediately to prevent duplicate reloads
                    if (setCreatedContactId) {
                        setCreatedContactId(null, null);
                    }
                    
                    // CRITICAL: Reload IMMEDIATELY when drawer closes
                    console.log('[PURCHASE FORM] Reloading suppliers, createdContactId:', contactIdToSelect, 'Type:', contactTypeToSelect);
                    
                    // Small delay to ensure DB commit
                    await new Promise(resolve => setTimeout(resolve, 200));
                    
                    const contactsData = await contactService.getAllContacts(companyId);
                    const supplierContacts = contactsData
                        .filter(c => c.type === 'supplier' || c.type === 'both')
                        .map(c => ({
                            id: c.id || c.uuid || '',
                            name: c.name || '',
                            dueBalance: c.payables || 0
                        }));
                    
                    console.log('[PURCHASE FORM] Reloaded suppliers:', supplierContacts.length, 'IDs:', supplierContacts.map(c => c.id));
                    
                    setSuppliers(supplierContacts);
                    
                    // Auto-select newly created contact
                    const contactIdStr = contactIdToSelect.toString();
                    const foundContact = supplierContacts.find(c => {
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
                        // Force state update and component remount
                        setSupplierId('');
                        // Use setTimeout to ensure state update happens
                        setTimeout(() => {
                            setSupplierId(selectedId);
                            toast.success(`Supplier "${foundContact.name}" selected`);
                            console.log('[PURCHASE FORM] ✅ Auto-selected supplier:', selectedId, foundContact.name);
                        }, 50);
                    } else {
                        console.warn('[PURCHASE FORM] ❌ Could not find created contact:', contactIdStr, 'Available IDs:', supplierContacts.map(c => c.id));
                        // Try one more time after a longer delay (DB might need more time)
                        setTimeout(async () => {
                            const retryData = await contactService.getAllContacts(companyId);
                            const retryContacts = retryData
                                .filter(c => c.type === 'supplier' || c.type === 'both')
                                .map(c => ({
                                    id: c.id || c.uuid || '',
                                    name: c.name || '',
                                    dueBalance: c.payables || 0
                                }));
                            const retryFound = retryContacts.find(c => {
                                const cId = c.id?.toString() || '';
                                return cId === contactIdStr || c.id === contactIdToSelect;
                            });
                            if (retryFound) {
                                setSuppliers(retryContacts);
                                const retrySelectedId = retryFound.id.toString();
                                // Force state update
                                setSupplierId('');
                                setTimeout(() => {
                                    setSupplierId(retrySelectedId);
                                    toast.success(`Supplier "${retryFound.name}" selected`);
                                    console.log('[PURCHASE FORM] ✅ Retry successful - Auto-selected supplier');
                                }, 50);
                            }
                        }, 1000);
                    }
                } catch (error) {
                    console.error('[PURCHASE FORM] Error reloading suppliers:', error);
                }
            } else if (activeDrawer === 'none' && createdContactId !== null && 
                       (createdContactType === 'customer' || createdContactType === 'worker')) {
                // Clear the ID if customer/worker was created (no reload needed)
                if (setCreatedContactId) {
                    setCreatedContactId(null, null);
                }
            }
        };
        
        reloadSuppliers();
    }, [activeDrawer, companyId, createdContactId, createdContactType, setCreatedContactId]);

    // Generate PO number for new purchases
    // Track if PO number has been generated for new purchases
    const poNumberGeneratedRef = useRef(false);
    
    // CRITICAL FIX: Generate collision-safe document number when form opens (new purchase only)
    useEffect(() => {
        if (!initialPurchase && !poNumberGeneratedRef.current && companyId) {
            // New purchase: Generate collision-safe PO number (only once)
            poNumberGeneratedRef.current = true;
            const generateSafeNumber = async () => {
                try {
                    const safeNumber = await generateDocumentNumberSafe('purchase');
                    setPoNumber(safeNumber);
                    console.log('[PURCHASE FORM] Generated safe document number:', safeNumber);
                } catch (error) {
                    console.error('[PURCHASE FORM] Error generating safe document number:', error);
                    // Fallback to sync generation
                    const fallbackNumber = generateDocumentNumber('purchase');
                    setPoNumber(fallbackNumber);
                }
            };
            generateSafeNumber();
        }
        
        // Reset when switching to edit mode
        if (initialPurchase) {
            poNumberGeneratedRef.current = false;
        }
    }, [initialPurchase, companyId, generateDocumentNumberSafe, generateDocumentNumber]);

    // STEP 2: Load full purchase data from backend when editing
    useEffect(() => {
        const loadPurchaseData = async () => {
            // Only load if we have a purchase ID (edit mode)
            if (!purchaseId) {
                setLoadedPurchaseData(null);
                return;
            }
            
            try {
                setLoading(true);
                console.log('[PURCHASE FORM] Loading purchase data from backend, ID:', purchaseId);
                
                // Load full purchase data from backend API (includes items, payments, expenses, supplier, branch)
                const fullPurchaseData = await purchaseService.getPurchase(purchaseId);
                console.log('[PURCHASE FORM] Loaded purchase data from backend:', fullPurchaseData);
                
                if (!fullPurchaseData) {
                    console.error('[PURCHASE FORM] No purchase data returned from API');
                    toast.error('Purchase not found');
                    return;
                }
                
                setLoadedPurchaseData(fullPurchaseData);
                
                // Load full payment history from payments table (getPurchase does not include payments)
                const paymentsList = await purchaseService.getPurchasePayments(purchaseId);
                if (paymentsList && paymentsList.length > 0) {
                    const mapped: PartialPayment[] = paymentsList.map((p: any, index: number) => ({
                        id: p.id?.toString() || String(index + 1),
                        method: (p.method === 'bank' || p.method === 'card' ? 'bank' : p.method === 'mobile_wallet' ? 'Mobile Wallet' : 'cash') as 'cash' | 'bank' | 'Mobile Wallet',
                        amount: Number(p.amount) || 0,
                        reference: p.referenceNo || p.reference_number || '',
                        notes: p.notes || '',
                        attachments: Array.isArray(p.attachments) ? p.attachments : (p.attachments ? [p.attachments] : []),
                    }));
                    setPartialPayments(mapped);
                }
            } catch (error: any) {
                console.error('[PURCHASE FORM] Error loading purchase data:', error);
                toast.error('Failed to load purchase data: ' + (error.message || 'Unknown error'));
                // Fallback to context data if API fails
                if (initialPurchase) {
                    setLoadedPurchaseData(initialPurchase);
                }
            } finally {
                setLoading(false);
            }
        };
        
        loadPurchaseData();
    }, [purchaseId]); // Only depend on purchaseId, not initialPurchase

    // Edit mode: fetch variations for products in loaded purchase so variation strip has options even if products list hasn't loaded yet
    useEffect(() => {
        if (!loadedPurchaseData?.items?.length || !supabaseClient) {
            setEditModeProductVariations({});
            return;
        }
        const productIds = [...new Set((loadedPurchaseData.items as any[]).map((i: any) => i.product_id || i.productId).filter(Boolean))] as string[];
        if (productIds.length === 0) {
            setEditModeProductVariations({});
            return;
        }
        let cancelled = false;
        (async () => {
            const { data: variations } = await supabaseClient
                .from('product_variations')
                .select('id, product_id, sku, attributes')
                .in('product_id', productIds);
            if (cancelled || !variations?.length) {
                if (!cancelled) setEditModeProductVariations({});
                return;
            }
            const byProduct: Record<string, Array<{ id?: string; size?: string; color?: string; sku?: string; price?: number; stock?: number; attributes?: Record<string, unknown> }>> = {};
            variations.forEach((v: any) => {
                const pid = String(v.product_id);
                if (!byProduct[pid]) byProduct[pid] = [];
                let size = '';
                let color = '';
                if (v.attributes && typeof v.attributes === 'object') {
                    const a = v.attributes as Record<string, unknown>;
                    size = String(a.size ?? a.Size ?? a.SIZE ?? '').trim();
                    color = String(a.color ?? a.Color ?? a.COLOR ?? '').trim();
                    if (!size && !color) {
                        const vals = Object.values(a).filter((x): x is string => typeof x === 'string');
                        const sizeLike = vals.find((val: string) => ['s', 'm', 'l', 'xl', 'xs'].includes(val.toLowerCase()));
                        const colorLike = vals.find((val: string) => ['red', 'blue', 'green', 'white', 'black'].some(c => val.toLowerCase().includes(c)));
                        if (sizeLike) size = sizeLike;
                        if (colorLike) color = colorLike;
                    }
                }
                byProduct[pid].push({
                    id: v.id,
                    size,
                    color,
                    sku: v.sku,
                    price: undefined,
                    stock: undefined,
                    attributes: v.attributes || {},
                });
            });
            if (!cancelled) setEditModeProductVariations(byProduct);
        })();
        return () => { cancelled = true; };
    }, [loadedPurchaseData, supabaseClient]);

    // STEP 3: Pre-populate form when editing - wait for loadedPurchaseData
    // Use ref to track which purchase we initialized so we re-run when opening a different purchase
    const formInitializedRef = useRef(false);
    const lastInitializedPurchaseIdRef = useRef<string | null>(null);
    const variationStockHydratedRef = useRef(false);
    
    useEffect(() => {
        // In edit mode, wait for loadedPurchaseData from backend
        // In create mode, use initialPurchase if provided (shouldn't happen, but safe fallback)
        const purchaseData = isEditMode ? loadedPurchaseData : (initialPurchase || null);
        const purchaseId = purchaseData?.id ?? null;
        
        // CRITICAL: When opening a different purchase in edit mode, allow re-init (so date/fields come from DB)
        if (isEditMode && purchaseId && lastInitializedPurchaseIdRef.current !== purchaseId) {
            formInitializedRef.current = false;
            lastInitializedPurchaseIdRef.current = null;
        }
        
        // Only run when:
        // 1. We have purchase data
        // 2. Form hasn't been initialized yet for this purchase
        // 3. In edit mode, wait for loadedPurchaseData (not null)
        if (purchaseData && !formInitializedRef.current && (!isEditMode || loadedPurchaseData !== null)) {
            formInitializedRef.current = true;
            lastInitializedPurchaseIdRef.current = purchaseId;
            
            console.log('[PURCHASE FORM] Pre-populating form with data:', purchaseData);
            
            // Pre-fill header fields
            const supplierIdValue = purchaseData.supplier_id || 
                                   purchaseData.supplier?.id || 
                                   purchaseData.supplier || 
                                   '';
            setSupplierId(supplierIdValue.toString());
            
            // Handle date + time: DB may return DATE (date only) or TIMESTAMPTZ (with time). Parse so picker shows saved date/time.
            const raw = purchaseData.po_date || purchaseData.date || purchaseData.purchaseDate;
            if (raw) {
                try {
                    if (typeof raw === 'object' && raw instanceof Date) {
                        setPurchaseDate(raw);
                    } else if (typeof raw === 'string') {
                        const str = raw.trim();
                        if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
                            setPurchaseDate(parseISO(str));
                        } else {
                            const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
                            if (match) {
                                const [, y, m, d] = match.map(Number);
                                setPurchaseDate(new Date(y, m - 1, d));
                            } else {
                                setPurchaseDate(parseISO(str) || new Date(raw));
                            }
                        }
                    } else {
                        setPurchaseDate(new Date(raw));
                    }
                } catch {
                    setPurchaseDate(new Date(raw));
                }
            } else {
                setPurchaseDate(new Date());
            }
            
            // Load PO number (read-only, auto-generated)
            setPoNumber(purchaseData.po_no || purchaseData.purchaseNo || purchaseData.poNo || generateDocumentNumber('purchase'));
            
            // STEP 1 FIX: Load reference number from reference field or notes field
            setRefNumber(purchaseData.reference || purchaseData.reference_no || purchaseData.notes || '');
            
            // STEP 4: Pre-fill branch if available (RULE 2 - Branch locked in edit mode)
            if (purchaseData.branch_id) {
                setBranchId(purchaseData.branch_id);
            }
            
            // Pre-fill items from backend response
            if (purchaseData.items && purchaseData.items.length > 0) {
                const convertedItems: PurchaseItem[] = purchaseData.items.map((item: any, index: number) => {
                    // Handle nested product data from backend
                    const product = item.product || {};
                    const variation = item.variation || item.product_variations || {};
                    
                    // CRITICAL: Get variation_id from DB (required for edit form to preselect dropdown)
                    const variationId = item.variation_id ??
                                       item.variationId ??
                                       (variation?.id) ??
                                       undefined;
                    
                    // Get variation attributes
                    const variationAttrs = variation?.attributes || {};
                    
                    // CRITICAL: If variant_id exists → variation mode: show selector and preselect it
                    const hasVariations = Boolean(product?.has_variations ?? variationId);
                    const showVariations = hasVariations;
                    const selectedVariationId = variationId ?? undefined;
                    
                    // Handle packing details from backend
                    const packingDetails = item.packing_details || item.packingDetails || null;
                    
                    return {
                        id: Date.now() + index, // Generate unique ID
                        productId: item.product_id || item.productId || product.id || '',
                        name: product.name || item.product_name || item.productName || '',
                        sku: product.sku || item.sku || '',
                        price: item.unit_price || item.price || 0,
                        qty: item.quantity || item.qty || 0,
                        receivedQty: item.received_quantity || item.receivedQty || item.quantity || item.qty || 0,
                        size: item.size || variationAttrs.size || variation?.size,
                        color: item.color || variationAttrs.color || variation?.color,
                        variationId: variationId, // For save
                        selectedVariationId: selectedVariationId, // For UI dropdown preselect
                        showVariations: showVariations, // Show variation column when product has variations or we have saved variation
                        stock: (variation?.stock != null ? Number(variation.stock) : 0) as number,
                        lastPurchasePrice: undefined,
                        lastSupplier: undefined,
                        packingDetails: packingDetails,
                        thaans: packingDetails?.total_boxes || packingDetails?.boxes || 0,
                        meters: packingDetails?.total_meters || packingDetails?.meters || 0,
                        unitAllowDecimal: product?.unit_allow_decimal ?? product?.unit?.allow_decimal ?? false,
                    };
                });
                setItems(convertedItems);
                console.log('[PURCHASE FORM] Converted items:', convertedItems);
            }
            
            // Pre-fill payments if any (from purchase_payments table)
            if (purchaseData.payments && purchaseData.payments.length > 0) {
                const payments = purchaseData.payments.map((payment: any, index: number) => ({
                    id: payment.id?.toString() || (index + 1).toString(),
                    method: (payment.method || payment.payment_method || 'cash') as 'cash' | 'bank' | 'Mobile Wallet',
                    amount: payment.amount || 0,
                    reference: payment.reference || payment.reference_no || '',
                    attachments: payment.attachments || []
                }));
                setPartialPayments(payments);
            } else if (purchaseData.paid > 0 || purchaseData.paid_amount > 0) {
                // Fallback to single payment if payments array not available
                const paidAmount = purchaseData.paid || purchaseData.paid_amount || 0;
                setPartialPayments([{
                    id: '1',
                    method: (purchaseData.paymentMethod || purchaseData.payment_method || 'cash') as 'cash' | 'bank' | 'Mobile Wallet',
                    amount: paidAmount,
                    reference: '',
                    attachments: []
                }]);
            }
            
            // Pre-fill expenses (from purchase_expenses or extra_expenses)
            if (purchaseData.expenses && purchaseData.expenses.length > 0) {
                const expenses = purchaseData.expenses.map((expense: any, index: number) => ({
                    id: expense.id?.toString() || (index + 1).toString(),
                    type: expense.type || expense.expense_type || 'other',
                    amount: expense.amount || 0,
                    notes: expense.notes || expense.description || ''
                }));
                setExtraExpenses(expenses);
            } else if (purchaseData.shippingCost > 0 || purchaseData.shipping_cost > 0) {
                // Fallback to single expense if expenses array not available
                const shippingAmount = purchaseData.shippingCost || purchaseData.shipping_cost || 0;
                setExtraExpenses([{
                    id: '1',
                    type: 'freight',
                    amount: shippingAmount,
                    notes: 'Shipping charges'
                }]);
            }
            
            // Pre-fill discount
            if (purchaseData.discount > 0 || purchaseData.discount_amount > 0) {
                const discountAmount = purchaseData.discount || purchaseData.discount_amount || 0;
                setDiscountValue(discountAmount);
                setDiscountType('fixed'); // Default to fixed, can be enhanced
            }
            
            // Pre-fill status
            if (purchaseData.status === 'ordered') {
                setPurchaseStatus('ordered');
            } else if (purchaseData.status === 'received') {
                setPurchaseStatus('received');
            } else if (purchaseData.status === 'completed' || purchaseData.status === 'final') {
                setPurchaseStatus('final');
            } else {
                setPurchaseStatus('draft');
            }
        }
        
        // Reset ref when purchase data is cleared (form closed or new purchase selected)
        if (!purchaseData && !isEditMode) {
            formInitializedRef.current = false;
            lastInitializedPurchaseIdRef.current = null;
            variationStockHydratedRef.current = false;
        }
    }, [loadedPurchaseData, initialPurchase, isEditMode]); // Watch loadedPurchaseData, initialPurchase, and isEditMode

    const lastHydratedPurchaseIdRef = useRef<string | null>(null);
    // Edit mode: hydrate variation-level stock from inventory overview (movement-based) for items with selectedVariationId
    useEffect(() => {
        const purchaseId = loadedPurchaseData?.id;
        if (purchaseId && lastHydratedPurchaseIdRef.current !== purchaseId) {
            lastHydratedPurchaseIdRef.current = null;
            variationStockHydratedRef.current = false;
        }
        if (!loadedPurchaseData || !companyId || !items.length) return;
        const withVariation = items.filter(i => i.selectedVariationId);
        if (withVariation.length === 0 || variationStockHydratedRef.current) return;
        let cancelled = false;
        (async () => {
            try {
                const branchToUse = branchId || (loadedPurchaseData as any)?.branch_id || null;
                const overview = await inventoryService.getInventoryOverview(companyId, branchToUse);
                if (cancelled) return;
                const variationStockMap: Record<string, number> = {};
                (overview || []).forEach((row: any) => {
                    (row.variations || []).forEach((v: any) => {
                        if (v.id != null) variationStockMap[v.id] = v.stock ?? 0;
                    });
                });
                setItems(prev => prev.map(item =>
                    item.selectedVariationId
                        ? { ...item, stock: variationStockMap[item.selectedVariationId!] ?? item.stock }
                        : item
                ));
                if (!cancelled) {
                    variationStockHydratedRef.current = true;
                    lastHydratedPurchaseIdRef.current = loadedPurchaseData?.id ?? null;
                }
            } catch {
                if (!cancelled) variationStockHydratedRef.current = false;
            }
        })();
        return () => { cancelled = true; };
    }, [loadedPurchaseData, companyId, branchId, items.length, items.map(i => i.selectedVariationId).filter(Boolean).join(',')]);

    // Handle Save
    const handleSave = async (print: boolean = false) => {
        // RULE 2 FIX: Branch validation - Required for Admin/Owner
        if (isAdmin && (!branchId || branchId === '' || branchId === 'all')) {
            toast.error('Please select a branch before saving purchase');
            return;
        }
        
        // RULE 3 FIX: Branch validation for all users (backend requirement)
        if (!branchId || branchId === '' || branchId === 'all') {
            toast.error('Branch is required. Please select a branch.');
            return;
        }
        
        if (!supplierId || supplierId === '') {
            toast.error('Please select a supplier');
            return;
        }
        
        if (items.length === 0) {
            toast.error('Please add at least one item');
            return;
        }

        // RULE 4: Variation selection required when product has variations
        const itemWithoutVariation = items.find(i => i.showVariations && !i.selectedVariationId && !i.variationId);
        if (itemWithoutVariation) {
            toast.error(`Variation selection required for "${itemWithoutVariation.name}". Please select a size/color (or combination) before saving.`);
            return;
        }
        
        // CRITICAL FIX: Validate unit decimal rules before save (unit allows decimal → allow; else whole numbers only)
        for (const item of items) {
            if (item.unitAllowDecimal !== true && item.qty % 1 !== 0) {
                toast.error(`Item "${item.name}": This product unit does not allow decimal quantities. Please enter a whole number.`);
                setSaving(false);
                return;
            }
        }

        // When status is Received or Final, show payment option (Pay Now / Credit) – only for NEW purchase, not when updating
        const isPaymentStatus = purchaseStatus === 'received' || purchaseStatus === 'final';
        if (isPaymentStatus && !isEditMode) {
            setPendingSaveAction({ print });
            setPaymentChoiceDialogOpen(true);
            return;
        }

        await proceedWithSave(print, false);
    };

    const proceedWithSave = async (print: boolean, openPaymentDialogAfter: boolean): Promise<string | null> => {
        try {
            setSaving(true);
            
            const selectedSupplier = suppliers.find(s => s.id.toString() === supplierId);
            const supplierName = selectedSupplier?.name || '';
            const supplierUuid = supplierId.toString();
            
            // Convert items to PurchaseItem format (packing only when Enable Packing is ON)
            const purchaseItems = items.map(item => ({
                id: item.id.toString(),
                productId: item.productId.toString(),
                variationId: item.variationId || undefined, // Include variation ID if available
                productName: item.name,
                sku: item.sku,
                quantity: item.qty,
                receivedQty: item.receivedQty || 0, // Preserve received qty if editing
                price: item.price,
                discount: 0, // Can be enhanced later
                tax: 0, // Can be enhanced later
                total: item.price * item.qty,
                size: item.size,
                color: item.color,
                ...(enablePacking ? {
                    packingDetails: item.packingDetails,
                    thaans: item.thaans,
                    meters: item.meters
                } : { packingDetails: undefined, thaans: undefined, meters: undefined })
            }));
            
            // CRITICAL FIX: Branch validation (MANDATORY)
            // Admin must select branch, normal user uses auto-selected branch
            const finalBranchId = isAdmin 
                ? (branchId || contextBranchId || '') // Admin can select or use context
                : (contextBranchId || branchId || ''); // Normal user uses context (auto-selected)
            
            // Validate branch: Must be a valid UUID, not "all" or empty
            if (!finalBranchId || finalBranchId === 'all' || finalBranchId.trim() === '') {
                toast.error('Please select a branch before saving purchase. Branch is mandatory.');
                setSaving(false);
                return;
            }
            
            const paidToUse = openPaymentDialogAfter ? 0 : totalPaid;
            const dueToUse = openPaymentDialogAfter ? totalAmount : balanceDue;
            const paymentStatusToUse = openPaymentDialogAfter ? 'unpaid' : paymentStatus;
            // Create purchase data
            const purchaseData = {
                supplier: supplierUuid,
                supplierName: supplierName,
                contactNumber: '', // Can be enhanced to get from supplier
                date: format(purchaseDate, "yyyy-MM-dd'T'HH:mm:ss"),
                expectedDelivery: undefined,
                location: finalBranchId, // Branch name for display
                branchId: finalBranchId, // CRITICAL: Branch UUID for database
                status: purchaseStatus as 'draft' | 'ordered' | 'received' | 'final',
                items: purchaseItems,
                itemsCount: items.length,
                subtotal: subtotal,
                discount: discountAmount,
                tax: 0, // Can be enhanced later
                shippingCost: expensesTotal,
                total: totalAmount,
                paid: paidToUse,
                due: dueToUse,
                paymentStatus: paymentStatusToUse as 'paid' | 'partial' | 'unpaid',
                paymentMethod: partialPayments.length > 0 ? partialPayments[0].method : 'cash',
                notes: refNumber || undefined
            };
            
            // STEP 5: Handle edit vs create mode
            if (isEditMode && purchaseId) {
                // 🔒 EDIT MODE: Update existing purchase with items
                // CRITICAL FIX: Pass items to updatePurchase() (like SaleForm does)
                // PurchaseContext.updatePurchase() handles items update internally with delta-based stock movements
                await updatePurchase(purchaseId, {
                    status: purchaseStatus as 'draft' | 'ordered' | 'received' | 'final',
                    paymentStatus: paymentStatusToUse as 'paid' | 'partial' | 'unpaid',
                    total: totalAmount,
                    paid: paidToUse,
                    due: dueToUse,
                    notes: refNumber || undefined,
                    date: format(purchaseDate, "yyyy-MM-dd'T'HH:mm:ss"),
                    // 🔒 CRITICAL: Pass items array to updatePurchase (like SaleForm does)
                    items: purchaseItems,
                });
                if (purchaseAttachmentFiles.length > 0 && companyId) {
                    try {
                        const uploaded = await uploadPurchaseAttachments(companyId, purchaseId, purchaseAttachmentFiles);
                        const existing = (loadedPurchaseData as any)?.attachments || [];
                        const merged = Array.isArray(existing) ? [...existing, ...uploaded] : uploaded;
                        if (merged.length > 0) await updatePurchase(purchaseId, { attachments: merged } as any);
                        setPurchaseAttachmentFiles([]);
                        setLoadedPurchaseData((prev: any) => prev ? { ...prev, attachments: merged } : null);
                    } catch (e) {
                        console.warn('[PURCHASE FORM] Attachment upload failed:', e);
                        toast.warning('Purchase saved but some attachments could not be uploaded.');
                    }
                }
                toast.success('Purchase order updated successfully!');
                
                // 🔒 CRITICAL FIX: Dispatch event for inventory refresh (EDIT MODE)
                console.log('[PURCHASE FORM] 📢 Dispatching purchaseSaved event (EDIT MODE), purchaseId:', purchaseId);
                window.dispatchEvent(new CustomEvent('purchaseSaved', { 
                    detail: { purchaseId: purchaseId } 
                }));
                if (openPaymentDialogAfter) {
                    setSavedPurchaseIdForPayment(purchaseId);
                    setUnifiedPaymentDialogOpen(true);
                } else {
                    onClose();
                }
                return purchaseId;
            } else {
                // CREATE MODE: Create new purchase
                const newPurchase = await createPurchase(purchaseData);
                if (newPurchase?.id && purchaseAttachmentFiles.length > 0 && companyId) {
                    try {
                        const uploaded = await uploadPurchaseAttachments(companyId, newPurchase.id, purchaseAttachmentFiles);
                        if (uploaded.length > 0) await updatePurchase(newPurchase.id, { attachments: uploaded } as any);
                        setPurchaseAttachmentFiles([]);
                    } catch (e) {
                        console.warn('[PURCHASE FORM] Attachment upload failed:', e);
                        toast.warning('Purchase created but some attachments could not be uploaded.');
                    }
                }
                // Save payments only when NOT opening payment dialog (user already added in form or chose Credit)
                if (!openPaymentDialogAfter && partialPayments.length > 0 && newPurchase?.id && companyId) {
                    try {
                        const finalBranchId = isAdmin 
                            ? (branchId || contextBranchId || '') 
                            : (contextBranchId || branchId || '');
                        
                        for (const payment of partialPayments) {
                            await purchaseService.recordPayment(
                                newPurchase.id,
                                payment.amount,
                                payment.method,
                                payment.accountId || undefined,
                                companyId,
                                finalBranchId || undefined,
                                payment.reference || undefined
                            );
                        }
                        console.log('[PURCHASE FORM] Payments saved:', partialPayments.length);
                    } catch (paymentError: any) {
                        console.error('[PURCHASE FORM] Error saving payments:', paymentError);
                        toast.error('Purchase created but failed to save payments: ' + (paymentError.message || 'Unknown error'));
                    }
                }
                
                toast.success('Purchase order created successfully!');
                
                console.log('[PURCHASE FORM] 📢 Dispatching purchaseSaved event (CREATE MODE), purchaseId:', newPurchase?.id);
                window.dispatchEvent(new CustomEvent('purchaseSaved', { 
                    detail: { purchaseId: newPurchase?.id } 
                }));
                if (openPaymentDialogAfter && newPurchase?.id) {
                    setSavedPurchaseIdForPayment(newPurchase.id);
                    setUnifiedPaymentDialogOpen(true);
                    return newPurchase.id;
                }
                onClose();
                return newPurchase?.id ?? null;
            }
            
        } catch (error: any) {
            console.error('[PURCHASE FORM] Error saving purchase:', error);
            toast.error(`Failed to save purchase: ${error.message || 'Unknown error'}`);
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
            {/* ============ LAYER 1: FIXED HEADER (Same as Purchase Header Test / Sale) ============ */}
            <div className="shrink-0 bg-[#0B1019] border-b border-gray-800 z-20">
                {/* Top Bar – PO # left, Status + Branch right */}
                <div className="h-12 flex items-center justify-between px-6 border-b border-gray-800/50">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-400 hover:text-white h-8 w-8">
                            <X size={18} />
                        </Button>
                        <div>
                            <h2 className="text-sm font-bold text-white">New Purchase Order</h2>
                            <p className="text-[10px] text-gray-500">Standard Entry</p>
                        </div>
                        <div className="flex items-center gap-2 ml-4 pl-4 border-l border-gray-800">
                            <Hash size={14} className="text-cyan-500" />
                            <span className="text-sm font-mono text-cyan-400">
                                {displayPurchaseNumber || 'PO-0001'}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <Popover open={statusOpen} onOpenChange={setStatusOpen}>
                            <PopoverTrigger asChild>
                                <button
                                    type="button"
                                    className={cn(
                                        'px-3 py-1 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5',
                                        getStatusChipColor(),
                                        'hover:opacity-80 cursor-pointer'
                                    )}
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                    {purchaseStatus.charAt(0).toUpperCase() + purchaseStatus.slice(1)}
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-48 bg-gray-900 border-gray-800 text-white p-2" align="start">
                                <Command className="bg-transparent border-0">
                                    <CommandList>
                                        <CommandGroup>
                                            {(['draft', 'ordered', 'received', 'final'] as const).map((s) => (
                                                <CommandItem
                                                    key={s}
                                                    onSelect={() => { setPurchaseStatus(s); setStatusOpen(false); }}
                                                    className={cn(
                                                        'cursor-pointer px-3 py-2 rounded-md text-sm transition-all flex items-center gap-2',
                                                        purchaseStatus === s ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                                    )}
                                                >
                                                    <span
                                                        className={cn(
                                                            'w-1.5 h-1.5 rounded-full shrink-0',
                                                            s === 'draft' && 'bg-gray-500',
                                                            s === 'ordered' && 'bg-yellow-500',
                                                            s === 'received' && 'bg-blue-500',
                                                            s === 'final' && 'bg-green-500'
                                                        )}
                                                    />
                                                    {s.charAt(0).toUpperCase() + s.slice(1)}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        {/* Branch Selector - Role-based visibility + Edit mode lock */}
                        {isAdmin ? (
                            <BranchSelector 
                                branchId={branchId} 
                                setBranchId={setBranchId} 
                                variant="header"
                                disabled={isEditMode} // STEP 4: Lock branch in edit mode
                            />
                        ) : (
                            <div className="px-3 py-1.5 rounded-lg bg-gray-800/50 border border-gray-700 text-xs text-gray-400">
                                Branch: {branches.find(b => b.id === branchId)?.name || 'Auto-selected'}
                            </div>
                        )}
                    </div>
                </div>

                {/* Form Row – Supplier, Date, Ref # only (no Invoice #, Status in top bar) */}
                <div className="px-6 py-4 bg-[#0F1419]">
                    <div className="invoice-container mx-auto w-full max-w-[1151px]">
                        <div className="bg-gray-900/30 border border-gray-800/50 rounded-lg p-3 min-h-[85px] w-full">
                            <div className="flex items-end gap-3 w-full flex-wrap">
                                <div className="flex flex-col flex-1 min-w-0 min-w-[200px]">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <Label className="text-orange-400 font-medium text-[10px] uppercase tracking-wide h-[14px]">Supplier</Label>
                                        {supplierId && (
                                            <span className={cn("absolute left-[677px] text-[15px] font-semibold tabular-nums", getDueBalanceColor(selectedSupplierDue))}>
                                                {formatDueBalanceCompact(selectedSupplierDue)}
                                            </span>
                                        )}
                                    </div>
                                    <SearchableSelect
                                        key={`supplier-select-${supplierId}-${suppliers.length}`}
                                        value={supplierId}
                                        onValueChange={setSupplierId}
                                        options={suppliers.map(s => ({ id: s.id.toString(), name: s.name, dueBalance: s.dueBalance }))}
                                        placeholder="Select Supplier"
                                        searchPlaceholder="Search supplier..."
                                        icon={<User size={14} className="text-gray-400 shrink-0" />}
                                        enableAddNew={true}
                                        addNewLabel="Add New Supplier"
                                        onAddNew={(searchText) => {
                                            openDrawer('addContact', 'addPurchase', { 
                                                contactType: 'supplier',
                                                prefillName: searchText || undefined
                                            });
                                        }}
                                        renderOption={(option) => (
                                            <div className="flex items-center justify-between w-full">
                                                <span className="flex-1 font-medium">{option.name}</span>
                                                <span className={cn(
                                                    "text-xs font-semibold tabular-nums ml-2",
                                                    option.dueBalance < 0 && "text-green-400",
                                                    option.dueBalance > 0 && "text-red-400",
                                                    option.dueBalance === 0 && "text-gray-500"
                                                )}>
                                                    {formatDueBalanceCompact(option.dueBalance)}
                                                </span>
                                            </div>
                                        )}
                                    />
                                </div>
                                <div className="flex flex-col w-[184px] absolute left-[798px] top-[77px] z-0">
                                    <Label className="text-gray-500 font-medium text-xs uppercase tracking-wide h-[14px] mb-1.5">Date</Label>
                                    <div className="[&>div>button]:bg-gray-900/50 [&>div>button]:border-gray-800 [&>div>button]:text-white [&>div>button]:text-xs [&>div>button]:h-10 [&>div>button]:min-h-[40px] [&>div>button]:px-2.5 [&>div>button]:py-1 [&>div>button]:rounded-lg [&>div>button]:border [&>div>button]:hover:bg-gray-800 [&>div>button]:w-full [&>div>button]:justify-start">
                                        <CalendarDatePicker
                                            value={purchaseDate}
                                            onChange={(date) => setPurchaseDate(date || new Date())}
                                            showTime={true}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col absolute left-[987px] w-[132px]">
                                    <Label className="text-gray-500 font-medium text-xs uppercase tracking-wide h-[14px] mb-1.5">Ref #</Label>
                                    <div className="relative">
                                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={14} />
                                        <Input 
                                            value={refNumber}
                                            onChange={(e) => setRefNumber(e.target.value)}
                                            className="pl-9 bg-gray-950 border-gray-700 h-10 text-sm"
                                            placeholder="Optional"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ============ LAYER 2: SCROLLABLE MAIN CONTENT (DUAL PANEL) ============ */}
            <div className="flex-1 overflow-hidden">
                <div className="invoice-container mx-auto px-6 h-full">
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-3 h-full py-3">
                        
                        {/* LEFT PANEL - Items Entry (Independent Scroll) */}
                        <div className="flex flex-col h-full overflow-hidden">
                            {/* Branch Validation Warning */}
                            {(!branchId || branchId === 'all' || branchId.trim() === '') && (
                                <div className="mb-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center gap-2">
                                    <AlertCircle size={16} className="text-yellow-400 flex-shrink-0" />
                                    <p className="text-xs text-yellow-400">
                                        {isAdmin 
                                            ? 'Please select a branch before adding items. Branch is mandatory for purchases.'
                                            : 'Branch is required. Please contact admin if branch is not auto-selected.'}
                                    </p>
                                </div>
                            )}
                            
                            {/* Items Table Section - Disabled until branch selected */}
                            <div className={cn(
                                "flex flex-col h-full overflow-hidden",
                                (!branchId || branchId === 'all' || branchId.trim() === '') && "opacity-50 pointer-events-none"
                            )}>
                            <PurchaseItemsSection
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
                                // Variation handling
                                productVariations={productVariationsFromBackend}
                                handleInlineVariationSelect={handleInlineVariationSelect}
                                isEditMode={isEditMode}
                                updateItem={updateItem}
                                // Keyboard navigation
                                itemQtyRefs={itemQtyRefs}
                                itemPriceRefs={itemPriceRefs}
                                handleQtyKeyDown={handleQtyKeyDown}
                                handlePriceKeyDown={handlePriceKeyDown}
                            />
                            </div>
                        </div>

                        {/* RIGHT PANEL - Extra Expenses first, then Summary (Independent Scroll) */}
                        <div className="flex flex-col h-full overflow-y-auto space-y-3 pb-3">
                            {/* Extra Expenses Card – above Summary */}
                            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 space-y-3 shrink-0">
                                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Extra Expenses</h3>
                                
                                {/* Add Expense Form */}
                                <div className="grid grid-cols-3 gap-2">
                                    <Select value={newExpenseType} onValueChange={(v: any) => setNewExpenseType(v)}>
                                        <SelectTrigger className="h-9 bg-gray-950 border-gray-700 text-white text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-gray-950 border-gray-800 text-white">
                                            <SelectItem value="freight">Freight</SelectItem>
                                            <SelectItem value="loading">Loading</SelectItem>
                                            <SelectItem value="unloading">Unloading</SelectItem>
                                            <SelectItem value="customs">Customs</SelectItem>
                                            <SelectItem value="Mobile Wallet">Mobile Wallet</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Input 
                                        type="number"
                                        placeholder="Amount"
                                        value={newExpenseAmount > 0 ? newExpenseAmount : ''}
                                        onChange={(e) => setNewExpenseAmount(parseFloat(e.target.value) || 0)}
                                        className="h-9 bg-gray-950 border-gray-700 text-white text-xs"
                                    />
                                    <Button
                                        onClick={handleAddExpense}
                                        size="sm"
                                        className="h-9 bg-purple-600 hover:bg-purple-500 text-white text-xs"
                                    >
                                        <Plus size={14} className="mr-1" /> Add
                                    </Button>
                                </div>

                                {/* Expense List */}
                                {extraExpenses.length > 0 && (
                                    <div className="space-y-2 max-h-32 overflow-y-auto">
                                        {extraExpenses.map((exp) => (
                                            <div key={exp.id} className="flex items-center justify-between bg-gray-950 rounded p-2 text-sm">
                                                <span className="text-purple-400 capitalize">{exp.type}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-white font-medium text-sm">{exp.amount.toLocaleString()}</span>
                                                    <button
                                                        onClick={() => setExtraExpenses(extraExpenses.filter(e => e.id !== exp.id))}
                                                        className="text-red-400 hover:text-red-300"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Summary Card */}
                            <div className="bg-gradient-to-br from-gray-900/80 to-gray-900/50 border border-gray-800 rounded-lg p-4 shrink-0">
                                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Purchase Summary</h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Items Subtotal</span>
                                        <span className="text-white font-medium">{subtotal.toLocaleString()}</span>
                                    </div>
                                    
                                    {/* Discount - Inline Input */}
                                    <div className="flex items-center justify-between gap-2 py-1">
                                        <div className="flex items-center gap-1.5">
                                            <Percent size={14} className="text-red-400" />
                                            <span className="text-sm text-gray-400">Discount</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Select value={discountType} onValueChange={(v: any) => setDiscountType(v)}>
                                                <SelectTrigger className="w-14 h-8 bg-gray-950 border-gray-700 text-white text-sm px-2">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-gray-950 border-gray-800 text-white min-w-[60px]">
                                                    <SelectItem value="percentage">%</SelectItem>
                                                    <SelectItem value="fixed">$</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Input 
                                                type="number"
                                                placeholder="0"
                                                className="w-20 h-8 bg-gray-950 border-gray-700 text-white text-sm text-right px-2"
                                                value={discountValue > 0 ? discountValue : ''}
                                                onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                                            />
                                            {discountAmount > 0 && (
                                                <span className="text-sm text-red-400 font-medium min-w-[60px] text-right">
                                                    -{discountAmount.toLocaleString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {expensesTotal > 0 && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-purple-400">Extra Expenses</span>
                                            <span className="text-purple-400 font-medium">+{expensesTotal.toLocaleString()}</span>
                                        </div>
                                    )}

                                    {/* Payment history – directly under Extra Expenses, detail per payment */}
                                    {partialPayments.length > 0 && (
                                        <>
                                            <div className="pt-1">
                                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                                                    <Wallet size={14} />
                                                    Payment history {partialPayments.length > 0 && `(${partialPayments.length})`}
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
                                                            <span className="text-sm font-semibold text-green-400 shrink-0 tabular-nums">{Number(p.amount).toLocaleString()}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                    
                                    <Separator className="bg-gray-800" />
                                    
                                    <div className="flex justify-between items-center pt-1">
                                        <span className="text-gray-400">Grand Total</span>
                                        <span className="text-xl font-semibold text-white">${totalAmount.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-1">
                                        <span className="text-sm font-semibold text-white">Due balance</span>
                                        <span className="text-xl font-semibold text-orange-500">${Math.max(0, balanceDue).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Attachments Card – upload purchase bill / docs; saved with payment when you Pay Now */}
                            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 space-y-3 shrink-0">
                                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
                                    <Paperclip size={14} />
                                    Attachments
                                </h3>
                                <input
                                    ref={purchaseAttachmentInputRef}
                                    type="file"
                                    accept="image/*,.pdf,application/pdf"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => {
                                        const files = e.target.files;
                                        if (files?.length) {
                                            const valid = Array.from(files).filter((f) => f.type.startsWith('image/') || f.type === 'application/pdf');
                                            setPurchaseAttachmentFiles((prev) => [...prev, ...valid]);
                                            if (valid.length < (files.length || 0)) toast.error('Only images and PDF allowed.');
                                        }
                                        e.target.value = '';
                                    }}
                                />
                                <label className="block cursor-pointer">
                                    <div
                                        className="border-2 border-dashed border-gray-700 rounded-lg p-3 hover:border-blue-500/50 hover:bg-gray-800/30 transition-all text-center"
                                        onClick={() => purchaseAttachmentInputRef.current?.click()}
                                        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-blue-500/50', 'bg-gray-800/30'); }}
                                        onDragLeave={(e) => { e.currentTarget.classList.remove('border-blue-500/50', 'bg-gray-800/30'); }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            e.currentTarget.classList.remove('border-blue-500/50', 'bg-gray-800/30');
                                            const files = e.dataTransfer.files;
                                            if (files?.length) {
                                                const valid = Array.from(files).filter((f) => f.type.startsWith('image/') || f.type === 'application/pdf');
                                                setPurchaseAttachmentFiles((prev) => [...prev, ...valid]);
                                            }
                                        }}
                                    >
                                        <Upload className="mx-auto mb-1 text-gray-500" size={20} />
                                        <p className="text-xs text-gray-400">Click or drop files (images, PDF)</p>
                                        <p className="text-[10px] text-gray-500 mt-0.5">Saved with purchase when you save</p>
                                    </div>
                                </label>
                                {purchaseAttachmentFiles.length > 0 && (
                                    <div className="space-y-1.5 max-h-28 overflow-y-auto">
                                        {purchaseAttachmentFiles.map((file, idx) => (
                                            <div key={idx} className="flex items-center justify-between gap-2 bg-gray-950 rounded-md px-2.5 py-2 border border-gray-800/50">
                                                <FileText size={14} className="text-gray-500 shrink-0" />
                                                <span className="text-sm text-gray-300 truncate flex-1 min-w-0">{file.name}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setPurchaseAttachmentFiles((prev) => prev.filter((_, i) => i !== idx))}
                                                    className="text-red-400 hover:text-red-300 shrink-0 p-0.5"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {(() => {
                                    const raw = (loadedPurchaseData as any)?.attachments;
                                    let purchaseSaved: { url: string; name?: string }[] = [];
                                    if (Array.isArray(raw)) purchaseSaved = raw;
                                    else if (raw && typeof raw === 'string') {
                                        try { purchaseSaved = JSON.parse(raw) || []; } catch { purchaseSaved = []; }
                                    }
                                    const fromPayments = partialPayments.flatMap((p) => (p.attachments || []).map((a) => ({ ...a, paymentMethod: p.method })));
                                    const hasPurchaseSaved = purchaseSaved.length > 0;
                                    return (
                                        <>
                                            {hasPurchaseSaved && (
                                                <div className="space-y-1.5 pt-1 border-t border-gray-800">
                                                    <p className="text-[10px] text-gray-500 uppercase tracking-wide">Saved with purchase</p>
                                                    <div className="space-y-1.5 max-h-24 overflow-y-auto">
                                                        {purchaseSaved.map((att: { url: string; name?: string }, idx: number) => (
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
                                            {fromPayments.length > 0 && (
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
                                            )}
                                        </>
                                    );
                                })()}
                                {purchaseAttachmentFiles.length === 0 && partialPayments.flatMap((p) => p.attachments || []).length === 0 && !(Array.isArray((loadedPurchaseData as any)?.attachments) && (loadedPurchaseData as any).attachments.length > 0) && (
                                    <p className="text-xs text-gray-500">No files yet. Add above; they’ll be saved with the purchase when you save.</p>
                                )}
                            </div>

                        </div>
                    </div>
                </div>
            </div>

            {/* ============ PAYMENT CHOICE DIALOG (like Sale – Pay Now / Credit) ============ */}
            <AlertDialog open={paymentChoiceDialogOpen} onOpenChange={setPaymentChoiceDialogOpen}>
                <AlertDialogContent className="bg-gray-900 border-gray-700 text-white max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-bold flex items-center gap-2">
                            <DollarSign size={20} className="text-blue-400" />
                            Payment Option
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-gray-400 pt-2">
                            Is purchase ki payment ab record karein ya credit par chhorein?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-3 py-4">
                        <Button
                            onClick={async () => {
                                setPaymentChoiceDialogOpen(false);
                                const printFlag = pendingSaveAction?.print ?? false;
                                setPendingSaveAction(null);
                                try {
                                    await proceedWithSave(printFlag, true);
                                } catch (e) {
                                    console.error('[PURCHASE FORM] Save for payment failed:', e);
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
                                    await proceedWithSave(pendingSaveAction.print, false);
                                }
                                setPendingSaveAction(null);
                            }}
                            className="w-full h-14 bg-gray-700 hover:bg-gray-600 text-white text-base font-semibold flex items-center justify-center gap-2"
                        >
                            <CreditCard size={20} />
                            Credit (Save without payment)
                        </Button>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel
                            onClick={() => setPendingSaveAction(null)}
                            className="bg-gray-800 hover:bg-gray-700 text-white border-gray-700"
                        >
                            Cancel
                        </AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <UnifiedPaymentDialog
                isOpen={unifiedPaymentDialogOpen && !!savedPurchaseIdForPayment}
                onClose={() => {
                    setUnifiedPaymentDialogOpen(false);
                    setSavedPurchaseIdForPayment(null);
                    setPurchaseAttachmentFiles([]);
                    onClose();
                }}
                context="supplier"
                entityName={suppliers.find(s => s.id.toString() === supplierId)?.name || 'Supplier'}
                entityId={supplierId || undefined}
                outstandingAmount={totalAmount}
                totalAmount={totalAmount}
                paidAmount={0}
                previousPayments={[]}
                referenceNo={poNumber || undefined}
                referenceId={savedPurchaseIdForPayment || undefined}
                onSuccess={() => {
                    setUnifiedPaymentDialogOpen(false);
                    setSavedPurchaseIdForPayment(null);
                    setPurchaseAttachmentFiles([]);
                    window.dispatchEvent(new CustomEvent('paymentAdded'));
                    onClose();
                }}
            />

            {/* ============ LAYER 3: FIXED FOOTER ============ */}
            <div className="shrink-0 bg-[#0B1019] border-t border-gray-800">
                {/* Status Summary Row */}
                <div className="h-12 flex items-center justify-between px-6 border-b border-gray-800/50">
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                        {/* Items Count */}
                        <span>{items.length} Items</span>
                        <span className="w-1 h-1 rounded-full bg-gray-600" />
                        
                        {/* Total Quantity */}
                        <span>Qty: {items.reduce((sum, item) => sum + item.qty, 0).toLocaleString()}</span>
                        
                        {/* Packing Summary - Only when Enable Packing is ON and non-zero */}
                        {enablePacking && items.some(item => item.packingDetails) && (() => {
                            const totalBoxes = items.reduce((sum, item) => sum + (item.packingDetails?.total_boxes || 0), 0);
                            const totalPieces = items.reduce((sum, item) => sum + (item.packingDetails?.total_pieces || 0), 0);
                            const totalMeters = items.reduce((sum, item) => sum + (item.packingDetails?.total_meters || 0), 0);
                            const parts = [];
                            if (totalBoxes > 0) parts.push(`Box: ${totalBoxes}`);
                            if (totalPieces > 0) parts.push(`Pcs: ${totalPieces}`);
                            if (totalMeters > 0) parts.push(`Mtr: ${totalMeters.toLocaleString()}`);
                            return parts.length > 0 ? (
                                <>
                                    <span className="w-1 h-1 rounded-full bg-gray-600" />
                                    <span>{parts.join(' | ')}</span>
                                </>
                            ) : null;
                        })()}
                        
                        <span className="w-1 h-1 rounded-full bg-gray-600" />
                        
                        {/* Grand Total */}
                        <span>Total: ${totalAmount.toLocaleString()}</span>
                    </div>
                </div>
                
                {/* Action Buttons Row - FIXED 2 BUTTONS ONLY */}
                <div className="h-14 px-6 flex items-center justify-center">
                    <div className="flex gap-3 justify-center">
                            <Button 
                                type="button"
                                variant="outline"
                                className="h-10 bg-transparent border border-gray-700 hover:border-gray-600 hover:bg-gray-800 text-white text-sm font-semibold"
                                onClick={() => handleSave(false)}
                                disabled={saving}
                            >
                                <Save size={15} className="mr-1.5" />
                                {saving ? (isEditMode ? 'Updating...' : 'Saving...') : (isEditMode ? 'Update' : 'Save')}
                            </Button>
                            <Button 
                                type="button"
                                className="h-10 bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold shadow-lg shadow-orange-900/20"
                                onClick={() => handleSave(true)}
                                disabled={saving}
                            >
                                <Printer size={15} className="mr-1.5" />
                                {saving ? (isEditMode ? 'Updating...' : 'Saving...') : (isEditMode ? 'Update & Print' : 'Save & Print')}
                            </Button>
                    </div>
                </div>
            </div>

            {/* Packing Modal - Now rendered globally in GlobalDrawer */}

            {/* Add Supplier Modal - REMOVED (using GlobalDrawer contact form instead) */}
        </div>
    );
};