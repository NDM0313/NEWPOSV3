import { useState, useEffect } from 'react';
import { ArrowLeft, Search, Plus, Phone, Loader2, Star, Building2 } from 'lucide-react';
import type { AddContactFormData } from '../contacts/AddContactFlow';
import { AddContactFlow } from '../contacts/AddContactFlow';
import { SwipeBackShell } from '../common';
import * as contactsApi from '../../api/contacts';
import type { Supplier } from './SelectSupplierTablet';
import { usePermissions } from '../../context/PermissionContext';
import { getPartyBalanceLabel } from '../../utils/balancePrivacy';

interface SelectSupplierProps {
  companyId: string | null;
  onBack: () => void;
  onSelect: (supplier: Supplier) => void;
}

function contactToSupplier(c: contactsApi.Contact): Supplier {
  return { id: c.id, name: c.name, phone: c.phone || '', balance: c.balance || 0 };
}

function SupplierBalanceLine({ balance, canView }: { balance: number; canView: boolean }) {
  const label = getPartyBalanceLabel(balance, canView);
  if (!label) return null;
  return (
    <p className={`text-xs mt-2 ${balance > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>{label}</p>
  );
}

export function SelectSupplier({ companyId, onBack, onSelect }: SelectSupplierProps) {
  const { canViewBalances } = usePermissions();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(!!companyId);
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<'pick' | 'addContact'>('pick');
  const [addError, setAddError] = useState('');
  const [addSaving, setAddSaving] = useState(false);

  useEffect(() => {
    if (!companyId) {
      setSuppliers([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    contactsApi.getContacts(companyId, 'supplier').then(({ data, error }) => {
      if (cancelled) return;
      setLoading(false);
      setSuppliers(error ? [] : data.map(contactToSupplier));
    });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const recentSuppliers = suppliers.slice(0, 3);

  const filtered = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.phone.includes(searchQuery)
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
          roles: data.roles.length ? data.roles : ['supplier'],
          openingBalance: data.balance,
          creditLimit: data.creditLimit || undefined,
        });
        if (error) {
          setAddError(error);
          return;
        }
        if (created) {
          const s = contactToSupplier(created);
          setSuppliers((prev) => [s, ...prev]);
          setView('pick');
          onSelect(s);
        }
      } else {
        const s: Supplier = {
          id: `s${Date.now()}`,
          name: data.name.trim(),
          phone: data.phone.trim(),
          balance: 0,
        };
        setSuppliers((prev) => [s, ...prev]);
        setView('pick');
        onSelect(s);
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
          defaultRoles={['supplier']}
          lockRoles
          title="Add New Supplier"
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
      <div className="bg-[#1F2937] border-b border-[#374151] px-4 py-3 sticky top-0 z-10 flow-screen-header">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg transition-colors text-[#F9FAFB]">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-[#F9FAFB]">Select Supplier</h1>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search supplier by name or phone…"
            className="w-full h-11 bg-[#111827] border border-[#374151] rounded-lg pl-11 pr-4 text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#10B981]"
          />
        </div>
      </div>

      <div className="p-4 pb-24">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#10B981] animate-spin" />
          </div>
        ) : (
          <>
            {!searchQuery && recentSuppliers.length > 0 && (
              <div className="mb-6">
                <h2 className="text-sm font-medium text-[#9CA3AF] mb-3">RECENT SUPPLIERS</h2>
                <div className="space-y-2">
                  {recentSuppliers.map((supplier) => (
                    <button
                      key={supplier.id}
                      onClick={() => onSelect(supplier)}
                      className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#10B981] transition-all text-left"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-[#10B981]/10 rounded-full flex items-center justify-center flex-shrink-0">
                          <Star className="w-5 h-5 text-[#10B981] fill-[#10B981]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-white mb-1">{supplier.name}</h3>
                          <div className="flex items-center gap-2 text-sm text-[#9CA3AF]">
                            <Phone className="w-4 h-4" />
                            <span>{supplier.phone || '—'}</span>
                          </div>
                          <SupplierBalanceLine balance={supplier.balance} canView={canViewBalances} />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h2 className="text-sm font-medium text-[#9CA3AF] mb-3">{searchQuery ? 'SEARCH RESULTS' : 'ALL SUPPLIERS'}</h2>
              <div className="space-y-2">
                {filtered.map((supplier) => (
                  <button
                    key={supplier.id}
                    onClick={() => onSelect(supplier)}
                    className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#10B981] transition-all text-left"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-[#10B981]/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-5 h-5 text-[#10B981]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-white mb-1">{supplier.name}</h3>
                        <div className="flex items-center gap-2 text-sm text-[#9CA3AF]">
                          <Phone className="w-4 h-4" />
                          <span>{supplier.phone || '—'}</span>
                        </div>
                        <SupplierBalanceLine balance={supplier.balance} canView={canViewBalances} />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              {filtered.length === 0 && (
                <div className="text-center py-12 text-[#9CA3AF]">No suppliers found</div>
              )}
            </div>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={() => setView('addContact')}
        className="mx-4 mt-4 w-[calc(100%-2rem)] py-4 border-2 border-dashed border-[#374151] rounded-xl text-[#9CA3AF] hover:border-[#10B981] hover:text-[#10B981] flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" />
        Add New Supplier
      </button>
    </div>
  );
}
