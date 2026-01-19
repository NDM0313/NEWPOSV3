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
  Lock
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
import { PackingEntryModal, PackingDetails } from '../transactions/PackingEntryModal';
import { toast } from "sonner";
import { BranchSelector, currentUser } from '@/app/components/layout/BranchSelector';
import { PurchaseItemsSection } from './PurchaseItemsSection';
import { AddSupplierModal } from './AddSupplierModal';
import { PaymentAttachments, PaymentAttachment } from '../payments/PaymentAttachments';

// Mock Data - Moved to state to allow dynamic updates
const initialSuppliers = [
  { id: 1, name: "Bilal Fabrics", dueBalance: 25000 },
  { id: 2, name: "ChenOne Mills", dueBalance: 0 },
  { id: 3, name: "Sapphire Textiles", dueBalance: 12500 },
  { id: 4, name: "Local Supplier", dueBalance: 5000 },
];

const productsMock = [
    { id: 1, name: "Premium Cotton Fabric", sku: "FAB-001", price: 850, stock: 50, lastPurchasePrice: 720, lastSupplier: "Sapphire Textiles", hasVariations: false, needsPacking: true },
    { id: 2, name: "Lawn Print Floral", sku: "LWN-045", price: 1250, stock: 120, lastPurchasePrice: 980, lastSupplier: "Al-Karam Fabrics", hasVariations: false, needsPacking: true },
    { id: 3, name: "Silk Dupatta", sku: "SLK-022", price: 1800, stock: 35, lastPurchasePrice: 1450, lastSupplier: "Gul Ahmed", hasVariations: true, needsPacking: false },
    { id: 4, name: "Unstitched 3-Pc Suit", sku: "SUIT-103", price: 4500, stock: 18, lastPurchasePrice: 3800, lastSupplier: "Khaadi Suppliers", hasVariations: true, needsPacking: false },
    { id: 5, name: "Chiffon Fabric", sku: "CHF-078", price: 950, stock: 65, lastPurchasePrice: 750, lastSupplier: "Sapphire Textiles", hasVariations: false, needsPacking: true },
];

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

export const PurchaseForm = ({ onClose }: { onClose: () => void }) => {
    // Header State
    const [supplierId, setSupplierId] = useState("");
    const [supplierSearchOpen, setSupplierSearchOpen] = useState(false);
    const [purchaseDate, setPurchaseDate] = useState<Date>(new Date());
    const [refNumber, setRefNumber] = useState("");
    
    // Dynamic suppliers list (starts with initial suppliers)
    const [suppliers, setSuppliers] = useState(initialSuppliers);
    
    // Add Supplier Modal State
    const [addSupplierModalOpen, setAddSupplierModalOpen] = useState(false);
    
    // Branch State
    const [branchId, setBranchId] = useState<string>(currentUser.assignedBranchId.toString());
    
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
    
    // Calculate total after discount and expenses
    const afterDiscountTotal = subtotal - discountAmount + expensesTotal;
    const totalAmount = afterDiscountTotal;
    
    // Automatic Payment Status Detection
    const totalPaid = partialPayments.reduce((sum, p) => sum + p.amount, 0);
    const balanceDue = totalAmount - totalPaid;
    
    // Auto-detect payment status
    const paymentStatus = totalPaid === 0 ? 'credit' : totalPaid >= totalAmount ? 'paid' : 'partial';

    const getSupplierName = () => suppliers.find(s => s.id.toString() === supplierId)?.name || "Select Supplier";

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

    // Packing Handlers - Open with existing data if available (for editing)
    const openPackingModal = (item: PurchaseItem) => {
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

    const filteredProducts = productsMock.filter(p => 
        p.name.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(productSearchTerm.toLowerCase())
    );

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
                            <h2 className="text-sm font-bold text-white">New Purchase Order</h2>
                            <p className="text-[10px] text-gray-500">Standard Entry</p>
                        </div>
                    </div>
                    <BranchSelector branchId={branchId} setBranchId={setBranchId} variant="header" />
                </div>

                {/* Supplier & Invoice Info Row - FIXED ALIGNMENT */}
                <div className="px-6 py-2.5 bg-[#0F1419]">
                    <div className="invoice-container mx-auto w-full">
                        <div className="bg-gray-900/30 border border-gray-800/50 rounded-lg p-3">
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5 items-end">
                                <div className="flex flex-col">
                                    <Label className="text-orange-400 font-medium text-[10px] uppercase tracking-wide h-[14px] mb-1.5">Supplier</Label>
                                <SearchableSelect
                                    value={supplierId}
                                    onValueChange={setSupplierId}
                                    options={suppliers.map(s => ({ id: s.id.toString(), name: s.name, dueBalance: s.dueBalance }))}
                                    placeholder="Select Supplier"
                                    searchPlaceholder="Search supplier..."
                                    icon={<User size={14} className="text-gray-400 shrink-0" />}
                                    enableAddNew={true}
                                    addNewLabel="Add New Supplier"
                                    onAddNew={() => {
                                        setAddSupplierModalOpen(true);
                                    }}
                                    renderOption={(option) => (
                                        <div className="flex items-center justify-between w-full">
                                            <span className="flex-1">{option.name}</span>
                                            {option.dueBalance > 0 && (
                                                <span className="text-xs font-medium px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 ml-2">
                                                    Due: ${option.dueBalance.toLocaleString()}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <CalendarDatePicker
                                    label="Date"
                                    value={purchaseDate}
                                    onChange={(date) => setPurchaseDate(date || new Date())}
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
                                            placeholder="PO-001"
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
                                    <Select value={purchaseStatus} onValueChange={(v: any) => setPurchaseStatus(v)}>
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
                                            <SelectItem value="ordered">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                                                    Ordered
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="received">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                                    Received
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
                        setPackingModalOpen={setPackingModalOpen}
                        setActiveProductName={setActiveProductName}
                        setActivePackingData={setActivePackingData}
                        setActivePackingItemId={setActivePackingItemId}
                        searchInputRef={searchInputRef}
                        qtyInputRef={qtyInputRef}
                        priceInputRef={priceInputRef}
                        addBtnRef={addBtnRef}
                        // Inline variation selection
                        showVariationSelector={showVariationSelector}
                        selectedProductForVariation={selectedProductForVariation}
                        productVariations={productVariations}
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

                            {/* Payment Section */}
                            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 space-y-4 shrink-0">
                                {/* Header with Status Badge */}
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Payment</h3>
                                    <Badge className={cn(
                                    "text-xs font-medium px-3 py-1",
                                    paymentStatus === 'paid' && "bg-green-600 text-white",
                                    paymentStatus === 'partial' && "bg-blue-600 text-white",
                                    paymentStatus === 'credit' && "bg-orange-600 text-white"
                                )}>
                                    {paymentStatus === 'paid' && '✓ Paid'}
                                    {paymentStatus === 'partial' && '◐ Partial'}
                                    {paymentStatus === 'credit' && '○ Credit'}
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
                                        Full
                                    </Button>
                                </div>
                            </div>

                            {/* Add Payment Form */}
                            <div className="space-y-2">
                                <Label className="text-xs text-gray-500">Add Payment</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <Select value={newPaymentMethod} onValueChange={(v: any) => setNewPaymentMethod(v)}>
                                        <SelectTrigger className="h-9 bg-gray-950 border-gray-700 text-white text-xs">
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
                                        value={newPaymentAmount > 0 ? newPaymentAmount : ''}
                                        onChange={(e) => setNewPaymentAmount(parseFloat(e.target.value) || 0)}
                                        className="h-9 bg-gray-950 border-gray-700 text-white text-xs"
                                    />
                                </div>
                                <Input 
                                    placeholder="Reference (optional)"
                                    value={newPaymentReference}
                                    onChange={(e) => setNewPaymentReference(e.target.value)}
                                    className="h-9 bg-gray-950 border-gray-700 text-white text-xs"
                                />
                                <PaymentAttachments
                                    attachments={paymentAttachments}
                                    onAttachmentsChange={setPaymentAttachments}
                                />
                                <Button
                                    onClick={handleAddPayment}
                                    className="w-full h-9 bg-blue-600 hover:bg-blue-500 text-white text-xs"
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
                                                        onClick={() => setPartialPayments(partialPayments.filter(p => p.id !== payment.id))}
                                                        className="text-red-400 hover:text-red-300 p-1"
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
                        
                        {/* Packing Summary - Only show non-zero values */}
                        {items.some(item => item.packingDetails) && (() => {
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
                                onClick={() => toast.success("Purchase order saved!")}
                            >
                                <Save size={15} className="mr-1.5" />
                                Save
                            </Button>
                            <Button 
                                type="button"
                                className="h-10 bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold shadow-lg shadow-orange-900/20"
                                onClick={() => toast.success("Purchase order saved and printing!")}
                            >
                                <Printer size={15} className="mr-1.5" />
                                Save & Print
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Packing Modal */}
            <PackingEntryModal
                open={packingModalOpen}
                onOpenChange={(open) => {
                    setPackingModalOpen(open);
                    if (!open) {
                        setActivePackingItemId(null);
                        setActiveProductName("");
                        setActivePackingData(undefined);
                    }
                }}
                productName={activeProductName}
                onSave={handleSavePacking}
                initialData={activePackingData}
            />

            {/* Add Supplier Modal */}
            <AddSupplierModal
                open={addSupplierModalOpen}
                onClose={() => setAddSupplierModalOpen(false)}
                onSave={(newSupplier) => {
                    setSuppliers(prev => [...prev, newSupplier]);
                    setSupplierId(newSupplier.id.toString());
                    setAddSupplierModalOpen(false);
                }}
            />
        </div>
    );
};