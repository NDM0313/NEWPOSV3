import { useState, useEffect } from 'react';
import { ArrowLeft, Search, Plus, Phone, Star, Building2, Loader2 } from 'lucide-react';
import type { AddContactFormData } from '../contacts/AddContactFlow';
import { AddContactFlow } from '../contacts/AddContactFlow';
import { SwipeBackShell } from '../common';
import * as contactsApi from '../../api/contacts';
import { usePermissions } from '../../context/PermissionContext';

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  balance: number;
}

interface SelectSupplierTabletProps {
  onBack: () => void;
  onSelect: (supplier: Supplier) => void;
  companyId: string | null;
}

export function SelectSupplierTablet({ onBack, onSelect, companyId }: SelectSupplierTabletProps) {
  const { canViewBalances } = usePermissions();
  const [searchQuery, setSearchQuery] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(!!companyId);
  const [view, setView] = useState<'pick' | 'addContact'>('pick');
  const [addError, setAddError] = useState('');
  const [addSaving, setAddSaving] = useState(false);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    contactsApi.getContacts(companyId, 'supplier').then(({ data, error }) => {
      if (cancelled) return;
      setLoading(false);
      setSuppliers(
        error
          ? []
          : data.map((c) => ({
              id: c.id,
              name: c.name,
              phone: c.phone || '',
              balance: c.balance || 0,
            })),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.phone.includes(searchQuery),
  );
  const recentSuppliers = suppliers.slice(0, 2);

  const handleAddContactSubmit = async (data: AddContactFormData) => {
    if (!companyId) return;
    setAddError('');
    setAddSaving(true);
    try {
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
        const supplier: Supplier = {
          id: created.id,
          name: created.name,
          phone: created.phone || '',
          balance: 0,
        };
        setSuppliers([supplier, ...suppliers]);
        setView('pick');
        onSelect(supplier);
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

  const stats = {
    total: suppliers.length,
    withDue: suppliers.filter((s) => s.balance > 0).length,
    withCredit: suppliers.filter((s) => s.balance < 0).length,
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
                <h1 className="text-xl font-semibold text-white">Select Supplier</h1>
                <p className="text-xs text-[#6B7280]">Choose supplier for purchase</p>
              </div>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search suppliers..."
              className="w-full h-11 bg-[#111827] border border-[#374151] rounded-lg pl-11 pr-4 text-white placeholder-[#6B7280] focus:outline-none focus:border-[#10B981]"
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
            <Loader2 className="w-8 h-8 text-[#10B981] animate-spin" />
          </div>
        ) : (
          <>
            {!searchQuery && recentSuppliers.length > 0 && (
              <div className="mb-4">
                <h2 className="text-xs font-medium text-[#9CA3AF] mb-2 uppercase">Recent</h2>
                <div className="space-y-2">
                  {recentSuppliers.map((supplier) => (
                    <SupplierCard
                      key={supplier.id}
                      supplier={supplier}
                      canViewBalances={canViewBalances}
                      onSelect={() => onSelect(supplier)}
                      isRecent
                    />
                  ))}
                </div>
              </div>
            )}

            <h2 className="text-xs font-medium text-[#9CA3AF] mb-2 uppercase">
              {searchQuery ? 'Search Results' : 'All Suppliers'}
            </h2>
            <div className="space-y-2 mb-4">
              {filteredSuppliers.map((supplier) => (
                <SupplierCard
                  key={supplier.id}
                  supplier={supplier}
                  canViewBalances={canViewBalances}
                  onSelect={() => onSelect(supplier)}
                />
              ))}
              {filteredSuppliers.length === 0 && (
                <p className="text-center py-8 text-[#9CA3AF]">No suppliers found</p>
              )}
            </div>
          </>
        )}

        <button
          type="button"
          onClick={() => setView('addContact')}
          className="w-full py-3 border-2 border-dashed border-[#374151] rounded-lg text-[#9CA3AF] hover:border-[#10B981] hover:text-[#10B981] flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add New Supplier
        </button>
      </div>
    </div>
  );
}

function SupplierCard({
  supplier,
  canViewBalances,
  onSelect,
  isRecent,
}: {
  supplier: Supplier;
  canViewBalances: boolean;
  onSelect: () => void;
  isRecent?: boolean;
}) {
  return (
    <button
      onClick={onSelect}
      className="w-full bg-[#1F2937] border border-[#374151] rounded-lg p-3 hover:border-[#10B981] transition-all text-left"
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
            isRecent ? 'bg-[#10B981]/10' : 'bg-[#10B981]/10'
          }`}
        >
          {isRecent ? (
            <Star className="w-4 h-4 text-[#10B981] fill-[#10B981]" />
          ) : (
            <Building2 className="w-4 h-4 text-[#10B981]" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-white text-sm truncate">{supplier.name}</h3>
          <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
            <Phone className="w-3 h-3" />
            <span>{supplier.phone}</span>
          </div>
        </div>
        {canViewBalances && supplier.balance !== 0 && (
          <div className="text-right flex-shrink-0">
            <p className={`text-xs font-medium ${supplier.balance > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
              {supplier.balance > 0 ? 'Due' : 'Credit'}
            </p>
            <p className={`text-sm font-semibold ${supplier.balance > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
              Rs. {Math.abs(supplier.balance).toLocaleString()}
            </p>
          </div>
        )}
      </div>
    </button>
  );
}
