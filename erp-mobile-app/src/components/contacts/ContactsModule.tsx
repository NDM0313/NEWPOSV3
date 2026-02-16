import { useState, useEffect } from 'react';
import { ArrowLeft, Users, Plus, Search, Phone, Loader2 } from 'lucide-react';
import type { User } from '../../types';
import * as contactsApi from '../../api/contacts';

export type ContactRole = 'customer' | 'supplier' | 'worker';

export interface Contact {
  id: string;
  name: string;
  roles: ContactRole[];
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  balance: number;
  status: 'active' | 'inactive';
}

interface ContactsModuleProps {
  onBack: () => void;
  user: User;
  companyId: string | null;
}

const MOCK_CONTACTS: Contact[] = [
  { id: '1', name: 'Ahmed Retailers', roles: ['customer'], phone: '+92 300 1234567', email: 'ahmed@example.com', city: 'Karachi', balance: 50000, status: 'active' },
  { id: '2', name: 'Textile Suppliers Co.', roles: ['supplier'], phone: '+92 333 4567890', city: 'Faisalabad', balance: -85000, status: 'active' },
  { id: '3', name: 'Usman - Master Tailor', roles: ['worker', 'supplier'], phone: '+92 321 9988776', city: 'Lahore', balance: -12000, status: 'active' },
  { id: '4', name: 'Fatima Dyer', roles: ['worker'], phone: '+92 300 5544332', city: 'Karachi', balance: -8500, status: 'active' },
  { id: '5', name: 'Ayesha Fashion', roles: ['customer', 'supplier'], phone: '+92 321 9876543', city: 'Lahore', balance: 25000, status: 'active' },
];

function ContactDetail({ contact, onBack, onEdit }: { contact: Contact; onBack: () => void; onEdit: () => void }) {
  return (
    <div className="min-h-screen bg-[#111827] p-4 pb-24">
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button onClick={onEdit} className="px-4 py-2 bg-[#3B82F6] hover:bg-[#2563EB] rounded-lg text-sm font-medium text-white">
          Edit
        </button>
      </div>
      <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-6">
        <h1 className="text-xl font-bold text-white mb-4">{contact.name}</h1>
        <div className="flex flex-wrap gap-2 mb-4">
          {contact.roles.map((r) => (
            <span key={r} className="px-2 py-1 rounded-full text-xs font-medium bg-[#3B82F6]/20 text-[#93C5FD]">
              {r}
            </span>
          ))}
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-[#6B7280]" />
            <span className="text-white">{contact.phone}</span>
          </div>
          {contact.email && (
            <div className="flex items-center gap-2">
              <span className="text-[#6B7280]">Email:</span>
              <span className="text-white">{contact.email}</span>
            </div>
          )}
          {contact.city && (
            <div className="flex items-center gap-2">
              <span className="text-[#6B7280]">City:</span>
              <span className="text-white">{contact.city}</span>
            </div>
          )}
          <div className="flex items-center gap-2 pt-2 border-t border-[#374151]">
            <span className="text-[#6B7280]">Balance:</span>
            <span className={contact.balance >= 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}>
              Rs. {Math.abs(contact.balance).toLocaleString()} {contact.balance >= 0 ? '(Receivable)' : '(Payable)'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditContactForm({
  contact,
  onBack,
  onSubmit,
  error: formError,
}: {
  contact: Contact;
  onBack: () => void;
  onSubmit: (c: Contact) => void;
  error: string;
}) {
  const [name, setName] = useState(contact.name);
  const [phone, setPhone] = useState(contact.phone);
  const [email, setEmail] = useState(contact.email ?? '');
  const [city, setCity] = useState(contact.city ?? '');
  const [roles, setRoles] = useState<ContactRole[]>(contact.roles.length ? contact.roles : ['customer']);

  const toggleRole = (r: ContactRole) => {
    setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  };

  const handleSubmit = () => {
    if (!name.trim() || !phone.trim()) return;
    onSubmit({
      ...contact,
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      city: city.trim() || undefined,
      roles: roles.length ? roles : ['customer'],
    });
  };

  return (
    <div className="min-h-screen bg-[#111827] p-4 pb-24">
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-white">Edit Contact</h1>
      </div>
      {formError && <p className="text-sm text-red-400 mb-4">{formError}</p>}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[#9CA3AF] mb-2">Name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contact name"
            className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg px-4 text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#9CA3AF] mb-2">Phone *</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+92 300 1234567"
            className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg px-4 text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#9CA3AF] mb-2">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg px-4 text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#9CA3AF] mb-2">City</label>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City"
            className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg px-4 text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#9CA3AF] mb-2">Role(s)</label>
          <div className="flex gap-2">
            {(['customer', 'supplier', 'worker'] as ContactRole[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => toggleRole(r)}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${
                  roles.includes(r) ? 'bg-[#8B5CF6] text-white' : 'bg-[#1F2937] text-[#9CA3AF] border border-[#374151]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={!name.trim() || !phone.trim()}
          className="w-full h-12 bg-[#3B82F6] hover:bg-[#2563EB] disabled:bg-[#374151] disabled:text-[#6B7280] rounded-lg font-medium text-white mt-4"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}

function AddContactForm({
  onBack,
  onSubmit,
  error: formError,
}: {
  onBack: () => void;
  onSubmit: (c: Omit<Contact, 'id' | 'status'>) => void;
  error: string;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [roles, setRoles] = useState<ContactRole[]>(['customer']);

  const toggleRole = (r: ContactRole) => {
    setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  };

  const handleSubmit = () => {
    if (!name.trim() || !phone.trim()) return;
    onSubmit({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      city: city.trim() || undefined,
      roles: roles.length ? roles : ['customer'],
      balance: 0,
    });
  };

  return (
    <div className="min-h-screen bg-[#111827] p-4 pb-24">
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-white">Add Contact</h1>
      </div>
      {formError && <p className="text-sm text-red-400 mb-4">{formError}</p>}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[#9CA3AF] mb-2">Name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contact name"
            className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg px-4 text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#9CA3AF] mb-2">Phone *</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+92 300 1234567"
            className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg px-4 text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#9CA3AF] mb-2">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg px-4 text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#9CA3AF] mb-2">City</label>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City"
            className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg px-4 text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#9CA3AF] mb-2">Role(s)</label>
          <div className="flex gap-2">
            {(['customer', 'supplier', 'worker'] as ContactRole[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => toggleRole(r)}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${
                  roles.includes(r) ? 'bg-[#8B5CF6] text-white' : 'bg-[#1F2937] text-[#9CA3AF] border border-[#374151]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={!name.trim() || !phone.trim()}
          className="w-full h-12 bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:bg-[#374151] disabled:text-[#6B7280] rounded-lg font-medium text-white mt-4"
        >
          Save Contact
        </button>
      </div>
    </div>
  );
}

export function ContactsModule({ onBack, user: _user, companyId }: ContactsModuleProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(!!companyId);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | ContactRole>('all');
  const [view, setView] = useState<'list' | 'add' | 'detail' | 'edit'>('list');
  const [selected, setSelected] = useState<Contact | null>(null);
  const [addError, setAddError] = useState('');
  const [updateError, setUpdateError] = useState('');

  useEffect(() => {
    if (!companyId) {
      setContacts(MOCK_CONTACTS);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    contactsApi.getContacts(companyId).then(({ data, error }) => {
      if (cancelled) return;
      setLoading(false);
      if (error) setContacts(MOCK_CONTACTS);
      else setContacts(data);
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

  const handleAdd = async (c: Omit<Contact, 'id' | 'status'>) => {
    if (!companyId) {
      setContacts([{ ...c, id: `c${Date.now()}`, status: 'active' }, ...contacts]);
      setView('list');
      return;
    }
    setAddError('');
    const { data, error } = await contactsApi.createContact(companyId, {
      name: c.name,
      phone: c.phone,
      email: c.email,
      city: c.city,
      roles: c.roles.length ? c.roles : ['customer'],
    });
    if (error) {
      setAddError(error);
      return;
    }
    if (data) setContacts([data, ...contacts]);
    setView('list');
  };

  const handleUpdate = async (updated: Contact) => {
    if (!companyId) {
      setContacts(contacts.map((c) => (c.id === updated.id ? updated : c)));
      setSelected(updated);
      setView('detail');
      return;
    }
    setUpdateError('');
    const { data, error } = await contactsApi.updateContact(updated.id, {
      name: updated.name,
      phone: updated.phone,
      email: updated.email,
      city: updated.city,
      roles: updated.roles.length ? updated.roles : ['customer'],
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
    return <AddContactForm onBack={() => { setAddError(''); setView('list'); }} onSubmit={handleAdd} error={addError} />;
  }

  if (view === 'edit' && selected) {
    return (
      <EditContactForm
        contact={selected}
        onBack={() => { setUpdateError(''); setView('detail'); }}
        onSubmit={handleUpdate}
        error={updateError}
      />
    );
  }

  if (view === 'detail' && selected) {
    return (
      <ContactDetail
        contact={selected}
        onBack={() => { setView('list'); setSelected(null); }}
        onEdit={() => setView('edit')}
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
