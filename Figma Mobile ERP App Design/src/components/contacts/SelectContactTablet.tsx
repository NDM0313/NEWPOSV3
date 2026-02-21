import { useState } from 'react';
import { ArrowLeft, Search, Plus, Phone, Mail, X, Users, Star } from 'lucide-react';

interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: 'Customer' | 'Supplier' | 'Worker' | 'Other';
  balance: number;
}

interface SelectContactTabletProps {
  onBack: () => void;
  onSelect: (contact: Contact) => void;
  contacts: Contact[];
  setContacts: (contacts: Contact[]) => void;
  title?: string;
  subtitle?: string;
  filterRole?: 'Customer' | 'Supplier' | 'Worker' | 'Other';
}

export function SelectContactTablet({ 
  onBack, 
  onSelect, 
  contacts, 
  setContacts,
  title = 'Select Contact',
  subtitle = 'Choose contact',
  filterRole
}: SelectContactTabletProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newContact, setNewContact] = useState({ 
    name: '', 
    phone: '', 
    email: '',
    role: filterRole || 'Customer' as const
  });

  const filteredContacts = contacts
    .filter(contact => filterRole ? contact.role === filterRole : true)
    .filter(contact =>
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.phone.includes(searchQuery) ||
      (contact.email && contact.email.toLowerCase().includes(searchQuery.toLowerCase()))
    );

  const recentContacts = filteredContacts.slice(0, 2);

  const stats = {
    total: filteredContacts.length,
    customers: contacts.filter(c => c.role === 'Customer').length,
    suppliers: contacts.filter(c => c.role === 'Supplier').length,
    workers: contacts.filter(c => c.role === 'Worker').length,
  };

  const handleAddNewContact = () => {
    if (!newContact.name || !newContact.phone) return;
    
    const contact: Contact = {
      id: `c${Date.now()}`,
      name: newContact.name,
      phone: newContact.phone,
      email: newContact.email || undefined,
      role: newContact.role,
      balance: 0,
    };
    
    setContacts([contact, ...contacts]);
    setShowAddDialog(false);
    setNewContact({ name: '', phone: '', email: '', role: filterRole || 'Customer' });
    onSelect(contact);
  };

  // Compact Contact Card Component
  const CompactContactCard = ({ contact, isRecent }: { contact: Contact; isRecent?: boolean }) => {
    const getRoleColor = (role: string) => {
      switch(role) {
        case 'Customer': return 'text-[#3B82F6] bg-[#3B82F6]/10';
        case 'Supplier': return 'text-[#10B981] bg-[#10B981]/10';
        case 'Worker': return 'text-[#F59E0B] bg-[#F59E0B]/10';
        default: return 'text-[#6B7280] bg-[#6B7280]/10';
      }
    };

    return (
      <button
        onClick={() => onSelect(contact)}
        className="w-full bg-[#1F2937] border border-[#374151] rounded-lg p-3 hover:border-[#6366F1] transition-all active:scale-[0.98] text-left group"
      >
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className={`w-9 h-9 ${isRecent ? 'bg-[#F59E0B]/10' : getRoleColor(contact.role)} rounded-full flex items-center justify-center flex-shrink-0`}>
            {isRecent ? (
              <Star className="w-4 h-4 text-[#F59E0B] fill-[#F59E0B]" />
            ) : (
              <span className="text-sm font-semibold">
                {contact.name.charAt(0)}
              </span>
            )}
          </div>

          {/* Name + Contact Info (Left) */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-white text-sm truncate">{contact.name}</h3>
              <span className={`text-xs px-1.5 py-0.5 rounded ${getRoleColor(contact.role)}`}>
                {contact.role}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#6B7280] mt-0.5">
              <Phone className="w-3 h-3" />
              <span>{contact.phone}</span>
            </div>
          </div>

          {/* Balance (Right) */}
          {contact.balance !== 0 && (
            <div className="text-right flex-shrink-0">
              <p className={`text-xs font-medium ${contact.balance > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
                {contact.balance > 0 ? 'Due' : 'Credit'}
              </p>
              <p className={`text-sm font-semibold ${contact.balance > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
                Rs. {Math.abs(contact.balance).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[#111827]">
      {/* Header */}
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="p-2 hover:bg-[#374151] rounded-lg transition-colors active:scale-95"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-semibold">{title}</h1>
                <p className="text-xs text-[#6B7280]">{subtitle}</p>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contact by name, phone or email..."
              className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg pl-11 pr-4 text-sm focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="grid grid-cols-3 gap-6">
          {/* Left Column - Contact List (2/3 width) */}
          <div className="col-span-2 space-y-6">
            {/* Recent Contacts */}
            {!searchQuery && recentContacts.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-[#9CA3AF] mb-3">RECENT CONTACTS</h2>
                <div className="space-y-2">
                  {recentContacts.map((contact) => (
                    <CompactContactCard key={contact.id} contact={contact} isRecent />
                  ))}
                </div>
              </div>
            )}

            {/* All Contacts */}
            <div>
              <h2 className="text-sm font-medium text-[#9CA3AF] mb-3">
                {searchQuery ? 'SEARCH RESULTS' : filterRole ? `${filterRole.toUpperCase()}S` : 'ALL CONTACTS'}
              </h2>
              <div className="space-y-2">
                {filteredContacts.map((contact) => (
                  <CompactContactCard key={contact.id} contact={contact} />
                ))}
              </div>

              {filteredContacts.length === 0 && (
                <div className="text-center py-12 bg-[#1F2937] rounded-xl border border-[#374151]">
                  <div className="w-16 h-16 bg-[#374151] rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="w-8 h-8 text-[#6B7280]" />
                  </div>
                  <p className="text-[#9CA3AF]">No contacts found</p>
                </div>
              )}
            </div>

            {/* Add New Contact Button */}
            <button 
              onClick={() => setShowAddDialog(true)}
              className="w-full py-3 border-2 border-dashed border-[#374151] rounded-lg text-[#9CA3AF] hover:border-[#6366F1] hover:text-[#6366F1] transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium text-sm">Add New Contact</span>
            </button>
          </div>

          {/* Right Column - Stats & Info (1/3 width) */}
          <div className="space-y-4">
            {/* Stats */}
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-[#6366F1]" />
                <h3 className="text-sm font-semibold text-white">Contact Stats</h3>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#6B7280]">Total</span>
                  <span className="text-sm font-semibold text-white">{stats.total}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#6B7280]">Customers</span>
                  <span className="text-sm font-semibold text-[#3B82F6]">{stats.customers}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#6B7280]">Suppliers</span>
                  <span className="text-sm font-semibold text-[#10B981]">{stats.suppliers}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#6B7280]">Workers</span>
                  <span className="text-sm font-semibold text-[#F59E0B]">{stats.workers}</span>
                </div>
              </div>
            </div>

            {/* Role Legend */}
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Contact Roles</h3>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#3B82F6] rounded-full"></div>
                  <span className="text-[#9CA3AF]">Customer</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#10B981] rounded-full"></div>
                  <span className="text-[#9CA3AF]">Supplier</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#F59E0B] rounded-full"></div>
                  <span className="text-[#9CA3AF]">Worker</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#6B7280] rounded-full"></div>
                  <span className="text-[#9CA3AF]">Other</span>
                </div>
              </div>
            </div>

            {/* Quick Tip */}
            <div className="bg-[#6366F1]/10 border border-[#6366F1]/30 rounded-xl p-4">
              <div className="text-lg mb-2">💡</div>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                <span className="text-white font-medium">Quick Tip:</span> Search by name, phone or email address
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Add Contact Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1F2937] rounded-2xl w-full max-w-md">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#374151] flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add New Contact</h2>
              <button
                onClick={() => {
                  setShowAddDialog(false);
                  setNewContact({ name: '', phone: '', email: '', role: filterRole || 'Customer' });
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
                  Contact Name *
                </label>
                <input
                  type="text"
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                  placeholder="Enter contact name"
                  className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#9CA3AF] mb-2">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  value={newContact.phone}
                  onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                  placeholder="+92-300-1234567"
                  className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#9CA3AF] mb-2">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={newContact.email}
                  onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                  placeholder="email@example.com"
                  className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20"
                />
              </div>

              {!filterRole && (
                <div>
                  <label className="block text-sm font-medium text-[#9CA3AF] mb-2">
                    Role *
                  </label>
                  <select
                    value={newContact.role}
                    onChange={(e) => setNewContact({ ...newContact, role: e.target.value as any })}
                    className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20"
                  >
                    <option value="Customer">Customer</option>
                    <option value="Supplier">Supplier</option>
                    <option value="Worker">Worker</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowAddDialog(false);
                    setNewContact({ name: '', phone: '', email: '', role: filterRole || 'Customer' });
                  }}
                  className="flex-1 h-12 border border-[#374151] rounded-lg font-medium hover:bg-[#374151] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddNewContact}
                  disabled={!newContact.name || !newContact.phone}
                  className="flex-1 h-12 bg-[#6366F1] hover:bg-[#5558E3] disabled:bg-[#374151] disabled:text-[#6B7280] rounded-lg font-medium transition-colors"
                >
                  Add Contact
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
