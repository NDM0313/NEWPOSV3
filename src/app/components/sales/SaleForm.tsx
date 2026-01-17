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
  Lock
} from 'lucide-react';
import { format } from "date-fns";
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

// Mock Data
const customers = [
  { id: 1, name: "Walk-in Customer" },
  { id: 2, name: "Ahmed Khan" },
  { id: 3, name: "Fatima Ali" },
  { id: 4, name: "Bilal Textiles Ltd" },
];

const salesmen = [
  { id: 1, name: "No Salesman" },
  { id: 2, name: "Ali Hassan" },
  { id: 3, name: "Muhammad Bilal" },
  { id: 4, name: "Sara Khan" },
];

const productsMock = [
    { id: 1, name: "Premium Cotton Fabric", sku: "FAB-001", price: 850, stock: 50, hasVariations: false, needsPacking: true },
    { id: 2, name: "Lawn Print Floral", sku: "LWN-045", price: 1250, stock: 120, hasVariations: false, needsPacking: true },
    { id: 3, name: "Silk Dupatta", sku: "SLK-022", price: 1800, stock: 35, hasVariations: true, needsPacking: false },
    { id: 4, name: "Unstitched 3-Pc Suit", sku: "SUIT-103", price: 4500, stock: 18, hasVariations: true, needsPacking: false },
    { id: 5, name: "Chiffon Fabric", sku: "CHF-078", price: 950, stock: 65, hasVariations: false, needsPacking: true },
];

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
    type: 'stitching' | 'lining' | 'dying' | 'cargo' | 'other';
    amount: number;
    notes?: string;
}

export const SaleForm = ({ onClose }: { onClose: () => void }) => {
    // Header State
    const [customerId, setCustomerId] = useState("");
    const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
    const [saleDate, setSaleDate] = useState<Date>(new Date());
    const [refNumber, setRefNumber] = useState("");
    const [invoiceNumber, setInvoiceNumber] = useState("");
    
    // Branch State - Locked for regular users, open for admin
    const [branchId, setBranchId] = useState<string>(currentUser.assignedBranchId.toString());
    
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
    const [newExpenseType, setNewExpenseType] = useState<'stitching' | 'lining' | 'dying' | 'cargo' | 'other'>('stitching');
    const [newExpenseAmount, setNewExpenseAmount] = useState<number>(0);
    const [newExpenseNotes, setNewExpenseNotes] = useState<string>("");

    // Discount State
    const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
    const [discountValue, setDiscountValue] = useState<number>(0);

    // Salesman State (moved to header)
    const [salesmanId, setSalesmanId] = useState<string>("1"); // Default to "No Salesman"
    const [commissionType, setCommissionType] = useState<'percentage' | 'fixed'>('percentage');
    const [commissionValue, setCommissionValue] = useState<number>(0);

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
    const paymentStatus = totalPaid === 0 ? 'credit' : totalPaid >= totalAmount ? 'paid' : 'partial';

    const getSalesmanName = () => salesmen.find(s => s.id.toString() === salesmanId)?.name || "No Salesman";

    // Status helper functions
    const getStatusColor = () => {
        switch(saleStatus) {
            case 'draft': return {
                color: 'var(--color-text-tertiary)',
                backgroundColor: 'rgba(17, 24, 39, 0.5)',
                borderColor: 'var(--color-border-secondary)'
            };
            case 'quotation': return {
                color: 'rgba(234, 179, 8, 1)',
                backgroundColor: 'rgba(234, 179, 8, 0.2)',
                borderColor: 'rgba(234, 179, 8, 0.5)'
            };
            case 'order': return {
                color: 'var(--color-primary)',
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                borderColor: 'rgba(59, 130, 246, 0.5)'
            };
            case 'final': return {
                color: 'var(--color-success)',
                backgroundColor: 'rgba(34, 197, 94, 0.2)',
                borderColor: 'rgba(34, 197, 94, 0.5)'
            };
            default: return {
                color: 'var(--color-text-tertiary)',
                backgroundColor: 'rgba(17, 24, 39, 0.5)',
                borderColor: 'var(--color-border-secondary)'
            };
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

    // 1. Select Product -> Move to Qty
    const handleSelectProduct = (product: any) => {
        setPendingProduct(product);
        setPendingPrice(product.price);
        setPendingQty(1);
        setProductSearchTerm(product.name);
        setProductSearchOpen(false);
        
        // Focus Qty Input after a short delay to allow UI update
        setTimeout(() => {
            qtyInputRef.current?.focus();
            qtyInputRef.current?.select();
        }, 50);
    };

    // 2. Clear Pending Row (Reset to Search)
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

    // 3. Add to List -> Loop back to Search
    const commitPendingItem = () => {
        if (!pendingProduct) {
            toast.error("Please select a product first");
            searchInputRef.current?.focus();
            return;
        }
        if (pendingQty <= 0) {
            toast.error("Quantity must be greater than 0");
            qtyInputRef.current?.focus();
            return;
        }

        const newItem: SaleItem = {
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

        setItems(prev => {
            return [newItem, ...prev]; 
        });

        toast.success("Item added");
        resetEntryRow();
    };

    // Keyboard Navigation in Entry Row
    const handleQtyKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            priceInputRef.current?.focus();
            priceInputRef.current?.select();
        }
    };

    const handlePriceKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            commitPendingItem();
        }
    };

    // Items List Handlers
    const updateItem = (id: number, field: keyof SaleItem, value: number) => {
        setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const removeItem = (id: number) => {
        setItems(prev => prev.filter(item => item.id !== id));
    };

    // Packing Handlers
    const openPackingModal = (item: SaleItem) => {
        setActivePackingItemId(item.id);
        setActiveProductName(item.name);
        setActivePackingData(item.packingDetails);
        setPackingModalOpen(true);
    };

    const handleSavePacking = (details: PackingDetails) => {
        if (activePackingItemId !== null) {
            setItems(prev => prev.map(item => {
                if (item.id === activePackingItemId) {
                    return { 
                        ...item, 
                        packingDetails: details,
                        qty: details.total_meters // Auto-update quantity based on meters
                    };
                }
                return item;
            }));
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
            reference: newPaymentReference
        }]);
        setNewPaymentAmount(0); // Reset input
        setNewPaymentReference("");
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

    return (
        <div 
          className="flex flex-col h-full overflow-hidden"
          style={{
            backgroundColor: 'var(--color-bg-primary)',
            color: 'var(--color-text-primary)'
          }}
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
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-text-primary)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
                    >
                        <X size={20} />
                    </Button>
                    <div>
                        <h2 
                          className="text-lg font-bold"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          New Sale Invoice
                        </h2>
                        <div 
                          className="flex items-center gap-2 text-xs"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                            <span>Standard Entry</span>
                            <span 
                              className="w-1 h-1 rounded-full"
                              style={{ backgroundColor: 'var(--color-border-secondary)' }}
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
                
                {/* 2. Customer & Info Section (Compact - 7 Columns Single Row) */}
                <div 
                  className="border rounded-xl p-5"
                  style={{
                    backgroundColor: 'rgba(17, 24, 39, 0.5)',
                    borderColor: 'var(--color-border-primary)',
                    borderRadius: 'var(--radius-xl)'
                  }}
                >
                    <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                            <div className="space-y-1.5">
                                <Label 
                                  className="font-medium text-xs uppercase tracking-wide"
                                  style={{ color: 'var(--color-primary)' }}
                                >
                                  Customer
                                </Label>
                                <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
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
                                                <span className="truncate text-sm">{getCustomerName()}</span>
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
                                            <CommandInput placeholder="Search customer..." className="h-9" />
                                            <CommandList>
                                                <CommandEmpty>No customer found.</CommandEmpty>
                                                <CommandGroup>
                                                    {customers.map((c) => (
                                                        <CommandItem
                                                            key={c.id}
                                                            value={c.name}
                                                            onSelect={() => {
                                                                setCustomerId(c.id.toString());
                                                                setCustomerSearchOpen(false);
                                                            }}
                                                            className="cursor-pointer"
                                                            style={{ color: 'var(--color-text-primary)' }}
                                                            onMouseEnter={(e) => {
                                                              e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                              e.currentTarget.style.backgroundColor = 'transparent';
                                                            }}
                                                        >
                                                            <Check className={cn("mr-2 h-4 w-4", customerId === c.id.toString() ? "opacity-100" : "opacity-0")} />
                                                            {c.name}
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
                                    value={saleDate}
                                    onChange={(date) => setSaleDate(date || new Date())}
                                    showTime={true}
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label 
                                  className="font-medium text-xs uppercase tracking-wide"
                                  style={{ color: 'var(--color-text-tertiary)' }}
                                >
                                  Ref#
                                </Label>
                                <div className="relative">
                                    <FileText 
                                      className="absolute left-3 top-1/2 -translate-y-1/2" 
                                      size={14}
                                      style={{ color: 'var(--color-text-disabled)' }}
                                    />
                                    <Input 
                                        value={refNumber}
                                        onChange={(e) => setRefNumber(e.target.value)}
                                        className="pl-9 h-10 text-sm"
                                        style={{
                                          backgroundColor: 'var(--color-bg-tertiary)',
                                          borderColor: 'var(--color-border-secondary)',
                                          color: 'var(--color-text-primary)'
                                        }}
                                        placeholder="SO-001"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label 
                                  className="font-medium text-xs uppercase tracking-wide"
                                  style={{ color: 'var(--color-text-tertiary)' }}
                                >
                                  Invoice#
                                </Label>
                                <div className="relative">
                                    <FileText 
                                      className="absolute left-3 top-1/2 -translate-y-1/2" 
                                      size={14}
                                      style={{ color: 'var(--color-text-disabled)' }}
                                    />
                                    <Input 
                                        value={invoiceNumber}
                                        onChange={(e) => setInvoiceNumber(e.target.value)}
                                        className="pl-9 h-10 text-sm"
                                        style={{
                                          backgroundColor: 'var(--color-bg-tertiary)',
                                          borderColor: 'var(--color-border-secondary)',
                                          color: 'var(--color-text-primary)'
                                        }}
                                        placeholder="INV-001"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label 
                                  className="font-medium text-xs uppercase tracking-wide"
                                  style={{ color: 'rgba(6, 182, 212, 1)' }}
                                >
                                  Status
                                </Label>
                                <Select value={saleStatus} onValueChange={(v: any) => setSaleStatus(v)}>
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
                                                ></span>
                                                Draft
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="quotation">
                                            <div className="flex items-center gap-2">
                                                <span 
                                                  className="w-2 h-2 rounded-full"
                                                  style={{ backgroundColor: 'rgba(234, 179, 8, 1)' }}
                                                ></span>
                                                Quotation
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="order">
                                            <div className="flex items-center gap-2">
                                                <span 
                                                  className="w-2 h-2 rounded-full"
                                                  style={{ backgroundColor: 'var(--color-primary)' }}
                                                ></span>
                                                Order
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="final">
                                            <div className="flex items-center gap-2">
                                                <span 
                                                  className="w-2 h-2 rounded-full"
                                                  style={{ backgroundColor: 'var(--color-success)' }}
                                                ></span>
                                                Final
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label 
                                  className="font-medium text-xs uppercase tracking-wide"
                                  style={{ color: 'var(--color-success)' }}
                                >
                                  Salesman
                                </Label>
                                <Select value={salesmanId} onValueChange={setSalesmanId}>
                                    <SelectTrigger 
                                      className="h-10"
                                      style={{
                                        backgroundColor: 'var(--color-bg-tertiary)',
                                        borderColor: 'var(--color-border-secondary)',
                                        color: 'var(--color-text-primary)'
                                      }}
                                    >
                                        <div className="flex items-center gap-2">
                                            <UserCheck 
                                              size={14} 
                                              className="shrink-0"
                                              style={{ color: 'var(--color-text-secondary)' }}
                                            />
                                            <span className="truncate text-sm">{getSalesmanName()}</span>
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent 
                                      style={{
                                        backgroundColor: 'var(--color-bg-tertiary)',
                                        borderColor: 'var(--color-border-primary)',
                                        color: 'var(--color-text-primary)'
                                      }}
                                    >
                                        {salesmen.map(s => (
                                            <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label 
                                  className="font-medium text-xs uppercase tracking-wide"
                                  style={{ 
                                    color: isStudioSale ? 'var(--color-wholesale)' : 'var(--color-text-tertiary)' 
                                  }}
                                >
                                    Type {isStudioSale && (
                                      <Badge 
                                        className="ml-1 text-[8px] px-1 py-0"
                                        style={{
                                          backgroundColor: 'var(--color-wholesale)',
                                          color: 'var(--color-text-primary)'
                                        }}
                                      >
                                        ST
                                      </Badge>
                                    )}
                                </Label>
                                <div className="flex gap-1">
                                    <Select 
                                        value={isStudioSale ? 'studio' : 'regular'} 
                                        onValueChange={(v) => {
                                            setIsStudioSale(v === 'studio');
                                            if (v === 'studio') setShippingEnabled(false);
                                        }}
                                    >
                                        <SelectTrigger 
                                          className="h-10 flex-1"
                                          style={{
                                            backgroundColor: 'var(--color-bg-tertiary)',
                                            borderColor: isStudioSale 
                                              ? 'rgba(147, 51, 234, 0.5)' 
                                              : 'var(--color-border-secondary)',
                                            color: isStudioSale 
                                              ? 'var(--color-wholesale)' 
                                              : 'var(--color-text-primary)'
                                          }}
                                        >
                                            <div className="flex items-center gap-2">
                                                {isStudioSale ? <Palette size={14} /> : <ShoppingBag size={14} />}
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
                                            <SelectItem value="regular">Regular</SelectItem>
                                            <SelectItem value="studio">Studio</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {!isStudioSale && (
                                        <button
                                            onClick={() => setShippingEnabled(!shippingEnabled)}
                                            className="w-10 h-10 rounded-lg transition-all flex items-center justify-center shrink-0"
                                            style={shippingEnabled ? {
                                              backgroundColor: 'rgba(59, 130, 246, 0.2)',
                                              color: 'var(--color-primary)',
                                              borderColor: 'rgba(59, 130, 246, 0.3)',
                                              borderRadius: 'var(--radius-lg)'
                                            } : {
                                              backgroundColor: 'var(--color-bg-card)',
                                              color: 'var(--color-text-tertiary)',
                                              borderColor: 'var(--color-border-secondary)',
                                              borderRadius: 'var(--radius-lg)'
                                            }}
                                            onMouseEnter={(e) => {
                                              if (!shippingEnabled) {
                                                e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                                              }
                                            }}
                                            onMouseLeave={(e) => {
                                              if (!shippingEnabled) {
                                                e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
                                              }
                                            }}
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
                            <div 
                              className="border rounded-lg p-2 flex items-center gap-2 flex-wrap"
                              style={{
                                backgroundColor: 'rgba(147, 51, 234, 0.05)',
                                borderColor: 'rgba(147, 51, 234, 0.2)',
                                borderRadius: 'var(--radius-lg)'
                              }}
                            >
                                <div 
                                  className="flex items-center gap-1.5 text-xs"
                                  style={{ color: 'var(--color-wholesale)' }}
                                >
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
                                    className="flex-1 min-w-[150px] h-7 text-xs"
                                    style={{
                                      backgroundColor: 'var(--color-bg-tertiary)',
                                      borderColor: 'rgba(147, 51, 234, 0.3)',
                                      color: 'var(--color-text-primary)',
                                      '::placeholder': { color: 'rgba(196, 181, 253, 0.3)' }
                                    }}
                                />
                            </div>
                        )}

                {/* 3. Items Entry - REDESIGNED COMPACT */}
                <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 
                                  className="text-sm font-semibold uppercase tracking-wide flex items-center gap-2"
                                  style={{ color: 'var(--color-text-secondary)' }}
                                >
                                    <ShoppingBag 
                                      size={16}
                                      style={{ color: 'var(--color-primary)' }}
                                    />
                                    Items Entry
                                </h3>
                                <div 
                                  className="text-xs"
                                  style={{ color: 'var(--color-text-tertiary)' }}
                                >
                                    <span className="flex items-center gap-1">
                                      <span 
                                        className="px-1.5 py-0.5 rounded text-[10px]"
                                        style={{
                                          backgroundColor: 'var(--color-bg-card)',
                                          borderColor: 'var(--color-border-secondary)',
                                          borderRadius: 'var(--radius-sm)',
                                          color: 'var(--color-text-primary)'
                                        }}
                                      >
                                        Enter
                                      </span> to add
                                    </span>
                                </div>
                            </div>
                            
                            {/* The "Entry Stage" Card - MODERN INLINE FLOW */}
                            <div 
                              className="border rounded-xl overflow-hidden shadow-lg"
                              style={{
                                backgroundColor: 'var(--color-bg-panel)',
                                borderColor: 'rgba(59, 130, 246, 0.3)', // border-blue-500/30
                                borderRadius: 'var(--radius-xl)',
                                boxShadow: 'var(--shadow-blue-glow)'
                              }}
                            >
                                <div className="flex items-stretch">
                                    {/* Blue accent bar */}
                                    <div 
                                      className="w-1 flex-shrink-0"
                                      style={{ backgroundColor: 'var(--color-primary)' }}
                                    />
                                    
                                    <div className="flex-1 p-4">
                                        <div className="flex flex-col lg:flex-row gap-3 items-stretch">
                                            {/* 1. Find Product - Always Visible */}
                                            <div className="flex-1 min-w-[250px]">
                                                <Label 
                                                  className="text-xs mb-1.5 block font-semibold"
                                                  style={{ color: 'var(--color-primary)' }}
                                                >
                                                  Find Product
                                                </Label>
                                                <Popover open={productSearchOpen} onOpenChange={setProductSearchOpen}>
                                                    <PopoverTrigger asChild>
                                                        <div className="relative">
                                                            <Search 
                                                              className="absolute left-3 top-1/2 -translate-y-1/2" 
                                                              size={16}
                                                              style={{ color: 'var(--color-text-tertiary)' }}
                                                            />
                                                            <Input
                                                                ref={searchInputRef}
                                                                placeholder="Scan barcode or search..."
                                                                value={productSearchTerm}
                                                                onChange={(e) => {
                                                                    setProductSearchTerm(e.target.value);
                                                                    setProductSearchOpen(true);
                                                                }}
                                                                onClick={() => setProductSearchOpen(true)}
                                                                className="pl-10 pr-9 h-11 text-base"
                                                                style={{
                                                                  backgroundColor: 'var(--color-bg-primary)',
                                                                  borderColor: 'var(--color-border-secondary)',
                                                                  color: 'var(--color-text-primary)',
                                                                  '--tw-ring-color': 'var(--color-primary)'
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
                                                            {pendingProduct && (
                                                                <button 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        resetEntryRow();
                                                                    }}
                                                                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                                                                    style={{ color: 'var(--color-text-tertiary)' }}
                                                                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-text-primary)'}
                                                                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-tertiary)'}
                                                                >
                                                                    <X size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </PopoverTrigger>
                                                <PopoverContent 
                                                    className="w-[400px] p-0" 
                                                    align="start"
                                                    onOpenAutoFocus={(e) => e.preventDefault()}
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
                                                        <CommandInput className="hidden" value={productSearchTerm} onValueChange={setProductSearchTerm} />
                                                        <CommandList>
                                                            <CommandEmpty 
                                                              className="p-2 text-sm text-center py-4"
                                                              style={{ color: 'var(--color-text-tertiary)' }}
                                                            >
                                                                No products found
                                                            </CommandEmpty>
                                                            <CommandGroup heading="Available Products">
                                                                {productsMock.filter(p => 
                                                                    p.name.toLowerCase().includes(productSearchTerm.toLowerCase()) || 
                                                                    p.sku.toLowerCase().includes(productSearchTerm.toLowerCase())
                                                                ).map((product) => (
                                                                    <CommandItem
                                                                        key={product.id}
                                                                        value={product.name}
                                                                        onSelect={() => handleSelectProduct(product)}
                                                                        className="cursor-pointer flex justify-between"
                                                                        style={{ color: 'var(--color-text-primary)' }}
                                                                        onMouseEnter={(e) => {
                                                                          e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                                                                        }}
                                                                        onMouseLeave={(e) => {
                                                                          e.currentTarget.style.backgroundColor = 'transparent';
                                                                        }}
                                                                    >
                                                                        <div className="flex flex-col">
                                                                            <span>{product.name}</span>
                                                                            <span 
                                                                              className="text-xs"
                                                                              style={{ color: 'var(--color-text-tertiary)' }}
                                                                            >
                                                                              {product.sku}
                                                                            </span>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <span 
                                                                              className="text-xs block"
                                                                              style={{ color: 'var(--color-text-secondary)' }}
                                                                            >
                                                                              Stock: {product.stock}
                                                                            </span>
                                                                            <span 
                                                                              className="text-xs font-mono"
                                                                              style={{ color: 'var(--color-success)' }}
                                                                            >
                                                                              ${product.price}
                                                                            </span>
                                                                        </div>
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        </div>

                                            {/* Conditional Fields - Only show when product selected */}
                                            {pendingProduct && (
                                                <>
                                                    {/* 2. Size (Standard Variation) */}
                                                    {pendingProduct.hasVariations && (
                                                        <div className="w-28 lg:w-32 animate-in slide-in-from-left duration-200">
                                                            <Label 
                                                              className="text-xs mb-1.5 block font-semibold"
                                                              style={{ color: 'var(--color-wholesale)' }}
                                                            >
                                                              Size
                                                            </Label>
                                                            <Select value={pendingSize} onValueChange={setPendingSize}>
                                                                <SelectTrigger 
                                                                  className="h-11"
                                                                  style={{
                                                                    backgroundColor: 'var(--color-bg-primary)',
                                                                    borderColor: 'rgba(147, 51, 234, 0.5)',
                                                                    color: 'var(--color-text-primary)'
                                                                  }}
                                                                >
                                                                    <SelectValue placeholder="..." />
                                                                </SelectTrigger>
                                                                <SelectContent 
                                                                  style={{
                                                                    backgroundColor: 'var(--color-bg-tertiary)',
                                                                    borderColor: 'var(--color-border-primary)',
                                                                    color: 'var(--color-text-primary)'
                                                                  }}
                                                                >
                                                                    <SelectItem value="S">Small</SelectItem>
                                                                    <SelectItem value="M">Medium</SelectItem>
                                                                    <SelectItem value="L">Large</SelectItem>
                                                                    <SelectItem value="XL">X-Large</SelectItem>
                                                                    <SelectItem value="XXL">XX-Large</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    )}

                                                    {/* 3. Color (Standard Variation) */}
                                                    {pendingProduct.hasVariations && (
                                                        <div className="w-28 lg:w-32 animate-in slide-in-from-left duration-200">
                                                            <Label 
                                                              className="text-xs mb-1.5 block font-semibold"
                                                              style={{ color: 'var(--color-wholesale)' }}
                                                            >
                                                              Color
                                                            </Label>
                                                            <Select value={pendingColor} onValueChange={setPendingColor}>
                                                                <SelectTrigger 
                                                                  className="h-11"
                                                                  style={{
                                                                    backgroundColor: 'var(--color-bg-primary)',
                                                                    borderColor: 'rgba(147, 51, 234, 0.5)',
                                                                    color: 'var(--color-text-primary)'
                                                                  }}
                                                                >
                                                                    <SelectValue placeholder="..." />
                                                                </SelectTrigger>
                                                                <SelectContent 
                                                                  style={{
                                                                    backgroundColor: 'var(--color-bg-tertiary)',
                                                                    borderColor: 'var(--color-border-primary)',
                                                                    color: 'var(--color-text-primary)'
                                                                  }}
                                                                >
                                                                    <SelectItem value="Red">Red</SelectItem>
                                                                    <SelectItem value="Blue">Blue</SelectItem>
                                                                    <SelectItem value="Black">Black</SelectItem>
                                                                    <SelectItem value="White">White</SelectItem>
                                                                    <SelectItem value="Green">Green</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    )}

                                                    {/* 4. Thaans (Standard Packing - Wholesale) */}
                                                    {pendingProduct.needsPacking && (
                                                        <div className="w-24 lg:w-28 animate-in slide-in-from-left duration-200">
                                                            <Label 
                                                              className="text-xs mb-1.5 block font-semibold"
                                                              style={{ color: 'var(--color-warning)' }}
                                                            >
                                                              Thaans
                                                            </Label>
                                                            <Input
                                                                type="number"
                                                                value={pendingThaans || ""}
                                                                onChange={(e) => setPendingThaans(parseFloat(e.target.value) || 0)}
                                                                placeholder="0"
                                                                className="h-11 text-center text-lg font-bold"
                                                                style={{
                                                                  backgroundColor: 'var(--color-bg-primary)',
                                                                  borderColor: 'rgba(249, 115, 22, 0.5)',
                                                                  color: 'var(--color-warning)',
                                                                  textAlign: 'center'
                                                                }}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* 5. Meters (Standard Packing - Wholesale) */}
                                                    {pendingProduct.needsPacking && (
                                                        <div className="w-28 lg:w-32 animate-in slide-in-from-left duration-200">
                                                            <Label 
                                                              className="text-xs mb-1.5 block font-semibold"
                                                              style={{ color: 'var(--color-warning)' }}
                                                            >
                                                              Meters
                                                            </Label>
                                                            <Input
                                                                type="number"
                                                                value={pendingMeters || ""}
                                                                onChange={(e) => setPendingMeters(parseFloat(e.target.value) || 0)}
                                                                placeholder="0"
                                                                className="h-11 text-center text-lg font-bold"
                                                                style={{
                                                                  backgroundColor: 'var(--color-bg-primary)',
                                                                  borderColor: 'rgba(249, 115, 22, 0.5)',
                                                                  color: 'var(--color-warning)',
                                                                  textAlign: 'center'
                                                                }}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* 4. Quantity */}
                                                    <div className="w-24 lg:w-28 animate-in slide-in-from-left duration-200">
                                                        <Label 
                                                          className="text-xs mb-1.5 block font-semibold"
                                                          style={{ color: 'var(--color-text-secondary)' }}
                                                        >
                                                          Qty
                                                        </Label>
                                                        <Input 
                                                            ref={qtyInputRef}
                                                            type="number"
                                                            value={pendingQty}
                                                            onChange={(e) => setPendingQty(parseFloat(e.target.value) || 0)}
                                                            onKeyDown={handleQtyKeyDown}
                                                            className="h-11 text-center text-lg font-bold"
                                                            style={{
                                                              backgroundColor: 'var(--color-bg-primary)',
                                                              borderColor: 'var(--color-border-secondary)',
                                                              color: 'var(--color-text-primary)',
                                                              textAlign: 'center'
                                                            }}
                                                            onFocus={(e) => {
                                                              e.currentTarget.style.borderColor = 'var(--color-primary)';
                                                            }}
                                                            onBlur={(e) => {
                                                              e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                                                            }}
                                                        />
                                                    </div>

                                                    {/* 5. Price */}
                                                    <div className="w-32 lg:w-36 animate-in slide-in-from-left duration-200">
                                                        <Label 
                                                          className="text-xs mb-1.5 block font-semibold"
                                                          style={{ color: 'var(--color-text-secondary)' }}
                                                        >
                                                          Price
                                                        </Label>
                                                        <div className="relative">
                                                            <span 
                                                              className="absolute left-3 top-1/2 -translate-y-1/2"
                                                              style={{ color: 'var(--color-text-tertiary)' }}
                                                            >
                                                              $
                                                            </span>
                                                            <Input 
                                                                ref={priceInputRef}
                                                                type="number"
                                                                value={pendingPrice}
                                                                onChange={(e) => setPendingPrice(parseFloat(e.target.value) || 0)}
                                                                onKeyDown={handlePriceKeyDown}
                                                                className="h-11 pl-7 text-right text-lg"
                                                                style={{
                                                                  backgroundColor: 'var(--color-bg-primary)',
                                                                  borderColor: 'var(--color-border-secondary)',
                                                                  color: 'var(--color-text-primary)',
                                                                  textAlign: 'right'
                                                                }}
                                                                onFocus={(e) => {
                                                                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                                                                }}
                                                                onBlur={(e) => {
                                                                  e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                                                                }}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* 6. Add Button */}
                                                    <div className="w-full lg:w-auto animate-in slide-in-from-left duration-200">
                                                        <Label className="text-xs text-transparent mb-1.5 block select-none">Add</Label>
                                                        <Button 
                                                            ref={addBtnRef}
                                                            onClick={commitPendingItem}
                                                            className="w-full lg:w-auto h-11 px-6 shadow-lg font-semibold"
                                                            style={{
                                                              background: 'linear-gradient(to right, var(--color-primary), rgba(59, 130, 246, 0.8))',
                                                              color: 'var(--color-text-primary)',
                                                              boxShadow: '0 10px 15px rgba(37, 99, 235, 0.3)'
                                                            }}
                                                            onMouseEnter={(e) => {
                                                              e.currentTarget.style.background = 'linear-gradient(to right, rgba(59, 130, 246, 0.8), rgba(59, 130, 246, 0.6))';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                              e.currentTarget.style.background = 'linear-gradient(to right, var(--color-primary), rgba(59, 130, 246, 0.8))';
                                                            }}
                                                        >
                                                            <ArrowDownCircle size={18} className="mr-2" /> Add
                                                        </Button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        
                                        {/* Selected Product Info Bar - Shows after selection */}
                                        {pendingProduct && (
                                            <div 
                                              className="mt-3 pt-3 border-t flex items-center justify-between text-xs animate-in fade-in duration-200"
                                              style={{ borderTopColor: 'var(--color-border-primary)' }}
                                            >
                                                <div className="flex items-center gap-3 flex-wrap">
                                                    <span style={{ color: 'var(--color-text-tertiary)' }}>Selected:</span>
                                                    <span 
                                                      className="font-medium"
                                                      style={{ color: 'var(--color-text-primary)' }}
                                                    >
                                                      {pendingProduct.name}
                                                    </span>
                                                    <span style={{ color: 'var(--color-text-disabled)' }}>•</span>
                                                    <span 
                                                      className="font-mono"
                                                      style={{ color: 'var(--color-text-tertiary)' }}
                                                    >
                                                      {pendingProduct.sku}
                                                    </span>
                                                    <span style={{ color: 'var(--color-text-disabled)' }}>•</span>
                                                    <span style={{ color: 'var(--color-success)' }}>
                                                      Stock: {pendingProduct.stock}
                                                    </span>
                                                </div>
                                                <span 
                                                  className="text-[10px] hidden lg:block"
                                                  style={{ color: 'var(--color-text-tertiary)' }}
                                                >
                                                  Press Enter to add
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 4. Items List Table */}
                        <div 
                          className="border rounded-xl overflow-hidden min-h-[300px] flex flex-col"
                          style={{
                            borderColor: 'var(--color-border-primary)',
                            backgroundColor: 'rgba(17, 24, 39, 0.3)',
                            borderRadius: 'var(--radius-xl)'
                          }}
                        >
                            <Table>
                                <TableHeader 
                                  style={{ backgroundColor: 'rgba(3, 7, 18, 0.5)' }}
                                >
                                    <TableRow 
                                      style={{ borderColor: 'var(--color-border-primary)' }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                        <TableHead 
                                          className="pl-4 w-[50px]"
                                          style={{ color: 'var(--color-text-secondary)' }}
                                        >
                                          #
                                        </TableHead>
                                        <TableHead style={{ color: 'var(--color-text-secondary)' }}>
                                          Product Details
                                        </TableHead>
                                        <TableHead 
                                          className="w-[160px]"
                                          style={{ color: 'var(--color-text-secondary)' }}
                                        >
                                          Packing Info
                                        </TableHead>
                                        <TableHead 
                                          className="w-[120px] text-right"
                                          style={{ color: 'var(--color-text-secondary)' }}
                                        >
                                          Price
                                        </TableHead>
                                        <TableHead 
                                          className="w-[100px] text-center"
                                          style={{ color: 'var(--color-text-secondary)' }}
                                        >
                                          Qty
                                        </TableHead>
                                        <TableHead 
                                          className="w-[140px] text-right"
                                          style={{ color: 'var(--color-text-secondary)' }}
                                        >
                                          Total
                                        </TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.length === 0 ? (
                                        <TableRow 
                                          style={{ borderColor: 'var(--color-border-primary)' }}
                                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                        >
                                            <TableCell 
                                              colSpan={7} 
                                              className="h-40 text-center"
                                              style={{ color: 'var(--color-text-disabled)' }}
                                            >
                                                <div className="flex flex-col items-center gap-2">
                                                    <ShoppingBag size={32} className="opacity-20" />
                                                    <p>No items added yet</p>
                                                    <p className="text-xs">Search for products above to build your invoice</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        items.map((item, index) => (
                                            <TableRow 
                                              key={item.id} 
                                              className="group"
                                              style={{ borderColor: 'var(--color-border-primary)' }}
                                              onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = 'rgba(31, 41, 55, 0.5)';
                                              }}
                                              onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = 'transparent';
                                              }}
                                            >
                                                <TableCell 
                                                  className="pl-4 font-mono text-xs"
                                                  style={{ color: 'var(--color-text-tertiary)' }}
                                                >
                                                    {(items.length - index).toString().padStart(2, '0')}
                                                </TableCell>
                                                <TableCell>
                                                    <div>
                                                        <div 
                                                          className="font-medium"
                                                          style={{ color: 'var(--color-text-primary)' }}
                                                        >
                                                          {item.name}
                                                        </div>
                                                        <div 
                                                          className="text-xs font-mono flex items-center gap-2"
                                                          style={{ color: 'var(--color-text-tertiary)' }}
                                                        >
                                                            <span>{item.sku}</span>
                                                            {item.size && (
                                                                <>
                                                                    <span style={{ color: 'var(--color-text-disabled)' }}>•</span>
                                                                    <Badge 
                                                                      className="text-[10px] px-1.5 py-0"
                                                                      style={{
                                                                        backgroundColor: 'rgba(147, 51, 234, 0.3)',
                                                                        color: 'var(--color-wholesale)',
                                                                        borderColor: 'rgba(147, 51, 234, 0.3)'
                                                                      }}
                                                                    >
                                                                        {item.size}
                                                                    </Badge>
                                                                </>
                                                            )}
                                                            {item.color && (
                                                                <>
                                                                    <span style={{ color: 'var(--color-text-disabled)' }}>•</span>
                                                                    <Badge 
                                                                      className="text-[10px] px-1.5 py-0"
                                                                      style={{
                                                                        backgroundColor: 'rgba(147, 51, 234, 0.3)',
                                                                        color: 'var(--color-wholesale)',
                                                                        borderColor: 'rgba(147, 51, 234, 0.3)'
                                                                      }}
                                                                    >
                                                                        {item.color}
                                                                    </Badge>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {item.thaans || item.meters ? (
                                                        <div className="flex items-center gap-2 text-xs">
                                                            {item.thaans && (
                                                                <Badge 
                                                                  className="text-[10px] px-2 py-0.5"
                                                                  style={{
                                                                    backgroundColor: 'rgba(249, 115, 22, 0.3)',
                                                                    color: 'var(--color-warning)',
                                                                    borderColor: 'rgba(249, 115, 22, 0.3)'
                                                                  }}
                                                                >
                                                                    <Box size={10} className="mr-1" />
                                                                    {item.thaans} Th
                                                                </Badge>
                                                            )}
                                                            {item.meters && (
                                                                <Badge 
                                                                  className="text-[10px] px-2 py-0.5"
                                                                  style={{
                                                                    backgroundColor: 'rgba(249, 115, 22, 0.3)',
                                                                    color: 'var(--color-warning)',
                                                                    borderColor: 'rgba(249, 115, 22, 0.3)'
                                                                  }}
                                                                >
                                                                    <Ruler size={10} className="mr-1" />
                                                                    {item.meters}M
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span 
                                                          className="text-xs"
                                                          style={{ color: 'var(--color-text-disabled)' }}
                                                        >
                                                          —
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Input 
                                                        type="number"
                                                        className="h-7 w-20 text-right bg-transparent border-transparent p-1 text-sm"
                                                        style={{
                                                          color: 'var(--color-text-primary)',
                                                          borderColor: 'transparent'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                          e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                          e.currentTarget.style.borderColor = 'transparent';
                                                        }}
                                                        onFocus={(e) => {
                                                          e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
                                                          e.currentTarget.style.borderColor = 'var(--color-primary)';
                                                        }}
                                                        onBlur={(e) => {
                                                          e.currentTarget.style.backgroundColor = 'transparent';
                                                          e.currentTarget.style.borderColor = 'transparent';
                                                        }}
                                                        value={item.price}
                                                        onChange={(e) => updateItem(item.id, 'price', parseFloat(e.target.value) || 0)}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-center">
                                                     <div className="flex items-center justify-center gap-1">
                                                        <Input 
                                                            type="number"
                                                            className="h-7 w-16 text-center bg-transparent border-transparent p-1 text-sm font-medium"
                                                            style={{
                                                              color: 'var(--color-text-primary)',
                                                              borderColor: 'transparent'
                                                            }}
                                                            onMouseEnter={(e) => {
                                                              e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                              e.currentTarget.style.borderColor = 'transparent';
                                                            }}
                                                            onFocus={(e) => {
                                                              e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
                                                              e.currentTarget.style.borderColor = 'var(--color-primary)';
                                                            }}
                                                            onBlur={(e) => {
                                                              e.currentTarget.style.backgroundColor = 'transparent';
                                                              e.currentTarget.style.borderColor = 'transparent';
                                                            }}
                                                            value={item.qty}
                                                            onChange={(e) => updateItem(item.id, 'qty', parseFloat(e.target.value) || 0)}
                                                            disabled={!!item.packingDetails}
                                                        />
                                                     </div>
                                                </TableCell>
                                                <TableCell 
                                                  className="text-right font-medium"
                                                  style={{ color: 'var(--color-text-primary)' }}
                                                >
                                                    ${(item.price * item.qty).toLocaleString()}
                                                </TableCell>
                                                <TableCell>
                                                    <Button 
                                                      variant="ghost" 
                                                      size="icon" 
                                                      onClick={() => removeItem(item.id)} 
                                                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                                      style={{ color: 'var(--color-text-tertiary)' }}
                                                      onMouseEnter={(e) => {
                                                        e.currentTarget.style.color = 'var(--color-error)';
                                                        e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                                                      }}
                                                      onMouseLeave={(e) => {
                                                        e.currentTarget.style.color = 'var(--color-text-tertiary)';
                                                        e.currentTarget.style.backgroundColor = 'transparent';
                                                      }}
                                                    >
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                {/* Optional Shipping Section - Compact */}
                {shippingEnabled && (
                    <div 
                      className="border rounded-lg p-3"
                      style={{
                        backgroundColor: 'rgba(17, 24, 39, 0.5)',
                        borderColor: 'rgba(59, 130, 246, 0.3)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <h3 
                              className="text-xs font-semibold uppercase tracking-wide flex items-center gap-2"
                              style={{ color: 'var(--color-primary)' }}
                            >
                                <Truck size={14} />
                                Shipping Details
                            </h3>
                            <button 
                                onClick={() => setShippingEnabled(false)}
                                className="text-xs"
                                style={{ color: 'var(--color-text-tertiary)' }}
                                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-error)'}
                                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-tertiary)'}
                            >
                                <X size={14} />
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <Input 
                                type="text" 
                                placeholder="Shipping Address"
                                className="h-8 text-xs md:col-span-2"
                                style={{
                                  backgroundColor: 'var(--color-bg-tertiary)',
                                  borderColor: 'var(--color-border-secondary)',
                                  color: 'var(--color-text-primary)'
                                }}
                                value={shippingAddress}
                                onChange={(e) => setShippingAddress(e.target.value)}
                            />
                            <Input 
                                type="number" 
                                placeholder="Shipping Charges"
                                className="h-8 text-xs"
                                style={{
                                  backgroundColor: 'var(--color-bg-tertiary)',
                                  borderColor: 'var(--color-border-secondary)',
                                  color: 'var(--color-text-primary)'
                                }}
                                value={shippingCharges > 0 ? shippingCharges : ''}
                                onChange={(e) => setShippingCharges(parseFloat(e.target.value) || 0)}
                            />
                        </div>
                    </div>
                )}

                {/* 5. Bottom Section - Expenses, Summary & Payment */}
                <div 
                  className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-4 border-t"
                  style={{ borderTopColor: 'var(--color-border-primary)' }}
                >
                    {/* Left Column - Expenses & Summary */}
                    <div className="space-y-4">
                        {/* Extra Expenses - Compact Inline */}
                        <div 
                          className="border rounded-lg p-4"
                          style={{
                            backgroundColor: 'rgba(17, 24, 39, 0.5)',
                            borderColor: 'var(--color-border-primary)',
                            borderRadius: 'var(--radius-lg)'
                          }}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <h3 
                                  className="text-xs font-semibold uppercase tracking-wide flex items-center gap-2"
                                  style={{ color: 'var(--color-text-secondary)' }}
                                >
                                    <DollarSign 
                                      size={14}
                                      style={{ color: 'var(--color-wholesale)' }}
                                    />
                                    Extra Expenses
                                </h3>
                                {extraExpenses.length > 0 && (
                                    <Badge 
                                      className="text-xs px-2 py-0.5"
                                      style={{
                                        backgroundColor: 'var(--color-wholesale)',
                                        color: 'var(--color-text-primary)'
                                      }}
                                    >
                                        ${expensesTotal.toLocaleString()}
                                    </Badge>
                                )}
                            </div>

                            {/* Add Expense Form - More Compact */}
                            <div className="flex gap-2 mb-3">
                                <Select value={newExpenseType} onValueChange={(v: any) => setNewExpenseType(v)}>
                                    <SelectTrigger 
                                      className="w-[110px] h-8 text-xs"
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
                                    className="h-8 w-[90px] text-xs"
                                    style={{
                                      backgroundColor: 'var(--color-bg-tertiary)',
                                      borderColor: 'var(--color-border-secondary)',
                                      color: 'var(--color-text-primary)'
                                    }}
                                    value={newExpenseAmount > 0 ? newExpenseAmount : ''}
                                    onChange={(e) => setNewExpenseAmount(parseFloat(e.target.value) || 0)}
                                />
                                <Input 
                                    type="text" 
                                    placeholder="Notes (optional)" 
                                    className="h-8 flex-1 text-xs"
                                    style={{
                                      backgroundColor: 'var(--color-bg-tertiary)',
                                      borderColor: 'var(--color-border-secondary)',
                                      color: 'var(--color-text-primary)'
                                    }}
                                    value={newExpenseNotes}
                                    onChange={(e) => setNewExpenseNotes(e.target.value)}
                                />
                                <Button 
                                  onClick={addExtraExpense} 
                                  className="h-8 w-8 p-0"
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
                                    <Plus size={14} />
                                </Button>
                            </div>

                            {/* Expenses List - Only show if exists */}
                            {extraExpenses.length > 0 && (
                                <div className="space-y-1.5">
                                    {extraExpenses.map((expense) => (
                                        <div 
                                          key={expense.id} 
                                          className="flex justify-between items-center p-2 rounded border transition-colors"
                                          style={{
                                            backgroundColor: 'var(--color-bg-tertiary)',
                                            borderColor: 'rgba(31, 41, 55, 0.5)',
                                            borderRadius: 'var(--radius-md)'
                                          }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.borderColor = 'rgba(147, 51, 234, 0.3)';
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.borderColor = 'rgba(31, 41, 55, 0.5)';
                                          }}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div 
                                                  className="w-6 h-6 rounded flex items-center justify-center"
                                                  style={{ backgroundColor: 'rgba(147, 51, 234, 0.2)' }}
                                                >
                                                    <DollarSign 
                                                      size={10}
                                                      style={{ color: 'var(--color-wholesale)' }}
                                                    />
                                                </div>
                                                <div>
                                                    <div 
                                                      className="text-xs font-medium capitalize"
                                                      style={{ color: 'var(--color-text-primary)' }}
                                                    >
                                                      {expense.type}
                                                    </div>
                                                    {expense.notes && (
                                                      <div 
                                                        className="text-[10px]"
                                                        style={{ color: 'var(--color-text-tertiary)' }}
                                                      >
                                                        {expense.notes}
                                                      </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span 
                                                  className="text-xs font-medium"
                                                  style={{ color: 'var(--color-text-primary)' }}
                                                >
                                                  ${expense.amount.toLocaleString()}
                                                </span>
                                                <button 
                                                  onClick={() => removeExtraExpense(expense.id)} 
                                                  style={{ color: 'var(--color-text-tertiary)' }}
                                                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-error)'}
                                                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-tertiary)'}
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Summary Card - Compact with Inline Controls */}
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
                              Invoice Summary
                            </h3>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span style={{ color: 'var(--color-text-secondary)' }}>Items Subtotal</span>
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
                                            style={{
                                              backgroundColor: 'var(--color-bg-tertiary)',
                                              borderColor: 'var(--color-border-secondary)',
                                              color: 'var(--color-text-primary)'
                                            }}
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
                                        <span style={{ color: 'var(--color-wholesale)' }}>Extra Expenses</span>
                                        <span 
                                          className="font-medium"
                                          style={{ color: 'var(--color-wholesale)' }}
                                        >
                                          +${expensesTotal.toLocaleString()}
                                        </span>
                                    </div>
                                )}
                                
                                {/* Shipping - Optional, show button or charges */}
                                {!shippingEnabled ? (
                                    <button 
                                        onClick={() => setShippingEnabled(true)}
                                        className="flex items-center gap-1.5 text-xs transition-colors py-1"
                                        style={{ color: 'var(--color-primary)' }}
                                        onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(147, 197, 253, 1)'}
                                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
                                    >
                                        <Truck size={12} />
                                        <span>Add Shipping</span>
                                    </button>
                                ) : finalShippingCharges > 0 && (
                                    <div className="flex justify-between text-xs">
                                        <span style={{ color: 'var(--color-primary)' }}>Shipping</span>
                                        <span 
                                          className="font-medium"
                                          style={{ color: 'var(--color-primary)' }}
                                        >
                                          +${finalShippingCharges.toLocaleString()}
                                        </span>
                                    </div>
                                )}
                                
                                <Separator style={{ backgroundColor: 'var(--color-border-primary)' }} />
                                
                                <div className="flex justify-between items-center pt-1">
                                    <span 
                                      className="text-sm font-semibold"
                                      style={{ color: 'var(--color-text-primary)' }}
                                    >
                                      Grand Total
                                    </span>
                                    <span 
                                      className="text-2xl font-bold"
                                      style={{ color: 'var(--color-primary)' }}
                                    >
                                      ${totalAmount.toLocaleString()}
                                    </span>
                                </div>

                                {/* Salesman Commission - Info Only (not added to total) */}
                                {salesmanId !== "1" && (
                                    <>
                                        <Separator style={{ backgroundColor: 'rgba(31, 41, 55, 0.5)' }} />
                                        <div className="pt-2 space-y-1.5">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-1.5">
                                                    <UserCheck 
                                                      size={12}
                                                      style={{ color: 'var(--color-success)' }}
                                                    />
                                                    <span 
                                                      className="text-xs"
                                                      style={{ color: 'var(--color-text-secondary)' }}
                                                    >
                                                      Commission
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <Select value={commissionType} onValueChange={(v: any) => setCommissionType(v)}>
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
                                            style={{
                                              backgroundColor: 'var(--color-bg-tertiary)',
                                              borderColor: 'var(--color-border-secondary)',
                                              color: 'var(--color-text-primary)'
                                            }}
                                                        value={commissionValue > 0 ? commissionValue : ''}
                                                        onChange={(e) => setCommissionValue(parseFloat(e.target.value) || 0)}
                                                    />
                                                </div>
                                            </div>
                                            {commissionAmount > 0 && (
                                                <div 
                                                  className="text-xs font-medium text-right px-2 py-1 rounded"
                                                  style={{
                                                    color: 'var(--color-success)',
                                                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                                                    borderRadius: 'var(--radius-md)'
                                                  }}
                                                >
                                                    Commission: ${commissionAmount.toLocaleString()}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
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
                                  style={paymentStatus === 'paid' ? {
                                    backgroundColor: 'var(--color-success)',
                                    color: 'var(--color-text-primary)'
                                  } : paymentStatus === 'partial' ? {
                                    backgroundColor: 'var(--color-primary)',
                                    color: 'var(--color-text-primary)'
                                  } : {
                                    backgroundColor: 'var(--color-warning)',
                                    color: 'var(--color-text-primary)'
                                  }}
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
                                      Invoice Amount
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
                                          backgroundColor: 'rgba(22, 163, 74, 1)', // green-700
                                          borderColor: 'rgba(22, 163, 74, 1)',
                                          color: 'var(--color-text-primary)'
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 1)'; // green-600
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.backgroundColor = 'rgba(22, 163, 74, 1)';
                                        }}
                                    >
                                        100%
                                    </Button>
                                </div>
                            </div>

                            {/* Payment Entry Form */}
                            <div className="space-y-2">
                                <Label 
                                  className="text-xs"
                                  style={{ color: 'var(--color-text-tertiary)' }}
                                >
                                  Add Payment
                                </Label>
                                <div className="flex gap-2">
                                    <Select value={newPaymentMethod} onValueChange={(v: any) => setNewPaymentMethod(v)}>
                                        <SelectTrigger 
                                          className="w-[110px] h-10 text-xs"
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
                                        className="h-10 flex-1"
                                        style={{
                                          backgroundColor: 'var(--color-bg-tertiary)',
                                          borderColor: 'var(--color-border-secondary)',
                                          color: 'var(--color-text-primary)'
                                        }}
                                        value={newPaymentAmount > 0 ? newPaymentAmount : ''}
                                        onChange={(e) => setNewPaymentAmount(parseFloat(e.target.value) || 0)}
                                    />
                                    <Button 
                                      onClick={addPartialPayment} 
                                      className="h-10 w-10 p-0"
                                      style={{
                                        backgroundColor: 'var(--color-primary)',
                                        color: 'var(--color-text-primary)'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.8)'; // blue-500
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                                      }}
                                    >
                                        <Plus size={16} />
                                    </Button>
                                </div>
                                <Input 
                                    type="text" 
                                    placeholder="Reference (optional)" 
                                    className="h-9 text-xs"
                                    style={{
                                      backgroundColor: 'var(--color-bg-tertiary)',
                                      borderColor: 'var(--color-border-secondary)',
                                      color: 'var(--color-text-primary)'
                                    }}
                                    value={newPaymentReference}
                                    onChange={(e) => setNewPaymentReference(e.target.value)}
                                />
                            </div>

                            {/* Payments List */}
                            <div 
                              className="rounded-lg border p-3 space-y-2 min-h-[100px]"
                              style={{
                                backgroundColor: 'var(--color-bg-tertiary)',
                                borderColor: 'var(--color-border-primary)',
                                borderRadius: 'var(--radius-lg)'
                              }}
                            >
                                {partialPayments.length === 0 ? (
                                    <div 
                                      className="text-center text-xs py-4"
                                      style={{ color: 'var(--color-text-disabled)' }}
                                    >
                                      No payments added
                                    </div>
                                ) : (
                                    partialPayments.map((p) => (
                                        <div 
                                          key={p.id} 
                                          className="flex justify-between items-center text-sm p-2 rounded border"
                                          style={{
                                            backgroundColor: 'var(--color-bg-primary)',
                                            borderColor: 'rgba(31, 41, 55, 0.5)',
                                            borderRadius: 'var(--radius-md)'
                                          }}
                                        >
                                            <div className="flex items-center gap-2">
                                                {p.method === 'cash' && (
                                                  <Banknote 
                                                    size={14}
                                                    style={{ color: 'var(--color-success)' }}
                                                  />
                                                )}
                                                {p.method === 'bank' && (
                                                  <CreditCard 
                                                    size={14}
                                                    style={{ color: 'var(--color-primary)' }}
                                                  />
                                                )}
                                                {p.method === 'other' && (
                                                  <Wallet 
                                                    size={14}
                                                    style={{ color: 'var(--color-wholesale)' }}
                                                  />
                                                )}
                                                <span 
                                                  className="capitalize text-xs"
                                                  style={{ color: 'var(--color-text-secondary)' }}
                                                >
                                                  {p.method}
                                                </span>
                                                {p.reference && (
                                                  <span 
                                                    className="text-xs"
                                                    style={{ color: 'var(--color-text-tertiary)' }}
                                                  >
                                                    ({p.reference})
                                                  </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span 
                                                  className="font-medium"
                                                  style={{ color: 'var(--color-text-primary)' }}
                                                >
                                                  ${p.amount.toLocaleString()}
                                                </span>
                                                <button 
                                                  onClick={() => removePartialPayment(p.id)} 
                                                  style={{ color: 'var(--color-text-tertiary)' }}
                                                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-error)'}
                                                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-tertiary)'}
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <Separator style={{ backgroundColor: 'var(--color-border-primary)' }} />
                            
                        <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                                <span style={{ color: 'var(--color-text-secondary)' }}>Total Paid</span>
                                <span 
                                  className="font-bold"
                                  style={{ color: 'var(--color-success)' }}
                                >
                                  ${totalPaid.toLocaleString()}
                                </span>
                            </div>
                            <div className="flex justify-between items-center pt-2">
                                <span 
                                  className="font-medium text-sm"
                                  style={{ color: 'var(--color-warning)' }}
                                >
                                  Balance Due
                                </span>
                                <span 
                                  className="font-bold text-xl"
                                  style={{ color: 'rgba(249, 115, 22, 1)' }}
                                >
                                  ${Math.max(0, balanceDue).toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Final Action Buttons */}
                <div className="grid grid-cols-[1fr_1.5fr_0.6fr] gap-2">
                    <Button 
                        type="button"
                        variant="outline"
                        className="h-11 border-2 text-sm font-semibold"
                        style={{
                          backgroundColor: 'transparent',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)',
                          borderWidth: '2px'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                          e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                    >
                        <Save size={16} className="mr-1.5" />
                        Save
                    </Button>
                    <Button 
                        type="button"
                        className="h-11 text-sm font-bold shadow-xl"
                        style={{
                          backgroundColor: 'var(--color-primary)',
                          color: 'var(--color-text-primary)',
                          boxShadow: '0 20px 25px rgba(37, 99, 235, 0.2)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.8)'; // blue-500
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                        }}
                    >
                        <Printer size={16} className="mr-1.5" />
                        Save & Print
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button 
                                type="button"
                                variant="outline"
                                className="h-11 bg-transparent border-2"
                                style={{
                                  borderColor: 'var(--color-border-secondary)',
                                  color: 'var(--color-text-primary)',
                                  borderWidth: '2px'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                                  e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                                title="Attach Files"
                            >
                                <Paperclip size={16} />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent 
                          align="end"
                          style={{
                            backgroundColor: 'var(--color-bg-primary)',
                            borderColor: 'var(--color-border-secondary)',
                            color: 'var(--color-text-primary)'
                          }}
                        >
                            <DropdownMenuItem 
                              className="cursor-pointer"
                              style={{ color: 'var(--color-text-primary)' }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                            >
                                <FileText 
                                  size={14} 
                                  className="mr-2"
                                  style={{ color: 'var(--color-primary)' }}
                                />
                                Bill Attachment
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="cursor-pointer"
                              style={{ color: 'var(--color-text-primary)' }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                            >
                                <CreditCard 
                                  size={14} 
                                  className="mr-2"
                                  style={{ color: 'var(--color-success)' }}
                                />
                                Payment Attachment
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
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