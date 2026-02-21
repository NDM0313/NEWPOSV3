import { useState, useEffect } from 'react';
import { ArrowLeft, Search, Plus, Phone, X, Star } from 'lucide-react';
import * as contactsApi from '../../api/contacts';

export interface RentalCustomer {
  id: string;
  name: string;
  phone: string;
  balance: number;
}

interface SelectRentalCustomerTabletProps {
  onBack: () => void;
  onSelect: (customer: RentalCustomer) => void;
  companyId: string | null;
}

export function SelectRentalCustomerTablet({ onBack, onSelect, companyId }: SelectRentalCustomerTabletProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<RentalCustomer[]>([]);
  const [loading, setLoading] = useState(!!companyId);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });
  const [addError, setAddError] = useState('');

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    contactsApi.getContacts(companyId, 'customer').then(({ data, error }) => {
      if (cancelled) return;
      setLoading(false);
      setCustomers(
        error
          ? []
          : (data || []).map((c) => ({
              id: c.id,
              name: c.name,
              phone: c.phone || '',
              balance: c.balance || 0,
            }))
      );
    });
    return () => { cancelled = true; };
  }, [companyId]);

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery)
  );
  const recentCustomers = customers.slice(0, 2);

  const handleAddNewCustomer = async () => {
    if (!newCustomer.name.trim() || !companyId) return;
    setAddError('');
    const { data, error } = await contactsApi.createContact(companyId, {
      name: newCustomer.name.trim(),
      phone: newCustomer.phone.trim(),
      roles: ['customer'],
    });
    if (error) {
      setAddError(error);
      return;
    }
    if (data) {
      const customer: RentalCustomer = {
        id: data.id,
        name: data.name,
        phone: data.phone || '',
        balance: 0,
      };
      setCustomers([customer, ...customers]);
      setShowAddDialog(false);
      setNewCustomer({ name: '', phone: '' });
      onSelect(customer);
    }
  };

  const stats = {
    total: customers.length,
    withDue: customers.filter((c) => c.balance > 0).length,
    withCredit: customers.filter((c) => c.balance < 0).length,
  };

  return (
    <div className="min-h-screen bg-[#111827]">
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg transition-colors text-white">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-white">Select Customer</h1>
                <p className="text-xs text-[#6B7280]">Choose customer for rental booking</p>
              </div>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customer by name or phone..."
              className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg pl-11 pr-4 text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#8B5CF6]"
            />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-[#8B5CF6] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {!searchQuery && recentCustomers.length > 0 && (
                  <div>
                    <h2 className="text-sm font-medium text-[#9CA3AF] mb-3">RECENT CUSTOMERS</h2>
                    <div className="space-y-2">
                      {recentCustomers.map((c) => (
                        <CustomerCard key={c.id} customer={c} onSelect={onSelect} isRecent />
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <h2 className="text-sm font-medium text-[#9CA3AF] mb-3">
                    {searchQuery ? 'SEARCH RESULTS' : 'ALL CUSTOMERS'}
                  </h2>
                  <div className="space-y-2">
                    {filteredCustomers.map((c) => (
                      <CustomerCard key={c.id} customer={c} onSelect={onSelect} />
                    ))}
                  </div>
                  {filteredCustomers.length === 0 && (
                    <div className="text-center py-12 bg-[#1F2937] rounded-xl border border-[#374151]">
                      <Search className="w-8 h-8 mx-auto mb-4 text-[#6B7280]" />
                      <p className="text-[#9CA3AF]">No customers found</p>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setShowAddDialog(true)}
                  className="w-full py-3 border-2 border-dashed border-[#374151] rounded-lg text-[#9CA3AF] hover:border-[#8B5CF6] hover:text-[#8B5CF6] transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  <span className="font-medium text-sm">Add New Customer</span>
                </button>
              </>
            )}
          </div>
          <div className="space-y-4">
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-4">Customer Stats</h3>
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
          </div>
        </div>
      </div>

      {showAddDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1F2937] rounded-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-[#374151] flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Add New Customer</h2>
              <button
                onClick={() => {
                  setShowAddDialog(false);
                  setNewCustomer({ name: '', phone: '' });
                  setAddError('');
                }}
                className="p-2 hover:bg-[#374151] rounded-lg transition-colors text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#9CA3AF] mb-2">Customer Name *</label>
                <input
                  type="text"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  placeholder="Enter customer name"
                  className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-white placeholder-[#6B7280] focus:outline-none focus:border-[#8B5CF6]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#9CA3AF] mb-2">Phone Number *</label>
                <input
                  type="tel"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  placeholder="+92-300-1234567"
                  className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-white placeholder-[#6B7280] focus:outline-none focus:border-[#8B5CF6]"
                />
              </div>
              {addError && <p className="text-sm text-red-400">{addError}</p>}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowAddDialog(false);
                    setNewCustomer({ name: '', phone: '' });
                  }}
                  className="flex-1 h-12 border border-[#374151] rounded-lg font-medium hover:bg-[#374151] transition-colors text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddNewCustomer}
                  disabled={!newCustomer.name.trim() || !newCustomer.phone.trim()}
                  className="flex-1 h-12 bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:bg-[#374151] disabled:text-[#6B7280] rounded-lg font-medium transition-colors text-white"
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

function CustomerCard({
  customer,
  onSelect,
  isRecent,
}: {
  customer: RentalCustomer;
  onSelect: (c: RentalCustomer) => void;
  isRecent?: boolean;
}) {
  return (
    <button
      onClick={() => onSelect(customer)}
      className="w-full bg-[#1F2937] border border-[#374151] rounded-lg p-3 hover:border-[#8B5CF6] transition-all text-left"
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
            isRecent ? 'bg-[#F59E0B]/10' : 'bg-[#8B5CF6]/10'
          }`}
        >
          {isRecent ? (
            <Star className="w-4 h-4 text-[#F59E0B] fill-[#F59E0B]" />
          ) : (
            <span className="text-sm font-semibold text-[#8B5CF6]">{customer.name.charAt(0)}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-white text-sm truncate">{customer.name}</h3>
          <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
            <Phone className="w-3 h-3" />
            <span>{customer.phone}</span>
          </div>
        </div>
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
}
