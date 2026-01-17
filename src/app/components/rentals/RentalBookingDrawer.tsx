import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  Search, 
  ShoppingBag,
  ArrowRight,
  Info,
  Box,
  AlertCircle,
  Tag
} from 'lucide-react';
import { addDays, differenceInDays } from "date-fns";
import { formatDate } from '../../../utils/dateFormat';
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
import { SecuritySection, SecurityDetails } from './SecuritySection';
import { ReturnDressModal } from './ReturnDressModal';
import { QuickAddContactModal } from '../contacts/QuickAddContactModal';
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

// --- NEW ROBUST MOCK DATA ---
export const demoProducts = [
  {
    id: "P-101",
    name: "Red Bridal Baraat Lehenga (Handwork)",
    sku: "BRD-RED-001",
    category: "Bridal",
    brand: "Sana Safinaz",
    image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=200", 
    isSellable: true,
    isRentable: true,
    sellingPrice: 150000,
    rentalPrice: 35000,
    securityDeposit: 10000,
    status: "AVAILABLE",
    stock: 1
  },
  {
    id: "P-102",
    name: "Gul Ahmed 3-Pc Lawn Suit (Unstitched)",
    sku: "LWN-SUM-2025",
    category: "Unstitched",
    brand: "Gul Ahmed",
    image: "https://images.unsplash.com/photo-1617112036732-47c3edae80ee?auto=format&fit=crop&w=200", 
    isSellable: true,
    isRentable: false, // Retail Only
    sellingPrice: 4500,
    rentalPrice: null, // Logic Test: System should prompt for Manual Price
    securityDeposit: null,
    status: "AVAILABLE",
    stock: 50
  },
  {
    id: "P-103",
    name: "Groom Golden Sherwani (Premium)",
    sku: "SHR-GLD-099",
    category: "Groom Wear",
    brand: "J. Junaid Jamshed",
    image: "https://images.unsplash.com/photo-1596462502278-27bfdd403ea6?auto=format&fit=crop&w=200", 
    isSellable: true,
    isRentable: true,
    sellingPrice: 65000,
    rentalPrice: 12000,
    securityDeposit: 5000,
    status: "AVAILABLE",
    stock: 2
  },
  {
    id: "P-104",
    name: "Silver Zircon Jewelry Set",
    sku: "JWL-SIL-005",
    category: "Accessories",
    brand: "Local",
    image: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=200", 
    isSellable: false,
    isRentable: true,
    sellingPrice: 0,
    rentalPrice: 5000,
    securityDeposit: 15000,
    status: "RENTED_OUT", // Logic Test: Should show as Unavailable
    stock: 0
  }
];

const customers = [
    { id: 1, name: "Walk-in Customer" },
    { id: 2, name: "Sarah Khan" },
    { id: 3, name: "Fatima Ali" },
  ];

interface RentalBookingDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

export const RentalBookingDrawer = ({ isOpen, onClose }: RentalBookingDrawerProps) => {
  // Context State
  const [bookingDate, setBookingDate] = useState<Date>(new Date());
  const [pickupDate, setPickupDate] = useState<Date | undefined>(new Date());
  const [returnDate, setReturnDate] = useState<Date | undefined>(addDays(new Date(), 3));
  const [rentalStatus, setRentalStatus] = useState("booked");

  const [selectedCustomer, setSelectedCustomer] = useState<string>("1");
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [isQuickContactOpen, setIsQuickContactOpen] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [customerList, setCustomerList] = useState(customers);

  // Cart State
  const [selectedProduct, setSelectedProduct] = useState<SearchProduct | null>(null);
  const [manualRentPrice, setManualRentPrice] = useState<string>('');
  const [advancePaid, setAdvancePaid] = useState('');
  
  // Security State
  const [securityDetails, setSecurityDetails] = useState<SecurityDetails | null>(null);

  // Return Modal State
  const [showReturnModal, setShowReturnModal] = useState(false);

  // --- DATA MAPPING LOGIC ---
  const mappedProducts: SearchProduct[] = demoProducts.map(p => {
    let status: SearchProduct['status'] = 'available';
    let unavailableReason = undefined;

    if (p.status === 'RENTED_OUT') {
        status = 'unavailable';
        unavailableReason = 'Rented Out';
    } else if (!p.isRentable && p.isSellable) {
        status = 'retail_only';
    }

    return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        image: p.image,
        status,
        unavailableReason,
        rentPrice: p.rentalPrice,
        retailPrice: p.sellingPrice,
        category: p.category,
        brand: p.brand,
        securityDeposit: p.securityDeposit
    };
  });

  // Update manual rent price when product changes
  useEffect(() => {
    if (selectedProduct) {
        if (selectedProduct.rentPrice && selectedProduct.rentPrice > 0) {
            setManualRentPrice(selectedProduct.rentPrice.toString());
        } else {
            setManualRentPrice(''); // Clear for manual entry
        }
    }
  }, [selectedProduct]);

  if (!isOpen) return null;

  const totalDays = pickupDate && returnDate 
    ? differenceInDays(returnDate, pickupDate) 
    : 0;

  const handleCustomerSelect = (id: string) => {
      setSelectedCustomer(id);
      setCustomerSearchOpen(false);
  };

  const handleSaveContact = (newContact: any) => {
    setCustomerList(prev => [...prev, newContact]);
    setSelectedCustomer(newContact.id.toString());
    setCustomerSearchOpen(false);
  };
  
  const getCustomerName = () => {
      const c = customerList.find(x => x.id.toString() === selectedCustomer);
      return c ? c.name : "Unknown";
  };

  // Mock Conflict Check
  // Logic: If status is 'unavailable' in search product, it is already handled.
  // We can add extra date conflict logic if needed, but for now relies on status.
  const isDateConflict = (product: SearchProduct) => {
     // Example: Specific logic for the red lehenga
     if (product.id === "P-101" && totalDays > 7) return true;
     return false;
  };

  const hasConflict = selectedProduct && isDateConflict(selectedProduct);
  const isManualRent = selectedProduct && (selectedProduct.rentPrice === null || selectedProduct.rentPrice === 0);
  const currentRentPrice = parseFloat(manualRentPrice) || 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div 
        className="w-full max-w-6xl h-full shadow-2xl flex flex-col border-l animate-in slide-in-from-right duration-300"
        style={{
          backgroundColor: 'var(--color-bg-tertiary)',
          borderLeftColor: 'var(--color-border-primary)'
        }}
      >
        
        {/* Header */}
        <div 
          className="px-6 py-4 border-b flex items-center justify-between"
          style={{
            borderBottomColor: 'var(--color-border-primary)',
            backgroundColor: 'rgba(17, 24, 39, 0.5)'
          }}
        >
          <div className="flex items-center gap-3">
            <div 
              className="p-2 rounded-lg"
              style={{
                backgroundColor: 'rgba(236, 72, 153, 0.2)',
                borderRadius: 'var(--radius-lg)',
                color: 'var(--color-primary)'
              }}
            >
              <ShoppingBag size={20} />
            </div>
            <div>
               <h2 
                 className="text-xl font-bold"
                 style={{ color: 'var(--color-text-primary)' }}
               >
                 New Rental Booking
               </h2>
               <p 
                 className="text-xs"
                 style={{ color: 'var(--color-text-secondary)' }}
               >
                 Manage bridal dresses, security & dates
               </p>
            </div>
          </div>
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
            <span className="sr-only">Close</span>
            <XIcon />
          </Button>
        </div>

        {/* Main Content Grid */}
        <div className="flex-1 flex overflow-hidden">
            
          {/* Left Side: Product Selection & Date Management */}
          <div 
            className="w-1/2 flex flex-col border-r"
            style={{ borderRightColor: 'var(--color-border-primary)' }}
          >
             
             {/* RENTAL SCHEDULE CARD */}
             <div 
               className="p-5 border-b space-y-5"
               style={{
                 borderBottomColor: 'var(--color-border-primary)',
                 backgroundColor: 'rgba(17, 24, 39, 0.3)'
               }}
             >
                
                {/* Row 1: Transaction Meta Data */}
                <div className="flex items-center justify-between gap-4">
                   <div className="flex-1 space-y-1">
                      <Label 
                        className="text-xs uppercase"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >
                        Customer
                      </Label>
                        <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                variant="outline"
                                role="combobox"
                                className="w-full justify-between h-9"
                                style={{
                                  backgroundColor: 'var(--color-bg-card)',
                                  borderColor: 'var(--color-border-secondary)',
                                  color: 'var(--color-text-primary)'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                                  e.currentTarget.style.color = 'var(--color-text-primary)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
                                  e.currentTarget.style.color = 'var(--color-text-primary)';
                                }}
                                >
                                {getCustomerName()}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent 
                              className="w-[300px] p-0"
                              style={{
                                backgroundColor: 'var(--color-bg-card)',
                                borderColor: 'var(--color-border-primary)',
                                color: 'var(--color-text-primary)'
                              }}
                            >
                                <Command
                                  style={{
                                    backgroundColor: 'var(--color-bg-card)',
                                    color: 'var(--color-text-primary)'
                                  }}
                                >
                                    <CommandInput 
                                        placeholder="Search customer..." 
                                        className="h-9 border-none focus:ring-0"
                                        value={customerSearchTerm}
                                        onValueChange={setCustomerSearchTerm}
                                        style={{ color: 'var(--color-text-primary)' }}
                                    />
                                    <CommandList>
                                        <CommandEmpty>
                                        <div className="p-2">
                                            <p 
                                              className="text-sm mb-2 text-center"
                                              style={{ color: 'var(--color-text-secondary)' }}
                                            >
                                              No results found.
                                            </p>
                                            <Button 
                                            variant="ghost" 
                                            className="w-full justify-start"
                                            style={{ color: 'var(--color-primary)' }}
                                            onMouseEnter={(e) => {
                                              e.currentTarget.style.color = 'var(--color-primary)';
                                            }}
                                            onMouseLeave={(e) => {
                                              e.currentTarget.style.color = 'var(--color-primary)';
                                            }}
                                            onClick={() => setIsQuickContactOpen(true)}
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
                                            className="cursor-pointer"
                                            style={{
                                              color: 'var(--color-text-primary)'
                                            }}
                                            onMouseEnter={(e) => {
                                              e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                                            }}
                                            onMouseLeave={(e) => {
                                              e.currentTarget.style.backgroundColor = 'transparent';
                                            }}
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
                      <Label 
                        className="text-xs uppercase"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >
                        Invoice #
                      </Label>
                      <div 
                        className="h-9 flex items-center px-3 border rounded text-sm font-mono"
                        style={{
                          backgroundColor: 'rgba(31, 41, 55, 0.5)',
                          borderColor: 'var(--color-border-primary)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--color-text-secondary)'
                        }}
                      >
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
                <div 
                  className="border rounded-lg p-4 relative overflow-hidden"
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-primary)',
                    borderRadius: 'var(--radius-lg)'
                  }}
                >
                   {/* Visual Connector Line */}
                   <div 
                     className="absolute top-1/2 left-4 right-10 border-t-2 border-dashed -z-0"
                     style={{ borderColor: 'var(--color-border-primary)' }}
                   ></div>
                   <ArrowRight 
                     className="absolute top-1/2 right-4 -translate-y-1/2 -z-0" 
                     size={16}
                     style={{ color: 'var(--color-border-primary)' }}
                   />
                   
                   <div className="relative z-10 flex items-end justify-between gap-4">
                      
                      {/* Pickup Date */}
                      <div className="space-y-2 flex-1">
                         <Label 
                           className="text-xs uppercase font-bold flex items-center gap-2"
                           style={{ color: 'var(--color-primary)' }}
                         >
                            <Box size={14} /> Pickup Date
                         </Label>
                         <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                variant={"outline"}
                                className="w-full justify-start text-left font-medium h-11"
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
                                <CalendarIcon 
                                  className="mr-2 h-4 w-4"
                                  style={{ color: 'var(--color-text-secondary)' }}
                                />
                                {pickupDate ? formatDate(pickupDate) : <span>Pick date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent 
                              className="w-auto p-0"
                              align="start"
                              style={{
                                backgroundColor: 'var(--color-bg-card)',
                                borderColor: 'var(--color-border-primary)'
                              }}
                            >
                                <Calendar
                                    mode="single"
                                    selected={pickupDate}
                                    onSelect={setPickupDate}
                                    initialFocus
                                    style={{
                                      backgroundColor: 'var(--color-bg-card)',
                                      color: 'var(--color-text-primary)'
                                    }}
                                />
                            </PopoverContent>
                        </Popover>
                      </div>

                      {/* Duration Indicator */}
                      <div 
                        className="px-3 py-1 rounded-full border text-xs font-mono mb-3 shrink-0"
                        style={{
                          backgroundColor: 'var(--color-bg-tertiary)',
                          borderColor: 'var(--color-border-primary)',
                          borderRadius: 'var(--radius-full)',
                          color: 'var(--color-text-secondary)'
                        }}
                      >
                         {totalDays > 0 ? `${totalDays} Days` : '--'}
                      </div>

                      {/* Return Date */}
                      <div className="space-y-2 flex-1">
                         <Label 
                           className="text-xs uppercase font-bold flex items-center gap-2"
                           style={{ color: 'var(--color-success)' }}
                         >
                             Return Date <Box size={14} className="rotate-180" />
                         </Label>
                         <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                variant={"outline"}
                                className={cn(
                                    "w-full justify-start text-left font-medium h-11",
                                    !returnDate && "text-muted-foreground"
                                )}
                                style={{
                                  backgroundColor: hasConflict 
                                    ? 'rgba(127, 29, 29, 0.1)' 
                                    : 'var(--color-bg-card)',
                                  borderColor: hasConflict 
                                    ? 'var(--color-error)' 
                                    : 'var(--color-border-secondary)',
                                  color: hasConflict 
                                    ? 'var(--color-error)' 
                                    : 'var(--color-text-primary)'
                                }}
                                onMouseEnter={(e) => {
                                  if (!hasConflict) {
                                    e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!hasConflict) {
                                    e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
                                  }
                                }}
                                >
                                <CalendarIcon 
                                  className="mr-2 h-4 w-4"
                                  style={{ color: 'var(--color-text-secondary)' }}
                                />
                                {returnDate ? formatDate(returnDate) : <span>Pick date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent 
                              className="w-auto p-0"
                              align="end"
                              style={{
                                backgroundColor: 'var(--color-bg-card)',
                                borderColor: 'var(--color-border-primary)'
                              }}
                            >
                                <Calendar
                                    mode="single"
                                    selected={returnDate}
                                    onSelect={setReturnDate}
                                    initialFocus
                                    style={{
                                      backgroundColor: 'var(--color-bg-card)',
                                      color: 'var(--color-text-primary)'
                                    }}
                                    fromDate={pickupDate}
                                />
                            </PopoverContent>
                        </Popover>
                      </div>

                   </div>

                   {/* Conflict Warning Toast */}
                   {hasConflict && (
                       <div 
                         className="absolute inset-x-0 -bottom-1 backdrop-blur text-xs p-2 flex items-center justify-center gap-2 animate-in slide-in-from-bottom-2"
                         style={{
                           backgroundColor: 'rgba(127, 29, 29, 0.9)',
                           color: 'var(--color-text-primary)'
                         }}
                       >
                          <AlertCircle size={14} style={{ color: 'var(--color-error)' }} />
                          <span className="font-semibold">Conflict:</span> This dress is booked by another client for {'>'}7 days rental.
                       </div>
                   )}
                </div>

                {/* Section 3: Status & Search */}
                <div className="flex gap-4">
                     <div className="w-1/3 space-y-1">
                        <Label 
                          className="text-xs uppercase"
                          style={{ color: 'var(--color-text-tertiary)' }}
                        >
                          Rental Status
                        </Label>
                        <Select value={rentalStatus} onValueChange={setRentalStatus}>
                            <SelectTrigger 
                              className="h-9"
                              style={{
                                backgroundColor: 'var(--color-bg-card)',
                                borderColor: 'var(--color-border-secondary)',
                                color: 'var(--color-text-primary)'
                              }}
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent
                              style={{
                                backgroundColor: 'var(--color-bg-card)',
                                borderColor: 'var(--color-border-primary)',
                                color: 'var(--color-text-primary)'
                              }}
                            >
                                <SelectItem value="booked">Booked (Reserved)</SelectItem>
                                <SelectItem value="dispatched">Dispatched (Out)</SelectItem>
                                <SelectItem value="returned">Returned</SelectItem>
                                <SelectItem value="overdue">Overdue</SelectItem>
                            </SelectContent>
                        </Select>
                     </div>
                     <div className="flex-1 space-y-1 relative">
                        <Label 
                          className="text-xs uppercase"
                          style={{ color: 'var(--color-text-tertiary)' }}
                        >
                          Product Search
                        </Label>
                        <RentalProductSearch 
                          products={mappedProducts} 
                          onSelect={setSelectedProduct} 
                        />
                     </div>
                </div>

             </div>

             {/* Product Grid (Filtered / Display) */}
             <ScrollArea 
               className="flex-1 p-4"
               style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
             >
                  <div className="grid grid-cols-1 gap-3">
                      {mappedProducts.map((product) => {
                          const isUnavailable = product.status === 'unavailable';
                          const isSelected = selectedProduct?.id === product.id;
                          const isConflict = hasConflict && product.id === selectedProduct?.id; // Only show conflict for selected
                          
                          return (
                              <div 
                                key={product.id}
                                onClick={() => !isUnavailable && setSelectedProduct(product)}
                                className={cn(
                                    "flex gap-4 p-3 rounded-lg border transition-all cursor-pointer relative overflow-hidden",
                                    (isUnavailable) && "opacity-60 cursor-not-allowed"
                                )}
                                style={{
                                  backgroundColor: isSelected 
                                    ? 'rgba(236, 72, 153, 0.1)' 
                                    : isUnavailable 
                                      ? 'rgba(17, 24, 39, 0.5)' 
                                      : 'var(--color-bg-card)',
                                  borderColor: isSelected 
                                    ? 'var(--color-primary)' 
                                    : 'var(--color-border-primary)',
                                  borderRadius: 'var(--radius-lg)',
                                  boxShadow: isSelected ? '0 0 0 1px rgba(236, 72, 153, 0.5)' : 'none'
                                }}
                                onMouseEnter={(e) => {
                                  if (!isUnavailable && !isSelected) {
                                    e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!isUnavailable && !isSelected) {
                                    e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                                  }
                                }}
                              >
                                  <div 
                                    className="w-20 h-20 rounded-md overflow-hidden shrink-0"
                                    style={{
                                      backgroundColor: 'var(--color-bg-card)',
                                      borderRadius: 'var(--radius-md)'
                                    }}
                                  >
                                      <img src={product.image} alt={product.name} className={cn("w-full h-full object-cover", isUnavailable && "grayscale")} />
                                  </div>
                                  <div className="flex-1 flex flex-col justify-center">
                                      <div className="flex justify-between items-start">
                                          <h4 
                                            className={cn("font-medium", isUnavailable && "line-through")}
                                            style={{ 
                                              color: isUnavailable 
                                                ? 'var(--color-text-tertiary)' 
                                                : 'var(--color-text-primary)' 
                                            }}
                                          >
                                            {product.name}
                                          </h4>
                                          {isUnavailable ? (
                                              <Badge 
                                                variant="outline" 
                                                className="text-[10px]"
                                                style={{
                                                  backgroundColor: 'rgba(127, 29, 29, 0.2)',
                                                  color: 'var(--color-error)',
                                                  borderColor: 'rgba(127, 29, 29, 0.5)'
                                                }}
                                              >
                                                  {product.unavailableReason}
                                              </Badge>
                                          ) : (
                                              <div className="flex gap-2">
                                                  {product.status === 'available' && (
                                                      <Badge 
                                                        variant="outline" 
                                                        className="text-[10px]"
                                                        style={{
                                                          backgroundColor: 'rgba(5, 150, 105, 0.2)',
                                                          color: 'var(--color-success)',
                                                          borderColor: 'rgba(5, 150, 105, 0.5)'
                                                        }}
                                                      >
                                                        Available
                                                      </Badge>
                                                  )}
                                                  {isConflict && (
                                                      <Badge 
                                                        variant="outline" 
                                                        className="text-[10px]"
                                                        style={{
                                                          backgroundColor: 'rgba(127, 29, 29, 0.2)',
                                                          color: 'var(--color-error)',
                                                          borderColor: 'rgba(127, 29, 29, 0.5)'
                                                        }}
                                                      >
                                                          Date Conflict
                                                      </Badge>
                                                  )}
                                              </div>
                                          )}
                                      </div>
                                      <p 
                                        className="text-xs mb-2"
                                        style={{ color: 'var(--color-text-tertiary)' }}
                                      >
                                        {product.sku}
                                      </p>
                                      <div className="flex items-center gap-4 text-sm">
                                          <span 
                                            className="line-through text-xs"
                                            style={{ color: 'var(--color-text-tertiary)' }}
                                          >
                                            Retail: ${product.retailPrice.toLocaleString()}
                                          </span>
                                          {product.status === 'retail_only' ? (
                                            <span 
                                              className="font-bold text-xs px-2 py-0.5 rounded"
                                              style={{
                                                color: 'var(--color-primary)',
                                                backgroundColor: 'rgba(30, 58, 138, 0.2)',
                                                borderRadius: 'var(--radius-sm)'
                                              }}
                                            >
                                              Set Rent Manually
                                            </span>
                                          ) : (
                                            <span 
                                              className="font-bold"
                                              style={{ color: 'var(--color-primary)' }}
                                            >
                                              Rent: ${product.rentPrice?.toLocaleString() ?? '0'}
                                            </span>
                                          )}
                                      </div>
                                  </div>
                              </div>
                          );
                      })}
                  </div>
             </ScrollArea>

          </div>

          {/* Right Side: Security & Summary */}
          <div 
            className="w-1/2 flex flex-col border-l"
            style={{
              backgroundColor: 'rgba(17, 24, 39, 0.5)',
              borderLeftColor: 'var(--color-border-primary)'
            }}
          >
              <ScrollArea className="flex-1 p-6 space-y-6">
                  
                  {/* Selected Item Summary */}
                  {selectedProduct ? (
                      <div 
                        className="border rounded-lg p-4 flex gap-4 items-center animate-in fade-in slide-in-from-bottom-4"
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-primary)',
                          borderRadius: 'var(--radius-lg)'
                        }}
                      >
                          <div 
                            className="w-16 h-16 rounded overflow-hidden"
                            style={{
                              backgroundColor: 'var(--color-bg-card)',
                              borderRadius: 'var(--radius-sm)'
                            }}
                          >
                              <img src={selectedProduct.image} alt="" className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1">
                              <div className="flex items-start justify-between">
                                <div>
                                    <p 
                                      className="text-xs"
                                      style={{ color: 'var(--color-text-secondary)' }}
                                    >
                                      Selected Item
                                    </p>
                                    <h3 
                                      className="font-bold"
                                      style={{ color: 'var(--color-text-primary)' }}
                                    >
                                      {selectedProduct.name}
                                    </h3>
                                </div>
                                {isManualRent && (
                                    <Badge 
                                      className="border-none flex items-center gap-1"
                                      style={{
                                        backgroundColor: 'var(--color-primary)',
                                        color: 'var(--color-text-primary)'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.opacity = '0.9';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.opacity = '1';
                                      }}
                                    >
                                        <Tag size={12} /> Standard Retail Item
                                    </Badge>
                                )}
                              </div>
                              
                              <div className="mt-2">
                                  <div className="flex flex-col gap-1">
                                      <Label 
                                        className="text-xs"
                                        style={{ color: 'var(--color-text-secondary)' }}
                                      >
                                        {isManualRent ? 'Set Rent Amount (Manual)' : 'Rent Amount (Editable)'}
                                      </Label>
                                      <Input 
                                        value={manualRentPrice}
                                        onChange={(e) => setManualRentPrice(e.target.value)}
                                        placeholder="Enter Rent Amount"
                                        className="h-9 font-bold w-48 transition-colors"
                                        style={{
                                          borderColor: isManualRent 
                                            ? 'var(--color-primary)' 
                                            : 'rgba(236, 72, 153, 0.5)',
                                          backgroundColor: isManualRent 
                                            ? 'rgba(30, 58, 138, 0.1)' 
                                            : 'var(--color-bg-card)',
                                          color: 'var(--color-text-primary)'
                                        }}
                                        onFocus={(e) => {
                                          e.target.style.borderColor = isManualRent 
                                            ? 'var(--color-primary)' 
                                            : 'var(--color-primary)';
                                          e.target.style.boxShadow = isManualRent 
                                            ? '0 0 0 2px rgba(59, 130, 246, 0.2)' 
                                            : '0 0 0 2px rgba(236, 72, 153, 0.2)';
                                        }}
                                        onBlur={(e) => {
                                          e.target.style.borderColor = isManualRent 
                                            ? 'var(--color-primary)' 
                                            : 'rgba(236, 72, 153, 0.5)';
                                          e.target.style.boxShadow = 'none';
                                        }}
                                        autoFocus={!!isManualRent}
                                      />
                                  </div>
                              </div>
                          </div>
                      </div>
                  ) : (
                      <div 
                        className="border border-dashed rounded-lg p-8 text-center"
                        style={{
                          borderColor: 'var(--color-border-primary)',
                          borderRadius: 'var(--radius-lg)',
                          color: 'var(--color-text-tertiary)'
                        }}
                      >
                          Select a dress from the list to proceed
                      </div>
                  )}

                  {/* Security Section */}
                  <SecuritySection onChange={setSecurityDetails} />

                  {/* Notes */}
                  <div className="space-y-2">
                      <Label 
                        className="text-xs uppercase"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >
                        Booking Notes
                      </Label>
                      <Input 
                        placeholder="Measurements, alteration requests, etc."
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-primary)',
                          color: 'var(--color-text-primary)'
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = 'var(--color-primary)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = 'var(--color-border-primary)';
                        }}
                      />
                  </div>

                  {/* Demo: Return Flow Trigger */}
                  <div className="pt-8">
                     <div 
                       className="p-3 border rounded flex items-center gap-3"
                       style={{
                         backgroundColor: 'rgba(30, 58, 138, 0.1)',
                         borderColor: 'rgba(30, 58, 138, 0.3)',
                         borderRadius: 'var(--radius-sm)'
                       }}
                     >
                        <Info size={16} style={{ color: 'var(--color-primary)' }} />
                        <p 
                          className="text-xs flex-1"
                          style={{ color: 'var(--color-primary)' }}
                        >
                            Demo: Simulate returning this dress later.
                        </p>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-7 text-xs"
                          style={{
                            borderColor: 'rgba(30, 58, 138, 0.5)',
                            color: 'var(--color-primary)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(30, 58, 138, 0.2)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                          onClick={() => setShowReturnModal(true)}
                        >
                            Open Return Flow
                        </Button>
                     </div>
                  </div>

              </ScrollArea>

              {/* Footer Calculations */}
              <div 
                className="p-6 border-t"
                style={{
                  borderTopColor: 'var(--color-border-primary)',
                  backgroundColor: 'var(--color-bg-tertiary)'
                }}
              >
                  <div className="space-y-3 mb-4">
                      <div 
                        className="flex justify-between text-sm"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                          <span>Total Rent</span>
                          <span 
                            className="font-medium"
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                            ${currentRentPrice.toLocaleString()}
                          </span>
                      </div>
                      <div 
                        className="flex justify-between items-center text-sm"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                          <span>Advance / Booking Amount</span>
                          <div className="w-32">
                              <Input 
                                className="h-8 text-right"
                                placeholder="0"
                                value={advancePaid}
                                onChange={(e) => setAdvancePaid(e.target.value)}
                                style={{
                                  backgroundColor: 'var(--color-bg-card)',
                                  borderColor: 'var(--color-border-secondary)',
                                  color: 'var(--color-text-primary)'
                                }}
                                onFocus={(e) => {
                                  e.target.style.borderColor = 'var(--color-primary)';
                                }}
                                onBlur={(e) => {
                                  e.target.style.borderColor = 'var(--color-border-secondary)';
                                }}
                              />
                          </div>
                      </div>
                      <div 
                        className="flex justify-between text-sm font-bold pt-2 border-t"
                        style={{
                          color: 'var(--color-text-primary)',
                          borderTopColor: 'var(--color-border-primary)'
                        }}
                      >
                          <span>Balance Due</span>
                          <span style={{ color: 'var(--color-primary)' }}>
                              ${Math.max(0, currentRentPrice - (parseFloat(advancePaid) || 0)).toLocaleString()}
                          </span>
                      </div>
                  </div>
                  
                  <Button 
                    className="w-full font-bold h-12 text-lg shadow-lg"
                    style={{
                      backgroundColor: 'var(--color-primary)',
                      color: 'var(--color-text-primary)',
                      boxShadow: '0 10px 15px -3px rgba(236, 72, 153, 0.2)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                      e.currentTarget.style.opacity = '0.9';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                      e.currentTarget.style.opacity = '1';
                    }}
                    disabled={!selectedProduct || !securityDetails || !!hasConflict}
                  >
                      {hasConflict ? "Date Conflict" : "Book Order"} <ArrowRight className="ml-2" size={18} />
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
                securityType={securityDetails?.type || 'id_card'}
                securityValue={securityDetails?.type === 'cash' ? parseFloat(securityDetails.reference) || 0 : 0}
                returnDate={returnDate || new Date()}
            />
        )}

        <QuickAddContactModal 
          isOpen={isQuickContactOpen}
          onClose={() => setIsQuickContactOpen(false)}
          onSave={handleSaveContact}
          initialName={customerSearchTerm}
          contactType="customer"
        />

      </div>
    </div>
  );
};

const XIcon = () => (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5"><path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.1929 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.1929 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
);
