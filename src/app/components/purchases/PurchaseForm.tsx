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
import { InlineVariationSelector, Variation } from "../ui/inline-variation-selector";
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
import { contactService } from '@/app/services/contactService';
import { productService } from '@/app/services/productService';
import { branchService } from '@/app/services/branchService';
import { usePurchases } from '@/app/context/PurchaseContext';
import { useNavigation } from '@/app/context/NavigationContext';
import { Loader2 } from 'lucide-react';
import { format } from "date-fns";

interface PurchaseItem {
    id: number;
    productId: number;
    name: string;
    sku: string;
    price: number;
    qty: number;
    // Standard Variation Fields
    size?: string;
    color?: string;
    // Standard Packing Fields (Wholesale)
    thaans?: number;
    meters?: number;
    packingDetails?: PackingDetails;
    // Stock and Purchase Info
    stock?: number;
    lastPurchasePrice?: number;
    lastSupplier?: string;
    // UI State
    showVariations?: boolean; // Flag to show variation selector inline under this item
}

interface PartialPayment {
    id: string;
    method: 'cash' | 'bank' | 'other';
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
    const { companyId, branchId: contextBranchId, userRole, enablePacking } = useSupabase();
    // CRITICAL FIX: Check if user is admin
    const isAdmin = userRole === 'admin' || userRole === 'Admin';
    const { createPurchase } = usePurchases();
    const { openDrawer, activeDrawer, createdContactId, createdContactType, setCreatedContactId, openPackingModal } = useNavigation();
    
    // Data State
    const [suppliers, setSuppliers] = useState<Array<{ id: number | string; name: string; dueBalance: number }>>([]);
    const [products, setProducts] = useState<Array<{ id: number | string; name: string; sku: string; price: number; stock: number; lastPurchasePrice?: number; lastSupplier?: string; hasVariations: boolean; needsPacking: boolean; variations?: Array<{ id: string; attributes?: Record<string, unknown>; size?: string; color?: string }> }>>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Header State
    const [supplierId, setSupplierId] = useState("");
    const [supplierSearchOpen, setSupplierSearchOpen] = useState(false);
    const [supplierSearchTerm, setSupplierSearchTerm] = useState("");
    const [purchaseDate, setPurchaseDate] = useState<Date>(new Date());
    const [refNumber, setRefNumber] = useState("");
    
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
    // Inline Variation Selection
    const [showVariationSelector, setShowVariationSelector] = useState(false);
    const [selectedProductForVariation, setSelectedProductForVariation] = useState<any | null>(null);
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
    
    // Payment Form State
    const [newPaymentMethod, setNewPaymentMethod] = useState<'cash' | 'bank' | 'other'>('cash');
    const [newPaymentAmount, setNewPaymentAmount] = useState<number>(0);
    const [newPaymentReference, setNewPaymentReference] = useState<string>("");
    
    // Payment Attachments State
    const [paymentAttachments, setPaymentAttachments] = useState<PaymentAttachment[]>([]);

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
    const isFinal = purchaseStatus === 'final';

    // When status changes away from Final: clear temp payments (ERP rule: payment only when Final)
    useEffect(() => {
        if (purchaseStatus !== 'final') {
            setPartialPayments([]);
            setNewPaymentAmount(0);
            setNewPaymentReference('');
            setPaymentAttachments([]);
        }
    }, [purchaseStatus]);

    const formatDueBalanceCompact = (due: number) => {
        if (due === 0) return '0';
        if (due < 0) return `-${Math.abs(due).toLocaleString()}`;
        return `+${due.toLocaleString()}`;
    };
    const getDueBalanceColor = (due: number) => {
        if (due < 0) return 'text-green-400';
        if (due > 0) return 'text-red-400';
        return 'text-gray-500';
    };

    // Variation options from backend only (product.variations) - no dummy data
    const productVariationsFromBackend = useMemo(() => {
        const map: Record<number, Array<{ size: string; color: string }>> = {};
        products.forEach((p) => {
            if (!p.variations?.length) return;
            const key = typeof p.id === 'number' ? p.id : (/^\d+$/.test(String(p.id)) ? parseInt(String(p.id), 10) : NaN);
            if (!Number.isNaN(key)) {
                map[key] = p.variations.map((v: any) => ({
                    size: (v.attributes?.size ?? v.size ?? '').toString(),
                    color: (v.attributes?.color ?? v.color ?? '').toString(),
                }));
            }
        });
        return map;
    }, [products]);

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

    // --- Workflow Handlers ---

    // 1. Select Product -> Immediately add to items list (Selection = Add)
    const handleSelectProduct = (product: any) => {
        const newItemId = Date.now();
        
        // Check if product has variations
        if (product.hasVariations) {
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
            };

            setItems(prev => [newItem, ...prev]);
            toast.success("Item added - Select variation");
            
            // Set focus tracking for variation section
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
    
    // Handle variation selection from inline row
    const handleInlineVariationSelect = (itemId: number, variation: { size?: string; color?: string }) => {
        setItems(prev => prev.map(item => {
            if (item.id === itemId) {
                return {
                    ...item,
                    size: variation.size,
                    color: variation.color,
                    showVariations: false, // Hide variation selector
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

    const filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(productSearchTerm.toLowerCase())
    );
    
    // Load data from Supabase
    useEffect(() => {
        const loadData = async () => {
            if (!companyId) return;
            
            try {
                setLoading(true);
                
                // Load suppliers (contacts with type='supplier')
                const contactsData = await contactService.getAllContacts(companyId);
                const supplierContacts = contactsData
                    .filter(c => c.type === 'supplier' || c.type === 'both')
                    .map(c => ({
                        id: c.id || c.uuid || '',
                        name: c.name || '',
                        dueBalance: c.payables || 0
                    }));
                setSuppliers(supplierContacts);
                
                // Load products
                const productsData = await productService.getAllProducts(companyId);
                const productsList = productsData.map(p => ({
                    id: p.id || p.uuid || '',
                    name: p.name || '',
                    sku: p.sku || '',
                    price: (p.cost_price ?? p.costPrice ?? p.price) || 0,
                    stock: (p.current_stock ?? p.stock) ?? 0,
                    lastPurchasePrice: (p.cost_price ?? p.costPrice) ?? undefined,
                    lastSupplier: undefined, // Can be enhanced later
                    hasVariations: (p.variations && p.variations.length > 0) || false,
                    needsPacking: false, // Can be enhanced based on product type
                    variations: p.variations || []
                }));
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

    // Pre-populate form when editing (TASK 3 FIX)
    useEffect(() => {
        if (initialPurchase) {
            // Pre-fill header fields
            setSupplierId(initialPurchase.supplier || '');
            setPurchaseDate(initialPurchase.date ? new Date(initialPurchase.date) : new Date());
            setRefNumber('');
            
            // Pre-fill items
            if (initialPurchase.items && initialPurchase.items.length > 0) {
                const convertedItems: PurchaseItem[] = initialPurchase.items.map((item: any, index: number) => ({
                    id: Date.now() + index, // Generate unique ID
                    productId: item.productId || '',
                    name: item.productName || '',
                    sku: item.sku || '',
                    price: item.price || 0,
                    qty: item.quantity || 0,
                    receivedQty: item.receivedQty || item.quantity || 0,
                    size: item.size,
                    color: item.color,
                    stock: 0, // Will be loaded from product if needed
                    lastPurchasePrice: undefined,
                    lastSupplier: undefined,
                    showVariations: false,
                    packingDetails: item.packingDetails,
                    thaans: item.packingDetails?.total_boxes,
                    meters: item.packingDetails?.total_meters,
                }));
                setItems(convertedItems);
            }
            
            // Pre-fill payments if any
            if (initialPurchase.paid > 0) {
                setPartialPayments([{
                    id: '1',
                    method: (initialPurchase.paymentMethod || 'cash') as 'cash' | 'bank' | 'other',
                    amount: initialPurchase.paid,
                    reference: '',
                    attachments: []
                }]);
            }
            
            // Pre-fill expenses
            if (initialPurchase.shippingCost > 0) {
                setExtraExpenses([{
                    id: '1',
                    type: 'freight',
                    amount: initialPurchase.shippingCost,
                    notes: 'Shipping charges'
                }]);
            }
            
            // Pre-fill discount
            if (initialPurchase.discount > 0) {
                setDiscountValue(initialPurchase.discount);
                setDiscountType('fixed'); // Default to fixed, can be enhanced
            }
            
            // Pre-fill status
            if (initialPurchase.status === 'ordered') {
                setPurchaseStatus('ordered');
            } else if (initialPurchase.status === 'received') {
                setPurchaseStatus('received');
            } else if (initialPurchase.status === 'completed' || initialPurchase.status === 'final') {
                setPurchaseStatus('final');
            } else {
                setPurchaseStatus('draft');
            }
        }
    }, [initialPurchase]);
    
    // Handle Save
    const handleSave = async (print: boolean = false) => {
        if (!supplierId || supplierId === '') {
            toast.error('Please select a supplier');
            return;
        }
        
        if (items.length === 0) {
            toast.error('Please add at least one item');
            return;
        }
        
        try {
            setSaving(true);
            
            const selectedSupplier = suppliers.find(s => s.id.toString() === supplierId);
            const supplierName = selectedSupplier?.name || '';
            const supplierUuid = supplierId.toString();
            
            // Convert items to PurchaseItem format (packing only when Enable Packing is ON)
            const purchaseItems = items.map(item => ({
                id: item.id.toString(),
                productId: item.productId.toString(),
                productName: item.name,
                sku: item.sku,
                quantity: item.qty,
                receivedQty: 0, // Will be updated when received
                price: item.price,
                discount: 0, // Can be enhanced later
                tax: 0, // Can be enhanced later
                total: item.price * item.qty,
                ...(enablePacking ? {
                    packingDetails: item.packingDetails,
                    thaans: item.thaans,
                    meters: item.meters
                } : { packingDetails: undefined, thaans: undefined, meters: undefined })
            }));
            
            // CRITICAL FIX: Branch validation
            // Admin must select branch, normal user uses auto-selected branch
            const finalBranchId = isAdmin 
                ? (branchId || contextBranchId || '') // Admin can select or use context
                : (contextBranchId || branchId || ''); // Normal user uses context (auto-selected)
            
            if (isAdmin && !finalBranchId) {
                toast.error('Please select a branch');
                setSaving(false);
                return;
            }
            
            // Create purchase data
            const purchaseData = {
                supplier: supplierUuid,
                supplierName: supplierName,
                contactNumber: '', // Can be enhanced to get from supplier
                date: format(purchaseDate, 'yyyy-MM-dd'),
                expectedDelivery: undefined,
                location: finalBranchId, // CRITICAL: Always use validated branch ID
                status: purchaseStatus as 'draft' | 'ordered' | 'received' | 'final',
                items: purchaseItems,
                itemsCount: items.length,
                subtotal: subtotal,
                discount: discountAmount,
                tax: 0, // Can be enhanced later
                shippingCost: expensesTotal,
                total: totalAmount,
                paid: totalPaid,
                due: balanceDue,
                paymentStatus: paymentStatus as 'paid' | 'partial' | 'unpaid',
                paymentMethod: partialPayments.length > 0 ? partialPayments[0].method : 'cash',
                notes: refNumber || undefined
            };
            
            // Create purchase via context
            await createPurchase(purchaseData);
            
            toast.success('Purchase order created successfully!');
            
            if (print) {
                // TODO: Implement print functionality
                toast.info('Print functionality coming soon');
            }
            
            // Close form
            onClose();
        } catch (error: any) {
            console.error('[PURCHASE FORM] Error saving purchase:', error);
            toast.error(`Failed to save purchase: ${error.message || 'Unknown error'}`);
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
                            <span className="text-sm font-mono text-cyan-400">{refNumber || 'PO-001'}</span>
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
                                <div className="space-y-1">
                                    {(['draft', 'ordered', 'received', 'final'] as const).map((s) => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => { setPurchaseStatus(s); setStatusOpen(false); }}
                                            className={cn(
                                                'w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center gap-2',
                                                purchaseStatus === s ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    'w-1.5 h-1.5 rounded-full',
                                                    s === 'draft' && 'bg-gray-500',
                                                    s === 'ordered' && 'bg-yellow-500',
                                                    s === 'received' && 'bg-blue-500',
                                                    s === 'final' && 'bg-green-500'
                                                )}
                                            />
                                            {s.charAt(0).toUpperCase() + s.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </PopoverContent>
                        </Popover>
                        <BranchSelector branchId={branchId} setBranchId={setBranchId} variant="header" />
                    </div>
                </div>

                {/* Form Row – Supplier, Date, Ref # only (no Invoice #, Status in top bar) */}
                <div className="px-6 py-4 bg-[#0F1419]">
                    <div className="invoice-container mx-auto w-full">
                        <div className="bg-gray-900/30 border border-gray-800/50 rounded-lg p-3">
                            <div className="flex items-end gap-3 w-full flex-wrap">
                                <div className="flex flex-col flex-1 min-w-0 min-w-[200px]">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <Label className="text-orange-400 font-medium text-[10px] uppercase tracking-wide h-[14px]">Supplier</Label>
                                        {supplierId && (
                                            <span className={cn("text-[10px] font-medium tabular-nums", getDueBalanceColor(selectedSupplierDue))}>
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
                                <div className="flex flex-col w-32">
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
                                <div className="flex flex-col w-24">
                                    <Label className="text-gray-500 font-medium text-xs uppercase tracking-wide h-[14px] mb-1.5">Ref #</Label>
                                    <div className="relative">
                                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={14} />
                                        <Input 
                                            value={refNumber}
                                            onChange={(e) => setRefNumber(e.target.value)}
                                            className="pl-9 bg-gray-950 border-gray-700 h-10 text-sm"
                                            placeholder="PO-001"
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
                            {/* Items Table Section */}
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
                                // Inline variation selection
                                showVariationSelector={showVariationSelector}
                                selectedProductForVariation={selectedProductForVariation}
                                productVariations={productVariationsFromBackend}
                                handleVariationSelect={handleVariationSelect}
                                setShowVariationSelector={setShowVariationSelector}
                                setSelectedProductForVariation={setSelectedProductForVariation}
                                handleInlineVariationSelect={handleInlineVariationSelect}
                                // Update item
                                updateItem={updateItem}
                                // Keyboard navigation
                                itemQtyRefs={itemQtyRefs}
                                itemPriceRefs={itemPriceRefs}
                                itemVariationRefs={itemVariationRefs}
                                handleQtyKeyDown={handleQtyKeyDown}
                                handlePriceKeyDown={handlePriceKeyDown}
                            />
                        </div>

                        {/* RIGHT PANEL - Summary + Payment + Expenses (Independent Scroll) */}
                        <div className="flex flex-col h-full overflow-y-auto space-y-3 pb-3">
                            {/* Summary Card */}
                            <div className="bg-gradient-to-br from-gray-900/80 to-gray-900/50 border border-gray-800 rounded-lg p-4 shrink-0">
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Purchase Summary</h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-400">Items Subtotal</span>
                                        <span className="text-white font-medium">${subtotal.toLocaleString()}</span>
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
                                                    <SelectItem value="fixed">$</SelectItem>
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
                                                <span className="text-xs text-red-400 font-medium min-w-[60px] text-right">
                                                    -${discountAmount.toLocaleString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {expensesTotal > 0 && (
                                        <div className="flex justify-between text-xs">
                                            <span className="text-purple-400">Extra Expenses</span>
                                            <span className="text-purple-400 font-medium">+${expensesTotal.toLocaleString()}</span>
                                        </div>
                                    )}
                                    
                                    <Separator className="bg-gray-800" />
                                    
                                    <div className="flex justify-between items-center pt-1">
                                        <span className="text-sm font-semibold text-white">Grand Total</span>
                                        <span className="text-2xl font-bold text-orange-500">${totalAmount.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Extra Expenses Card */}
                            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 space-y-3 shrink-0">
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Extra Expenses</h3>
                                
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
                                            <SelectItem value="other">Other</SelectItem>
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
                                            <div key={exp.id} className="flex items-center justify-between bg-gray-950 rounded p-2 text-xs">
                                                <span className="text-purple-400 capitalize">{exp.type}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-white font-medium">${exp.amount}</span>
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

                            {/* Payment Section – enabled only when Status = Final (ERP rule) */}
                            <div className={cn(
                                "bg-gray-900/50 border border-gray-800 rounded-lg p-4 space-y-4 shrink-0 transition-opacity",
                                !isFinal && "opacity-50 pointer-events-none"
                            )}>
                                {!isFinal && (
                                    <div className="text-xs text-yellow-400 mb-2 rounded-md bg-yellow-500/10 border border-yellow-500/30 px-3 py-2">
                                        Payment sirf Final status par allowed hai. Status ko Final par set karein.
                                    </div>
                                )}
                                {/* Header with Status Badge */}
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Payment</h3>
                                    <Badge className={cn(
                                        "text-xs font-medium px-3 py-1",
                                        paymentStatus === 'paid' && "bg-green-600 text-white",
                                        paymentStatus === 'partial' && "bg-blue-600 text-white",
                                        paymentStatus === 'unpaid' && "bg-orange-600 text-white"
                                    )}>
                                        {paymentStatus === 'paid' && '✓ Paid'}
                                        {paymentStatus === 'partial' && '◐ Partial'}
                                        {paymentStatus === 'unpaid' && '○ Unpaid'}
                                    </Badge>
                                </div>

                            {/* 1. AMOUNT SUMMARY SECTION */}
                            <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 space-y-3">
                                {/* Purchase Amount */}
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-500 uppercase tracking-wide">Purchase Amount</span>
                                    <span className="text-xl font-bold text-white">${totalAmount.toLocaleString()}</span>
                                </div>
                                
                                {/* Total Paid */}
                                {totalPaid > 0 && (
                                    <>
                                        <Separator className="bg-gray-800" />
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-gray-400">Total Paid</span>
                                            <span className="text-sm font-medium text-green-400">${totalPaid.toLocaleString()}</span>
                                        </div>
                                    </>
                                )}
                                
                                {/* Balance Due */}
                                <Separator className="bg-gray-800" />
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-semibold text-gray-400">Balance Due</span>
                                    <span className={cn(
                                        "text-xl font-bold",
                                        balanceDue === 0 ? "text-green-500" : balanceDue < totalAmount ? "text-blue-500" : "text-orange-500"
                                    )}>
                                        ${balanceDue.toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            {/* Quick Payment Buttons */}
                            <div className="space-y-2">
                                <Label className="text-xs text-gray-500">Quick Pay</Label>
                                <div className="grid grid-cols-4 gap-2">
                                    <Button 
                                        type="button"
                                        disabled={!isFinal}
                                        onClick={() => setNewPaymentAmount(totalAmount * 0.25)}
                                        className="h-9 bg-gray-800 hover:bg-gray-700 text-white text-xs border border-gray-700 disabled:opacity-50 disabled:pointer-events-none"
                                    >
                                        25%
                                    </Button>
                                    <Button 
                                        type="button"
                                        disabled={!isFinal}
                                        onClick={() => setNewPaymentAmount(totalAmount * 0.50)}
                                        className="h-9 bg-gray-800 hover:bg-gray-700 text-white text-xs border border-gray-700 disabled:opacity-50 disabled:pointer-events-none"
                                    >
                                        50%
                                    </Button>
                                    <Button 
                                        type="button"
                                        disabled={!isFinal}
                                        onClick={() => setNewPaymentAmount(totalAmount * 0.75)}
                                        className="h-9 bg-gray-800 hover:bg-gray-700 text-white text-xs border border-gray-700 disabled:opacity-50 disabled:pointer-events-none"
                                    >
                                        75%
                                    </Button>
                                    <Button 
                                        type="button"
                                        disabled={!isFinal}
                                        onClick={() => setNewPaymentAmount(totalAmount)}
                                        className="h-9 bg-green-700 hover:bg-green-600 text-white text-xs border border-green-600 disabled:opacity-50 disabled:pointer-events-none"
                                    >
                                        Full
                                    </Button>
                                </div>
                            </div>

                            {/* Add Payment Form */}
                            <div className="space-y-2">
                                <Label className="text-xs text-gray-500">Add Payment</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <Select value={newPaymentMethod} onValueChange={(v: any) => setNewPaymentMethod(v)} disabled={!isFinal}>
                                        <SelectTrigger className="h-9 bg-gray-950 border-gray-700 text-white text-xs disabled:opacity-50">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-gray-950 border-gray-800 text-white">
                                            <SelectItem value="cash">Cash</SelectItem>
                                            <SelectItem value="bank">Bank</SelectItem>
                                            <SelectItem value="other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Input 
                                        type="number"
                                        placeholder="Amount"
                                        disabled={!isFinal}
                                        value={newPaymentAmount > 0 ? newPaymentAmount : ''}
                                        onChange={(e) => setNewPaymentAmount(parseFloat(e.target.value) || 0)}
                                        className="h-9 bg-gray-950 border-gray-700 text-white text-xs disabled:opacity-50"
                                    />
                                </div>
                                <Input 
                                    placeholder="Reference (optional)"
                                    disabled={!isFinal}
                                    value={newPaymentReference}
                                    onChange={(e) => setNewPaymentReference(e.target.value)}
                                    className="h-9 bg-gray-950 border-gray-700 text-white text-xs disabled:opacity-50"
                                />
                                <PaymentAttachments
                                    attachments={paymentAttachments}
                                    onAttachmentsChange={setPaymentAttachments}
                                />
                                <Button
                                    onClick={handleAddPayment}
                                    disabled={!isFinal}
                                    className="w-full h-9 bg-blue-600 hover:bg-blue-500 text-white text-xs disabled:opacity-50 disabled:pointer-events-none"
                                >
                                    <Plus size={14} className="mr-1" /> Add Payment
                                </Button>
                            </div>

                            {/* Payment List */}
                            {partialPayments.length > 0 && (
                                <div className="space-y-2">
                                    <Label className="text-xs text-gray-500">Payments Received</Label>
                                    <div className="bg-gray-950 rounded-lg border border-gray-800 p-3 space-y-2 max-h-48 overflow-y-auto">
                                        {partialPayments.map((payment) => (
                                            <div key={payment.id} className="flex items-center justify-between bg-gray-900 rounded p-2.5 text-xs border border-gray-800/50">
                                                <div>
                                                    <div className="text-blue-400 capitalize font-medium">{payment.method}</div>
                                                    {payment.reference && <div className="text-gray-500 text-[10px] mt-0.5">{payment.reference}</div>}
                                                    {payment.attachments && payment.attachments.length > 0 && (
                                                        <div className="text-gray-500 text-[10px] mt-0.5 flex items-center gap-1">
                                                            <Paperclip size={10} />
                                                            {payment.attachments.length} file(s)
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-white font-medium">${payment.amount.toLocaleString()}</span>
                                                    <button
                                                        type="button"
                                                        disabled={!isFinal}
                                                        onClick={() => setPartialPayments(partialPayments.filter(p => p.id !== payment.id))}
                                                        className="text-red-400 hover:text-red-300 p-1 disabled:opacity-50 disabled:pointer-events-none"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

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
                                {saving ? 'Saving...' : 'Save'}
                            </Button>
                            <Button 
                                type="button"
                                className="h-10 bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold shadow-lg shadow-orange-900/20"
                                onClick={() => handleSave(true)}
                                disabled={saving}
                            >
                                <Printer size={15} className="mr-1.5" />
                                {saving ? 'Saving...' : 'Save & Print'}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Packing Modal - Now rendered globally in GlobalDrawer */}

            {/* Add Supplier Modal - REMOVED (using GlobalDrawer contact form instead) */}
        </div>
    );
};