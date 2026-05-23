import { useState, useEffect } from 'react';
import { ArrowLeft, Search, Plus, Phone, Loader2, Star, ShoppingCart, Palette } from 'lucide-react';
import type { Customer } from './SalesModule';
import type { AddContactFormData } from '../contacts/AddContactFlow';
import { AddContactFlow } from '../contacts/AddContactFlow';
import { SwipeBackShell } from '../common';
import * as contactsApi from '../../api/contacts';
import { usePermissions } from '../../context/PermissionContext';
import { getPartyBalanceLabel } from '../../utils/balancePrivacy';

interface SelectCustomerProps {
  companyId: string | null;
  branchId?: string | null;
  onBack: () => void;
  onSelect: (customer: Customer, saleType: 'regular' | 'studio') => void;
  initialSaleType?: 'regular' | 'studio';
  onSaleTypeChange?: (saleType: 'regular' | 'studio') => void;
}

function contactToCustomer(c: contactsApi.Contact): Customer {
  return { id: c.id, name: c.name, phone: c.phone || '—', balance: c.balance };
}

function CustomerBalanceLine({ balance, canView }: { balance: number; canView: boolean }) {
  const label = getPartyBalanceLabel(balance, canView);
  if (!label) return null;
  return (
    <p className={`text-xs mt-2 ${balance > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>{label}</p>
  );
}

export function SelectCustomer({ companyId, branchId, onBack, onSelect, initialSaleType = 'regular', onSaleTypeChange }: SelectCustomerProps) {
  const { canViewBalances } = usePermissions();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(!!companyId);
  const [searchQuery, setSearchQuery] = useState('');
  const [saleType, setSaleType] = useState<'regular' | 'studio'>(initialSaleType);
  const [view, setView] = useState<'pick' | 'addContact'>('pick');
  const [addError, setAddError] = useState('');
  const [addSaving, setAddSaving] = useState(false);

  useEffect(() => {
    setSaleType(initialSaleType);
  }, [initialSaleType]);

  const handleSaleTypeChange = (type: 'regular' | 'studio') => {
    setSaleType(type);
    onSaleTypeChange?.(type);
  };

  useEffect(() => {
    if (!companyId) {
      setCustomers([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    contactsApi.getContacts(companyId, 'customer', branchId ?? undefined).then(({ data, error }) => {
      if (cancelled) return;
      setLoading(false);
      setCustomers(error ? [] : data.map(contactToCustomer));
    });
    return () => { cancelled = true; };
  }, [companyId, branchId]);

  const list = customers;
  const recentCustomers = list.slice(0, 3);

  const filtered = list.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone.includes(searchQuery)
  );

  const handleAddContactSubmit = async (data: AddContactFormData) => {
    setAddError('');
    setAddSaving(true);
    try {
      if (companyId) {
        const { data: created, error } = await contactsApi.createContact(companyId, {
          name: data.name.trim(),
          phone: data.phone.trim(),
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
          setCustomers((prev) => [c, ...prev]);
          setView('pick');
          onSelect(c, saleType);
        }
      } else {
        const c: Customer = {
          id: `c${Date.now()}`,
          name: data.name.trim(),
          phone: data.phone.trim(),
          balance: 0,
        };
        setCustomers((prev) => [c, ...prev]);
        setView('pick');
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

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-[#1F2937] border-b border-[#374151] px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg transition-colors text-[#F9FAFB]">
            <ArrowLeft className="w-5 h-5" />
          </button>
            <h1 className="text-lg font-semibold text-[#F9FAFB]">Select Customer</h1>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-[#9CA3AF] mb-2">SALE TYPE</label>
          <div className="flex gap-2">
            <button
              onClick={() => handleSaleTypeChange('regular')}
              className={`flex-1 h-10 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                saleType === 'regular' ? 'bg-[#10B981] text-white shadow-lg shadow-[#10B981]/20' : 'bg-[#111827] text-[#9CA3AF] border border-[#374151] hover:border-[#10B981]/50'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              Regular Sale
            </button>
            <button
              onClick={() => handleSaleTypeChange('studio')}
              className={`flex-1 h-10 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                saleType === 'studio' ? 'bg-[#8B5CF6] text-white shadow-lg shadow-[#8B5CF6]/20' : 'bg-[#111827] text-[#9CA3AF] border border-[#374151] hover:border-[#8B5CF6]/50'
              }`}
            >
              <Palette className="w-4 h-4" />
              Studio Sale
            </button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customer..."
            className="w-full h-11 bg-[#111827] border border-[#374151] rounded-lg pl-11 pr-4 text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
          />
        </div>
      </div>

      <div className="p-4 pb-24">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin" />
          </div>
        ) : (
        <>
        {!searchQuery && recentCustomers.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-medium text-[#9CA3AF] mb-3">RECENT CUSTOMERS</h2>
            <div className="space-y-2">
              {recentCustomers.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => onSelect(customer, saleType)}
                  className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#3B82F6] transition-all text-left"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-[#F59E0B]/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <Star className="w-5 h-5 text-[#F59E0B] fill-[#F59E0B]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-white mb-1">{customer.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-[#9CA3AF]">
                        <Phone className="w-4 h-4" />
                        <span>{customer.phone}</span>
                      </div>
                      <CustomerBalanceLine balance={customer.balance} canView={canViewBalances} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <h2 className="text-sm font-medium text-[#9CA3AF] mb-3">{searchQuery ? 'SEARCH RESULTS' : 'ALL CUSTOMERS'}</h2>
          <div className="space-y-2">
            {filtered.map((customer) => (
              <button
                key={customer.id}
                onClick={() => onSelect(customer, saleType)}
                className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#3B82F6] transition-all text-left"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-[#3B82F6]/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-[#3B82F6]">{customer.name.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-white mb-1">{customer.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-[#9CA3AF]">
                      <Phone className="w-4 h-4" />
                      <span>{customer.phone}</span>
                    </div>
                    <CustomerBalanceLine balance={customer.balance} canView={canViewBalances} />
                  </div>
                </div>
              </button>
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-[#9CA3AF]">No customers found</div>
          )}
        </div>
        </>
        )}
      </div>

      <button
        onClick={() => setView('addContact')}
        className="mx-4 mt-4 w-[calc(100%-2rem)] py-4 border-2 border-dashed border-[#374151] rounded-xl text-[#9CA3AF] hover:border-[#3B82F6] hover:text-[#3B82F6] flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" />
        Add New Customer
      </button>
    </div>
  );
}
