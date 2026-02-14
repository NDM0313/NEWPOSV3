import { useState } from 'react';
import { ArrowLeft, Search, Calendar, FileText, AlertCircle, CheckCircle, User as UserIcon, Package, ChevronRight, Info } from 'lucide-react';

interface RentalBookingFlowProps {
  onBack: () => void;
  onComplete: () => void;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  cnic: string;
  address: string;
}

interface RentalProduct {
  id: string;
  name: string;
  category: string;
  images: string[];
  rentAmount: number; // Total rent for minimum period
  minimumDays: number;
  status: 'available' | 'reserved' | 'rented';
  size?: string;
  color?: string;
}

type BookingStep = 'customer' | 'product' | 'dates' | 'payment' | 'review' | 'confirmation';

export function RentalBookingFlow({ onBack, onComplete }: RentalBookingFlowProps) {
  const [currentStep, setCurrentStep] = useState<BookingStep>('customer');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<RentalProduct | null>(null);
  
  // Dates
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split('T')[0]); // Editable now
  const [deliveryDate, setDeliveryDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  
  // Payment
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [notes, setNotes] = useState('');

  // Mock customers
  const customers: Customer[] = [
    { 
      id: '1', 
      name: 'Sana Ahmed', 
      phone: '+92 300 1234567', 
      cnic: '42101-1234567-8',
      address: 'DHA Phase 6, Karachi'
    },
    { 
      id: '2', 
      name: 'Ayesha Khan', 
      phone: '+92 321 9876543', 
      cnic: '42201-9876543-2',
      address: 'Gulshan-e-Iqbal, Karachi'
    },
    { 
      id: '3', 
      name: 'Fatima Ali', 
      phone: '+92 333 4567890', 
      cnic: '42301-4567890-1',
      address: 'Clifton Block 5, Karachi'
    },
  ];

  // Mock rental products (bridal dresses)
  const rentalProducts: RentalProduct[] = [
    {
      id: '1',
      name: 'Bridal Lehenga - Red & Gold Premium',
      category: 'Bridal',
      images: ['👗'],
      rentAmount: 50000,
      minimumDays: 3,
      status: 'available',
      size: 'Medium',
      color: 'Red & Gold',
    },
    {
      id: '2',
      name: 'Wedding Dress - Cream & Silver Luxury',
      category: 'Bridal',
      images: ['👗'],
      rentAmount: 60000,
      minimumDays: 3,
      status: 'available',
      size: 'Large',
      color: 'Cream & Silver',
    },
    {
      id: '3',
      name: 'Bridal Lehenga - Pink Elegance',
      category: 'Bridal',
      images: ['👗'],
      rentAmount: 45000,
      minimumDays: 3,
      status: 'reserved',
      size: 'Small',
      color: 'Pink & Gold',
    },
    {
      id: '4',
      name: 'Royal Wedding Dress - Golden Heritage',
      category: 'Bridal',
      images: ['👗'],
      rentAmount: 75000,
      minimumDays: 4,
      status: 'available',
      size: 'Medium',
      color: 'Golden',
    },
  ];

  const calculateRentalDays = () => {
    if (!deliveryDate || !returnDate) return 0;
    const delivery = new Date(deliveryDate);
    const returnD = new Date(returnDate);
    const diffTime = returnD.getTime() - delivery.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const rentalDays = calculateRentalDays();
  const totalRent = selectedProduct ? selectedProduct.rentAmount : 0;
  const remainingAmount = totalRent - advanceAmount;

  // STEP 1: Customer Selection with CNIC
  if (currentStep === 'customer') {
    return (
      <div className="min-h-screen pb-24 bg-[#111827]">
        <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
          <div className="flex items-center gap-3 px-4 h-14">
            <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-base">New Rental Booking</h1>
              <p className="text-xs text-[#9CA3AF]">Step 1/5: Select Customer</p>
            </div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="p-4">
          <div className="bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded-lg p-3 flex gap-2">
            <Info size={18} className="text-[#8B5CF6] flex-shrink-0 mt-0.5" />
            <div className="text-xs text-[#D1D5DB]">
              <p className="font-medium text-white mb-1">CNIC Required for Rental</p>
              <p>Customer CNIC will be verified and kept as security during rental period.</p>
            </div>
          </div>
        </div>

        <div className="px-4 pb-4">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" size={18} />
              <input
                type="text"
                placeholder="Search by name, phone or CNIC..."
                className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg pl-10 pr-4 text-sm text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#8B5CF6]"
              />
            </div>
          </div>

          <div className="space-y-3">
            {customers.map((customer) => (
              <button
                key={customer.id}
                onClick={() => {
                  setSelectedCustomer(customer);
                  setCurrentStep('product');
                }}
                className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#8B5CF6] transition-all text-left active:scale-[0.98]"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-[#8B5CF6]/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <UserIcon size={20} className="text-[#8B5CF6]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white mb-1">{customer.name}</h3>
                    <p className="text-sm text-[#9CA3AF] mb-1">{customer.phone}</p>
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-[#6B7280]" />
                      <p className="text-xs text-[#6B7280] font-mono">{customer.cnic}</p>
                    </div>
                    <p className="text-xs text-[#6B7280] mt-1">{customer.address}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[#6B7280] flex-shrink-0" />
                </div>
              </button>
            ))}
          </div>

          <button className="w-full mt-4 h-12 bg-[#374151] hover:bg-[#4B5563] text-white rounded-lg font-medium flex items-center justify-center gap-2">
            <UserIcon size={18} />
            Add New Customer with CNIC
          </button>
        </div>
      </div>
    );
  }

  // STEP 2: Product Selection (Only Available Items)
  if (currentStep === 'product') {
    const availableProducts = rentalProducts.filter(p => p.status === 'available');

    return (
      <div className="min-h-screen pb-24 bg-[#111827]">
        <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
          <div className="flex items-center gap-3 px-4 h-14">
            <button onClick={() => setCurrentStep('customer')} className="p-2 hover:bg-[#374151] rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-base">Select Dress/Item</h1>
              <p className="text-xs text-[#9CA3AF]">Step 2/5: Choose rental item</p>
            </div>
          </div>
        </div>

        {/* Customer Info Bar */}
        <div className="p-4 bg-[#1F2937] border-b border-[#374151]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">{selectedCustomer?.name}</p>
              <p className="text-xs text-[#6B7280]">CNIC: {selectedCustomer?.cnic}</p>
            </div>
            <button onClick={() => setCurrentStep('customer')} className="text-xs text-[#8B5CF6]">
              Change
            </button>
          </div>
        </div>

        <div className="p-4">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" size={18} />
              <input
                type="text"
                placeholder="Search available dresses..."
                className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg pl-10 pr-4 text-sm text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#8B5CF6]"
              />
            </div>
          </div>

          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-[#9CA3AF]">Available for Rent</p>
            <span className="text-sm font-semibold text-[#10B981]">{availableProducts.length} items</span>
          </div>

          <div className="space-y-3">
            {availableProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => {
                  setSelectedProduct(product);
                  setCurrentStep('dates');
                }}
                className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#8B5CF6] transition-all text-left active:scale-[0.98]"
              >
                <div className="flex gap-3">
                  <div className="w-20 h-20 bg-[#111827] rounded-lg flex items-center justify-center text-4xl flex-shrink-0">
                    👗
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white mb-1">{product.name}</h3>
                    <div className="flex items-center gap-2 mb-2">
                      {product.size && (
                        <span className="text-xs px-2 py-0.5 bg-[#374151] rounded text-[#9CA3AF]">
                          {product.size}
                        </span>
                      )}
                      {product.color && (
                        <span className="text-xs px-2 py-0.5 bg-[#374151] rounded text-[#9CA3AF]">
                          {product.color}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[#6B7280]">Rent Amount</span>
                        <span className="text-sm font-bold text-[#8B5CF6]">
                          Rs. {product.rentAmount.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[#6B7280]">Minimum Days</span>
                        <span className="text-xs font-medium text-white">
                          {product.minimumDays} days
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[#6B7280] flex-shrink-0" />
                </div>
              </button>
            ))}
          </div>

          {/* Reserved Items (Not Clickable) */}
          <div className="mt-6">
            <p className="text-sm text-[#9CA3AF] mb-3">Currently Rented/Reserved</p>
            <div className="space-y-2">
              {rentalProducts.filter(p => p.status !== 'available').map((product) => (
                <div
                  key={product.id}
                  className="bg-[#1F2937]/50 border border-[#374151]/50 rounded-xl p-3 opacity-50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="text-2xl">👗</div>
                      <div>
                        <p className="text-sm font-medium text-white">{product.name}</p>
                        <p className="text-xs text-[#6B7280]">{product.size} • {product.color}</p>
                      </div>
                    </div>
                    <span className="text-xs px-2 py-1 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded text-[#F59E0B]">
                      {product.status === 'reserved' ? 'Reserved' : 'Rented'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // STEP 3: Rental Dates (CRITICAL)
  if (currentStep === 'dates') {
    const minDays = selectedProduct?.minimumDays || 3;
    const isValidPeriod = rentalDays >= minDays;

    return (
      <div className="min-h-screen pb-24 bg-[#111827]">
        <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
          <div className="flex items-center gap-3 px-4 h-14">
            <button onClick={() => setCurrentStep('product')} className="p-2 hover:bg-[#374151] rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-base">Rental Dates</h1>
              <p className="text-xs text-[#9CA3AF]">Step 3/5: Set booking & delivery dates</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Selected Item */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <p className="text-xs text-[#9CA3AF] mb-2">Selected Item</p>
            <div className="flex items-center gap-3">
              <div className="text-3xl">👗</div>
              <div className="flex-1">
                <p className="font-semibold text-white text-sm">{selectedProduct?.name}</p>
                <p className="text-xs text-[#6B7280]">{selectedProduct?.size} • {selectedProduct?.color}</p>
              </div>
              <button onClick={() => setCurrentStep('product')} className="text-xs text-[#8B5CF6]">
                Change
              </button>
            </div>
          </div>

          {/* Date 1: Booking Date (Today - Read Only) */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <label className="text-sm font-medium text-white mb-3 block flex items-center gap-2">
              <Calendar size={16} className="text-[#8B5CF6]" />
              Booking Date
            </label>
            <input
              type="date"
              value={bookingDate}
              onChange={(e) => setBookingDate(e.target.value)}
              className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-sm focus:outline-none focus:border-[#8B5CF6] text-white"
            />
            <p className="text-xs text-[#6B7280] mt-2">* Booking date is set to today</p>
          </div>

          {/* Date 2: Delivery Date */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <label className="text-sm font-medium text-white mb-3 block flex items-center gap-2">
              <Package size={16} className="text-[#10B981]" />
              Delivery Date
              <span className="text-[#EF4444]">*</span>
            </label>
            <input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              min={new Date(Date.now() + 86400000).toISOString().split('T')[0]} // Tomorrow
              className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-sm focus:outline-none focus:border-[#8B5CF6] text-white"
            />
            <p className="text-xs text-[#6B7280] mt-2">When customer will receive the dress</p>
          </div>

          {/* Date 3: Return Date */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <label className="text-sm font-medium text-white mb-3 block flex items-center gap-2">
              <AlertCircle size={16} className="text-[#F59E0B]" />
              Return Date
              <span className="text-[#EF4444]">*</span>
            </label>
            <input
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              min={deliveryDate}
              className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-sm focus:outline-none focus:border-[#8B5CF6] text-white"
            />
            <p className="text-xs text-[#6B7280] mt-2">When dress must be returned</p>
          </div>

          {/* Rental Period Summary */}
          {deliveryDate && returnDate && (
            <div className={`rounded-xl p-4 border ${
              isValidPeriod 
                ? 'bg-[#10B981]/10 border-[#10B981]/30' 
                : 'bg-[#EF4444]/10 border-[#EF4444]/30'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-[#9CA3AF]">Total Rental Period</span>
                <span className={`text-2xl font-bold ${isValidPeriod ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                  {rentalDays} {rentalDays === 1 ? 'Day' : 'Days'}
                </span>
              </div>
              {!isValidPeriod && (
                <div className="flex items-start gap-2 text-xs text-[#EF4444]">
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  <p>Minimum rental period is {minDays} days for this item</p>
                </div>
              )}
              {isValidPeriod && (
                <div className="flex items-start gap-2 text-xs text-[#10B981]">
                  <CheckCircle size={14} className="flex-shrink-0 mt-0.5" />
                  <p>Valid rental period</p>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => setCurrentStep('payment')}
            disabled={!deliveryDate || !returnDate || !isValidPeriod}
            className="w-full h-12 bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:bg-[#374151] disabled:text-[#6B7280] text-white rounded-lg font-semibold transition-colors"
          >
            Continue to Payment
          </button>
        </div>
      </div>
    );
  }

  // STEP 4: Rent Amount & Advance Payment
  if (currentStep === 'payment') {
    return (
      <div className="min-h-screen pb-24 bg-[#111827]">
        <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
          <div className="flex items-center gap-3 px-4 h-14">
            <button onClick={() => setCurrentStep('dates')} className="p-2 hover:bg-[#374151] rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-base">Rent & Advance</h1>
              <p className="text-xs text-[#9CA3AF]">Step 4/5: Set advance payment</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Total Rent Amount */}
          <div className="bg-gradient-to-br from-[#8B5CF6]/10 to-[#EC4899]/10 border border-[#8B5CF6]/30 rounded-xl p-6 text-center">
            <p className="text-sm text-[#9CA3AF] mb-2">Total Rent Amount</p>
            <p className="text-4xl font-bold text-[#8B5CF6] mb-1">
              Rs. {totalRent.toLocaleString()}
            </p>
            <p className="text-xs text-[#6B7280]">for {rentalDays} days rental</p>
          </div>

          {/* Advance Payment */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <label className="text-sm font-medium text-white mb-3 block">
              Advance Payment (Flexible)
            </label>
            <input
              type="number"
              value={advanceAmount || ''}
              onChange={(e) => setAdvanceAmount(Number(e.target.value))}
              placeholder="Enter advance amount"
              className="w-full h-14 bg-[#111827] border border-[#374151] rounded-lg px-4 text-xl font-semibold text-center text-white focus:outline-none focus:border-[#8B5CF6]"
            />
            
            {/* Quick Amount Buttons */}
            <div className="grid grid-cols-4 gap-2 mt-3">
              {[10000, 15000, 20000, 25000].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setAdvanceAmount(amount)}
                  className="h-9 bg-[#111827] border border-[#374151] rounded-lg text-xs font-medium hover:border-[#8B5CF6] transition-colors"
                >
                  {amount / 1000}k
                </button>
              ))}
            </div>

            {/* Percentage Buttons */}
            <div className="grid grid-cols-3 gap-2 mt-2">
              {[25, 50, 100].map((percent) => (
                <button
                  key={percent}
                  onClick={() => setAdvanceAmount((totalRent * percent) / 100)}
                  className="h-9 bg-[#111827] border border-[#374151] rounded-lg text-xs font-medium hover:border-[#8B5CF6] transition-colors"
                >
                  {percent}%
                </button>
              ))}
            </div>
          </div>

          {/* Remaining Amount Calculation */}
          {advanceAmount > 0 && (
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#9CA3AF]">Total Rent</span>
                <span className="font-semibold">Rs. {totalRent.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#10B981]">Advance Paid</span>
                <span className="font-semibold text-[#10B981]">Rs. {advanceAmount.toLocaleString()}</span>
              </div>
              <div className="pt-3 border-t border-[#374151]">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#F59E0B]">Remaining Amount</span>
                  <span className="text-xl font-bold text-[#F59E0B]">
                    Rs. {remainingAmount.toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-[#6B7280] mt-1">
                  To be collected on delivery date ({new Date(deliveryDate).toLocaleDateString()})
                </p>
              </div>
            </div>
          )}

          {/* Important Notice */}
          <div className="bg-[#3B82F6]/10 border border-[#3B82F6]/30 rounded-lg p-3 flex gap-2">
            <Info size={16} className="text-[#3B82F6] flex-shrink-0 mt-0.5" />
            <div className="text-xs text-[#D1D5DB]">
              <p className="font-medium text-white mb-1">Payment Schedule</p>
              <ul className="space-y-1">
                <li>• Advance: Paid now at booking</li>
                <li>• Remaining: To be collected on delivery</li>
                <li>• Security: CNIC will be kept during rental</li>
              </ul>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <label className="text-sm font-medium text-[#9CA3AF] mb-2 block">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special instructions or notes..."
              rows={3}
              className="w-full bg-[#111827] border border-[#374151] rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-[#8B5CF6]"
            />
          </div>

          <button
            onClick={() => setCurrentStep('review')}
            disabled={advanceAmount <= 0}
            className="w-full h-12 bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:bg-[#374151] disabled:text-[#6B7280] text-white rounded-lg font-semibold"
          >
            Review Booking
          </button>
        </div>
      </div>
    );
  }

  // STEP 5: Review & Confirm Booking
  if (currentStep === 'review') {
    return (
      <div className="min-h-screen pb-24 bg-[#111827]">
        <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
          <div className="flex items-center gap-3 px-4 h-14">
            <button onClick={() => setCurrentStep('payment')} className="p-2 hover:bg-[#374151] rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-base">Review Booking</h1>
              <p className="text-xs text-[#9CA3AF]">Step 5/5: Confirm details</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Customer */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-[#9CA3AF]">Customer Details</h3>
              <button onClick={() => setCurrentStep('customer')} className="text-xs text-[#8B5CF6]">
                Edit
              </button>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#6B7280]">Name</span>
                <span className="font-medium text-white">{selectedCustomer?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#6B7280]">Phone</span>
                <span className="font-medium text-white">{selectedCustomer?.phone}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#6B7280]">CNIC</span>
                <span className="font-medium text-white font-mono">{selectedCustomer?.cnic}</span>
              </div>
            </div>
          </div>

          {/* Rental Item */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-[#9CA3AF]">Rental Item</h3>
              <button onClick={() => setCurrentStep('product')} className="text-xs text-[#8B5CF6]">
                Change
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-3xl">👗</div>
              <div className="flex-1">
                <p className="font-semibold text-white">{selectedProduct?.name}</p>
                <p className="text-xs text-[#6B7280]">{selectedProduct?.size} • {selectedProduct?.color}</p>
              </div>
            </div>
          </div>

          {/* Rental Period */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-[#9CA3AF]">Rental Period</h3>
              <button onClick={() => setCurrentStep('dates')} className="text-xs text-[#8B5CF6]">
                Edit
              </button>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#6B7280]">Booking Date</span>
                <span className="font-medium text-white">{new Date(bookingDate).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#6B7280]">Delivery Date</span>
                <span className="font-medium text-[#10B981]">{new Date(deliveryDate).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#6B7280]">Return Date</span>
                <span className="font-medium text-[#F59E0B]">{new Date(returnDate).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-[#374151]">
                <span className="text-white font-medium">Total Days</span>
                <span className="font-bold text-[#8B5CF6]">{rentalDays} days</span>
              </div>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="bg-gradient-to-br from-[#8B5CF6]/10 to-[#EC4899]/10 border border-[#8B5CF6]/30 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-white">Payment Summary</h3>
              <button onClick={() => setCurrentStep('payment')} className="text-xs text-[#8B5CF6]">
                Edit
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-[#D1D5DB]">Total Rent Amount</span>
                <span className="font-semibold text-white">Rs. {totalRent.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#10B981]">Advance (Paid Now)</span>
                <span className="font-semibold text-[#10B981]">Rs. {advanceAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-3 border-t border-[#8B5CF6]/30">
                <span className="text-white">Remaining</span>
                <span className="text-[#F59E0B]">Rs. {remainingAmount.toLocaleString()}</span>
              </div>
              <p className="text-xs text-[#9CA3AF] pt-2 border-t border-[#8B5CF6]/20">
                Remaining amount to be collected on delivery date
              </p>
            </div>
          </div>

          {/* Important Notice */}
          <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-lg p-4">
            <div className="flex items-start gap-2 mb-2">
              <AlertCircle size={16} className="text-[#F59E0B] flex-shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-[#F59E0B]">Booking Will Create:</p>
            </div>
            <ul className="text-xs text-[#D1D5DB] space-y-1 ml-6">
              <li>✓ Product will be RESERVED (not sold)</li>
              <li>✓ Status: BOOKED</li>
              <li>✓ Customer CNIC will be required at delivery</li>
              <li>✓ Remaining payment due on delivery date</li>
              <li>✓ Item must be returned by return date</li>
            </ul>
          </div>

          <button
            onClick={() => setCurrentStep('confirmation')}
            className="w-full h-12 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-lg font-semibold"
          >
            Confirm Booking
          </button>
        </div>
      </div>
    );
  }

  // STEP 6: Confirmation (Booking Created)
  return (
    <div className="min-h-screen pb-24 bg-[#111827] flex items-center justify-center">
      <div className="p-8 text-center max-w-md mx-auto">
        <div className="w-20 h-20 bg-[#10B981]/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={40} className="text-[#10B981]" />
        </div>
        
        <h2 className="text-2xl font-bold mb-2 text-white">Booking Confirmed!</h2>
        <p className="text-[#9CA3AF] mb-6">Rental booking created successfully</p>
        
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-6 mb-6 text-left space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-[#6B7280]">Booking Status</span>
            <span className="px-2 py-0.5 bg-[#3B82F6]/10 border border-[#3B82F6]/30 rounded text-xs font-medium text-[#3B82F6]">
              BOOKED
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#6B7280]">Customer</span>
            <span className="font-medium text-white">{selectedCustomer?.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#6B7280]">Item</span>
            <span className="font-medium text-white">{selectedProduct?.name}</span>
          </div>
          <div className="flex justify-between text-sm border-t border-[#374151] pt-3">
            <span className="text-[#6B7280]">Delivery Date</span>
            <span className="font-semibold text-[#10B981]">
              {new Date(deliveryDate).toLocaleDateString()}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#6B7280]">Return Date</span>
            <span className="font-semibold text-[#F59E0B]">
              {new Date(returnDate).toLocaleDateString()}
            </span>
          </div>
          <div className="flex justify-between text-sm border-t border-[#374151] pt-3">
            <span className="text-[#6B7280]">Advance Paid</span>
            <span className="font-semibold text-[#10B981]">Rs. {advanceAmount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#F59E0B]">Due on Delivery</span>
            <span className="font-semibold text-[#F59E0B]">Rs. {remainingAmount.toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded-lg p-4 mb-6 text-xs text-left text-[#D1D5DB]">
          <p className="font-medium text-white mb-2">Next Steps:</p>
          <ul className="space-y-1">
            <li>1. Product is now RESERVED</li>
            <li>2. Collect remaining Rs. {remainingAmount.toLocaleString()} on delivery</li>
            <li>3. Collect customer CNIC photocopy at delivery</li>
            <li>4. Mark as DELIVERED when handed over</li>
            <li>5. Process RETURN on return date</li>
          </ul>
        </div>

        <button
          onClick={onComplete}
          className="w-full h-12 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-lg font-semibold mb-3"
        >
          Done
        </button>
        
        <button
          onClick={() => {/* Print booking */}}
          className="w-full h-12 bg-[#374151] hover:bg-[#4B5563] text-white rounded-lg font-medium"
        >
          Print Booking Receipt
        </button>
      </div>
    </div>
  );
}