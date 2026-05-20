import { useState, useEffect } from 'react';
import { ArrowLeft, Search, Plus, Phone, X, Loader2, Star, Building2 } from 'lucide-react';
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
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [addError, setAddError] = useState('');

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

  const handleAdd = async () => {
    if (!newName.trim() || !newPhone.trim()) return;
    setAddError('');
    if (companyId) {
      const { data, error } = await contactsApi.createContact(companyId, {
        name: newName.trim(),
        phone: newPhone.trim(),
        roles: ['supplier'],
      });
      if (error) {
        setAddError(error);
        return;
      }
      if (data) {
        const s = contactToSupplier(data);
        setSuppliers((prev) => [s, ...prev]);
        setShowAdd(false);
        setNewName('');
        setNewPhone('');
        onSelect(s);
      }
    } else {
      const s: Supplier = { id: `s${Date.now()}`, name: newName.trim(), phone: newPhone.trim(), balance: 0 };
      setSuppliers((prev) => [s, ...prev]);
      setShowAdd(false);
      setNewName('');
      setNewPhone('');
      onSelect(s);
    }
  };

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-[#1F2937] border-b border-[#374151] px-4 py-3 sticky top-0 z-10">
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
        onClick={() => setShowAdd(true)}
        className="mx-4 mt-4 w-[calc(100%-2rem)] py-4 border-2 border-dashed border-[#374151] rounded-xl text-[#9CA3AF] hover:border-[#10B981] hover:text-[#10B981] flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" />
        Add New Supplier
      </button>

      {showAdd && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center p-4">
          <div className="bg-[#1F2937] rounded-t-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-white">Add New Supplier</h2>
              <button
                type="button"
                onClick={() => {
                  setShowAdd(false);
                  setAddError('');
                }}
                className="p-2 hover:bg-[#374151] rounded-lg text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {addError && <p className="text-sm text-red-400 mb-2">{addError}</p>}
            <div className="space-y-4">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Supplier name"
                className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-white placeholder-[#6B7280] focus:outline-none focus:border-[#10B981]"
              />
              <input
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="Phone"
                className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-white placeholder-[#6B7280] focus:outline-none focus:border-[#10B981]"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="flex-1 h-12 border border-[#374151] rounded-lg text-white hover:bg-[#374151]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={!newName.trim() || !newPhone.trim()}
                  className="flex-1 h-12 bg-[#10B981] hover:bg-[#059669] disabled:bg-[#374151] rounded-lg font-medium text-white"
                >
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
