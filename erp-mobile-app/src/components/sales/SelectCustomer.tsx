import { useState, useEffect } from 'react';
import { ArrowLeft, Search, Plus, Phone, X, Loader2 } from 'lucide-react';
import type { Customer } from './SalesModule';
import * as contactsApi from '../../api/contacts';

interface SelectCustomerProps {
  companyId: string | null;
  onBack: () => void;
  onSelect: (customer: Customer, saleType: 'regular' | 'studio') => void;
}

const MOCK_CUSTOMERS: Customer[] = [
  { id: '1', name: 'Ahmed Retailers', phone: '+92-300-1234567', balance: 5000 },
  { id: '2', name: 'Walk-in Customer', phone: '+92-321-9876543', balance: 0 },
  { id: '3', name: 'Ali Traders', phone: '+92-333-1111222', balance: -2000 },
  { id: '4', name: 'Bilal Store', phone: '+92-300-5555666', balance: 12000 },
  { id: '5', name: 'Sara Fashion', phone: '+92-321-7777888', balance: 0 },
  { id: '6', name: 'Fatima Boutique', phone: '+92-333-9999000', balance: 8000 },
];

function contactToCustomer(c: contactsApi.Contact): Customer {
  return { id: c.id, name: c.name, phone: c.phone || '—', balance: c.balance };
}

export function SelectCustomer({ companyId, onBack, onSelect }: SelectCustomerProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(!!companyId);
  const [searchQuery, setSearchQuery] = useState('');
  const [saleType, setSaleType] = useState<'regular' | 'studio'>('regular');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [addError, setAddError] = useState('');

  useEffect(() => {
    if (!companyId) {
      setCustomers(MOCK_CUSTOMERS);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    contactsApi.getContacts(companyId, 'customer').then(({ data, error }) => {
      if (cancelled) return;
      setLoading(false);
      if (error || !data.length) setCustomers(MOCK_CUSTOMERS);
      else setCustomers(data.map(contactToCustomer));
    });
    return () => { cancelled = true; };
  }, [companyId]);

  const list = customers.length ? customers : MOCK_CUSTOMERS;

  const filtered = list.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone.includes(searchQuery)
  );

  const handleAdd = async () => {
    if (!newName.trim() || !newPhone.trim()) return;
    setAddError('');
    if (companyId) {
      const { data, error } = await contactsApi.createContact(companyId, {
        name: newName.trim(),
        phone: newPhone.trim(),
        roles: ['customer'],
      });
      if (error) {
        setAddError(error);
        return;
      }
      if (data) {
        const c = contactToCustomer(data);
        setCustomers((prev) => (prev.length ? [c, ...prev] : [c]));
        setShowAdd(false);
        setNewName('');
        setNewPhone('');
        onSelect(c, saleType);
      }
    } else {
      const c: Customer = { id: `c${Date.now()}`, name: newName.trim(), phone: newPhone.trim(), balance: 0 };
      setCustomers((prev) => (prev.length ? [c, ...prev] : MOCK_CUSTOMERS));
      setShowAdd(false);
      setNewName('');
      setNewPhone('');
      onSelect(c, saleType);
    }
  };

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-[#1F2937] border-b border-[#374151] px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg transition-colors text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-white">Select Customer</h1>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-[#9CA3AF] mb-2">SALE TYPE</label>
          <div className="flex gap-2">
            <button
              onClick={() => setSaleType('regular')}
              className={`flex-1 h-10 rounded-lg text-sm font-medium transition-all ${
                saleType === 'regular' ? 'bg-[#10B981] text-white' : 'bg-[#111827] text-[#9CA3AF] border border-[#374151]'
              }`}
            >
              Regular Sale
            </button>
            <button
              onClick={() => setSaleType('studio')}
              className={`flex-1 h-10 rounded-lg text-sm font-medium transition-all ${
                saleType === 'studio' ? 'bg-[#8B5CF6] text-white' : 'bg-[#111827] text-[#9CA3AF] border border-[#374151]'
              }`}
            >
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

      <div className="p-4 space-y-2">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin" />
          </div>
        ) : (
        <>
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
                {customer.balance !== 0 && (
                  <p className={`text-xs mt-2 ${customer.balance > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
                    {customer.balance > 0 ? `Due: Rs. ${customer.balance.toLocaleString()}` : `Credit: Rs. ${Math.abs(customer.balance).toLocaleString()}`}
                  </p>
                )}
              </div>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-[#9CA3AF]">No customers found</div>
        )}
        </>
        )}
      </div>

      <button
        onClick={() => setShowAdd(true)}
        className="mx-4 mt-4 w-[calc(100%-2rem)] py-4 border-2 border-dashed border-[#374151] rounded-xl text-[#9CA3AF] hover:border-[#3B82F6] hover:text-[#3B82F6] flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" />
        Add New Customer
      </button>

      {showAdd && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center p-4">
          <div className="bg-[#1F2937] rounded-t-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-white">Add New Customer</h2>
              <button onClick={() => { setShowAdd(false); setAddError(''); }} className="p-2 hover:bg-[#374151] rounded-lg text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            {addError && <p className="text-sm text-red-400 mb-2">{addError}</p>}
            <div className="space-y-4">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Customer name"
                className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
              />
              <input
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="Phone"
                className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
              />
              <div className="flex gap-3">
                <button onClick={() => setShowAdd(false)} className="flex-1 h-12 border border-[#374151] rounded-lg text-white hover:bg-[#374151]">
                  Cancel
                </button>
                <button onClick={handleAdd} disabled={!newName.trim() || !newPhone.trim()} className="flex-1 h-12 bg-[#3B82F6] hover:bg-[#2563EB] disabled:bg-[#374151] rounded-lg font-medium text-white">
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
