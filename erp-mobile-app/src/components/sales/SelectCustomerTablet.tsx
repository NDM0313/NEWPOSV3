import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Search, Plus, Phone, Star, ShoppingCart, Palette, Loader2, UserRound } from 'lucide-react';
import type { Customer } from './SalesModule';
import type { AddContactFormData } from '../contacts/AddContactFlow';
import { AddContactFlow } from '../contacts/AddContactFlow';
import { SwipeBackShell } from '../common';
import * as contactsApi from '../../api/contacts';
import { getContactDisplayPhone } from '../../api/contacts';
import { usePermissions } from '../../context/PermissionContext';
function contactToCustomer(c: contactsApi.Contact): Customer {
  return { id: c.id, name: c.name, phone: getContactDisplayPhone(c) || '—', balance: c.balance };
}

interface SelectCustomerTabletProps {
  companyId: string | null;
  branchId?: string | null;
  onBack: () => void;
  onSelect: (customer: Customer, saleType: 'regular' | 'studio') => void;
  initialSaleType?: 'regular' | 'studio';
  onSaleTypeChange?: (saleType: 'regular' | 'studio') => void;
}

export function SelectCustomerTablet({ companyId, branchId, onBack, onSelect, initialSaleType = 'regular', onSaleTypeChange }: SelectCustomerTabletProps) {
  const { canViewBalances } = usePermissions();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [defaultCustomer, setDefaultCustomer] = useState<Customer | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!companyId);
  const [searchQuery, setSearchQuery] = useState('');
  const [saleType, setSaleType] = useState<'regular' | 'studio'>(initialSaleType);
  const [view, setView] = useState<'pick' | 'addContact'>('pick');
  const [addError, setAddError] = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const walkingInitRef = useRef(false);

  useEffect(() => {
    setSaleType(initialSaleType);
  }, [initialSaleType]);

  const handleSaleTypeChange = (type: 'regular' | 'studio') => {
    setSaleType(type);
    onSaleTypeChange?.(type);
  };

  useEffect(() => {
    walkingInitRef.current = false;
    if (!companyId) {
      setCustomers([]);
      setDefaultCustomer(null);
      setSelectedCustomerId(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      await contactsApi.ensureDefaultWalkingCustomerForCompany(companyId);
      const [contactsRes, walkingRes] = await Promise.all([
        contactsApi.getContacts(companyId, 'customer', branchId ?? undefined),
        contactsApi.getWalkingCustomer(companyId),
      ]);
      if (cancelled) return;
      setLoading(false);
      const list = contactsRes.error ? [] : (contactsRes.data || []).map(contactToCustomer);
      const walking = walkingRes.data ? contactToCustomer(walkingRes.data) : null;
      if (walking && !list.some((c) => c.id === walking.id)) {
        setCustomers([walking, ...list]);
      } else {
        setCustomers(list);
      }
      setDefaultCustomer(walking);
      if (walking && !walkingInitRef.current) {
        walkingInitRef.current = true;
        setSelectedCustomerId(walking.id);
      }
    })();
    return () => { cancelled = true; };
  }, [companyId, branchId]);

  const handleCustomerClick = (customer: Customer) => {
    if (selectedCustomerId === customer.id) {
      onSelect(customer, saleType);
    } else {
      setSelectedCustomerId(customer.id);
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      (defaultCustomer ? c.id !== defaultCustomer.id : true) &&
      (c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery))
  );
  const recentCustomers = !searchQuery
    ? customers.filter((c) => defaultCustomer?.id !== c.id).slice(0, 2)
    : [];

  const handleAddContactSubmit = async (data: AddContactFormData) => {
    if (!companyId) return;
    setAddError('');
    setAddSaving(true);
    try {
      const { data: created, error } = await contactsApi.createContact(companyId, {
        name: data.name.trim(),
        phone: data.phone.trim(),
        mobile: data.mobile.trim(),
        email: data.email?.trim() || undefined,
        address: data.address?.trim() || undefined,
        city: data.city?.trim() || undefined,
        roles: data.roles.length ? data.roles : ['customer'],
        openingBalance: data.balance,
        creditLimit: data.creditLimit || undefined,
        workerType: data.workerType || undefined,
        workerRate: data.workerRate || undefined,
      });
      if (error) {
        setAddError(error);
        return;
      }
      if (created) {
        const c = contactToCustomer(created);
        setCustomers([c, ...customers]);
        setView('pick');
        setSelectedCustomerId(c.id);
        onSelect(c, saleType);
      }
    } finally {
      setAddSaving(false);
    }
  };

  if (view === 'addContact') {
    return (
      <SwipeBackShell onBack={() => { setView('pick'); setAddError(''); }}>
        <AddContactFlow
          onBack={() => { setView('pick'); setAddError(''); }}
          onSubmit={handleAddContactSubmit}
          error={addError}
          defaultRoles={['customer']}
          lockRoles
          title="Add New Customer"
        />
        {addSaving && (
          <div className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-white animate-spin" />
          </div>
        )}
      </SwipeBackShell>
    );
  }

  const stats = {
    total: customers.length,
    withDue: customers.filter((c) => c.balance > 0).length,
    withCredit: customers.filter((c) => c.balance < 0).length,
  };

  return (
    <div className="min-h-screen bg-[#111827]">
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-10 flow-screen-header">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg transition-colors text-white">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-white">Select Customer</h1>
                <p className="text-xs text-[#6B7280]">Walk-in is selected by default — tap again to continue</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => handleSaleTypeChange('regular')}
              className={`flex-1 h-10 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${
                saleType === 'regular' ? 'bg-[#3B82F6] text-white' : 'bg-[#111827] border border-[#374151] text-[#9CA3AF]'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              Regular Sale
            </button>
            <button
              onClick={() => handleSaleTypeChange('studio')}
              className={`flex-1 h-10 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${
                saleType === 'studio' ? 'bg-[#EC4899] text-white' : 'bg-[#111827] border border-[#374151] text-[#9CA3AF]'
              }`}
            >
              <Palette className="w-4 h-4" />
              Studio Sale
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customers..."
              className="w-full h-11 bg-[#111827] border border-[#374151] rounded-lg pl-11 pr-4 text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
            />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-4">
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-[#1F2937] border border-[#374151] rounded-lg p-3 text-center">
            <p className="text-xs text-[#6B7280]">Total</p>
            <p className="text-lg font-bold text-white">{stats.total}</p>
          </div>
          <div className="bg-[#1F2937] border border-[#374151] rounded-lg p-3 text-center">
            <p className="text-xs text-[#6B7280]">With Due</p>
            <p className="text-lg font-bold text-[#EF4444]">{stats.withDue}</p>
          </div>
          <div className="bg-[#1F2937] border border-[#374151] rounded-lg p-3 text-center">
            <p className="text-xs text-[#6B7280]">With Credit</p>
            <p className="text-lg font-bold text-[#10B981]">{stats.withCredit}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin" />
          </div>
        ) : (
          <>
            {!searchQuery && defaultCustomer && (
              <div className="mb-4">
                <h2 className="text-xs font-medium text-[#9CA3AF] mb-2 uppercase">Walk-in</h2>
                <CustomerCard
                  customer={defaultCustomer}
                  canViewBalances={canViewBalances}
                  onSelect={() => handleCustomerClick(defaultCustomer)}
                  isSelected={selectedCustomerId === defaultCustomer.id}
                  isWalkIn
                />
              </div>
            )}

            {!searchQuery && recentCustomers.length > 0 && (
              <div className="mb-4">
                <h2 className="text-xs font-medium text-[#9CA3AF] mb-2 uppercase">Recent</h2>
                <div className="space-y-2">
                  {recentCustomers.map((customer) => (
                    <CustomerCard
                      key={customer.id}
                      customer={customer}
                      canViewBalances={canViewBalances}
                      onSelect={() => handleCustomerClick(customer)}
                      isRecent
                      isSelected={selectedCustomerId === customer.id}
                    />
                  ))}
                </div>
              </div>
            )}

            <h2 className="text-xs font-medium text-[#9CA3AF] mb-2 uppercase">
              {searchQuery ? 'Search Results' : 'All Customers'}
            </h2>
            <div className="space-y-2 mb-4">
              {filteredCustomers.map((customer) => (
                <CustomerCard
                  key={customer.id}
                  customer={customer}
                  canViewBalances={canViewBalances}
                  onSelect={() => handleCustomerClick(customer)}
                  isSelected={selectedCustomerId === customer.id}
                />
              ))}
              {filteredCustomers.length === 0 && (
                <p className="text-center py-8 text-[#9CA3AF]">No customers found</p>
              )}
            </div>
          </>
        )}

        <button
          onClick={() => setView('addContact')}
          className="w-full py-3 border-2 border-dashed border-[#374151] rounded-lg text-[#9CA3AF] hover:border-[#3B82F6] hover:text-[#3B82F6] flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add New Customer
        </button>
      </div>
    </div>
  );
}

function CustomerCard({
  customer,
  canViewBalances,
  onSelect,
  isRecent,
  isWalkIn,
  isSelected,
}: {
  customer: Customer;
  canViewBalances: boolean;
  onSelect: () => void;
  isRecent?: boolean;
  isWalkIn?: boolean;
  isSelected?: boolean;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full bg-[#1F2937] border rounded-lg p-3 hover:border-[#3B82F6] transition-all text-left ${
        isSelected ? 'border-[#3B82F6] ring-2 ring-[#3B82F6]/40' : 'border-[#374151]'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
            isWalkIn ? 'bg-[#10B981]/10' : isRecent ? 'bg-[#F59E0B]/10' : 'bg-[#3B82F6]/10'
          }`}
        >
          {isWalkIn ? (
            <UserRound className="w-4 h-4 text-[#10B981]" />
          ) : isRecent ? (
            <Star className="w-4 h-4 text-[#F59E0B] fill-[#F59E0B]" />
          ) : (
            <span className="text-sm font-semibold text-[#3B82F6]">{customer.name.charAt(0)}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-white text-sm truncate">{customer.name}</h3>
          <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
            <Phone className="w-3 h-3" />
            <span>{customer.phone}</span>
          </div>
        </div>
        {canViewBalances && customer.balance !== 0 && (
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
