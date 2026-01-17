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
  Sparkles
} from 'lucide-react';
import { cn } from "../ui/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Separator } from "../ui/separator";
import { Badge } from "../ui/badge";
import { CalendarDatePicker } from "../ui/CalendarDatePicker";
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

// Mock Data
const suppliers = [
  { id: 1, name: "Bilal Fabrics" },
  { id: 2, name: "ChenOne Mills" },
  { id: 3, name: "Sapphire Textiles" },
  { id: 4, name: "Local Supplier" },
];

const productsMock = [
    { id: 1, name: "Premium Cotton Fabric", sku: "FAB-001", price: 850, stock: 50, hasVariations: false, needsPacking: true },
    { id: 2, name: "Lawn Print Floral", sku: "LWN-045", price: 1250, stock: 120, hasVariations: false, needsPacking: true },
    { id: 3, name: "Silk Dupatta", sku: "SLK-022", price: 1800, stock: 35, hasVariations: true, needsPacking: false },
    { id: 4, name: "Unstitched 3-Pc Suit", sku: "SUIT-103", price: 4500, stock: 18, hasVariations: true, needsPacking: false },
    { id: 5, name: "Chiffon Fabric", sku: "CHF-078", price: 950, stock: 65, hasVariations: false, needsPacking: true },
];

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
}

interface PartialPayment {
    id: string;
    method: 'cash' | 'bank' | 'other';
    amount: number;
    reference?: string;
    notes?: string;
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
    const [invoiceNumber, setInvoiceNumber] = useState("");
    
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
    // Standard Packing States
    const [pendingThaans, setPendingThaans] = useState<number>(0);
    const [pendingMeters, setPendingMeters] = useState<number>(0);
    
    // Focus Refs
    const searchInputRef = useRef<HTMLInputElement>(null);
    const qtyInputRef = useRef<HTMLInputElement>(null);
    const priceInputRef = useRef<HTMLInputElement>(null);
    const addBtnRef = useRef<HTMLButtonElement>(null);

    // Payment State
    const [partialPayments, setPartialPayments] = useState<PartialPayment[]>([]);
    
    // Payment Form State
    const [newPaymentMethod, setNewPaymentMethod] = useState<'cash' | 'bank' | 'other'>('cash');
    const [newPaymentAmount, setNewPaymentAmount] = useState<number>(0);
    const [newPaymentReference, setNewPaymentReference] = useState<string>("");

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
            case 'draft': return {
                color: 'var(--color-text-tertiary)',
                backgroundColor: 'rgba(17, 24, 39, 0.5)',
                borderColor: 'var(--color-border-secondary)'
            };
            case 'ordered': return {
                color: 'rgba(234, 179, 8, 1)',
                backgroundColor: 'rgba(234, 179, 8, 0.2)',
                borderColor: 'rgba(234, 179, 8, 0.5)'
            };
            case 'received': return {
                color: 'var(--color-primary)',
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                borderColor: 'rgba(59, 130, 246, 0.5)'
            };
            case 'final': return {
                color: 'var(--color-success)',
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                borderColor: 'rgba(16, 185, 129, 0.5)'
            };
            default: return {
                color: 'var(--color-text-tertiary)',
                backgroundColor: 'rgba(17, 24, 39, 0.5)',
                borderColor: 'var(--color-border-secondary)'
            };
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

    // 1. Select Product -> Move to Qty
    const handleSelectProduct = (product: any) => {
        setPendingProduct(product);
        setPendingPrice(product.price);
        setPendingQty(1);
        setProductSearchOpen(false);
        setProductSearchTerm("");
        
        // Reset variations and packing
        setPendingSize("");
        setPendingColor("");
        setPendingThaans(0);
        setPendingMeters(0);
        
        setTimeout(() => qtyInputRef.current?.focus(), 100);
    };

    // 2. Add to List
    const handleAddItem = () => {
        if (!pendingProduct || pendingQty <= 0 || pendingPrice <= 0) {
            toast.error("Please fill all required fields");
            return;
        }

        const newItem: PurchaseItem = {
            id: Date.now(),
            productId: pendingProduct.id,
            name: pendingProduct.name,
            sku: pendingProduct.sku,
            price: pendingPrice,
            qty: pendingQty,
            // Add variation if provided
            size: pendingSize || undefined,
            color: pendingColor || undefined,
            // Add packing if provided
            thaans: pendingThaans > 0 ? pendingThaans : undefined,
            meters: pendingMeters > 0 ? pendingMeters : undefined,
        };

        setItems([...items, newItem]);

        // Reset
        setPendingProduct(null);
        setPendingQty(1);
        setPendingPrice(0);
        setPendingSize("");
        setPendingColor("");
        setPendingThaans(0);
        setPendingMeters(0);
        setProductSearchTerm("");

        toast.success("Item added!");
        setTimeout(() => searchInputRef.current?.focus(), 100);
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
        };

        setPartialPayments([...partialPayments, payment]);
        setNewPaymentAmount(0);
        setNewPaymentReference("");
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

    // Packing Modal Handlers
    const handleOpenPackingModal = (itemId: number) => {
        const item = items.find(i => i.id === itemId);
        if (item) {
            setActivePackingItemId(itemId);
            setActiveProductName(item.name);
            setActivePackingData(item.packingDetails);
            setPackingModalOpen(true);
        }
    };

    const handleSavePackingDetails = (details: PackingDetails) => {
        if (activePackingItemId) {
            setItems(items.map(item => 
                item.id === activePackingItemId 
                    ? { ...item, packingDetails: details }
                    : item
            ));
            toast.success("Packing details saved!");
        }
        setPackingModalOpen(false);
        setActivePackingItemId(null);
        setActiveProductName("");
        setActivePackingData(undefined);
    };

    const filteredProducts = productsMock.filter(p => 
        p.name.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(productSearchTerm.toLowerCase())
    );

    return (
        <div 
          className="flex flex-col h-full overflow-hidden"
          style={{ backgroundColor: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}
        >
            {/* 1. Top Header */}
            <div 
              className="h-16 shrink-0 border-b flex items-center justify-between px-6 z-20"
              style={{
                backgroundColor: 'var(--color-bg-panel)',
                borderBottomColor: 'var(--color-border-primary)'
              }}
            >
                <div className="flex items-center gap-4">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={onClose}
                      style={{ color: 'var(--color-text-secondary)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--color-text-primary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--color-text-secondary)';
                      }}
                    >
                        <X size={20} />
                    </Button>
                    <div>
                        <h2 
                          className="text-lg font-bold"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          New Purchase Order
                        </h2>
                        <div 
                          className="flex items-center gap-2 text-xs"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                            <span>Standard Entry</span>
                            <span 
                              className="w-1 h-1 rounded-full"
                              style={{ backgroundColor: 'var(--color-text-disabled)' }}
                            />
                            <span>{items.length} Items</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {/* Global Branch Selector */}
                    <BranchSelector branchId={branchId} setBranchId={setBranchId} variant="header" />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* 2. Supplier & Info Section */}
                <div 
                  className="border rounded-xl p-5"
                  style={{
                    backgroundColor: 'rgba(17, 24, 39, 0.5)',
                    borderColor: 'var(--color-border-primary)',
                    borderRadius: 'var(--radius-xl)'
                  }}
                >
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                            <div className="space-y-1.5">
                                <Label 
                                  className="font-medium text-xs uppercase tracking-wide"
                                  style={{ color: 'var(--color-warning)' }}
                                >
                                  Supplier
                                </Label>
                                <Popover open={supplierSearchOpen} onOpenChange={setSupplierSearchOpen}>
                                    <PopoverTrigger asChild>
                                        <Button 
                                          variant="outline" 
                                          role="combobox" 
                                          className="w-full justify-between h-10"
                                          style={{
                                            backgroundColor: 'var(--color-bg-tertiary)',
                                            borderColor: 'var(--color-border-secondary)',
                                            color: 'var(--color-text-primary)'
                                          }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
                                          }}
                                        >
                                            <div className="flex items-center gap-2 truncate">
                                                <User 
                                                  size={14} 
                                                  className="shrink-0"
                                                  style={{ color: 'var(--color-text-secondary)' }}
                                                />
                                                <span className="truncate text-sm">{getSupplierName()}</span>
                                            </div>
                                            <ChevronsUpDown className="ml-2 h-3 w-3 opacity-50 shrink-0" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent 
                                      className="w-[300px] p-0"
                                      style={{
                                        backgroundColor: 'var(--color-bg-tertiary)',
                                        borderColor: 'var(--color-border-primary)',
                                        color: 'var(--color-text-primary)'
                                      }}
                                    >
                                        <Command 
                                          style={{
                                            backgroundColor: 'var(--color-bg-tertiary)',
                                            color: 'var(--color-text-primary)'
                                          }}
                                        >
                                            <CommandInput placeholder="Search supplier..." className="h-9" />
                                            <CommandList>
                                                <CommandEmpty>No supplier found.</CommandEmpty>
                                                <CommandGroup>
                                                    {suppliers.map((s) => (
                                                        <CommandItem
                                                            key={s.id}
                                                            value={s.name}
                                                            onSelect={() => {
                                                                setSupplierId(s.id.toString());
                                                                setSupplierSearchOpen(false);
                                                            }}
                                                            style={{
                                                              color: 'var(--color-text-primary)'
                                                            }}
                                                            onMouseEnter={(e) => {
                                                              e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                              e.currentTarget.style.backgroundColor = 'transparent';
                                                            }}
                                                            className="cursor-pointer"
                                                        >
                                                            {s.name}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
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

                            <div className="space-y-1.5">
                                <Label 
                                  className="font-medium text-xs uppercase tracking-wide"
                                  style={{ color: 'var(--color-text-tertiary)' }}
                                >
                                  Ref #
                                </Label>
                                <Input 
                                    placeholder="PO-001"
                                    value={refNumber}
                                    onChange={(e) => setRefNumber(e.target.value)}
                                    className="h-10"
                                    style={{
                                      backgroundColor: 'var(--color-bg-tertiary)',
                                      borderColor: 'var(--color-border-secondary)',
                                      color: 'var(--color-text-primary)'
                                    }}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label 
                                  className="font-medium text-xs uppercase tracking-wide"
                                  style={{ color: 'var(--color-text-tertiary)' }}
                                >
                                  Invoice #
                                </Label>
                                <Input 
                                    placeholder="INV-001"
                                    value={invoiceNumber}
                                    onChange={(e) => setInvoiceNumber(e.target.value)}
                                    className="h-10"
                                    style={{
                                      backgroundColor: 'var(--color-bg-tertiary)',
                                      borderColor: 'var(--color-border-secondary)',
                                      color: 'var(--color-text-primary)'
                                    }}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label 
                                  className="font-medium text-xs uppercase tracking-wide"
                                  style={{ color: 'rgba(6, 182, 212, 1)' }}
                                >
                                  Status
                                </Label>
                                <Select value={purchaseStatus} onValueChange={(v: any) => setPurchaseStatus(v)}>
                                    <SelectTrigger 
                                      className="h-10 border"
                                      style={getStatusColor()}
                                    >
                                        <div className="flex items-center gap-2">
                                            {getStatusIcon()}
                                            <SelectValue />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent 
                                      style={{
                                        backgroundColor: 'var(--color-bg-tertiary)',
                                        borderColor: 'var(--color-border-primary)',
                                        color: 'var(--color-text-primary)'
                                      }}
                                    >
                                        <SelectItem value="draft">
                                            <div className="flex items-center gap-2">
                                                <span 
                                                  className="w-2 h-2 rounded-full"
                                                  style={{ backgroundColor: 'var(--color-text-tertiary)' }}
                                                />
                                                Draft
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="ordered">
                                            <div className="flex items-center gap-2">
                                                <span 
                                                  className="w-2 h-2 rounded-full"
                                                  style={{ backgroundColor: 'rgba(234, 179, 8, 1)' }}
                                                />
                                                Ordered
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="received">
                                            <div className="flex items-center gap-2">
                                                <span 
                                                  className="w-2 h-2 rounded-full"
                                                  style={{ backgroundColor: 'var(--color-primary)' }}
                                                />
                                                Received
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="final">
                                            <div className="flex items-center gap-2">
                                                <span 
                                                  className="w-2 h-2 rounded-full"
                                                  style={{ backgroundColor: 'var(--color-success)' }}
                                                />
                                                Final
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* 3. Items Table Section */}
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
                        handleAddItem={handleAddItem}
                        handleOpenPackingModal={handleOpenPackingModal}
                        setPackingModalOpen={setPackingModalOpen}
                        setActiveProductName={setActiveProductName}
                        setActivePackingData={setActivePackingData}
                        setActivePackingItemId={setActivePackingItemId}
                        searchInputRef={searchInputRef}
                        qtyInputRef={qtyInputRef}
                        priceInputRef={priceInputRef}
                        addBtnRef={addBtnRef}
                    />

                    {/* 4. Summary & Payment Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Left Column - Summary */}
                        <div className="space-y-4">
                            {/* Summary Card */}
                            <div 
                              className="border rounded-lg p-4"
                              style={{
                                background: 'linear-gradient(to bottom right, rgba(17, 24, 39, 0.8), rgba(17, 24, 39, 0.5))',
                                borderColor: 'var(--color-border-primary)',
                                borderRadius: 'var(--radius-lg)'
                              }}
                            >
                                <h3 
                                  className="text-xs font-semibold uppercase tracking-wide mb-3"
                                  style={{ color: 'var(--color-text-secondary)' }}
                                >
                                  Purchase Summary
                                </h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span style={{ color: 'var(--color-text-secondary)' }}>
                                          Items Subtotal
                                        </span>
                                        <span 
                                          className="font-medium"
                                          style={{ color: 'var(--color-text-primary)' }}
                                        >
                                          ${subtotal.toLocaleString()}
                                        </span>
                                    </div>
                                    
                                    {/* Discount - Inline Input */}
                                    <div className="flex items-center justify-between gap-2 py-1">
                                        <div className="flex items-center gap-1.5">
                                            <Percent 
                                              size={12}
                                              style={{ color: 'var(--color-error)' }}
                                            />
                                            <span 
                                              className="text-xs"
                                              style={{ color: 'var(--color-text-secondary)' }}
                                            >
                                              Discount
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Select value={discountType} onValueChange={(v: any) => setDiscountType(v)}>
                                                <SelectTrigger 
                                                  className="w-12 h-6 text-[10px] px-1"
                                                  style={{
                                                    backgroundColor: 'var(--color-bg-tertiary)',
                                                    borderColor: 'var(--color-border-secondary)',
                                                    color: 'var(--color-text-primary)'
                                                  }}
                                                >
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent 
                                                  className="min-w-[60px]"
                                                  style={{
                                                    backgroundColor: 'var(--color-bg-tertiary)',
                                                    borderColor: 'var(--color-border-primary)',
                                                    color: 'var(--color-text-primary)'
                                                  }}
                                                >
                                                    <SelectItem value="percentage">%</SelectItem>
                                                    <SelectItem value="fixed">$</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Input 
                                                type="number" 
                                                placeholder="0"
                                                className="w-16 h-6 text-xs text-right px-2"
                                                value={discountValue > 0 ? discountValue : ''}
                                                onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                                                style={{
                                                  backgroundColor: 'var(--color-bg-tertiary)',
                                                  borderColor: 'var(--color-border-secondary)',
                                                  color: 'var(--color-text-primary)'
                                                }}
                                            />
                                            {discountAmount > 0 && (
                                                <span 
                                                  className="text-xs font-medium min-w-[60px] text-right"
                                                  style={{ color: 'var(--color-error)' }}
                                                >
                                                  -${discountAmount.toLocaleString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {expensesTotal > 0 && (
                                        <div className="flex justify-between text-xs">
                                            <span style={{ color: 'var(--color-wholesale)' }}>
                                              Extra Expenses
                                            </span>
                                            <span 
                                              className="font-medium"
                                              style={{ color: 'var(--color-wholesale)' }}
                                            >
                                              +${expensesTotal.toLocaleString()}
                                            </span>
                                        </div>
                                    )}
                                    
                                    <Separator 
                                      style={{ backgroundColor: 'var(--color-bg-card)' }}
                                    />
                                    
                                    <div className="flex justify-between items-center pt-1">
                                        <span 
                                          className="text-sm font-semibold"
                                          style={{ color: 'var(--color-text-primary)' }}
                                        >
                                          Grand Total
                                        </span>
                                        <span 
                                          className="text-2xl font-bold"
                                          style={{ color: 'var(--color-warning)' }}
                                        >
                                          ${totalAmount.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Extra Expenses Card */}
                            <div 
                              className="border rounded-lg p-4 space-y-3"
                              style={{
                                backgroundColor: 'rgba(17, 24, 39, 0.5)',
                                borderColor: 'var(--color-border-primary)',
                                borderRadius: 'var(--radius-lg)'
                              }}
                            >
                                <h3 
                                  className="text-xs font-semibold uppercase tracking-wide"
                                  style={{ color: 'var(--color-text-secondary)' }}
                                >
                                  Extra Expenses
                                </h3>
                                
                                {/* Add Expense Form */}
                                <div className="grid grid-cols-3 gap-2">
                                    <Select value={newExpenseType} onValueChange={(v: any) => setNewExpenseType(v)}>
                                        <SelectTrigger 
                                          className="h-9 text-xs"
                                          style={{
                                            backgroundColor: 'var(--color-bg-tertiary)',
                                            borderColor: 'var(--color-border-secondary)',
                                            color: 'var(--color-text-primary)'
                                          }}
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent 
                                          style={{
                                            backgroundColor: 'var(--color-bg-tertiary)',
                                            borderColor: 'var(--color-border-primary)',
                                            color: 'var(--color-text-primary)'
                                          }}
                                        >
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
                                        className="h-9 text-xs"
                                        style={{
                                          backgroundColor: 'var(--color-bg-tertiary)',
                                          borderColor: 'var(--color-border-secondary)',
                                          color: 'var(--color-text-primary)'
                                        }}
                                    />
                                    <Button
                                        onClick={handleAddExpense}
                                        size="sm"
                                        className="h-9 text-xs"
                                        style={{
                                          backgroundColor: 'var(--color-wholesale)',
                                          color: 'var(--color-text-primary)'
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.backgroundColor = 'rgba(126, 34, 206, 1)'; // purple-500
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.backgroundColor = 'var(--color-wholesale)';
                                        }}
                                    >
                                        <Plus size={14} className="mr-1" /> Add
                                    </Button>
                                </div>

                                {/* Expense List */}
                                {extraExpenses.length > 0 && (
                                    <div className="space-y-2 max-h-32 overflow-y-auto">
                                        {extraExpenses.map((exp) => (
                                            <div 
                                              key={exp.id} 
                                              className="flex items-center justify-between rounded p-2 text-xs"
                                              style={{
                                                backgroundColor: 'var(--color-bg-tertiary)',
                                                borderRadius: 'var(--radius-md)'
                                              }}
                                            >
                                                <span 
                                                  className="capitalize"
                                                  style={{ color: 'var(--color-wholesale)' }}
                                                >
                                                  {exp.type}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <span 
                                                      className="font-medium"
                                                      style={{ color: 'var(--color-text-primary)' }}
                                                    >
                                                      ${exp.amount}
                                                    </span>
                                                    <button
                                                        onClick={() => setExtraExpenses(extraExpenses.filter(e => e.id !== exp.id))}
                                                        style={{ color: 'var(--color-error)' }}
                                                        onMouseEnter={(e) => {
                                                          e.currentTarget.style.color = 'rgba(248, 113, 113, 1)'; // red-300
                                                        }}
                                                        onMouseLeave={(e) => {
                                                          e.currentTarget.style.color = 'var(--color-error)';
                                                        }}
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Column - Payment */}
                        <div 
                          className="border rounded-lg p-4 space-y-4"
                          style={{
                            backgroundColor: 'rgba(17, 24, 39, 0.5)',
                            borderColor: 'var(--color-border-primary)',
                            borderRadius: 'var(--radius-lg)'
                          }}
                        >
                            {/* Auto Status Badge */}
                            <div className="flex items-center justify-between">
                                <h3 
                                  className="text-sm font-semibold uppercase tracking-wide"
                                  style={{ color: 'var(--color-text-secondary)' }}
                                >
                                  Payment
                                </h3>
                                <Badge 
                                  className="text-xs font-medium px-3 py-1"
                                  style={
                                    paymentStatus === 'paid' 
                                      ? {
                                          backgroundColor: 'var(--color-success)',
                                          color: 'var(--color-text-primary)'
                                        }
                                      : paymentStatus === 'partial'
                                      ? {
                                          backgroundColor: 'var(--color-primary)',
                                          color: 'var(--color-text-primary)'
                                        }
                                      : {
                                          backgroundColor: 'var(--color-warning)',
                                          color: 'var(--color-text-primary)'
                                        }
                                  }
                                >
                                    {paymentStatus === 'paid' && '✓ Paid'}
                                    {paymentStatus === 'partial' && '◐ Partial'}
                                    {paymentStatus === 'credit' && '○ Credit'}
                                </Badge>
                            </div>

                            {/* Invoice Amount Display */}
                            <div 
                              className="border rounded-lg p-4"
                              style={{
                                backgroundColor: 'var(--color-bg-tertiary)',
                                borderColor: 'var(--color-border-primary)',
                                borderRadius: 'var(--radius-lg)'
                              }}
                            >
                                <div className="flex items-center justify-between">
                                    <span 
                                      className="text-xs uppercase tracking-wide"
                                      style={{ color: 'var(--color-text-tertiary)' }}
                                    >
                                      Purchase Amount
                                    </span>
                                    <span 
                                      className="text-2xl font-bold"
                                      style={{ color: 'var(--color-text-primary)' }}
                                    >
                                      ${totalAmount.toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            {/* Quick Payment Buttons */}
                            <div className="space-y-2">
                                <Label 
                                  className="text-xs"
                                  style={{ color: 'var(--color-text-tertiary)' }}
                                >
                                  Quick Pay
                                </Label>
                                <div className="grid grid-cols-4 gap-2">
                                    <Button 
                                        type="button"
                                        onClick={() => setNewPaymentAmount(totalAmount * 0.25)}
                                        className="h-9 text-xs border"
                                        style={{
                                          backgroundColor: 'var(--color-bg-card)',
                                          borderColor: 'var(--color-border-secondary)',
                                          color: 'var(--color-text-primary)'
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
                                        }}
                                    >
                                        25%
                                    </Button>
                                    <Button 
                                        type="button"
                                        onClick={() => setNewPaymentAmount(totalAmount * 0.50)}
                                        className="h-9 text-xs border"
                                        style={{
                                          backgroundColor: 'var(--color-bg-card)',
                                          borderColor: 'var(--color-border-secondary)',
                                          color: 'var(--color-text-primary)'
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
                                        }}
                                    >
                                        50%
                                    </Button>
                                    <Button 
                                        type="button"
                                        onClick={() => setNewPaymentAmount(totalAmount * 0.75)}
                                        className="h-9 text-xs border"
                                        style={{
                                          backgroundColor: 'var(--color-bg-card)',
                                          borderColor: 'var(--color-border-secondary)',
                                          color: 'var(--color-text-primary)'
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
                                        }}
                                    >
                                        75%
                                    </Button>
                                    <Button 
                                        type="button"
                                        onClick={() => setNewPaymentAmount(totalAmount)}
                                        className="h-9 text-xs border"
                                        style={{
                                          backgroundColor: 'var(--color-bg-card)',
                                          borderColor: 'var(--color-border-secondary)',
                                          color: 'var(--color-text-primary)'
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
                                        }}
                                    >
                                        Full
                                    </Button>
                                </div>
                            </div>

                            {/* Add Payment Form */}
                            <div className="space-y-2">
                                <Label 
                                  className="text-xs"
                                  style={{ color: 'var(--color-text-tertiary)' }}
                                >
                                  Add Payment
                                </Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <Select value={newPaymentMethod} onValueChange={(v: any) => setNewPaymentMethod(v)}>
                                        <SelectTrigger 
                                          className="h-9 text-xs"
                                          style={{
                                            backgroundColor: 'var(--color-bg-tertiary)',
                                            borderColor: 'var(--color-border-secondary)',
                                            color: 'var(--color-text-primary)'
                                          }}
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent 
                                          style={{
                                            backgroundColor: 'var(--color-bg-tertiary)',
                                            borderColor: 'var(--color-border-primary)',
                                            color: 'var(--color-text-primary)'
                                          }}
                                        >
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
                                        className="h-9 text-xs"
                                        style={{
                                          backgroundColor: 'var(--color-bg-tertiary)',
                                          borderColor: 'var(--color-border-secondary)',
                                          color: 'var(--color-text-primary)'
                                        }}
                                    />
                                </div>
                                <Input 
                                    placeholder="Reference (optional)"
                                    value={newPaymentReference}
                                    onChange={(e) => setNewPaymentReference(e.target.value)}
                                    className="h-9 text-xs"
                                    style={{
                                      backgroundColor: 'var(--color-bg-tertiary)',
                                      borderColor: 'var(--color-border-secondary)',
                                      color: 'var(--color-text-primary)'
                                    }}
                                />
                                <Button
                                    onClick={handleAddPayment}
                                    className="w-full h-9 text-xs"
                                    style={{
                                      backgroundColor: 'var(--color-primary)',
                                      color: 'var(--color-text-primary)'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 1)'; // blue-500
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                                    }}
                                >
                                    <Plus size={14} className="mr-1" /> Add Payment
                                </Button>
                            </div>

                            {/* Payment List */}
                            {partialPayments.length > 0 && (
                                <div className="space-y-2">
                                    <Label 
                                      className="text-xs"
                                      style={{ color: 'var(--color-text-tertiary)' }}
                                    >
                                      Payments Received
                                    </Label>
                                    <div className="space-y-2 max-h-40 overflow-y-auto">
                                        {partialPayments.map((payment) => (
                                            <div 
                                              key={payment.id} 
                                              className="flex items-center justify-between rounded p-2 text-xs"
                                              style={{
                                                backgroundColor: 'var(--color-bg-tertiary)',
                                                borderRadius: 'var(--radius-md)'
                                              }}
                                            >
                                                <div>
                                                    <div 
                                                      className="capitalize"
                                                      style={{ color: 'var(--color-primary)' }}
                                                    >
                                                      {payment.method}
                                                    </div>
                                                    {payment.reference && (
                                                      <div 
                                                        className="text-[10px]"
                                                        style={{ color: 'var(--color-text-tertiary)' }}
                                                      >
                                                        {payment.reference}
                                                      </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span 
                                                      className="font-medium"
                                                      style={{ color: 'var(--color-text-primary)' }}
                                                    >
                                                      ${payment.amount.toLocaleString()}
                                                    </span>
                                                    <button
                                                        onClick={() => setPartialPayments(partialPayments.filter(p => p.id !== payment.id))}
                                                        style={{ color: 'var(--color-error)' }}
                                                        onMouseEnter={(e) => {
                                                          e.currentTarget.style.color = 'rgba(248, 113, 113, 1)'; // red-300
                                                        }}
                                                        onMouseLeave={(e) => {
                                                          e.currentTarget.style.color = 'var(--color-error)';
                                                        }}
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Balance Due */}
                            <Separator 
                              style={{ backgroundColor: 'var(--color-bg-card)' }}
                            />
                            <div className="flex justify-between items-center">
                                <span 
                                  className="text-sm font-semibold"
                                  style={{ color: 'var(--color-text-secondary)' }}
                                >
                                  Balance Due
                                </span>
                                <span 
                                  className="text-xl font-bold"
                                  style={{
                                    color: balanceDue === 0 
                                      ? 'var(--color-success)' 
                                      : balanceDue < totalAmount 
                                      ? 'var(--color-primary)' 
                                      : 'var(--color-warning)'
                                  }}
                                >
                                  ${balanceDue.toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

            {/* Footer Actions */}
            <div 
              className="h-16 shrink-0 border-t flex items-center justify-between px-6"
              style={{
                backgroundColor: 'var(--color-bg-panel)',
                borderTopColor: 'var(--color-border-primary)'
              }}
            >
                <div 
                  className="flex items-center gap-3 text-xs"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                    <span>{items.length} Items</span>
                    <span 
                      className="w-1 h-1 rounded-full"
                      style={{ backgroundColor: 'var(--color-text-disabled)' }}
                    />
                    <span>Total: ${totalAmount.toLocaleString()}</span>
                    <span 
                      className="w-1 h-1 rounded-full"
                      style={{ backgroundColor: 'var(--color-text-disabled)' }}
                    />
                    <span className="capitalize">{paymentStatus}</span>
                </div>
                <div className="flex items-center gap-3">
                    <Button 
                      variant="outline" 
                      onClick={onClose}
                      className="h-10"
                      style={{
                        borderColor: 'var(--color-border-secondary)',
                        color: 'var(--color-text-secondary)'
                      }}
                    >
                        Cancel
                    </Button>
                    <Button 
                        className="h-10 gap-2"
                        onClick={() => toast.success("Purchase order saved!")}
                        style={{
                          backgroundColor: 'var(--color-warning)',
                          color: 'var(--color-text-primary)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(249, 115, 22, 1)'; // orange-500
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--color-warning)';
                        }}
                    >
                        <Save size={16} />
                        Save Purchase
                    </Button>
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
                onSave={handleSavePackingDetails}
                initialData={activePackingData}
            />
        </div>
    );
};
