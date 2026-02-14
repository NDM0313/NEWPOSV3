import { useState } from 'react';
import { ArrowLeft, Users, Plus, Search, Filter } from 'lucide-react';
import { User } from '../../App';
import { AddContactFlow } from './AddContactFlow';
import { EditContactFlow } from './EditContactFlow';
import { ContactDetailView } from './ContactDetailView';

interface ContactsModuleProps {
  onBack: () => void;
  user: User;
}

export type ContactRole = 'customer' | 'supplier' | 'worker';

export interface Contact {
  id: string;
  name: string;
  roles: ContactRole[]; // Multiple roles support
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  balance: number; // positive = receivable, negative = payable
  creditLimit?: number;
  
  // Worker specific fields (if role includes 'worker')
  workerType?: 'dyer' | 'stitcher' | 'master' | 'handwork' | 'other';
  workerRate?: number; // Per piece or daily rate
  
  // Activity Log
  createdBy: string;
  createdByRole: string;
  createdAt: string;
  editedBy?: string;
  editedByRole?: string;
  editedAt?: string;
  
  status: 'active' | 'inactive';
}

export function ContactsModule({ onBack, user }: ContactsModuleProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | ContactRole>('all');
  const [showAddContact, setShowAddContact] = useState(false);
  const [showEditContact, setShowEditContact] = useState(false);
  const [showContactDetail, setShowContactDetail] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  // Mock contacts data with multi-role support
  const [contacts, setContacts] = useState<Contact[]>([
    {
      id: '1',
      name: 'Ahmed Retailers',
      roles: ['customer'],
      phone: '+92 300 1234567',
      email: 'ahmed@example.com',
      address: 'Shop 15, Main Bazaar',
      city: 'Karachi',
      balance: 50000,
      creditLimit: 100000,
      createdBy: 'Ali Hassan',
      createdByRole: 'Admin',
      createdAt: '2025-12-01T10:00:00',
      status: 'active',
    },
    {
      id: '2',
      name: 'Textile Suppliers Co.',
      roles: ['supplier'],
      phone: '+92 333 4567890',
      email: 'textile@example.com',
      address: 'Plot 25, Industrial Area',
      city: 'Faisalabad',
      balance: -85000,
      createdBy: 'Sara Khan',
      createdByRole: 'Manager',
      createdAt: '2025-11-20T14:30:00',
      editedBy: 'Ali Hassan',
      editedByRole: 'Admin',
      editedAt: '2026-01-15T09:20:00',
      status: 'active',
    },
    {
      id: '3',
      name: 'Usman - Master Tailor',
      roles: ['worker', 'supplier'],
      phone: '+92 321 9988776',
      city: 'Lahore',
      balance: -12000,
      workerType: 'master',
      workerRate: 500,
      createdBy: 'Ahmad Khan',
      createdByRole: 'Admin',
      createdAt: '2026-01-10T11:00:00',
      status: 'active',
    },
    {
      id: '4',
      name: 'Fatima Dyer',
      roles: ['worker'],
      phone: '+92 300 5544332',
      city: 'Karachi',
      balance: -8500,
      workerType: 'dyer',
      workerRate: 350,
      createdBy: 'Ahmad Khan',
      createdByRole: 'Admin',
      createdAt: '2026-01-12T16:45:00',
      status: 'active',
    },
    {
      id: '5',
      name: 'Ayesha Fashion',
      roles: ['customer', 'supplier'],
      phone: '+92 321 9876543',
      email: 'ayesha@example.com',
      address: 'House 42, DHA Phase 6',
      city: 'Lahore',
      balance: 25000,
      creditLimit: 75000,
      createdBy: 'Sara Khan',
      createdByRole: 'Manager',
      createdAt: '2026-01-05T13:20:00',
      status: 'active',
    },
  ]);

  // Calculate stats
  const stats = {
    total: contacts.length,
    customers: contacts.filter(c => c.roles.includes('customer')).length,
    suppliers: contacts.filter(c => c.roles.includes('supplier')).length,
    workers: contacts.filter(c => c.roles.includes('worker')).length,
    receivables: contacts.reduce((sum, c) => sum + (c.balance > 0 ? c.balance : 0), 0),
    payables: contacts.reduce((sum, c) => sum + (c.balance < 0 ? Math.abs(c.balance) : 0), 0),
  };

  // Filter contacts
  const filteredContacts = contacts.filter(contact => {
    const matchesSearch =
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.phone.includes(searchQuery);
    const matchesRole = filterRole === 'all' || contact.roles.includes(filterRole);
    return matchesSearch && matchesRole;
  });

  const handleAddContact = (newContact: Omit<Contact, 'id' | 'createdBy' | 'createdByRole' | 'createdAt'>) => {
    const contact: Contact = {
      ...newContact,
      id: Date.now().toString(),
      createdBy: user.name,
      createdByRole: user.role,
      createdAt: new Date().toISOString(),
    };
    setContacts([contact, ...contacts]);
    setShowAddContact(false);
  };

  const handleUpdateContact = (updatedContact: Contact) => {
    const updated: Contact = {
      ...updatedContact,
      editedBy: user.name,
      editedByRole: user.role,
      editedAt: new Date().toISOString(),
    };
    setContacts(contacts.map(c => c.id === updated.id ? updated : c));
    setShowEditContact(false);
    setSelectedContact(updated);
  };

  const handleViewDetails = (contact: Contact) => {
    setSelectedContact(contact);
    setShowContactDetail(true);
  };

  const handleEditContact = (contact: Contact) => {
    setSelectedContact(contact);
    setShowContactDetail(false);
    setShowEditContact(true);
  };

  const getRoleBadgeColor = (role: ContactRole) => {
    switch (role) {
      case 'customer':
        return 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/30';
      case 'supplier':
        return 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30';
      case 'worker':
        return 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30';
      default:
        return 'bg-[#6B7280]/10 text-[#6B7280] border-[#6B7280]/30';
    }
  };

  const getRoleLabel = (role: ContactRole) => {
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  // Show flows
  if (showAddContact) {
    return (
      <AddContactFlow
        onBack={() => setShowAddContact(false)}
        onSubmit={handleAddContact}
      />
    );
  }

  if (showEditContact && selectedContact) {
    return (
      <EditContactFlow
        contact={selectedContact}
        onBack={() => setShowEditContact(false)}
        onSubmit={handleUpdateContact}
      />
    );
  }

  if (showContactDetail && selectedContact) {
    return (
      <ContactDetailView
        contact={selectedContact}
        onBack={() => setShowContactDetail(false)}
        onEdit={handleEditContact}
        user={user}
      />
    );
  }

  return (
    <div className="min-h-screen pb-40 bg-[#111827]">
      {/* Header */}
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div className="w-8 h-8 bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] rounded-lg flex items-center justify-center shadow-lg shadow-[#8B5CF6]/30">
              <Users size={18} className="text-white" />
            </div>
            <h1 className="text-white font-semibold text-base">Contacts</h1>
          </div>
          <button
            onClick={() => setShowAddContact(true)}
            className="p-2 bg-[#8B5CF6] hover:bg-[#7C3AED] rounded-lg transition-colors"
          >
            <Plus size={20} className="text-white" />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="overflow-x-auto px-4 py-4 scrollbar-hide">
        <div className="flex gap-3" style={{ minWidth: 'min-content' }}>
          <StatsCard icon="👥" value={stats.total} label="Total" />
          <StatsCard icon="👤" value={stats.customers} label="Customers" color="blue" />
          <StatsCard icon="🏢" value={stats.suppliers} label="Suppliers" color="green" />
          <StatsCard icon="👷" value={stats.workers} label="Workers" color="orange" />
          <StatsCard 
            icon="💵" 
            value={`${(stats.receivables / 1000).toFixed(0)}k`} 
            label="Receivables" 
            color="red" 
          />
          <StatsCard 
            icon="💳" 
            value={`${(stats.payables / 1000).toFixed(0)}k`} 
            label="Payables" 
            color="purple" 
          />
        </div>
      </div>

      {/* Search & Filter */}
      <div className="px-4 pb-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or phone..."
            className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg pl-10 pr-4 text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#8B5CF6] focus:ring-2 focus:ring-[#8B5CF6]/20"
          />
        </div>

        {/* Role Filter */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          <Filter size={18} className="text-[#6B7280] flex-shrink-0" />
          {(['all', 'customer', 'supplier', 'worker'] as const).map((role) => (
            <button
              key={role}
              onClick={() => setFilterRole(role)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filterRole === role
                  ? 'bg-[#8B5CF6] text-white'
                  : 'bg-[#1F2937] text-[#9CA3AF] border border-[#374151] hover:border-[#8B5CF6]/50'
              }`}
            >
              {role === 'all' ? 'All' : getRoleLabel(role)}
            </button>
          ))}
        </div>
      </div>

      {/* Contacts List */}
      <div className="px-4 space-y-3">
        {filteredContacts.map((contact) => (
          <div
            key={contact.id}
            onClick={() => handleViewDetails(contact)}
            className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#8B5CF6]/50 transition-all cursor-pointer active:scale-[0.98]"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="text-white font-semibold text-base mb-2">{contact.name}</h3>
                {/* Role Badges */}
                <div className="flex flex-wrap gap-1.5">
                  {contact.roles.map((role) => (
                    <span
                      key={role}
                      className={`px-2 py-0.5 rounded-md text-xs font-medium border ${getRoleBadgeColor(role)}`}
                    >
                      {getRoleLabel(role)}
                    </span>
                  ))}
                </div>
              </div>
              {contact.balance !== 0 && (
                <div className="text-right">
                  <div className="text-xs text-[#9CA3AF] mb-1">
                    {contact.balance > 0 ? 'Receivable' : 'Payable'}
                  </div>
                  <div className={`text-sm font-semibold ${
                    contact.balance > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'
                  }`}>
                    {Math.abs(contact.balance).toLocaleString()}
                  </div>
                </div>
              )}
            </div>

            {/* Contact Info */}
            <div className="space-y-1.5">
              <div className="text-sm text-[#9CA3AF]">📞 {contact.phone}</div>
              {contact.city && (
                <div className="text-sm text-[#9CA3AF]">📍 {contact.city}</div>
              )}
              {contact.workerType && (
                <div className="text-sm text-[#9CA3AF]">
                  👷 {contact.workerType.charAt(0).toUpperCase() + contact.workerType.slice(1)}
                  {contact.workerRate && ` • Rs. ${contact.workerRate}/piece`}
                </div>
              )}
            </div>
          </div>
        ))}

        {filteredContacts.length === 0 && (
          <div className="text-center py-16">
            <Users className="w-16 h-16 mx-auto mb-4 text-[#374151]" />
            <p className="text-[#9CA3AF] text-sm">No contacts found</p>
            <button
              onClick={() => setShowAddContact(true)}
              className="mt-4 px-6 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-lg text-sm font-medium transition-colors"
            >
              Add First Contact
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Stats Card Component
interface StatsCardProps {
  icon: string;
  value: number | string;
  label: string;
  color?: string;
}

function StatsCard({ icon, value, label, color = 'gray' }: StatsCardProps) {
  const colorClasses: Record<string, string> = {
    gray: 'bg-[#1F2937] border-[#374151]',
    blue: 'bg-[#3B82F6]/10 border-[#3B82F6]/30',
    green: 'bg-[#10B981]/10 border-[#10B981]/30',
    orange: 'bg-[#F59E0B]/10 border-[#F59E0B]/30',
    red: 'bg-[#EF4444]/10 border-[#EF4444]/30',
    purple: 'bg-[#8B5CF6]/10 border-[#8B5CF6]/30',
  };

  return (
    <div className={`${colorClasses[color]} border rounded-xl p-4 min-w-[110px] flex-shrink-0`}>
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-xl font-bold text-white mb-1">{value}</div>
      <div className="text-xs text-[#9CA3AF] whitespace-nowrap">{label}</div>
    </div>
  );
}
