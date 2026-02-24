import React, { useState, useEffect, useCallback } from 'react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useRentals } from '@/app/context/RentalContext';
import { useAccounting } from '@/app/context/AccountingContext';
import { useNavigation } from '@/app/context/NavigationContext';
import { rentalService } from '@/app/services/rentalService';
import { productService } from '@/app/services/productService';
import { contactService } from '@/app/services/contactService';
import { 
  Calendar as CalendarIcon, 
  Search, 
  ShoppingBag,
  ArrowRight,
  Info,
  Box,
  AlertCircle,
  Tag,
  Clock,
  Package
} from 'lucide-react';
import { format, addDays, differenceInDays } from "date-fns";
import { cn } from "../ui/utils";
import { Button } from "../ui/button";
import { Calendar } from "../ui/calendar";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { CalendarDatePicker } from "../ui/CalendarDatePicker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../ui/select";
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { ReturnDressModal } from './ReturnDressModal';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
  } from "../ui/command";
import { Check, ChevronsUpDown, User, PlusCircle } from "lucide-react";
import { Label } from "../ui/label";
import { RentalProductSearch, SearchProduct } from './RentalProductSearch';
import { ProductImage } from '../products/ProductImage';
import { toast } from 'sonner';

// NEW: Import rental types and utilities
import { 
  RentalBooking, 
  RentalStatus, 
  RENTAL_STATUS_COLORS, 
  RENTAL_STATUS_LABELS 
} from '@/app/types/rental.types';
import { 
  checkDateConflict, 
  calculateRentalDays,
  validateRentalBooking,
  generateRentalInvoice
} from '@/app/utils/rentalUtils';

// Mock data removed - loading from Supabase via productService and contactService

// Existing bookings will be loaded from Supabase

import type { RentalUI } from '@/app/context/RentalContext';

interface RentalBookingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  editRental?: RentalUI | null;
}

export const RentalBookingDrawer = ({ isOpen, onClose, editRental }: RentalBookingDrawerProps) => {
  const { companyId, branchId, user } = useSupabase();
  const { refreshRentals } = useRentals();
  const accounting = useAccounting();
  const { formatCurrency } = useFormatCurrency();
  const { openDrawer, createdContactId, setCreatedContactId } = useNavigation();
  const [existingBookings, setExistingBookings] = useState<RentalBooking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  
  // Load existing bookings for conflict detection
  useEffect(() => {
    if (isOpen && companyId) {
      loadExistingBookings();
    }
  }, [isOpen, companyId]);
  
  const loadExistingBookings = async () => {
    try {
      setLoadingBookings(true);
      const rentals = await rentalService.getAllRentals(companyId, branchId || undefined);
      // Convert to RentalBooking format for conflict detection
      const bookings: RentalBooking[] = rentals
        .filter(r => r.status !== 'cancelled' && r.status !== 'closed')
        .map(r => ({
          id: r.id || '',
          invoiceNumber: r.booking_no || '',
          customerId: r.customer_id,
          customerName: r.customer_name,
          productId: r.items?.[0]?.product_id || '',
          productName: r.items?.[0]?.product_name || '',
          productSku: '',
          productImage: '',
          bookingDate: new Date(r.booking_date),
          pickupDate: new Date(r.pickup_date),
          returnDate: new Date(r.return_date),
          totalDays: r.duration_days,
          rentAmount: r.rental_charges,
          advancePaid: r.paid_amount,
          balanceDue: r.total_amount - r.paid_amount,
          damageCharges: r.damage_charges || 0,
          lateCharges: r.late_fee || 0,
          extraDays: 0,
          securityDetails: {
            type: 'id_card',
            reference: '',
            heldByShop: true
          },
          status: r.status as RentalStatus,
          createdBy: r.created_by,
          createdAt: new Date(r.booking_date),
          updatedAt: new Date(r.booking_date),
          branchId: r.branch_id,
          branchName: ''
        }));
      setExistingBookings(bookings);
    } catch (error) {
      console.error('[RENTAL BOOKING DRAWER] Error loading bookings:', error);
      setExistingBookings([]);
    } finally {
      setLoadingBookings(false);
    }
  };
  
  // Context State
  const [bookingDate, setBookingDate] = useState<Date>(new Date());
  const [pickupDate, setPickupDate] = useState<Date | undefined>(new Date());
  const [returnDate, setReturnDate] = useState<Date | undefined>(addDays(new Date(), 3));
  const [rentalStatus, setRentalStatus] = useState("booked");

  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [customerList, setCustomerList] = useState<Array<{id: string; name: string}>>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Cart State
  const [selectedProduct, setSelectedProduct] = useState<SearchProduct | null>(null);
  const [manualRentPrice, setManualRentPrice] = useState<string>('');
  const [advancePaid, setAdvancePaid] = useState('');
  
  // Return Modal State
  const [showReturnModal, setShowReturnModal] = useState(false);

  // Booking save state
  const [saving, setSaving] = useState(false);

  // Populate form when editing
  useEffect(() => {
    if (isOpen && editRental) {
      setSelectedCustomer(editRental.customerId || '');
      // Ensure edit rental's customer is in list (for display when contact may have been removed)
      if (editRental.customerId && editRental.customerName) {
        setCustomerList(prev => {
          if (prev.some((c: any) => c.id === editRental!.customerId)) return prev;
          return [{ id: editRental!.customerId!, name: editRental!.customerName }, ...prev];
        });
      }
      setBookingDate(editRental.startDate ? new Date(editRental.startDate) : new Date());
      setPickupDate(editRental.startDate ? new Date(editRental.startDate) : new Date());
      setReturnDate(editRental.expectedReturnDate ? new Date(editRental.expectedReturnDate) : addDays(new Date(), 3));
      setAdvancePaid(editRental.paidAmount?.toString() || '');
      const firstItem = editRental.items?.[0];
      if (firstItem) {
        const rentVal = firstItem.total || firstItem.rate || 0;
        const product: SearchProduct = {
          id: firstItem.productId,
          name: firstItem.productName,
          sku: firstItem.sku || '',
          image: '',
          status: 'available',
          rentPrice: firstItem.rate || firstItem.total || 0,
          retailPrice: 0,
        };
        setSelectedProduct(product);
        setManualRentPrice(String(rentVal || editRental.totalAmount || ''));
      }
    } else if (isOpen && !editRental) {
      setSelectedCustomer('');
      setSelectedProduct(null);
      setManualRentPrice('');
      setAdvancePaid('');
      setBookingDate(new Date());
      setPickupDate(new Date());
      setReturnDate(addDays(new Date(), 3));
    }
  }, [isOpen, editRental?.id]);

  // Load products and customers from Supabase
  const loadData = useCallback(async () => {
    if (!companyId) return;

    try {
      setLoadingProducts(true);
      
      // Load products
      const productsData = await productService.getAllProducts(companyId);
      setProducts(productsData);

      // Load customers only (exclude Walk-in; rentals require a real customer)
      const contactsData = await contactService.getAllContacts(companyId);
      const customersList = (contactsData || [])
        .filter((c: any) => (c.type === 'customer' || c.type === 'both') && !(c.is_system_generated && c.system_type === 'walking_customer'))
        .map((c: any) => ({ id: c.id || '', name: c.name || '' }));
      setCustomerList(customersList.length > 0 ? customersList : []);
    } catch (error) {
      console.error('[RENTAL BOOKING DRAWER] Error loading data:', error);
      setProducts([]);
      setCustomerList([]);
    } finally {
      setLoadingProducts(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (isOpen && companyId) {
      loadData();
    }
  }, [isOpen, companyId, loadData]);

  // --- DATA MAPPING LOGIC ---
  const mappedProducts: SearchProduct[] = products.map(p => {
    let status: SearchProduct['status'] = 'available';
    let unavailableReason = undefined;

    // Check if product is rentable
    const isRentable = p.is_rentable !== false;
    const isSellable = p.is_sellable !== false;
    const currentStock = p.current_stock || 0;

    if (!isRentable && isSellable) {
        status = 'retail_only';
    } else if (currentStock <= 0) {
        status = 'unavailable';
        unavailableReason = 'Out of Stock';
    }

    return {
        id: p.id || '',
        name: p.name || '',
        sku: p.sku || '',
        image: (Array.isArray(p.image_urls) && p.image_urls[0]) ? p.image_urls[0] : (p.image_url || p.thumbnail || ''),
        status,
        unavailableReason,
        rentPrice: p.rental_price_daily || 0,
        retailPrice: p.retail_price || 0,
        category: p.category?.name || '',
        brand: '',
        securityDeposit: 0 // TODO: Add security deposit field to products table
    };
  });

  // Update manual rent price when product changes (skip in edit mode—edit effect already set it)
  useEffect(() => {
    if (editRental?.id) return;
    if (selectedProduct) {
        if (selectedProduct.rentPrice && selectedProduct.rentPrice > 0) {
            setManualRentPrice(selectedProduct.rentPrice.toString());
        } else {
            setManualRentPrice(''); // Clear for manual entry
        }
    }
  }, [selectedProduct, editRental?.id]);

  // When a contact is created via the global Add Contact drawer, add to list and select (must be before early return)
  useEffect(() => {
    if (!createdContactId || !isOpen) return;
    const applyCreatedContact = async () => {
      try {
        const contact = await contactService.getContact(createdContactId);
        if (contact?.id) {
          const { id, name } = contact;
          setCustomerList(prev => {
            if (prev.some(c => c.id === id)) return prev;
            return [...prev, { id, name: name || 'Unknown' }];
          });
          setSelectedCustomer(id);
          setCustomerSearchOpen(false);
          toast.success('Customer added');
        }
      } catch (e) {
        console.error('[RentalBookingDrawer] Error fetching created contact:', e);
      } finally {
        setCreatedContactId?.(null);
      }
    };
    applyCreatedContact();
  }, [createdContactId, isOpen, setCreatedContactId]);

  if (!isOpen) return null;

  const totalDays = pickupDate && returnDate 
    ? differenceInDays(returnDate, pickupDate) 
    : 0;

  const handleCustomerSelect = (id: string) => {
      setSelectedCustomer(id);
      setCustomerSearchOpen(false);
  };

  const getCustomerName = () => {
    if (!selectedCustomer) return 'Select customer...';
    const c = customerList.find(x => x.id.toString() === selectedCustomer);
    if (c) return c.name;
    if (editRental?.customerId === selectedCustomer) return editRental.customerName;
    return 'Select customer...';
  };

  const handleBookOrder = async () => {
    if (!companyId || !branchId) {
      toast.error('Company or branch not set');
      return;
    }
    if (!selectedCustomer) {
      toast.error('Please select or add a customer');
      openDrawer('addContact', undefined, { contactType: 'customer', prefillName: customerSearchTerm || '' });
      return;
    }
    if (!selectedProduct) {
      toast.error('Please select a product');
      return;
    }
    if (!pickupDate || !returnDate) {
      toast.error('Please select pickup and return dates');
      return;
    }
    if (hasConflict) {
      toast.error('Selected dates conflict with an existing booking');
      return;
    }
    const rentAmount = parseFloat(manualRentPrice) || 0;
    if (rentAmount <= 0) {
      toast.error('Please enter a valid rent amount');
      return;
    }

    const items = [{
      productId: String(selectedProduct.id),
      productName: selectedProduct.name,
      quantity: 1,
      ratePerDay: selectedProduct.rentPrice ?? rentAmount,
      durationDays: totalDays || 1,
      total: rentAmount,
    }];

    try {
      setSaving(true);
      if (editRental?.id) {
        await rentalService.updateBooking(editRental.id, companyId, {
          customerId: selectedCustomer,
          customerName: getCustomerName(),
          pickupDate: pickupDate.toISOString().split('T')[0],
          returnDate: returnDate.toISOString().split('T')[0],
          rentalCharges: rentAmount,
          securityDeposit: 0,
          paidAmount: parseFloat(advancePaid) || 0,
          notes: null,
          items,
        });
        toast.success('Booking updated successfully');
      } else {
        const paidAmt = parseFloat(advancePaid) || 0;
        const result = await rentalService.createBooking({
          companyId,
          branchId,
          createdBy: user?.id ?? null,
          customerId: selectedCustomer,
          customerName: getCustomerName(),
          bookingDate: bookingDate.toISOString().split('T')[0],
          pickupDate: pickupDate.toISOString().split('T')[0],
          returnDate: returnDate.toISOString().split('T')[0],
          rentalCharges: rentAmount,
          securityDeposit: 0,
          paidAmount: paidAmt,
          notes: null,
          items,
        });
        if (paidAmt > 0) {
          accounting.recordRentalBooking({
            bookingId: result.id,
            customerName: getCustomerName(),
            customerId: selectedCustomer,
            advanceAmount: paidAmt,
            securityDepositAmount: 0,
            securityDepositType: 'Document',
            paymentMethod: 'Cash',
          }).catch((err) => console.warn('[RentalBookingDrawer] Ledger advance posting:', err));
        }
        toast.success(`Booking ${result.booking_no} created successfully`);
      }
      await refreshRentals();
      await loadExistingBookings();
      setSelectedProduct(null);
      setManualRentPrice('');
      setAdvancePaid('');
      onClose();
    } catch (error: any) {
      console.error('[RENTAL BOOKING DRAWER] Error saving booking:', error);
      toast.error('Failed to save booking: ' + (error?.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  // REAL-TIME CONFLICT DETECTION (exclude current rental when editing)
  const bookingsForConflict = editRental?.id
    ? existingBookings.filter((b) => b.id !== editRental.id)
    : existingBookings;
  const conflictCheck = selectedProduct && pickupDate && returnDate
    ? checkDateConflict(
        selectedProduct.id,
        pickupDate,
        returnDate,
        bookingsForConflict
      )
    : { hasConflict: false };

  const hasConflict = conflictCheck.hasConflict;
  const isManualRent = selectedProduct && (selectedProduct.rentPrice === null || selectedProduct.rentPrice === 0);
  const currentRentPrice = parseFloat(manualRentPrice) || 0;

  // Auto-update product list with conflict indicators
  const productsWithConflicts = mappedProducts.map(product => {
    if (!pickupDate || !returnDate) return product;
    
    const conflict = checkDateConflict(
      product.id,
      pickupDate,
      returnDate,
      bookingsForConflict
    );
    
    if (conflict.hasConflict) {
      return {
        ...product,
        status: 'unavailable' as const,
        unavailableReason: `Booked until ${conflict.availableFrom?.toLocaleDateString()}`
      };
    }
    
    return product;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-6xl bg-gray-950 h-full shadow-2xl flex flex-col border-l border-gray-800 animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-pink-500/20 text-pink-500">
              <ShoppingBag size={20} />
            </div>
            <div>
               <h2 className="text-xl font-bold text-white">{editRental ? 'Edit Booking' : 'New Rental Booking'}</h2>
               <p className="text-xs text-gray-400">{editRental ? editRental.rentalNo : 'Manage bridal dresses, security & dates'}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-400 hover:text-white">
            <span className="sr-only">Close</span>
            <XIcon />
          </Button>
        </div>

        {/* Main Content Grid */}
        <div className="flex-1 flex overflow-hidden">
            
          {/* Left Side: Product Selection & Date Management */}
          <div className="w-1/2 flex flex-col border-r border-gray-800">
             
             {/* RENTAL SCHEDULE CARD - FIXED HEADER */}
             <div className="shrink-0 p-5 border-b border-gray-800 bg-gray-900/30 space-y-5">
                
                {/* Row 1: Transaction Meta Data */}
                <div className="flex items-center justify-between gap-4">
                   <div className="flex-1 space-y-1">
                      <Label className="text-xs text-gray-500 uppercase">Customer</Label>
                        <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                variant="outline"
                                role="combobox"
                                className="w-full justify-between bg-gray-900 border-gray-700 text-white hover:bg-gray-800 hover:text-white h-9"
                                >
                                {getCustomerName()}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0 bg-gray-900 border-gray-800 text-white">
                                <Command className="bg-gray-900 text-white">
                                    <CommandInput 
                                        placeholder="Search customer..." 
                                        className="h-9 border-none focus:ring-0 text-white"
                                        value={customerSearchTerm}
                                        onValueChange={setCustomerSearchTerm}
                                    />
                                    <CommandList>
                                        <CommandEmpty>
                                        <div className="p-2">
                                            <p className="text-sm text-gray-400 mb-2 text-center">No results found.</p>
                                            <Button 
                                            variant="ghost" 
                                            className="w-full justify-start text-blue-400 hover:text-blue-300"
                                            onClick={() => openDrawer('addContact', undefined, { contactType: 'customer', prefillName: customerSearchTerm || '' })}
                                            >
                                            <PlusCircle size={14} className="mr-2" />
                                            Create "{customerSearchTerm}"?
                                            </Button>
                                        </div>
                                        </CommandEmpty>
                                        <CommandGroup>
                                        {customerList.map((customer) => (
                                            <CommandItem
                                            key={customer.id}
                                            value={customer.name}
                                            onSelect={() => handleCustomerSelect(customer.id.toString())}
                                            className="text-white hover:bg-gray-800 cursor-pointer"
                                            >
                                            <Check
                                                className={cn(
                                                "mr-2 h-4 w-4",
                                                selectedCustomer === customer.id.toString() ? "opacity-100" : "opacity-0"
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
                   <div className="w-32 space-y-1">
                      <Label className="text-xs text-gray-500 uppercase">Invoice #</Label>
                      <div className="h-9 flex items-center px-3 bg-gray-800/50 border border-gray-800 rounded text-sm text-gray-400 font-mono">
                        RENT-1001
                      </div>
                   </div>
                   <div className="w-36 space-y-1">
                      <CalendarDatePicker
                        label="Booking Date"
                        value={bookingDate}
                        onChange={(date) => setBookingDate(date || new Date())}
                        showTime={true}
                      />
                   </div>
                </div>

                {/* Row 2: Rental Timeline (High Emphasis) */}
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 relative overflow-hidden">
                   {/* Visual Connector Line */}
                   <div className="absolute top-1/2 left-4 right-10 border-t-2 border-dashed border-gray-800 -z-0"></div>
                   <ArrowRight className="absolute top-1/2 right-4 -translate-y-1/2 text-gray-800 -z-0" size={16} />
                   
                   <div className="relative z-10 flex items-end justify-between gap-4">
                      
                      {/* Pickup Date */}
                      <div className="space-y-2 flex-1">
                         <Label className="text-xs text-blue-400 uppercase font-bold flex items-center gap-2">
                            <Box size={14} /> Pickup Date
                         </Label>
                         <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                variant={"outline"}
                                className={cn(
                                    "w-full justify-start text-left font-medium bg-gray-800 border-gray-700 text-white hover:bg-gray-700 h-11",
                                    !pickupDate && "text-muted-foreground"
                                )}
                                >
                                <CalendarIcon className="mr-2 h-4 w-4 text-gray-400" />
                                {pickupDate ? format(pickupDate, "PPP") : <span>Pick date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 bg-gray-900 border-gray-800" align="start">
                                <Calendar
                                    mode="single"
                                    selected={pickupDate}
                                    onSelect={setPickupDate}
                                    initialFocus
                                    className="bg-gray-900 text-white"
                                />
                            </PopoverContent>
                        </Popover>
                      </div>

                      {/* Duration Indicator */}
                      <div className="bg-gray-950 px-3 py-1 rounded-full border border-gray-800 text-xs font-mono text-gray-400 mb-3 shrink-0">
                         {totalDays > 0 ? `${totalDays} Days` : '--'}
                      </div>

                      {/* Return Date */}
                      <div className="space-y-2 flex-1">
                         <Label className="text-xs text-green-400 uppercase font-bold flex items-center gap-2">
                             Return Date <Box size={14} className="rotate-180" />
                         </Label>
                         <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                variant={"outline"}
                                className={cn(
                                    "w-full justify-start text-left font-medium bg-gray-800 border-gray-700 text-white hover:bg-gray-700 h-11",
                                    !returnDate && "text-muted-foreground",
                                    hasConflict && "border-red-500 text-red-500 bg-red-900/10"
                                )}
                                >
                                <CalendarIcon className="mr-2 h-4 w-4 text-gray-400" />
                                {returnDate ? format(returnDate, "PPP") : <span>Pick date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 bg-gray-900 border-gray-800" align="end">
                                <Calendar
                                    mode="single"
                                    selected={returnDate}
                                    onSelect={setReturnDate}
                                    initialFocus
                                    className="bg-gray-900 text-white"
                                    fromDate={pickupDate}
                                />
                            </PopoverContent>
                        </Popover>
                      </div>

                   </div>

                   {/* Conflict Warning Toast */}
                   {hasConflict && conflictCheck.message && (
                       <div className="absolute inset-x-0 -bottom-1 bg-red-900/90 backdrop-blur text-white text-xs p-2 flex items-center justify-center gap-2 animate-in slide-in-from-bottom-2">
                          <AlertCircle size={14} className="text-red-300" />
                          <span className="font-semibold">Conflict:</span> {conflictCheck.message}
                       </div>
                   )}
                </div>

                {/* Section 3: Status & Search */}
                <div className="flex gap-4">
                     <div className="w-1/3 space-y-1">
                        <Label className="text-xs text-gray-500 uppercase">Rental Status</Label>
                        <Select value={rentalStatus} onValueChange={setRentalStatus}>
                            <SelectTrigger className="bg-gray-900 border-gray-700 text-white h-9">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-900 border-gray-800 text-white">
                                <SelectItem value="booked">Booked (Reserved)</SelectItem>
                                <SelectItem value="dispatched">Dispatched (Out)</SelectItem>
                                <SelectItem value="returned">Returned</SelectItem>
                                <SelectItem value="overdue">Overdue</SelectItem>
                            </SelectContent>
                        </Select>
                     </div>
                     <div className="flex-1 space-y-1 relative">
                        <Label className="text-xs text-gray-500 uppercase">Product Search</Label>
                        <RentalProductSearch 
                          products={productsWithConflicts} 
                          onSelect={setSelectedProduct} 
                        />
                     </div>
                </div>

             </div>

             {/* Product Grid (Filtered / Display) */}
             <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full p-4 bg-gray-950">
                   <div className="grid grid-cols-1 gap-3">
                       {productsWithConflicts.map((product) => {
                           const isUnavailable = product.status === 'unavailable';
                           const isSelected = selectedProduct?.id === product.id;
                           const isConflict = hasConflict && product.id === selectedProduct?.id; // Only show conflict for selected
                           
                           return (
                               <div 
                                 key={product.id}
                                 onClick={() => !isUnavailable && setSelectedProduct(product)}
                                 className={cn(
                                     "flex gap-4 p-3 rounded-lg border transition-all cursor-pointer relative overflow-hidden",
                                     isSelected ? "bg-pink-900/10 border-pink-500 ring-1 ring-pink-500/50" : "bg-gray-900 border-gray-800 hover:border-gray-700",
                                     (isUnavailable) && "opacity-60 cursor-not-allowed bg-gray-900/50"
                                 )}
                               >
                                   <div className="w-20 h-20 bg-gray-800 rounded-md overflow-hidden shrink-0 flex items-center justify-center">
                                       {product.image ? (
                                         <ProductImage src={product.image} alt={product.name} className={cn("w-full h-full object-cover", isUnavailable && "grayscale")} />
                                       ) : null}
                                       {!product.image && (
                                         <Package className="w-8 h-8 text-gray-500" />
                                       )}
                                   </div>
                                   <div className="flex-1 flex flex-col justify-center">
                                       <div className="flex justify-between items-start">
                                           <h4 className={cn("font-medium text-white", isUnavailable && "line-through text-gray-500")}>{product.name}</h4>
                                           {isUnavailable ? (
                                               <Badge variant="outline" className="bg-red-900/20 text-red-500 border-red-900/50 text-[10px]">
                                                   {product.unavailableReason}
                                               </Badge>
                                           ) : (
                                               <div className="flex gap-2">
                                                   {product.status === 'available' && (
                                                       <Badge variant="outline" className="bg-green-900/20 text-green-500 border-green-900/50 text-[10px]">
                                                         Available
                                                       </Badge>
                                                   )}
                                                   {isConflict && (
                                                       <Badge variant="outline" className="bg-red-900/20 text-red-500 border-red-900/50 text-[10px]">
                                                           Date Conflict
                                                       </Badge>
                                                   )}
                                               </div>
                                           )}
                                       </div>
                                       <p className="text-xs text-gray-500 mb-2">{product.sku}</p>
                                       <div className="flex items-center gap-4 text-sm">
                                           <span className="text-gray-500 line-through text-xs">Retail: {formatCurrency(Number(product.retailPrice) || 0)}</span>
                                           {product.status === 'retail_only' ? (
                                             <span className="font-bold text-blue-400 text-xs bg-blue-900/20 px-2 py-0.5 rounded">Set Rent Manually</span>
                                           ) : (
                                             <span className="font-bold text-pink-400">Rent: {formatCurrency(Number(product.rentPrice) || 0)}</span>
                                           )}
                                       </div>
                                   </div>
                               </div>
                           );
                       })}
                   </div>
              </ScrollArea>
             </div>

          </div>

          {/* Right Side: Security & Summary */}
          <div className="w-1/2 flex flex-col bg-gray-950/50 border-l border-gray-800">
              <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-full p-6">
                  <div className="space-y-6">
                  
                  {/* Selected Item Summary */}
                  {selectedProduct ? (
                      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex gap-4 items-center animate-in fade-in slide-in-from-bottom-4">
                          <div className="w-16 h-16 bg-gray-800 rounded overflow-hidden flex items-center justify-center">
                              {selectedProduct.image ? (
                                <ProductImage src={selectedProduct.image} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <Package className="w-7 h-7 text-gray-500" />
                              )}
                          </div>
                          <div className="flex-1">
                              <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-xs text-gray-400">Selected Item</p>
                                    <h3 className="font-bold text-white">{selectedProduct.name}</h3>
                                </div>
                                {isManualRent && (
                                    <Badge className="bg-blue-600 hover:bg-blue-500 text-white border-none flex items-center gap-1">
                                        <Tag size={12} /> Standard Retail Item
                                    </Badge>
                                )}
                              </div>
                              
                              <div className="mt-2">
                                  <div className="flex flex-col gap-1">
                                      <Label className="text-xs text-gray-400">
                                        {isManualRent ? 'Set Rent Amount (Manual)' : 'Rent Amount (Editable)'}
                                      </Label>
                                      <Input 
                                        value={manualRentPrice}
                                        onChange={(e) => setManualRentPrice(e.target.value)}
                                        placeholder="Enter Rent Amount"
                                        className={cn(
                                            "h-9 font-bold text-white w-48 transition-colors",
                                            isManualRent 
                                                ? "border-blue-500 focus:ring-blue-500 bg-blue-900/10" 
                                                : "border-pink-500/50 focus:border-pink-500 focus:ring-pink-500 bg-gray-900 hover:bg-pink-900/10"
                                        )}
                                        autoFocus={!!isManualRent}
                                      />
                                  </div>
                              </div>
                          </div>
                      </div>
                  ) : (
                      <div className="border border-dashed border-gray-800 rounded-lg p-8 text-center text-gray-500">
                          Select a dress from the list to proceed
                      </div>
                  )}

                  {/* Notes */}
                  <div className="space-y-2">
                      <Label className="text-xs text-gray-500 uppercase">Booking Notes</Label>
                      <Input 
                        placeholder="Measurements, alteration requests, etc." 
                        className="bg-gray-900 border-gray-800 text-white"
                      />
                  </div>

                  {/* Demo: Return Flow Trigger */}
                  <div className="pt-8">
                     <div className="p-3 bg-blue-900/10 border border-blue-900/30 rounded flex items-center gap-3">
                        <Info size={16} className="text-blue-400" />
                        <p className="text-xs text-blue-300 flex-1">
                            Demo: Simulate returning this dress later.
                        </p>
                        <Button size="sm" variant="outline" className="h-7 text-xs border-blue-800 text-blue-400 hover:bg-blue-900/20" onClick={() => setShowReturnModal(true)}>
                            Open Return Flow
                        </Button>
                     </div>
                  </div>

              </div>
                </ScrollArea>
              </div>

              {/* Footer Calculations */}
              <div className="p-6 border-t border-gray-800 bg-gray-950">
                  <div className="space-y-3 mb-4">
                      <div className="flex justify-between text-sm text-gray-400">
                          <span>Total Rent</span>
                          <span className="text-white font-medium">{formatCurrency(currentRentPrice)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm text-gray-400">
                          <span>Advance / Booking Amount</span>
                          <div className="w-32">
                              <Input 
                                className="h-8 text-right bg-gray-900 border-gray-700 text-white"
                                placeholder="0"
                                value={advancePaid}
                                onChange={(e) => setAdvancePaid(e.target.value)}
                              />
                          </div>
                      </div>
                      <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-gray-800">
                          <span>Balance Due</span>
                          <span className="text-pink-500">
                              {formatCurrency(Math.max(0, currentRentPrice - (parseFloat(advancePaid) || 0)))}
                          </span>
                      </div>
                  </div>
                  
                  <Button 
                    className="w-full bg-pink-600 hover:bg-pink-500 text-white font-bold h-12 text-lg shadow-lg shadow-pink-600/20"
                    disabled={!selectedProduct || !!hasConflict || saving}
                    onClick={handleBookOrder}
                  >
                      {saving ? "Saving..." : hasConflict ? "Date Conflict" : "Book Order"} <ArrowRight className="ml-2" size={18} />
                  </Button>
              </div>
          </div>
        </div>

        {/* Return Modal (Attached here for demo context) */}
        {showReturnModal && (
            <ReturnDressModal 
                isOpen={showReturnModal}
                onClose={() => setShowReturnModal(false)}
                customerName={getCustomerName()}
                securityType="id_card"
                securityValue={0}
                returnDate={returnDate || new Date()}
            />
        )}

      </div>
    </div>
  );
};

const XIcon = () => (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5"><path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.1929 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.1929 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
);