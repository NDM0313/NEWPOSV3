import { useState } from 'react';
import { ArrowLeft, Search, Calendar, Plus, Minus, Trash2, User as UserIcon, ChevronRight } from 'lucide-react';

interface CreateRentalFlowProps {
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
  rentPerDay: number;
  securityDeposit: number;
  stock: number;
}

interface RentalItem {
  product: RentalProduct;
  quantity: number;
  days: number;
  rentTotal: number;
  depositTotal: number;
}

type Step = 'customer' | 'products' | 'dates' | 'summary' | 'payment' | 'confirmation';

export function CreateRentalFlow({ onBack, onComplete }: CreateRentalFlowProps) {
  const [currentStep, setCurrentStep] = useState<Step>('customer');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [items, setItems] = useState<RentalItem[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank' | 'card'>('cash');

  // Mock customers
  const customers: Customer[] = [
    { id: '1', name: 'Ahmed Khan', phone: '+92 300 1111111', cnic: '12345-1234567-1', address: 'DHA Phase 6, Karachi' },
    { id: '2', name: 'Sara Ahmed', phone: '+92 321 2222222', cnic: '12345-2345678-2', address: 'F-8 Markaz, Islamabad' },
    { id: '3', name: 'Ali Hassan', phone: '+92 333 3333333', cnic: '12345-3456789-3', address: 'Model Town, Lahore' },
  ];

  // Mock rental products
  const rentalProducts: RentalProduct[] = [
    { id: '1', name: 'Bridal Lehenga - Premium', category: 'Bridal', rentPerDay: 2000, securityDeposit: 10000, stock: 3 },
    { id: '2', name: 'Groom Sherwani - Royal', category: 'Groom', rentPerDay: 1500, securityDeposit: 8000, stock: 5 },
    { id: '3', name: 'Kids Party Dress', category: 'Kids', rentPerDay: 500, securityDeposit: 2000, stock: 8 },
    { id: '4', name: 'Jewelry Set - Gold', category: 'Jewelry', rentPerDay: 1000, securityDeposit: 15000, stock: 2 },
    { id: '5', name: 'Dupatta - Embroidered', category: 'Accessories', rentPerDay: 300, securityDeposit: 1500, stock: 10 },
  ];

  const calculateDays = () => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays || 1;
  };

  const totalRent = items.reduce((sum, item) => sum + item.rentTotal, 0);
  const totalDeposit = items.reduce((sum, item) => sum + item.depositTotal, 0);
  const grandTotal = totalRent + totalDeposit;
  const dueAmount = grandTotal - paymentAmount;

  // STEP 1: Customer Selection
  if (currentStep === 'customer') {
    return (
      <div className="min-h-screen pb-24 bg-[#111827]">
        <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
          <div className="flex items-center gap-3 px-4 h-14">
            <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-semibold text-base">New Rental</h1>
              <p className="text-xs text-[#9CA3AF]">Step 1: Select Customer</p>
            </div>
          </div>
        </div>

        <div className="p-4">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" size={18} />
              <input
                type="text"
                placeholder="Search customers..."
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
                  setCurrentStep('products');
                }}
                className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#8B5CF6] transition-all text-left"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-12 h-12 bg-[#8B5CF6]/10 rounded-full flex items-center justify-center">
                      <UserIcon size={20} className="text-[#8B5CF6]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white mb-1">{customer.name}</h3>
                      <p className="text-sm text-[#9CA3AF]">{customer.phone}</p>
                      <p className="text-xs text-[#6B7280]">{customer.cnic}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[#6B7280]" />
                </div>
              </button>
            ))}
          </div>

          <button className="w-full mt-4 h-12 bg-[#374151] hover:bg-[#4B5563] text-white rounded-lg font-medium flex items-center justify-center gap-2">
            <Plus size={20} />
            Add New Customer
          </button>
        </div>
      </div>
    );
  }

  // STEP 2: Select Products
  if (currentStep === 'products') {
    const addItem = (product: RentalProduct) => {
      const days = calculateDays() || 1;
      const existing = items.find(item => item.product.id === product.id);
      if (existing) {
        setItems(items.map(item =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                rentTotal: (item.quantity + 1) * product.rentPerDay * days,
                depositTotal: (item.quantity + 1) * product.securityDeposit,
              }
            : item
        ));
      } else {
        setItems([...items, {
          product,
          quantity: 1,
          days,
          rentTotal: product.rentPerDay * days,
          depositTotal: product.securityDeposit,
        }]);
      }
    };

    const updateQuantity = (productId: string, delta: number) => {
      const days = calculateDays() || 1;
      setItems(items.map(item => {
        if (item.product.id === productId) {
          const newQty = Math.max(1, item.quantity + delta);
          return {
            ...item,
            quantity: newQty,
            rentTotal: newQty * item.product.rentPerDay * days,
            depositTotal: newQty * item.product.securityDeposit,
          };
        }
        return item;
      }));
    };

    const removeItem = (productId: string) => {
      setItems(items.filter(item => item.product.id !== productId));
    };

    return (
      <div className="min-h-screen pb-32 bg-[#111827]">
        <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
          <div className="flex items-center gap-3 px-4 h-14">
            <button onClick={() => setCurrentStep('customer')} className="p-2 hover:bg-[#374151] rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-base">Select Items</h1>
              <p className="text-xs text-[#9CA3AF]">{selectedCustomer?.name}</p>
            </div>
          </div>
        </div>

        {/* Cart */}
        {items.length > 0 && (
          <div className="p-4 bg-[#1F2937] border-b border-[#374151]">
            <h3 className="text-sm font-medium text-[#9CA3AF] mb-3">Selected Items ({items.length})</h3>
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.product.id} className="bg-[#111827] rounded-lg p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.product.name}</p>
                      <p className="text-xs text-[#6B7280]">Rs. {item.product.rentPerDay}/day</p>
                    </div>
                    <button onClick={() => removeItem(item.product.id)} className="p-1 text-[#EF4444]">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 bg-[#1F2937] rounded px-2 py-1">
                      <button onClick={() => updateQuantity(item.product.id, -1)} className="p-1">
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center text-sm">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.product.id, 1)} className="p-1">
                        <Plus size={14} />
                      </button>
                    </div>
                    <span className="text-sm font-semibold text-[#8B5CF6]">
                      Rs. {(item.rentTotal + item.depositTotal).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Products List */}
        <div className="p-4">
          <div className="grid grid-cols-2 gap-3">
            {rentalProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => addItem(product)}
                disabled={product.stock === 0}
                className="bg-[#1F2937] border border-[#374151] rounded-xl p-3 hover:border-[#8B5CF6] active:scale-95 transition-all text-left disabled:opacity-50"
              >
                <div className="w-full h-20 bg-[#111827] rounded-lg mb-2 flex items-center justify-center">
                  <div className="text-3xl">👗</div>
                </div>
                <h4 className="font-medium text-sm mb-1">{product.name}</h4>
                <p className="text-xs text-[#6B7280] mb-2">{product.category}</p>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#9CA3AF]">Rent/Day</span>
                    <span className="text-[#8B5CF6] font-semibold">Rs. {product.rentPerDay}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#9CA3AF]">Deposit</span>
                    <span className="text-white font-semibold">Rs. {product.securityDeposit}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Bottom Bar */}
        {items.length > 0 && (
          <div className="fixed bottom-16 left-0 right-0 bg-[#1F2937] border-t border-[#374151] p-4">
            <button
              onClick={() => setCurrentStep('dates')}
              className="w-full h-12 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-lg font-semibold"
            >
              Continue to Dates
            </button>
          </div>
        )}
      </div>
    );
  }

  // STEP 3: Select Dates
  if (currentStep === 'dates') {
    const handleDatesConfirm = () => {
      if (startDate && endDate) {
        const days = calculateDays();
        // Update all items with new days
        setItems(items.map(item => ({
          ...item,
          days,
          rentTotal: item.quantity * item.product.rentPerDay * days,
        })));
        setCurrentStep('summary');
      }
    };

    return (
      <div className="min-h-screen pb-24 bg-[#111827]">
        <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
          <div className="flex items-center gap-3 px-4 h-14">
            <button onClick={() => setCurrentStep('products')} className="p-2 hover:bg-[#374151] rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-semibold text-base">Rental Period</h1>
              <p className="text-xs text-[#9CA3AF]">Step 3: Select Dates</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded-xl p-4 text-center">
            <p className="text-sm text-[#9CA3AF] mb-1">Selected Items</p>
            <p className="text-3xl font-bold text-[#8B5CF6]">{items.length}</p>
          </div>

          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <label className="text-sm font-medium text-[#9CA3AF] mb-3 block">Start Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" size={18} />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg pl-10 pr-4 text-sm focus:outline-none focus:border-[#8B5CF6]"
              />
            </div>
          </div>

          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <label className="text-sm font-medium text-[#9CA3AF] mb-3 block">End Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" size={18} />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg pl-10 pr-4 text-sm focus:outline-none focus:border-[#8B5CF6]"
              />
            </div>
          </div>

          {startDate && endDate && (
            <div className="bg-[#10B981]/10 border border-[#10B981]/30 rounded-xl p-4 text-center">
              <p className="text-sm text-[#9CA3AF] mb-1">Total Days</p>
              <p className="text-3xl font-bold text-[#10B981]">{calculateDays()}</p>
            </div>
          )}

          <button
            onClick={handleDatesConfirm}
            disabled={!startDate || !endDate}
            className="w-full h-12 bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:bg-[#374151] disabled:text-[#6B7280] text-white rounded-lg font-semibold"
          >
            Continue to Summary
          </button>
        </div>
      </div>
    );
  }

  // STEP 4: Summary
  if (currentStep === 'summary') {
    return (
      <div className="min-h-screen pb-24 bg-[#111827]">
        <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
          <div className="flex items-center gap-3 px-4 h-14">
            <button onClick={() => setCurrentStep('dates')} className="p-2 hover:bg-[#374151] rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-semibold text-base">Rental Summary</h1>
              <p className="text-xs text-[#9CA3AF]">Step 4: Review Details</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Customer */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <h3 className="text-sm font-medium text-[#9CA3AF] mb-3">Customer</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{selectedCustomer?.name}</p>
                <p className="text-sm text-[#6B7280]">{selectedCustomer?.phone}</p>
              </div>
              <button onClick={() => setCurrentStep('customer')} className="text-sm text-[#8B5CF6]">
                Change
              </button>
            </div>
          </div>

          {/* Period */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <h3 className="text-sm font-medium text-[#9CA3AF] mb-3">Rental Period</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#9CA3AF]">From</span>
                <span>{new Date(startDate).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#9CA3AF]">To</span>
                <span>{new Date(endDate).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-[#374151]">
                <span>Total Days</span>
                <span className="text-[#8B5CF6]">{calculateDays()}</span>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <h3 className="text-sm font-medium text-[#9CA3AF] mb-3">Items ({items.length})</h3>
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.product.id} className="flex justify-between text-sm py-2 border-b border-[#374151] last:border-0">
                  <div className="flex-1">
                    <p className="font-medium">{item.product.name}</p>
                    <p className="text-xs text-[#6B7280]">
                      {item.quantity} × Rs. {item.product.rentPerDay} × {item.days} days
                    </p>
                  </div>
                  <span className="font-semibold">Rs. {item.rentTotal.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-[#9CA3AF]">Rent Amount</span>
              <span className="font-semibold">Rs. {totalRent.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#9CA3AF]">Security Deposit</span>
              <span className="font-semibold">Rs. {totalDeposit.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-[#374151]">
              <span>Total Amount</span>
              <span className="text-[#8B5CF6]">Rs. {grandTotal.toLocaleString()}</span>
            </div>
          </div>

          <button
            onClick={() => setCurrentStep('payment')}
            className="w-full h-12 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-lg font-semibold"
          >
            Proceed to Payment
          </button>
        </div>
      </div>
    );
  }

  // STEP 5: Payment
  if (currentStep === 'payment') {
    return (
      <div className="min-h-screen pb-24 bg-[#111827]">
        <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
          <div className="flex items-center gap-3 px-4 h-14">
            <button onClick={() => setCurrentStep('summary')} className="p-2 hover:bg-[#374151] rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-semibold text-base">Payment</h1>
              <p className="text-xs text-[#9CA3AF]">Step 5: Collect Payment</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Total */}
          <div className="bg-gradient-to-br from-[#8B5CF6]/10 to-[#EC4899]/10 border border-[#8B5CF6]/30 rounded-xl p-6 text-center">
            <p className="text-sm text-[#9CA3AF] mb-2">Total Amount</p>
            <p className="text-3xl font-bold text-[#8B5CF6]">Rs. {grandTotal.toLocaleString()}</p>
            <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
              <div className="text-left">
                <p className="text-[#6B7280]">Rent</p>
                <p className="font-semibold">Rs. {totalRent.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-[#6B7280]">Deposit</p>
                <p className="font-semibold">Rs. {totalDeposit.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <label className="text-sm font-medium text-[#9CA3AF] mb-3 block">Payment Method</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'cash', label: 'Cash', icon: '💵' },
                { id: 'bank', label: 'Bank', icon: '🏦' },
                { id: 'card', label: 'Card', icon: '💳' },
              ].map((method) => (
                <button
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id as typeof paymentMethod)}
                  className={`p-3 rounded-lg border transition-all ${
                    paymentMethod === method.id
                      ? 'bg-[#8B5CF6]/10 border-[#8B5CF6] text-white'
                      : 'bg-[#111827] border-[#374151] text-[#9CA3AF]'
                  }`}
                >
                  <div className="text-2xl mb-1">{method.icon}</div>
                  <div className="text-xs font-medium">{method.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Payment Amount */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <label className="text-sm font-medium text-[#9CA3AF] mb-3 block">Payment Amount</label>
            <input
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(Number(e.target.value))}
              placeholder="0"
              className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-lg font-semibold text-center focus:outline-none focus:border-[#8B5CF6]"
            />
            <div className="grid grid-cols-4 gap-2 mt-3">
              {[25, 50, 75, 100].map((percent) => (
                <button
                  key={percent}
                  onClick={() => setPaymentAmount((grandTotal * percent) / 100)}
                  className="h-9 bg-[#111827] border border-[#374151] rounded-lg text-xs font-medium hover:border-[#8B5CF6]"
                >
                  {percent}%
                </button>
              ))}
            </div>
          </div>

          {/* Due */}
          {dueAmount > 0 && (
            <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#F59E0B]">Amount Due</span>
                <span className="text-xl font-bold text-[#F59E0B]">Rs. {dueAmount.toLocaleString()}</span>
              </div>
            </div>
          )}

          <button
            onClick={() => setCurrentStep('confirmation')}
            className="w-full h-12 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-lg font-semibold"
          >
            Confirm Rental
          </button>
        </div>
      </div>
    );
  }

  // STEP 6: Confirmation
  return (
    <div className="min-h-screen pb-24 bg-[#111827] flex items-center justify-center">
      <div className="p-8 text-center">
        <div className="w-20 h-20 bg-[#8B5CF6]/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <div className="text-5xl">✓</div>
        </div>
        <h2 className="text-2xl font-bold mb-2">Rental Confirmed!</h2>
        <p className="text-[#9CA3AF] mb-6">Booking created for {selectedCustomer?.name}</p>
        
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-6 mb-6 text-left space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-[#9CA3AF]">Items</span>
            <span className="font-medium">{items.length}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#9CA3AF]">Period</span>
            <span className="font-medium">{calculateDays()} days</span>
          </div>
          <div className="flex justify-between text-sm border-t border-[#374151] pt-3">
            <span className="text-[#9CA3AF]">Total</span>
            <span className="font-semibold">Rs. {grandTotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#9CA3AF]">Paid</span>
            <span className="font-semibold text-[#10B981]">Rs. {paymentAmount.toLocaleString()}</span>
          </div>
          {dueAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-[#F59E0B]">Due</span>
              <span className="font-semibold text-[#F59E0B]">Rs. {dueAmount.toLocaleString()}</span>
            </div>
          )}
        </div>

        <button
          onClick={onComplete}
          className="w-full h-12 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-lg font-semibold"
        >
          Done
        </button>
      </div>
    </div>
  );
}
