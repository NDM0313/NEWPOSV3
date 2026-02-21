import { useState, useEffect } from 'react';
import { ArrowLeft, Users, Plus, Search, Phone, Loader2 } from 'lucide-react';
import type { User } from '../../types';
import * as contactsApi from '../../api/contacts';
import type { Contact, ContactRole } from '../../api/contacts';
import { AddContactFlow, type AddContactFormData } from './AddContactFlow';
import { EditContactFlow } from './EditContactFlow';
import { ContactDetailView } from './ContactDetailView';

export type { Contact, ContactRole };

interface ContactsModuleProps {
  onBack: () => void;
  user: User;
  companyId: string | null;
}

export function ContactsModule({ onBack, user, companyId }: ContactsModuleProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(!!companyId);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | ContactRole>('all');
  const [view, setView] = useState<'list' | 'add' | 'detail' | 'edit'>('list');
  const [selected, setSelected] = useState<Contact | null>(null);
  const [addError, setAddError] = useState('');
  const [updateError, setUpdateError] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setContacts([]);
      setLoading(false);
      setLoadError('Company not selected.');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    contactsApi.getContacts(companyId).then(({ data, error }) => {
      if (cancelled) return;
      setLoading(false);
      if (error) {
        setLoadError(error);
        setContacts([]);
      } else {
        setContacts(data || []);
      }
    });
    return () => { cancelled = true; };
  }, [companyId]);

  const filtered = contacts.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search);
    const matchRole = filterRole === 'all' || c.roles.includes(filterRole);
    return matchSearch && matchRole;
  });

  const stats = {
    total: contacts.length,
    customers: contacts.filter((c) => c.roles.includes('customer')).length,
    suppliers: contacts.filter((c) => c.roles.includes('supplier')).length,
    workers: contacts.filter((c) => c.roles.includes('worker')).length,
  };

  const handleAdd = async (data: AddContactFormData) => {
    if (!companyId) return;
    setAddError('');
    const { data: created, error } = await contactsApi.createContact(companyId, {
      name: data.name,
      phone: data.phone,
      email: data.email || undefined,
      city: data.city || undefined,
      address: data.address || undefined,
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
    if (created) setContacts([created, ...contacts]);
    setView('list');
  };

  const handleUpdate = async (updates: Partial<Contact>) => {
    if (!selected || !companyId) return;
    setUpdateError('');
    const { data, error } = await contactsApi.updateContact(selected.id, {
      name: updates.name ?? selected.name,
      phone: updates.phone ?? selected.phone,
      email: updates.email ?? selected.email,
      city: updates.city ?? selected.city,
      address: updates.address ?? selected.address,
      roles: updates.roles?.length ? updates.roles : selected.roles,
      openingBalance: updates.balance ?? selected.balance,
      creditLimit: updates.creditLimit ?? selected.creditLimit,
      workerType: updates.workerType ?? selected.workerType,
      workerRate: updates.workerRate ?? selected.workerRate,
      status: updates.status ?? selected.status,
    });
    if (error) {
      setUpdateError(error);
      return;
    }
    if (data) {
      setContacts(contacts.map((c) => (c.id === data.id ? data : c)));
      setSelected(data);
    }
    setView('detail');
  };

  if (view === 'add') {
    return (
      <AddContactFlow
        onBack={() => { setAddError(''); setView('list'); }}
        onSubmit={handleAdd}
        error={addError}
      />
    );
  }

  if (view === 'edit' && selected) {
    return (
      <EditContactFlow
        contact={selected}
        onBack={() => { setUpdateError(''); setView('detail'); }}
        onSubmit={handleUpdate}
        error={updateError}
      />
    );
  }

  if (view === 'detail' && selected) {
    return (
      <ContactDetailView
        contact={selected}
        onBack={() => { setView('list'); setSelected(null); }}
        onEdit={() => setView('edit')}
        user={user}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 bg-[#8B5CF6] rounded-lg flex items-center justify-center">
              <Users size={18} className="text-white" />
            </div>
            <h1 className="text-white font-semibold text-base">Contacts</h1>
          </div>
          <button onClick={() => setView('add')} className="p-2 bg-[#8B5CF6] hover:bg-[#7C3AED] rounded-lg text-white">
            <Plus size={20} />
          </button>
        </div>
      </div>

      <div className="p-4">
        {loadError && (
          <div className="mb-4 p-3 bg-[#EF4444]/10 border border-[#EF4444]/50 rounded-xl text-[#FCA5A5] text-sm">
            {loadError}
          </div>
        )}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#8B5CF6] animate-spin" />
          </div>
        ) : (
        <>
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          <div className="flex-shrink-0 px-4 py-2 bg-[#1F2937] border border-[#374151] rounded-lg text-center">
            <p className="text-lg font-bold text-white">{stats.total}</p>
            <p className="text-xs text-[#9CA3AF]">Total</p>
          </div>
          <div className="flex-shrink-0 px-4 py-2 bg-[#3B82F6]/10 border border-[#3B82F6]/30 rounded-lg text-center">
            <p className="text-lg font-bold text-[#93C5FD]">{stats.customers}</p>
            <p className="text-xs text-[#9CA3AF]">Customers</p>
          </div>
          <div className="flex-shrink-0 px-4 py-2 bg-[#10B981]/10 border border-[#10B981]/30 rounded-lg text-center">
            <p className="text-lg font-bold text-[#6EE7B7]">{stats.suppliers}</p>
            <p className="text-xs text-[#9CA3AF]">Suppliers</p>
          </div>
          <div className="flex-shrink-0 px-4 py-2 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-lg text-center">
            <p className="text-lg font-bold text-[#FCD34D]">{stats.workers}</p>
            <p className="text-xs text-[#9CA3AF]">Workers</p>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          {(['all', 'customer', 'supplier', 'worker'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setFilterRole(r)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${
                filterRole === r ? 'bg-[#8B5CF6] text-white' : 'bg-[#1F2937] text-[#9CA3AF] border border-[#374151]'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts..."
            className="w-full h-11 bg-[#1F2937] border border-[#374151] rounded-lg pl-10 pr-4 text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
          />
        </div>

        <div className="space-y-2">
          {filtered.map((contact) => (
            <button
              key={contact.id}
              onClick={() => { setSelected(contact); setView('detail'); }}
              className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#8B5CF6] transition-all text-left"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-white mb-1">{contact.name}</h3>
                  <p className="text-sm text-[#9CA3AF] flex items-center gap-1">
                    <Phone className="w-4 h-4" />
                    {contact.phone}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {contact.roles.map((r) => (
                      <span key={r} className="px-2 py-0.5 rounded text-xs bg-[#374151] text-[#9CA3AF] capitalize">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
                <span className={`text-sm font-medium ${contact.balance >= 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
                  Rs. {Math.abs(contact.balance).toLocaleString()}
                </span>
              </div>
            </button>
          ))}
        </div>
        {filtered.length === 0 && (
          <p className="text-center text-[#6B7280] py-8">No contacts found</p>
        )}
        </>
        )}
      </div>
    </div>
  );
}
