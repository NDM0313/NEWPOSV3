import React, { useState, useRef, useEffect } from 'react';
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
  Edit
} from 'lucide-react';
import { format } from "date-fns";
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
import { PackingEntryModal, PackingDetails } from '../transactions/PackingEntryModal';
import { toast } from "sonner";
import { BranchSelector, currentUser } from '@/app/components/layout/BranchSelector';
import { SaleItemsSection } from './SaleItemsSection';
import { PaymentAttachments, PaymentAttachment } from '../payments/PaymentAttachments';
import { useSupabase } from '@/app/context/SupabaseContext';
import { contactService } from '@/app/services/contactService';
import { productService } from '@/app/services/productService';
import { useSales } from '@/app/context/SalesContext';
import { useNavigation } from '@/app/context/NavigationContext';
import { Loader2 } from 'lucide-react';

// Mock variations for products that have them
const productVariations: Record<number, Array<{ size: string; color: string }>> = {
    3: [ // Silk Dupatta
        { size: "S", color: "Red" },
        { size: "S", color: "Blue" },
        { size: "M", color: "Red" },
        { size: "M", color: "Blue" },
        { size: "M", color: "Green" },
        { size: "L", color: "Red" },
        { size: "L", color: "Blue" },
        { size: "L", color: "Green" },
    ],
    4: [ // Unstitched 3-Pc Suit
        { size: "S", color: "Beige" },
        { size: "M", color: "Beige" },
        { size: "M", color: "Cream" },
        { size: "L", color: "Beige" },
        { size: "L", color: "Cream" },
        { size: "XL", color: "Beige" },
        { size: "XL", color: "Cream" },
        { size: "XL", color: "White" },
    ],
};

interface SaleItem {
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
    const { companyId, branchId: contextBranchId, user, userRole } = useSupabase();
    const { createSale } = useSales();
    const { openDrawer, closeDrawer, activeDrawer, createdContactId, createdContactType, setCreatedContactId } = useNavigation();
    
    // TASK 4 FIX - Check if user is admin
    const isAdmin = userRole === 'admin' || userRole === 'Admin';
    
    // Data State
    const [customers, setCustomers] = useState<Array<{ id: number | string; name: string; dueBalance: number }>>([]);
    const [products, setProducts] = useState<Array<{ id: number | string; name: string; sku: string; price: number; stock: number; lastPurchasePrice?: number; lastSupplier?: string; hasVariations: boolean; needsPacking: boolean }>>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Mock salesmen (can be enhanced later to fetch from contacts with type='worker' or separate table)
    const salesmen = [
        { id: 1, name: "No Salesman" },
        { id: 2, name: "Ali Hassan" },
        { id: 3, name: "Muhammad Bilal" },
        { id: 4, name: "Sara Khan" },
    ];
    
    // Header State
    const [customerId, setCustomerId] = useState("");
    const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
    const [saleDate, setSaleDate] = useState<Date>(new Date());
    const [refNumber, setRefNumber] = useState("");
    const [invoiceNumber, setInvoiceNumber] = useState("");
    
    // Branch State - Locked for regular users, open for admin
    const [branchId, setBranchId] = useState<string>(contextBranchId || '');
    
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
    const [newPaymentMethod, setNewPaymentMethod] = useState<'cash' | 'bank' | 'other'>('cash');
    const [newPaymentAmount, setNewPaymentAmount] = useState<number>(0);
    const [newPaymentReference, setNewPaymentReference] = useState<string>("");
    
    // Payment Attachments State
    const [paymentAttachments, setPaymentAttachments] = useState<PaymentAttachment[]>([]);

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

    // Packing Modal State
    const [packingModalOpen, setPackingModalOpen] = useState(false);
    const [activePackingItemId, setActivePackingItemId] = useState<number | null>(null);
    const [activeProductName, setActiveProductName] = useState("");
    const [activePackingData, setActivePackingData] = useState<PackingDetails | undefined>(undefined);

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

    // Filtered products for search
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
                
                // Load customers (contacts with type='customer')
                const contactsData = await contactService.getAllContacts(companyId);
                const customerContacts = contactsData
                    .filter(c => c.type === 'customer' || c.type === 'both')
                    .map(c => ({
                        id: c.id || c.uuid || '',
                        name: c.name || '',
                        dueBalance: c.receivables || 0
                    }));
                
                // Add walk-in customer option
                setCustomers([
                    { id: 'walk-in', name: "Walk-in Customer", dueBalance: 0 },
                    ...customerContacts
                ]);
                
                // CRITICAL FIX: Load products with calculated stock from movements
                // Instead of using products.current_stock, calculate from stock_movements
                const productsData = await productService.getAllProducts(companyId);
                
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
                    
                    return {
                      id: p.id || p.uuid || '',
                      name: p.name || '',
                      sku: p.sku || '',
                      price: p.salePrice || p.price || 0,
                      stock: calculatedStock, // This will show actual stock or current_stock, not forced 0
                      lastPurchasePrice: p.costPrice || undefined,
                      lastSupplier: undefined, // Can be enhanced later
                      hasVariations: (p.variations && p.variations.length > 0) || false,
                      needsPacking: false // Can be enhanced based on product type
                    };
                  })
                );
                
                setProducts(productsList);
            } catch (error) {
                console.error('[SALE FORM] Error loading data:', error);
                toast.error('Failed to load data');
            } finally {
                setLoading(false);
            }
        };
        
        loadData();
    }, [companyId]);

    // Reload customers when contact drawer closes (in case a new contact was added)
    useEffect(() => {
        const reloadCustomers = async () => {
            // Only reload when:
            // 1. Contact drawer was just closed (activeDrawer changed from 'addContact' to 'none')
            // 2. AND a contact was actually created (createdContactId is not null)
            // 3. AND the contact type is relevant (customer or both)
            // This prevents unnecessary reloads when other drawers close or when supplier/worker is created
            if (activeDrawer === 'none' && companyId && createdContactId !== null && 
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
                    console.log('[SALE FORM] Reloading customers, createdContactId:', contactIdToSelect, 'Type:', contactTypeToSelect);
                    
                    // Small delay to ensure DB commit
                    await new Promise(resolve => setTimeout(resolve, 200));
                    
                    const contactsData = await contactService.getAllContacts(companyId);
                    const customerContacts = contactsData
                        .filter(c => c.type === 'customer' || c.type === 'both')
                        .map(c => ({
                            id: c.id || c.uuid || '',
                            name: c.name || '',
                            dueBalance: c.receivables || 0
                        }));
                    
                    console.log('[SALE FORM] Reloaded customers:', customerContacts.length, 'IDs:', customerContacts.map(c => c.id));
                    
                    setCustomers([
                        { id: 'walk-in', name: "Walk-in Customer", dueBalance: 0 },
                        ...customerContacts
                    ]);
                    
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
                        // Force state update and component remount for UI refresh
                        setCustomerId('');
                        // Use setTimeout to ensure state update happens
                        setTimeout(() => {
                            setCustomerId(selectedId);
                            toast.success(`Customer "${foundContact.name}" selected`);
                            console.log('[SALE FORM] ✅ Auto-selected customer:', selectedId, foundContact.name);
                        }, 50);
                    } else {
                        console.warn('[SALE FORM] ❌ Could not find created contact:', contactIdStr, 'Available IDs:', customerContacts.map(c => c.id));
                        // Try one more time after a longer delay (DB might need more time)
                        setTimeout(async () => {
                            const retryData = await contactService.getAllContacts(companyId);
                            const retryContacts = retryData
                                .filter(c => c.type === 'customer' || c.type === 'both')
                                .map(c => ({
                                    id: c.id || c.uuid || '',
                                    name: c.name || '',
                                    dueBalance: c.receivables || 0
                                }));
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
                                // Force state update
                                setCustomerId('');
                                setTimeout(() => {
                                    setCustomerId(retrySelectedId);
                                    toast.success(`Customer "${retryFound.name}" selected`);
                                    console.log('[SALE FORM] ✅ Retry successful - Auto-selected customer');
                                }, 50);
                            }
                        }, 1000);
                    }
                } catch (error) {
                    console.error('[SALE FORM] Error reloading customers:', error);
                }
            } else if (activeDrawer === 'none' && createdContactId !== null && 
                       (createdContactType === 'supplier' || createdContactType === 'worker')) {
                // Clear the ID if supplier/worker was created (no reload needed)
                if (setCreatedContactId) {
                    setCreatedContactId(null, null);
                }
            }
        };
        
        reloadCustomers();
    }, [activeDrawer, companyId, createdContactId, createdContactType, setCreatedContactId]);

    // Pre-populate form when editing (TASK 3 FIX)
    useEffect(() => {
        if (initialSale) {
            // Pre-fill header fields
            setCustomerId(initialSale.customer || '');
            setSaleDate(initialSale.date ? new Date(initialSale.date) : new Date());
            setInvoiceNumber(initialSale.invoiceNo || '');
            setRefNumber('');
            
            // Pre-fill items
            if (initialSale.items && initialSale.items.length > 0) {
                const convertedItems: SaleItem[] = initialSale.items.map((item: any, index: number) => ({
                    id: Date.now() + index, // Generate unique ID
                    productId: item.productId || '',
                    name: item.productName || '',
                    sku: item.sku || '',
                    price: item.price || 0,
                    qty: item.quantity || 0,
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
            if (initialSale.paid > 0) {
                setPartialPayments([{
                    id: '1',
                    method: (initialSale.paymentMethod || 'cash') as 'cash' | 'bank' | 'other',
                    amount: initialSale.paid,
                    reference: '',
                    attachments: []
                }]);
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

    const getStatusIcon = () => {
        switch(saleStatus) {
            case 'draft': return <FileText size={14} />;
            case 'quotation': return <FileText size={14} />;
            case 'order': return <ShoppingBag size={14} />;
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
    const updateItem = (id: number, field: keyof SaleItem, value: number) => {
        setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const removeItem = (id: number) => {
        setItems(prev => prev.filter(item => item.id !== id));
    };

    // Packing Handlers - Open with existing data if available (for editing)
    const openPackingModal = (item: SaleItem) => {
        setActivePackingItemId(item.id);
        setActiveProductName(item.name);
        setActivePackingData(item.packingDetails); // Pre-fill with existing data if editing
        setPackingModalOpen(true);
    };

    const handleOpenPackingModalById = (itemId: number) => {
        const item = items.find(i => i.id === itemId);
        if (item) {
            openPackingModal(item);
        }
    };

    const handleSavePacking = (details: PackingDetails) => {
        if (activePackingItemId !== null) {
            // Update existing item
            setItems(prev => prev.map(item => {
                if (item.id === activePackingItemId) {
                    return { 
                        ...item, 
                        packingDetails: details,
                        qty: details.total_meters, // Auto-update quantity based on meters
                        thaans: details.total_boxes,
                        meters: details.total_meters
                    };
                }
                return item;
            }));
            toast.success("Packing details saved");
        }
        setPackingModalOpen(false);
    };

    // Payment Handlers
    const addPartialPayment = () => {
        if (newPaymentAmount <= 0) return;
        
        setPartialPayments(prev => [...prev, {
            id: Date.now().toString(),
            method: newPaymentMethod,
            amount: newPaymentAmount,
            reference: newPaymentReference,
            attachments: paymentAttachments
        }]);
        setNewPaymentAmount(0); // Reset input
        setNewPaymentReference("");
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
        
        if (items.length === 0) {
            toast.error('Please add at least one item');
            return;
        }
        
        try {
            setSaving(true);
            
            const selectedCustomer = customers.find(c => c.id.toString() === customerId);
            const customerName = selectedCustomer?.name || 'Walk-in Customer';
            const customerUuid = customerId === 'walk-in' ? undefined : customerId.toString();
            
            // CRITICAL FIX: Convert items to SaleItem format with variationId
            // Need to find variation_id from size/color if product has variations
            const saleItems = await Promise.all(
              items.map(async (item) => {
                let variationId: string | undefined = undefined;
                
                // If product has variations and size/color are set, find the variation_id
                if (item.size || item.color) {
                  try {
                    // Get product variations from database
                    const product = await productService.getProduct(item.productId.toString());
                    if (product && product.variations && product.variations.length > 0) {
                      // Find matching variation by size and color
                      const matchingVariation = product.variations.find((v: any) => {
                        const vSize = v.size || v.attributes?.size;
                        const vColor = v.color || v.attributes?.color;
                        return vSize === item.size && vColor === item.color;
                      });
                      if (matchingVariation) {
                        variationId = matchingVariation.id;
                      }
                    }
                  } catch (variationError) {
                    console.warn(`[SALE FORM] Could not find variation for item ${item.id}:`, variationError);
                    // Continue without variation_id
                  }
                }
                
                return {
                  id: item.id.toString(),
                  productId: item.productId.toString(),
                  productName: item.name,
                  sku: item.sku,
                  quantity: item.qty,
                  price: item.price,
                  discount: 0, // Can be enhanced later
                  tax: 0, // Can be enhanced later
                  total: item.price * item.qty,
                  variationId: variationId, // CRITICAL FIX: Include variationId
                  // Include packing data if available
                  packingDetails: item.packingDetails,
                  thaans: item.thaans,
                  meters: item.meters
                };
              })
            );
            
            // CRITICAL FIX: Map sale status correctly
            // Draft → status: 'draft', type: 'quotation'
            // Quotation → status: 'quotation', type: 'quotation'
            // Final → status: 'final', type: 'invoice'
            const saleType: 'invoice' | 'quotation' = saleStatus === 'final' ? 'invoice' : 'quotation';
            const mappedStatus: 'draft' | 'quotation' | 'final' = saleStatus === 'final' ? 'final' : saleStatus;
            
            // CRITICAL FIX: For draft/quotation, force payment to 0 and payment_status to 'unpaid'
            // Payment should only be allowed for final sales
            const finalPaid = (saleStatus === 'final') ? totalPaid : 0;
            const finalDue = (saleStatus === 'final') ? balanceDue : totalAmount;
            const finalPaymentStatus: 'paid' | 'partial' | 'unpaid' = (saleStatus === 'final') 
                ? paymentStatus 
                : 'unpaid';
            
            // Create sale data
            const saleData = {
                type: saleType,
                status: mappedStatus,
                customer: customerUuid || '',
                customerName: customerName,
                contactNumber: '', // Can be enhanced to get from customer
                date: format(saleDate, 'yyyy-MM-dd'),
                location: branchId || '',
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
                notes: studioNotes || refNumber || undefined
            };
            
            // Create sale via context
            await createSale(saleData);
            
            toast.success(`${saleType === 'invoice' ? 'Invoice' : 'Quotation'} created successfully!`);
            
            if (print) {
                // TODO: Implement print functionality
                toast.info('Print functionality coming soon');
            }
            
            // Close form
            onClose();
        } catch (error: any) {
            console.error('[SALE FORM] Error saving sale:', error);
            toast.error(`Failed to save sale: ${error.message || 'Unknown error'}`);
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
                {/* Top Bar */}
                <div className="h-12 flex items-center justify-between px-6 border-b border-gray-800/50">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-400 hover:text-white h-8 w-8">
                            <X size={18} />
                        </Button>
                        <div>
                            <h2 className="text-sm font-bold text-white">New Sale Invoice</h2>
                            <p className="text-[10px] text-gray-500">Standard Entry</p>
                        </div>
                    </div>
                    <BranchSelector branchId={branchId} setBranchId={setBranchId} variant="header" />
                </div>

                {/* Customer & Invoice Info Row - FIXED ALIGNMENT */}
                <div className="px-6 py-2.5 bg-[#0F1419]">
                    <div className="invoice-container mx-auto w-full">
                        <div className="bg-gray-900/30 border border-gray-800/50 rounded-lg p-3">
                            <div className="grid grid-cols-1 md:grid-cols-8 gap-2.5 items-end">
                                <div className="md:col-span-2 flex flex-col">
                                    <Label className="text-blue-400 font-medium text-[10px] uppercase tracking-wide h-[14px] mb-1.5">Customer</Label>
                                <SearchableSelect
                                    key={`customer-select-${customerId}-${customers.length}`}
                                    value={customerId}
                                    onValueChange={setCustomerId}
                                    options={customers.map(c => ({ id: c.id.toString(), name: c.name, dueBalance: c.dueBalance }))}
                                    placeholder="Select Customer"
                                    searchPlaceholder="Search customer..."
                                    icon={<User size={14} className="text-gray-400 shrink-0" />}
                                    badgeColor="red"
                                    enableAddNew={true}
                                    addNewLabel="Add New Customer"
                                    onAddNew={(searchText) => {
                                        // Open Add Contact drawer with Customer role pre-selected and search text prefilled
                                        console.log('[SALE FORM] Opening Add Contact drawer, searchText:', searchText);
                                        openDrawer('addContact', 'addSale', { 
                                            contactType: 'customer',
                                            prefillName: searchText || undefined
                                        });
                                    }}
                                    renderOption={(option) => (
                                        <div className="flex items-center justify-between w-full">
                                            <span className="flex-1">{option.name}</span>
                                            {option.dueBalance > 0 && (
                                                <span className="text-xs font-medium px-2 py-0.5 rounded bg-red-500/20 text-red-400 ml-2">
                                                    Due: ${option.dueBalance.toLocaleString()}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                />
                            </div>

                            <div className="flex flex-col">
                                <div className="h-[14px] mb-1.5"></div>
                                <CalendarDatePicker
                                    label="Date"
                                    value={saleDate}
                                    onChange={(date) => setSaleDate(date || new Date())}
                                    showTime={true}
                                    required
                                />
                            </div>

                            <div className="flex flex-col">
                                <Label className="text-gray-500 font-medium text-xs uppercase tracking-wide h-[14px] mb-1.5">Ref#</Label>
                                <div className="relative">
                                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={14} />
                                    <Input 
                                        value={refNumber}
                                        onChange={(e) => setRefNumber(e.target.value)}
                                        className="pl-9 bg-gray-950 border-gray-700 h-10 text-sm"
                                        placeholder="SO-001"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col">
                                <Label className="text-cyan-500 font-medium text-xs uppercase tracking-wide h-[14px] mb-1.5">Invoice#</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-500" size={14} />
                                    <Input 
                                        value="INV-001"
                                        readOnly
                                        disabled
                                        className="pl-9 bg-gray-950/50 border-cyan-500/30 text-cyan-400 h-10 text-sm cursor-not-allowed font-mono"
                                        placeholder="INV-001"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col">
                                <Label className="text-cyan-500 font-medium text-xs uppercase tracking-wide h-[14px] mb-1.5">Status</Label>
                                <Select value={saleStatus} onValueChange={(v: any) => setSaleStatus(v)}>
                                    <SelectTrigger className={`h-10 border ${getStatusColor()}`}>
                                        <div className="flex items-center gap-2">
                                            {getStatusIcon()}
                                            <SelectValue />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent className="bg-gray-950 border-gray-800 text-white">
                                        <SelectItem value="draft">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                                                Draft
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="quotation">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                                                Quotation
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="order">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                                Order
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="final">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                                Final
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex flex-col">
                                <Label className="text-green-500 font-medium text-xs uppercase tracking-wide h-[14px] mb-1.5">
                                    Salesman {!isAdmin && <span className="text-xs text-gray-500">(Auto-assigned)</span>}
                                </Label>
                                <Select 
                                    value={salesmanId} 
                                    onValueChange={setSalesmanId}
                                    disabled={!isAdmin} // TASK 4 FIX - Disable for non-admin users
                                >
                                    <SelectTrigger className={`bg-gray-950 border-gray-700 text-white h-10 ${!isAdmin ? 'opacity-60 cursor-not-allowed' : ''}`}>
                                        <div className="flex items-center gap-2">
                                            <UserCheck size={14} className="text-gray-400 shrink-0" />
                                            <span className="truncate text-sm">{getSalesmanName()}</span>
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent className="bg-gray-950 border-gray-800 text-white">
                                        {salesmen.map(s => (
                                            <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex flex-col">
                                <Label className={`font-medium text-xs uppercase tracking-wide h-[14px] mb-1.5 ${isStudioSale ? 'text-purple-500' : 'text-gray-500'}`}>
                                    Type {isStudioSale && <Badge className="ml-1 bg-purple-600 text-white text-[8px] px-1 py-0">ST</Badge>}
                                </Label>
                                <div className="flex gap-1">
                                    <Select 
                                        value={isStudioSale ? 'studio' : 'regular'} 
                                        onValueChange={(v) => {
                                            setIsStudioSale(v === 'studio');
                                            if (v === 'studio') setShippingEnabled(false);
                                        }}
                                    >
                                        <SelectTrigger className={`bg-gray-950 h-10 flex-1 ${ 
                                            isStudioSale 
                                                ? 'border-purple-500/50 text-purple-400' 
                                                : 'border-gray-700 text-white'
                                        }`}>
                                            <div className="flex items-center gap-2">
                                                {isStudioSale ? <Palette size={14} /> : <ShoppingBag size={14} />}
                                                <SelectValue />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent className="bg-gray-950 border-gray-800 text-white">
                                            <SelectItem value="regular">Regular</SelectItem>
                                            <SelectItem value="studio">Studio</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {!isStudioSale && (
                                        <button
                                            onClick={() => setShippingEnabled(!shippingEnabled)}
                                            className={`w-10 h-10 rounded-lg transition-all flex items-center justify-center shrink-0 ${ 
                                                shippingEnabled
                                                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                                    : 'bg-gray-800 text-gray-500 border border-gray-700 hover:bg-gray-750'
                                            }`}
                                            title="Shipping"
                                        >
                                            <Truck size={14} />
                                        </button>
                                    )}
                                </div>
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
                    setPackingModalOpen={setPackingModalOpen}
                    setActiveProductName={setActiveProductName}
                    setActivePackingData={setActivePackingData}
                    setActivePackingItemId={setActivePackingItemId}
                    searchInputRef={searchInputRef}
                    qtyInputRef={qtyInputRef}
                    priceInputRef={priceInputRef}
                    addBtnRef={addBtnRef}
                    showVariationSelector={showVariationSelector}
                    selectedProductForVariation={selectedProductForVariation}
                    productVariations={productVariations}
                    handleVariationSelect={handleVariationSelect}
                    setShowVariationSelector={setShowVariationSelector}
                    setSelectedProductForVariation={setSelectedProductForVariation}
                    handleInlineVariationSelect={handleInlineVariationSelect}
                    updateItem={updateItem}
                    itemQtyRefs={itemQtyRefs}
                    itemPriceRefs={itemPriceRefs}
                    itemVariationRefs={itemVariationRefs}
                    handleQtyKeyDown={handleQtyKeyDown}
                    handlePriceKeyDown={handlePriceKeyDown}
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
                                    <Badge className="bg-purple-600 text-white text-xs px-2 py-0.5">
                                        ${expensesTotal.toLocaleString()}
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
                                            <SelectItem value="other">Other</SelectItem>
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
                                                    <span className="text-xs font-medium text-white">${expense.amount.toLocaleString()}</span>
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
                                        <span className="text-blue-400 font-medium">+${finalShippingCharges.toLocaleString()}</span>
                                    </div>
                                )}
                                
                                <Separator className="bg-gray-800" />
                                
                                <div className="flex justify-between items-center pt-1">
                                    <span className="text-sm font-semibold text-white">Grand Total</span>
                                    <span className="text-2xl font-bold text-blue-500">${totalAmount.toLocaleString()}</span>
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
                                                            <SelectItem value="fixed">$</SelectItem>
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
                                                    Commission: ${commissionAmount.toLocaleString()}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                                </div>
                            </div>

                            {/* Payment Section - DISABLED for Draft/Quotation, ENABLED for Final */}
                            <div className={cn(
                                "bg-gray-900/50 border border-gray-800 rounded-lg p-4 shrink-0",
                                (saleStatus === 'draft' || saleStatus === 'quotation') && "opacity-50 pointer-events-none"
                            )}>
                                {/* Header with Status Badge */}
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
                                        Payment
                                        {(saleStatus === 'draft' || saleStatus === 'quotation') && (
                                            <span className="ml-2 text-xs text-yellow-500">(Disabled for {saleStatus})</span>
                                        )}
                                    </h3>
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
                                {/* Invoice Amount */}
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-500 uppercase tracking-wide">Invoice Amount</span>
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
                                        ${Math.max(0, balanceDue).toLocaleString()}
                                    </span>
                                </div>
                                </div>

                                {/* Quick Payment Buttons & Payment Entry - DISABLED for Draft/Quotation */}
                                {saleStatus === 'final' ? (
                                    <>
                                        <div className="space-y-2">
                                            <Label className="text-xs text-gray-500">Quick Pay</Label>
                                            <div className="grid grid-cols-4 gap-2">
                                                <Button 
                                                    type="button"
                                                    onClick={() => setNewPaymentAmount(totalAmount * 0.25)}
                                                    className="h-9 bg-gray-800 hover:bg-gray-700 text-white text-xs border border-gray-700"
                                                >
                                                    25%
                                                </Button>
                                                <Button 
                                                    type="button"
                                                    onClick={() => setNewPaymentAmount(totalAmount * 0.50)}
                                                    className="h-9 bg-gray-800 hover:bg-gray-700 text-white text-xs border border-gray-700"
                                                >
                                                    50%
                                                </Button>
                                                <Button 
                                                    type="button"
                                                    onClick={() => setNewPaymentAmount(totalAmount * 0.75)}
                                                    className="h-9 bg-gray-800 hover:bg-gray-700 text-white text-xs border border-gray-700"
                                                >
                                                    75%
                                                </Button>
                                                <Button 
                                                    type="button"
                                                    onClick={() => setNewPaymentAmount(totalAmount)}
                                                    className="h-9 bg-green-700 hover:bg-green-600 text-white text-xs border border-green-600"
                                                >
                                                    100%
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Payment Entry Form */}
                                        <div className="space-y-2">
                                            <Label className="text-xs text-gray-500">Add Payment</Label>
                                            <div className="flex gap-2">
                                                <Select value={newPaymentMethod} onValueChange={(v: any) => setNewPaymentMethod(v)}>
                                                    <SelectTrigger className="w-[110px] bg-gray-950 border-gray-700 text-white h-10 text-xs">
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
                                                    className="bg-gray-950 border-gray-700 text-white h-10 flex-1"
                                                    value={newPaymentAmount > 0 ? newPaymentAmount : ''}
                                                    onChange={(e) => setNewPaymentAmount(parseFloat(e.target.value) || 0)}
                                                />
                                                <Button onClick={addPartialPayment} className="bg-blue-600 hover:bg-blue-500 h-10 w-10 p-0" >
                                                    <Plus size={16} />
                                                </Button>
                                            </div>
                                            <Input 
                                                type="text" 
                                                placeholder="Reference (optional)" 
                                                className="bg-gray-950 border-gray-700 text-white h-9 text-xs"
                                                value={newPaymentReference}
                                                onChange={(e) => setNewPaymentReference(e.target.value)}
                                            />
                                            <PaymentAttachments
                                                attachments={paymentAttachments}
                                                onAttachmentsChange={setPaymentAttachments}
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center py-4 text-xs text-gray-500">
                                        Payment section is disabled for {saleStatus === 'draft' ? 'Draft' : 'Quotation'} sales.
                                        <br />
                                        Change status to "Final" to enable payment.
                                    </div>
                                )}

                                {/* Payments List - Show for all statuses */}
                                <div className="bg-gray-950 rounded-lg border border-gray-800 p-3 space-y-2 min-h-[100px] mt-4">
                                    {partialPayments.length === 0 ? (
                                        <div className="text-center text-gray-600 text-xs py-4">No payments added</div>
                                    ) : (
                                        partialPayments.map((p) => (
                                            <div key={p.id} className="flex justify-between items-center text-sm p-2 bg-gray-900 rounded border border-gray-800/50">
                                                <div className="flex items-center gap-2">
                                                    {p.method === 'cash' && <Banknote size={14} className="text-green-500" />}
                                                    {p.method === 'bank' && <CreditCard size={14} className="text-blue-500" />}
                                                    {p.method === 'other' && <Wallet size={14} className="text-purple-500" />}
                                                    <span className="capitalize text-gray-300 text-xs">{p.method}</span>
                                                    {p.reference && <span className="text-gray-500 text-xs">({p.reference})</span>}
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="font-medium text-white">${p.amount.toLocaleString()}</span>
                                                    <button onClick={() => removePartialPayment(p.id)} className="text-gray-500 hover:text-red-400">
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ============ LAYER 3: FIXED FOOTER ============ */}
            <div className="shrink-0 bg-[#0B1019] border-t border-gray-800">
                {/* Totals Summary Row */}
                <div className="h-10 flex items-center justify-between px-6 border-b border-gray-800/50 bg-gray-950/30">
                    <div className="flex items-center gap-2.5 text-[11px] text-gray-400">
                        {/* Items Count */}
                        <span className="font-medium">{items.length} Items</span>
                        <span className="w-0.5 h-0.5 rounded-full bg-gray-600" />
                        
                        {/* Total Quantity */}
                        <span>Qty: <span className="font-semibold text-white">{items.reduce((sum, item) => sum + item.qty, 0).toLocaleString()}</span></span>
                        
                        {/* Packing Summary - Only show non-zero values */}
                        {items.some(item => item.packingDetails) && (() => {
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
                        <span className="text-xs font-bold text-green-400">Total: ${totalAmount.toLocaleString()}</span>
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
                                className="h-10 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold shadow-lg shadow-blue-900/20"
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

            {/* Hidden - Old Footer (Replaced by Sticky Action Bar) */}
            <div className="hidden h-16 shrink-0 bg-[#0B1019] border-t border-gray-800 flex items-center justify-between px-6">
                <div className="flex items-center gap-3 text-xs text-gray-400">
                    {/* Items Count */}
                    <span>{items.length} Items</span>
                    <span className="w-1 h-1 rounded-full bg-gray-600" />
                    
                    {/* Total Quantity */}
                    <span>Qty: {items.reduce((sum, item) => sum + item.qty, 0).toLocaleString()}</span>
                    
                    {/* Packing Summary - Only show if at least one item has packing */}
                    {items.some(item => item.packingDetails) && (
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
                    <span>Total: ${totalAmount.toLocaleString()}</span>
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

            {/* Packing Modal */}
            <PackingEntryModal 
                open={packingModalOpen}
                onOpenChange={setPackingModalOpen}
                onSave={handleSavePacking}
                initialData={activePackingData}
                productName={activeProductName}
            />
        </div>
    );
};