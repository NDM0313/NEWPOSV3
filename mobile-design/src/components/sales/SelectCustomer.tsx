import { useState } from 'react';
import { ArrowLeft, Search, Star, Plus, Phone, X, TrendingUp, Users } from 'lucide-react';
import { Customer } from './SalesModule';
import { useResponsive } from '../../hooks/useResponsive';
import { SelectCustomerTablet } from './SelectCustomerTablet';

interface SelectCustomerProps {
  onBack: () => void;
  onSelect: (customer: Customer, saleType: 'regular' | 'studio') => void;
}

const mockCustomers: Customer[] = [
  { id: '1', name: 'Ahmed Retailers', phone: '+92-300-1234567', balance: 5000 },
  { id: '2', name: 'Walk-in Customer', phone: '+92-321-9876543', balance: 0 },
  { id: '3', name: 'Ali Traders', phone: '+92-333-1111222', balance: -2000 },
  { id: '4', name: 'Bilal Store', phone: '+92-300-5555666', balance: 12000 },
  { id: '5', name: 'Sara Fashion', phone: '+92-321-7777888', balance: 0 },
  { id: '6', name: 'Fatima Boutique', phone: '+92-333-9999000', balance: 8000 },
];

const recentCustomers = mockCustomers.slice(0, 2);

export function SelectCustomer({ onBack, onSelect }: SelectCustomerProps) {
  const responsive = useResponsive();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });
  const [customers, setCustomers] = useState(mockCustomers);
  const [saleType, setSaleType] = useState<'regular' | 'studio'>('regular');

  // Use Tablet Layout
  if (responsive.isTablet) {
    return (
      <SelectCustomerTablet
        onBack={onBack}
        onSelect={onSelect}
        customers={customers}
        setCustomers={setCustomers}
        saleType={saleType}
        setSaleType={setSaleType}
      />
    );
  }

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.phone.includes(searchQuery)
  );

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
    onSelect(customer, saleType);
  };

  return (
    <div className="min-h-screen bg-[#111827]">
      {/* Header */}
      <div className="bg-[#1F2937] border-b border-[#374151] px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-[#374151] rounded-lg transition-colors active:scale-95"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold">Select Customer</h1>
          </div>
        </div>

        {/* Sale Type Selector - PROMINENT */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-[#9CA3AF] mb-2">SALE TYPE</label>
          <div className="flex gap-2">
            <button
              onClick={() => setSaleType('regular')}
              className={`flex-1 h-10 rounded-lg text-sm font-medium transition-all ${
                saleType === 'regular'
                  ? 'bg-[#10B981] text-white shadow-lg shadow-[#10B981]/20'
                  : 'bg-[#111827] text-[#9CA3AF] border border-[#374151] hover:border-[#10B981]/50'
              }`}
            >
              🛒 Regular Sale
            </button>
            <button
              onClick={() => setSaleType('studio')}
              className={`flex-1 h-10 rounded-lg text-sm font-medium transition-all ${
                saleType === 'studio'
                  ? 'bg-[#8B5CF6] text-white shadow-lg shadow-[#8B5CF6]/20'
                  : 'bg-[#111827] text-[#9CA3AF] border border-[#374151] hover:border-[#8B5CF6]/50'
              }`}
            >
              🎨 Studio Sale
            </button>
          </div>
          {saleType === 'studio' && (
            <p className="text-xs text-[#8B5CF6] mt-2 bg-[#8B5CF6]/10 rounded px-2 py-1.5">
              ℹ️ This sale will go to production pipeline
            </p>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customer..."
            className="w-full h-11 bg-[#111827] border border-[#374151] rounded-lg pl-11 pr-4 text-sm focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20 transition-all"
          />
        </div>
      </div>

      {/* Content */}
      <div className="p-4 pb-24">
        {/* Recent Customers */}
        {!searchQuery && (
          <div className="mb-6">
            <h2 className="text-sm font-medium text-[#9CA3AF] mb-3">RECENT CUSTOMERS</h2>
            <div className="space-y-2">
              {recentCustomers.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => onSelect(customer, saleType)}
                  className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#3B82F6] transition-all active:scale-[0.98] text-left"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-[#F59E0B]/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <Star className="w-5 h-5 text-[#F59E0B] fill-[#F59E0B]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-[#F9FAFB] mb-1">{customer.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-[#9CA3AF]">
                        <Phone className="w-4 h-4" />
                        <span>{customer.phone}</span>
                      </div>
                      {customer.balance !== 0 && (
                        <p className={`text-xs mt-2 ${customer.balance > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
                          {customer.balance > 0 ? `Due: Rs. ${customer.balance.toLocaleString()}` : `Credit: Rs. ${Math.abs(customer.balance).toLocaleString()}`}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
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
              <button
                key={customer.id}
                onClick={() => onSelect(customer, saleType)}
                className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#3B82F6] transition-all active:scale-[0.98] text-left"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-[#3B82F6]/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-[#3B82F6]">
                      {customer.name.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-[#F9FAFB] mb-1">{customer.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-[#9CA3AF]">
                      <Phone className="w-4 h-4" />
                      <span>{customer.phone}</span>
                    </div>
                    {customer.balance !== 0 && (
                      <p className={`text-xs mt-2 ${customer.balance > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
                        {customer.balance > 0 ? `Due: Rs. ${customer.balance.toLocaleString()}` : `Credit: Rs. ${Math.abs(customer.balance).toLocaleString()}`}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {filteredCustomers.length === 0 && (
            <div className="text-center py-12">
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
          className="w-full mt-6 py-4 border-2 border-dashed border-[#374151] rounded-xl text-[#9CA3AF] hover:border-[#3B82F6] hover:text-[#3B82F6] transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Add New Customer</span>
        </button>
      </div>

      {/* Add Customer Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#1F2937] rounded-t-3xl sm:rounded-2xl w-full max-w-md">
            {/* Handle */}
            <div className="flex justify-center pt-2 pb-4 sm:hidden">
              <div className="w-12 h-1 bg-[#374151] rounded-full"></div>
            </div>

            {/* Header */}
            <div className="px-6 pb-4 border-b border-[#374151] flex items-center justify-between">
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
                  className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
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
                  className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
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
                  className="flex-1 h-12 bg-[#3B82F6] hover:bg-[#2563EB] disabled:bg-[#374151] disabled:text-[#6B7280] rounded-lg font-medium transition-colors"
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