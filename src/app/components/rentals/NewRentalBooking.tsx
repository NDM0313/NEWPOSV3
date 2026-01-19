import React, { useState, useEffect, useCallback } from 'react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { productService } from '@/app/services/productService';
import { contactService } from '@/app/services/contactService';
import { rentalService } from '@/app/services/rentalService';
import { toast } from 'sonner';
import {
  Calendar,
  Search,
  AlertTriangle,
  CheckCircle2,
  Shield,
  FileText,
  CreditCard,
  Printer,
  Clock,
  ArrowRight,
  User,
  Lock,
  DollarSign,
  Package,
  Info,
  ChevronDown,
  Image as ImageIcon
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import { CalendarDatePicker } from '../ui/CalendarDatePicker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { cn } from '../ui/utils';

interface RentalProduct {
  id: string;
  sku: string;
  name: string;
  category: 'bridal' | 'groom' | 'accessories';
  image: string;
  retailValue: number;
  rentPrice: number;
  perDayPrice: number;
  stock: number;
  bookings: {
    pickupDate: Date;
    returnDate: Date;
    invoiceNo: string;
  }[];
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  type: 'walk-in' | 'registered';
  cnic?: string;
}

interface SelectedItem {
  product: RentalProduct;
  quantity: number;
  customPrice?: number;
}

// Products and customers will be loaded from Supabase

export const NewRentalBooking = () => {
  const { companyId, branchId, user } = useSupabase();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Data states
  const [products, setProducts] = useState<RentalProduct[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  
  // Step A: Date Selection (Priority)
  const [pickupDate, setPickupDate] = useState<Date | undefined>(undefined);
  const [returnDate, setReturnDate] = useState<Date | undefined>(undefined);
  const [datesLocked, setDatesLocked] = useState(false);
  
  // Customer
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  
  // Product Selection
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  
  // Load products and customers from Supabase
  const loadData = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Load products (rentable only)
      const allProducts = await productService.getAllProducts(companyId);
      const rentableProducts: RentalProduct[] = allProducts
        .filter(p => p.is_rentable)
        .map(p => ({
          id: p.id,
          sku: p.sku || '',
          name: p.name,
          category: (p.category?.name?.toLowerCase() || 'bridal') as 'bridal' | 'groom' | 'accessories',
          image: p.image_url || '/placeholder-product.jpg',
          retailValue: p.retail_price || 0,
          rentPrice: p.rental_price_daily ? p.rental_price_daily * 3 : 0,
          perDayPrice: p.rental_price_daily || 0,
          stock: p.current_stock || 0,
          bookings: [] // Will be loaded from rentals if needed
        }));
      setProducts(rentableProducts);
      
      // Load customers
      const allContacts = await contactService.getAllContacts(companyId);
      const customerList: Customer[] = [
        { id: 'WALK', name: 'Walk-in Customer', phone: '', type: 'walk-in' },
        ...allContacts
          .filter(c => c.type === 'customer' && c.is_active)
          .map(c => ({
            id: c.id,
            name: c.name,
            phone: c.phone || '',
            type: 'registered' as const,
            cnic: c.cnic
          }))
      ];
      setCustomers(customerList);
      
      // Set default customer
      if (customerList.length > 0 && !selectedCustomer) {
        setSelectedCustomer(customerList[0]);
      }
    } catch (error: any) {
      console.error('[NEW RENTAL BOOKING] Error loading data:', error);
      toast.error('Failed to load data: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedCustomer]);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [loadData]);
  
  // Security & Documents
  const [securityType, setSecurityType] = useState<'id-card' | 'passport' | 'cash'>('id-card');
  const [documentReceived, setDocumentReceived] = useState(false);
  const [securityAmount, setSecurityAmount] = useState<number>(0);
  
  // Payment
  const [advanceAmount, setAdvanceAmount] = useState<number>(0);
  const [bookingNotes, setBookingNotes] = useState('');
  
  // Invoice Details
  const invoiceNumber = 'RENT-1001';
  const bookingDate = new Date();
  
  // Calculate rental days
  const rentalDays = pickupDate && returnDate
    ? Math.ceil((returnDate.getTime() - pickupDate.getTime()) / (1000 * 60 * 60 * 24))
    : 3;
  
  // Check if product is available for selected dates
  const isProductAvailable = (product: RentalProduct): { available: boolean; conflictDates?: string } => {
    if (!pickupDate || !returnDate) return { available: true };
    
    for (const booking of product.bookings) {
      const bookingStart = booking.pickupDate.getTime();
      const bookingEnd = booking.returnDate.getTime();
      const selectedStart = pickupDate.getTime();
      const selectedEnd = returnDate.getTime();
      
      // Check for overlap
      if (
        (selectedStart >= bookingStart && selectedStart <= bookingEnd) ||
        (selectedEnd >= bookingStart && selectedEnd <= bookingEnd) ||
        (selectedStart <= bookingStart && selectedEnd >= bookingEnd)
      ) {
        const conflictDates = `${booking.pickupDate.toLocaleDateString()} - ${booking.returnDate.toLocaleDateString()}`;
        return { available: false, conflictDates };
      }
    }
    
    return { available: true };
  };
  
  // Filter products based on search
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Handle save booking
  const handleSaveBooking = async () => {
    if (!companyId || !branchId || !user) {
      toast.error('System error: Missing company or user information');
      return;
    }
    
    if (!selectedCustomer || !pickupDate || !returnDate) {
      toast.error('Please fill all required fields');
      return;
    }

    if (selectedItems.length === 0) {
      toast.error('Please select at least one product');
      return;
    }

    try {
      setSaving(true);

      // Determine customer ID
      let customerId = selectedCustomer.id;
      let customerNameValue = selectedCustomer.name;

      // If walk-in customer, create contact first
      if (selectedCustomer && selectedCustomer.type === 'walk-in') {
        if (!customerName || !customerPhone) {
          toast.error('Please enter customer name and phone');
          setSaving(false);
          return;
        }

        const newContact = await contactService.createContact({
          company_id: companyId,
          name: customerName,
          phone: customerPhone,
          type: 'customer',
          is_active: true,
        });
        customerId = newContact.id;
        customerNameValue = customerName;
      }

      // Convert items to rental items format
      const rentalItems = selectedItems.map(item => ({
        product_id: item.product.id,
        product_name: item.product.name,
        quantity: item.quantity,
        rate_per_day: item.product.perDayPrice,
        duration_days: rentalDays,
        total: (item.customPrice || item.product.rentPrice) + (Math.max(0, rentalDays - 3) * item.product.perDayPrice),
      }));

      // Calculate totals
      const rentalCharges = totalRent;
      const totalAmount = rentalCharges + securityAmount;

      // Create rental
      const rental = await rentalService.createRental({
        company_id: companyId,
        branch_id: branchId,
        booking_date: bookingDate.toISOString().split('T')[0],
        customer_id: customerId,
        customer_name: customerNameValue,
        status: 'booked',
        pickup_date: pickupDate.toISOString().split('T')[0],
        return_date: returnDate.toISOString().split('T')[0],
        duration_days: rentalDays,
        rental_charges: rentalCharges,
        security_deposit: securityAmount,
        total_amount: totalAmount,
        paid_amount: advanceAmount,
        notes: bookingNotes,
        created_by: user.id,
      }, rentalItems);

      toast.success(`Rental booking ${rental.booking_no || rental.id} created successfully!`);
      
      // Reset form
      setSelectedItems([]);
      setPickupDate(undefined);
      setReturnDate(undefined);
      setDatesLocked(false);
      setAdvanceAmount(0);
      setSecurityAmount(0);
      setBookingNotes('');
      setDocumentReceived(false);
      
      // Reload data
      await loadData();
    } catch (error: any) {
      console.error('[NEW RENTAL BOOKING] Error saving booking:', error);
      toast.error('Failed to create booking: ' + (error.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };
  
  // Calculate totals
  const calculateTotalRent = () => {
    return selectedItems.reduce((total, item) => {
      const baseDays = 3;
      const basePrice = item.customPrice || item.product.rentPrice;
      const extraDays = Math.max(0, rentalDays - baseDays);
      const extraCharges = extraDays * item.product.perDayPrice;
      return total + (basePrice + extraCharges) * item.quantity;
    }, 0);
  };
  
  const totalRent = calculateTotalRent();
  const balanceDue = totalRent - advanceAmount;
  
  // Add item to cart
  const handleAddItem = (product: RentalProduct) => {
    const existing = selectedItems.find(item => item.product.id === product.id);
    if (existing) {
      setSelectedItems(selectedItems.map(item =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setSelectedItems([...selectedItems, { product, quantity: 1 }]);
    }
  };
  
  // Remove item
  const handleRemoveItem = (productId: string) => {
    setSelectedItems(selectedItems.filter(item => item.product.id !== productId));
  };
  
  // Lock dates to enable product selection
  const handleLockDates = () => {
    if (pickupDate && returnDate) {
      setDatesLocked(true);
    }
  };
  
  // Reset dates
  const handleResetDates = () => {
    setDatesLocked(false);
    setSelectedItems([]);
  };

  return (
    <div className="min-h-screen bg-[#121212] p-6">
      {/* Header */}
      <div className="mb-6 bg-gradient-to-r from-[#800020] to-[#5a0016] rounded-xl p-6 border border-[#800020]/30">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">New Rental Booking</h1>
            <p className="text-gray-300">Bridal & Groom Wear Rental Management</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-300 mb-1">Invoice Number</div>
            <div className="text-2xl font-bold text-white mb-2">{invoiceNumber}</div>
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <Calendar size={16} />
              Booking Date: {bookingDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* LEFT COLUMN: Inventory & Dates */}
        <div className="col-span-7 space-y-6">
          {/* Customer Selection */}
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <User size={20} className="text-[#800020]" />
              Customer Selection
            </h3>
            
            <div className="space-y-4">
              <div>
                <Label className="text-gray-400 mb-2 block">Customer Type</Label>
                <Select
                  value={selectedCustomer.id}
                  onValueChange={(value) => {
                    const customer = customers.find(c => c.id === value);
                    if (customer) {
                      setSelectedCustomer(customer);
                      setCustomerName(customer.name);
                      setCustomerPhone(customer.phone);
                    }
                  }}
                >
                  <SelectTrigger className="bg-[#121212] border-gray-700 text-white">
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-gray-700">
                    {customers.map(customer => (
                      <SelectItem key={customer.id} value={customer.id} className="text-white hover:bg-gray-800">
                        {customer.name} {customer.type === 'registered' && customer.phone && `(${customer.phone})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {selectedCustomer && selectedCustomer.type === 'walk-in' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400 mb-2 block">Customer Name *</Label>
                    <Input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Enter name"
                      className="bg-[#121212] border-gray-700 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-400 mb-2 block">Phone Number *</Label>
                    <Input
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="+92 300 1234567"
                      className="bg-[#121212] border-gray-700 text-white"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* STEP A: Rental Timeline (Priority) */}
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Clock size={20} className="text-[#800020]" />
                Step A: Select Rental Dates
              </h3>
              {datesLocked ? (
                <Button
                  onClick={handleResetDates}
                  variant="outline"
                  size="sm"
                  className="border-yellow-600 text-yellow-400 hover:bg-yellow-600/10"
                >
                  Change Dates
                </Button>
              ) : (
                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                  Required First
                </Badge>
              )}
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <CalendarDatePicker
                  label="Pickup Date"
                  value={pickupDate}
                  onChange={setPickupDate}
                  disabled={datesLocked}
                  showTime={false}
                  minDate={new Date()}
                  required
                />
                <CalendarDatePicker
                  label="Return Date"
                  value={returnDate}
                  onChange={setReturnDate}
                  disabled={datesLocked}
                  showTime={false}
                  minDate={pickupDate}
                  required
                />
              </div>

              {/* Visual Timeline */}
              {pickupDate && returnDate && (
                <div className="bg-[#121212] border border-gray-700 rounded-lg p-4 relative">
                  <div className="absolute top-1/2 left-8 right-8 border-t-2 border-dashed border-[#800020]/30 -z-0"></div>
                  <ArrowRight className="absolute top-1/2 right-4 -translate-y-1/2 text-[#800020] -z-0" size={20} />
                  
                  <div className="flex items-center justify-between relative z-10">
                    <div className="bg-[#1a1a1a] px-4 py-2 rounded-lg border border-emerald-500/30">
                      <div className="text-xs text-gray-500 mb-1">Pickup</div>
                      <div className="font-semibold text-emerald-400">
                        {pickupDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                    
                    <div className="bg-[#800020]/20 px-4 py-2 rounded-lg border border-[#800020]/40">
                      <div className="text-xs text-gray-500 mb-1">Duration</div>
                      <div className="font-bold text-white">{rentalDays} Days</div>
                    </div>
                    
                    <div className="bg-[#1a1a1a] px-4 py-2 rounded-lg border border-blue-500/30">
                      <div className="text-xs text-gray-500 mb-1">Return</div>
                      <div className="font-semibold text-blue-400">
                        {returnDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {rentalDays > 3 && (
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Info size={16} className="text-orange-400 mt-0.5" />
                    <div className="text-sm text-orange-300">
                      <span className="font-semibold">Extended Rental:</span> {rentalDays - 3} extra days will be charged at per-day rates
                    </div>
                  </div>
                </div>
              )}

              {!datesLocked && pickupDate && returnDate && (
                <Button
                  onClick={handleLockDates}
                  className="w-full bg-[#800020] hover:bg-[#600018] text-white font-semibold"
                >
                  <Lock size={16} className="mr-2" />
                  Lock Dates & Proceed to Inventory
                </Button>
              )}
            </div>
          </div>

          {/* STEP B: Product Selection (Locked until dates selected) */}
          <div className={cn(
            "bg-[#1a1a1a] border border-gray-800 rounded-xl p-6 transition-opacity",
            !datesLocked && "opacity-50 pointer-events-none"
          )}>
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Package size={20} className="text-[#800020]" />
              Step B: Select Items {!datesLocked && <Badge className="bg-gray-700 text-gray-400">Locked</Badge>}
            </h3>

            {/* Search */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by SKU or Product Name..."
                  className="pl-10 bg-[#121212] border-gray-700 text-white"
                  disabled={!datesLocked}
                />
              </div>
            </div>

            {/* Product Cards */}
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#800020]"></div>
                  <p className="mt-2">Loading products...</p>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No rentable products found
                </div>
              ) : filteredProducts.map(product => {
                const availability = isProductAvailable(product);
                const isSelected = selectedItems.some(item => item.product.id === product.id);
                
                return (
                  <div
                    key={product.id}
                    className={cn(
                      "bg-[#121212] border rounded-lg p-4 transition-all",
                      availability.available
                        ? "border-gray-700 hover:border-emerald-500/50"
                        : "border-red-500/50 bg-red-500/5",
                      isSelected && "border-[#800020] bg-[#800020]/10"
                    )}
                  >
                    <div className="flex gap-4">
                      {/* Image */}
                      <div className="w-24 h-24 rounded-lg bg-gray-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {product.image ? (
                          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon size={32} className="text-gray-600" />
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-semibold text-white mb-1">{product.name}</h4>
                            <div className="flex items-center gap-3 text-sm text-gray-400">
                              <span>SKU: {product.sku}</span>
                              <Badge className="bg-gray-700 text-gray-300 border-gray-600 text-xs">
                                {product.category}
                              </Badge>
                            </div>
                          </div>
                          
                          {availability.available ? (
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                              <CheckCircle2 size={12} className="mr-1" />
                              Available
                            </Badge>
                          ) : (
                            <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                              <AlertTriangle size={12} className="mr-1" />
                              Booked
                            </Badge>
                          )}
                        </div>

                        {/* Conflict Warning */}
                        {!availability.available && availability.conflictDates && (
                          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 mb-3">
                            <div className="text-xs text-red-300 font-medium">
                              ⚠️ Already booked for: {availability.conflictDates}
                            </div>
                          </div>
                        )}

                        {/* Pricing */}
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center gap-4">
                            <div>
                              <div className="text-xs text-gray-500">Retail Value</div>
                              <div className="text-sm text-gray-400">₨{product.retailValue.toLocaleString()}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500">Rent (3 days)</div>
                              <div className="text-lg font-bold text-white">₨{product.rentPrice.toLocaleString()}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500">Per Extra Day</div>
                              <div className="text-sm font-semibold text-orange-400">+₨{product.perDayPrice.toLocaleString()}</div>
                            </div>
                          </div>

                          {availability.available && (
                            <Button
                              onClick={() => handleAddItem(product)}
                              disabled={isSelected}
                              className={cn(
                                "bg-[#800020] hover:bg-[#600018] text-white",
                                isSelected && "bg-gray-700 text-gray-400 cursor-not-allowed"
                              )}
                            >
                              {isSelected ? 'Added' : 'Add to Booking'}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Security & Finalization */}
        <div className="col-span-5 space-y-6">
          {/* Selected Items */}
          {selectedItems.length > 0 && (
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Selected Items ({selectedItems.length})</h3>
              <div className="space-y-3">
                {selectedItems.map(item => (
                  <div key={item.product.id} className="bg-[#121212] border border-gray-700 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1">
                        <div className="font-semibold text-white text-sm">{item.product.name}</div>
                        <div className="text-xs text-gray-500">SKU: {item.product.sku}</div>
                      </div>
                      <Button
                        onClick={() => handleRemoveItem(item.product.id)}
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8 p-0"
                      >
                        ×
                      </Button>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Base Rent (3 days)</span>
                      <span className="font-semibold text-white">₨{item.product.rentPrice.toLocaleString()}</span>
                    </div>
                    {rentalDays > 3 && (
                      <div className="flex items-center justify-between text-sm mt-1">
                        <span className="text-orange-400">Extra {rentalDays - 3} days</span>
                        <span className="font-semibold text-orange-400">+₨{((rentalDays - 3) * item.product.perDayPrice).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Security Deposit Section */}
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Shield size={20} className="text-[#800020]" />
              Security & Documents
            </h3>

            <div className="space-y-4">
              <div>
                <Label className="text-gray-400 mb-2 block">Security Type *</Label>
                <Select value={securityType} onValueChange={(value: any) => setSecurityType(value)}>
                  <SelectTrigger className="bg-[#121212] border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-gray-700">
                    <SelectItem value="id-card" className="text-white hover:bg-gray-800">
                      ID Card (Original)
                    </SelectItem>
                    <SelectItem value="passport" className="text-white hover:bg-gray-800">
                      Passport (Original)
                    </SelectItem>
                    <SelectItem value="cash" className="text-white hover:bg-gray-800">
                      Cash Guarantee
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {securityType === 'cash' && (
                <div>
                  <Label className="text-gray-400 mb-2 block">Cash Amount (₨) *</Label>
                  <Input
                    type="number"
                    value={securityAmount}
                    onChange={(e) => setSecurityAmount(Number(e.target.value))}
                    placeholder="0"
                    className="bg-[#121212] border-gray-700 text-white"
                  />
                </div>
              )}

              <div className="bg-[#121212] border border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <Label className="text-gray-300 cursor-pointer flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={documentReceived}
                      onChange={(e) => setDocumentReceived(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-[#800020] focus:ring-[#800020]"
                    />
                    Original Document Received?
                  </Label>
                  {documentReceived && (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                      <CheckCircle2 size={12} className="mr-1" />
                      Verified
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-2 ml-6">
                  Document will be held by shop until return
                </div>
              </div>
            </div>
          </div>

          {/* Booking Notes */}
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <FileText size={20} className="text-[#800020]" />
              Booking Notes
            </h3>
            <Textarea
              value={bookingNotes}
              onChange={(e) => setBookingNotes(e.target.value)}
              placeholder="Measurements, alteration requests, special instructions..."
              className="bg-[#121212] border-gray-700 text-white min-h-[100px]"
            />
          </div>

          {/* Payment Breakdown Card */}
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <DollarSign size={20} className="text-[#800020]" />
              Payment Breakdown
            </h3>

            <div className="space-y-4">
              {/* Total Rent */}
              <div className="bg-[#800020]/10 border border-[#800020]/30 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">Total Rental Amount</div>
                <div className="text-4xl font-bold text-white">₨{totalRent.toLocaleString()}</div>
                <div className="text-xs text-gray-500 mt-1">
                  For {rentalDays} days ({selectedItems.length} items)
                </div>
              </div>

              {/* Advance Payment */}
              <div>
                <Label className="text-gray-400 mb-2 block flex items-center justify-between">
                  <span>Advance / Booking Amount</span>
                  <span className="text-xs text-gray-500">Paid on {bookingDate.toLocaleDateString()}</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₨</span>
                  <Input
                    type="number"
                    value={advanceAmount}
                    onChange={(e) => setAdvanceAmount(Number(e.target.value))}
                    placeholder="0"
                    className="pl-8 bg-[#121212] border-gray-700 text-white"
                  />
                </div>
              </div>

              {/* Balance Due */}
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-gray-400">Balance Due at Pickup</div>
                  {pickupDate && (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                      {pickupDate.toLocaleDateString()}
                    </Badge>
                  )}
                </div>
                <div className="text-3xl font-bold text-emerald-400">
                  ₨{balanceDue > 0 ? balanceDue.toLocaleString() : '0'}
                </div>
              </div>

              {/* Security Deposit Info */}
              {securityType === 'cash' && securityAmount > 0 && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-blue-300">Security Deposit (Refundable)</span>
                    <span className="font-semibold text-blue-400">₨{securityAmount.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="space-y-3">
            <Button
              onClick={handleSaveBooking}
              disabled={selectedItems.length === 0 || !documentReceived || !datesLocked || saving || loading}
              className="w-full bg-[#800020] hover:bg-[#600018] text-white font-bold py-6 text-lg shadow-lg shadow-[#800020]/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 size={20} className="mr-2" />
              {saving ? 'Saving...' : 'Confirm Booking'}
            </Button>
            
            <Button
              variant="outline"
              disabled={selectedItems.length === 0}
              className="w-full border-gray-700 text-white hover:bg-gray-800"
            >
              <Printer size={18} className="mr-2" />
              Print Receipt
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
