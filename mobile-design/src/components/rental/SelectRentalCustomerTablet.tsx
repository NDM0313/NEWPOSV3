import { useState } from 'react';
import { ArrowLeft, Search, Star, Plus, Phone, X, Users, Shirt } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  phone: string;
  balance: number;
}

interface SelectRentalCustomerTabletProps {
  onBack: () => void;
  onSelect: (customer: Customer) => void;
  customers: Customer[];
  setCustomers: (customers: Customer[]) => void;
}

export function SelectRentalCustomerTablet({ 
  onBack, 
  onSelect, 
  customers, 
  setCustomers 
}: SelectRentalCustomerTabletProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.phone.includes(searchQuery)
  );

  const recentCustomers = customers.slice(0, 2);

  const stats = {
    total: customers.length,
    withDue: customers.filter(c => c.balance > 0).length,
    withCredit: customers.filter(c => c.balance < 0).length,
  };

  const handleAddNewCustomer = () => {
    if (!newCustomer.name || !newCustomer.phone) return;
    
    const customer: Customer = {
      id: `c${Date.now()}`,
      name: newCustomer.name,
      phone: newCustomer.phone,
      balance: 0,
    };
    
    setCustomers([customer, ...customers]);
    setShowAddDialog(false);
    setNewCustomer({ name: '', phone: '' });
    onSelect(customer);
  };

  // Compact Customer Card Component
  const CompactCustomerCard = ({ customer, isRecent }: { customer: Customer; isRecent?: boolean }) => (
    <button
      onClick={() => onSelect(customer)}
      className="w-full bg-[#1F2937] border border-[#374151] rounded-lg p-3 hover:border-[#8B5CF6] transition-all active:scale-[0.98] text-left group"
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className={`w-9 h-9 ${isRecent ? 'bg-[#F59E0B]/10' : 'bg-[#8B5CF6]/10'} rounded-full flex items-center justify-center flex-shrink-0`}>
          {isRecent ? (
            <Star className="w-4 h-4 text-[#F59E0B] fill-[#F59E0B]" />
          ) : (
            <span className="text-sm font-semibold text-[#8B5CF6]">
              {customer.name.charAt(0)}
            </span>
          )}
        </div>

        {/* Name + Phone (Left) */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-white text-sm truncate">{customer.name}</h3>
          <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
            <Phone className="w-3 h-3" />
            <span>{customer.phone}</span>
          </div>
        </div>

        {/* Balance (Right) */}
        {customer.balance !== 0 && (
          <div className="text-right flex-shrink-0">
            <p className={`text-xs font-medium ${customer.balance > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
              {customer.balance > 0 ? 'Due' : 'Credit'}
            </p>
            <p className={`text-sm font-semibold ${customer.balance > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
              Rs. {Math.abs(customer.balance).toLocaleString()}
            </p>
          </div>
        )}
      </div>
    </button>
  );

  return (
    <div className="min-h-screen bg-[#111827]">
      {/* Header */}
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="p-2 hover:bg-[#374151] rounded-lg transition-colors active:scale-95"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-semibold">Select Customer</h1>
                <p className="text-xs text-[#6B7280]">Choose customer for rental booking</p>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customer by name or phone..."
              className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg pl-11 pr-4 text-sm focus:outline-none focus:border-[#8B5CF6] focus:ring-2 focus:ring-[#8B5CF6]/20 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="grid grid-cols-3 gap-6">
          {/* Left Column - Customer List (2/3 width) */}
          <div className="col-span-2 space-y-6">
            {/* Recent Customers */}
            {!searchQuery && recentCustomers.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-[#9CA3AF] mb-3">RECENT CUSTOMERS</h2>
                <div className="space-y-2">
                  {recentCustomers.map((customer) => (
                    <CompactCustomerCard key={customer.id} customer={customer} isRecent />
                  ))}
                </div>
              </div>
            )}

            {/* All Customers */}
            <div>
              <h2 className="text-sm font-medium text-[#9CA3AF] mb-3">
                {searchQuery ? 'SEARCH RESULTS' : 'ALL CUSTOMERS'}
              </h2>
              <div className="space-y-2">
                {filteredCustomers.map((customer) => (
                  <CompactCustomerCard key={customer.id} customer={customer} />
                ))}
              </div>

              {filteredCustomers.length === 0 && (
                <div className="text-center py-12 bg-[#1F2937] rounded-xl border border-[#374151]">
                  <div className="w-16 h-16 bg-[#374151] rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="w-8 h-8 text-[#6B7280]" />
                  </div>
                  <p className="text-[#9CA3AF]">No customers found</p>
                </div>
              )}
            </div>

            {/* Add New Customer Button */}
            <button 
              onClick={() => setShowAddDialog(true)}
              className="w-full py-3 border-2 border-dashed border-[#374151] rounded-lg text-[#9CA3AF] hover:border-[#8B5CF6] hover:text-[#8B5CF6] transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium text-sm">Add New Customer</span>
            </button>
          </div>

          {/* Right Column - Stats & Info (1/3 width) */}
          <div className="space-y-4">
            {/* Rental Info */}
            <div className="bg-gradient-to-br from-[#8B5CF6]/20 to-[#7C3AED]/10 border border-[#8B5CF6]/30 rounded-xl p-4">
              <div className="text-2xl mb-2">👗</div>
              <p className="text-sm font-medium text-white mb-1">Rental Booking</p>
              <p className="text-xs text-[#9CA3AF]">Select customer to create rental order</p>
            </div>

            {/* Stats */}
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-[#8B5CF6]" />
                <h3 className="text-sm font-semibold text-white">Customer Stats</h3>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#6B7280]">Total Customers</span>
                  <span className="text-sm font-semibold text-white">{stats.total}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#6B7280]">With Due</span>
                  <span className="text-sm font-semibold text-[#EF4444]">{stats.withDue}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#6B7280]">With Credit</span>
                  <span className="text-sm font-semibold text-[#10B981]">{stats.withCredit}</span>
                </div>
              </div>
            </div>

            {/* Quick Tip */}
            <div className="bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded-xl p-4">
              <div className="text-lg mb-2">💡</div>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                <span className="text-white font-medium">Quick Tip:</span> Search customers quickly using name or phone number
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Add Customer Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1F2937] rounded-2xl w-full max-w-md">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#374151] flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add New Customer</h2>
              <button
                onClick={() => {
                  setShowAddDialog(false);
                  setNewCustomer({ name: '', phone: '' });
                }}
                className="p-2 hover:bg-[#374151] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#9CA3AF] mb-2">
                  Customer Name *
                </label>
                <input
                  type="text"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  placeholder="Enter customer name"
                  className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 focus:outline-none focus:border-[#8B5CF6] focus:ring-2 focus:ring-[#8B5CF6]/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#9CA3AF] mb-2">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  placeholder="+92-300-1234567"
                  className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 focus:outline-none focus:border-[#8B5CF6] focus:ring-2 focus:ring-[#8B5CF6]/20"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowAddDialog(false);
                    setNewCustomer({ name: '', phone: '' });
                  }}
                  className="flex-1 h-12 border border-[#374151] rounded-lg font-medium hover:bg-[#374151] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddNewCustomer}
                  disabled={!newCustomer.name || !newCustomer.phone}
                  className="flex-1 h-12 bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:bg-[#374151] disabled:text-[#6B7280] rounded-lg font-medium transition-colors"
                >
                  Add Customer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
