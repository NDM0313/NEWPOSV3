import React, { useState } from 'react';
import { Plus, Search, Users, Phone, Mail, MapPin, ArrowUpRight, ArrowDownRight, MoreVertical, Eye, Edit, Trash2, Wallet } from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { cn } from "../ui/utils";
import { useNavigation } from '../../context/NavigationContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { QuickAddContactModal, Contact } from './QuickAddContactModal';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { ContactLedgerDrawer } from './ContactLedgerDrawer';

// Mock Data
const initialContacts = [
  { id: 1, name: 'Bilal Fabrics', type: 'Supplier', email: 'bilal@example.com', phone: '+92 300 1234567', receivables: 0, payables: 15000, status: 'Active', balance: -15000 },
  { id: 2, name: 'Ahmed Retailers', type: 'Customer', email: 'ahmed@example.com', phone: '+92 321 7654321', receivables: 45000, payables: 0, status: 'Active', balance: 45000 },
  { id: 3, name: 'ChenOne', type: 'Supplier', email: 'purchase@chenone.com', phone: '+92 42 111 222', receivables: 0, payables: 120000, status: 'On Hold', balance: -120000 },
  { id: 4, name: 'Walk-in Customer', type: 'Customer', email: '-', phone: '-', receivables: 0, payables: 0, status: 'Active', balance: 0 },
  { id: 5, name: 'Sapphire Mills', type: 'Supplier', email: 'accounts@sapphire.com', phone: '+92 300 9876543', receivables: 5000, payables: 45000, status: 'Active', balance: -40000 },
];

export const ContactList = () => {
  const { openDrawer } = useNavigation();
  const [contacts, setContacts] = useState(initialContacts);
  
  // Action States
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);

  // Handlers
  const handleEdit = (contact: any) => {
    setSelectedContact(contact);
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (contact: any) => {
    setSelectedContact(contact);
    setIsDeleteModalOpen(true);
  };

  const handleTransactionsClick = (contact: any) => {
    setSelectedContact(contact);
    setIsLedgerOpen(true);
  };

  const handleConfirmDelete = () => {
    if (selectedContact) {
      setContacts(prev => prev.filter(c => c.id !== selectedContact.id));
      setIsDeleteModalOpen(false);
      setSelectedContact(null);
    }
  };

  const handleUpdateContact = (updatedContact: Contact) => {
    setContacts(prev => prev.map(c => 
      c.id === updatedContact.id 
        ? { ...c, ...updatedContact, email: updatedContact.email || c.email } 
        : c
    ));
    // Also update selectedContact if ledger is open to reflect name changes immediately
    if (selectedContact && selectedContact.id === updatedContact.id) {
       setSelectedContact({ ...selectedContact, ...updatedContact });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Top Action Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 
            className="text-2xl font-bold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Contacts
          </h2>
          <p 
            className="text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Manage your suppliers and customers.
          </p>
        </div>
        <Button 
          onClick={() => openDrawer('addContact')}
          className="gap-2"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-text-primary)',
            boxShadow: 'var(--shadow-lg) rgba(59, 130, 246, 0.2)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-primary)';
          }}
        >
          <Plus size={18} />
          Add Contact
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard 
          title="Total Receivables" 
          value="$50,000" 
          subtitle="From 12 Customers"
          trend="+12%"
          trendUp={true}
          highlightColor="text-yellow-300" 
        />
        <GlassCard 
          title="Total Payables" 
          value="$180,000" 
          subtitle="To 5 Suppliers"
          trend="-5%"
          trendUp={false}
          highlightColor="text-white"
        />
        <GlassCard 
          title="Active Contacts" 
          value={contacts.length.toString()} 
          subtitle="+3 New this month"
          highlightColor="text-white"
        />
      </div>

      {/* Table Section */}
      <div 
        className="border rounded-xl overflow-hidden shadow-sm"
        style={{
          backgroundColor: 'var(--color-bg-primary)',
          borderColor: 'var(--color-border-primary)',
          borderRadius: 'var(--radius-xl)'
        }}
      >
        {/* Table Toolbar */}
        <div 
          className="p-4 border-b flex gap-4"
          style={{
            borderBottomColor: 'var(--color-border-primary)',
            backgroundColor: 'rgba(17, 24, 39, 0.5)'
          }}
        >
          <div className="relative flex-1 max-w-sm">
            <Search 
              className="absolute left-3 top-1/2 -translate-y-1/2" 
              size={16}
              style={{ color: 'var(--color-text-tertiary)' }}
            />
            <Input 
              placeholder="Search contacts..." 
              className="pl-9 transition-all"
              style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                borderColor: 'var(--color-border-primary)',
                color: 'var(--color-text-primary)'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-primary)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border-primary)';
              }}
            />
          </div>
          <div className="flex gap-2 ml-auto">
             <Button 
               variant="outline"
               style={{
                 borderColor: 'var(--color-border-primary)',
                 color: 'var(--color-text-secondary)'
               }}
               onMouseEnter={(e) => {
                 e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
               }}
               onMouseLeave={(e) => {
                 e.currentTarget.style.backgroundColor = 'transparent';
               }}
             >
               Filter
             </Button>
             <Button 
               variant="outline"
               style={{
                 borderColor: 'var(--color-border-primary)',
                 color: 'var(--color-text-secondary)'
               }}
               onMouseEnter={(e) => {
                 e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
               }}
               onMouseLeave={(e) => {
                 e.currentTarget.style.backgroundColor = 'transparent';
               }}
             >
               Export
             </Button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead 
              className="font-medium border-b"
              style={{
                backgroundColor: 'rgba(3, 7, 18, 0.5)',
                color: 'var(--color-text-secondary)',
                borderBottomColor: 'var(--color-border-primary)'
              }}
            >
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Contact Info</th>
                <th className="px-6 py-4 text-right">Receivables</th>
                <th className="px-6 py-4 text-right">Payables</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr 
                  key={contact.id} 
                  className="transition-colors group border-b"
                  style={{
                    borderBottomColor: 'var(--color-border-primary)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(31, 41, 55, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar 
                        className="h-9 w-9 border"
                        style={{ borderColor: 'var(--color-border-secondary)' }}
                      >
                        <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${contact.name}`} />
                        <AvatarFallback 
                          style={{
                            backgroundColor: 'rgba(30, 58, 138, 1)',
                            color: 'rgba(191, 219, 254, 1)'
                          }}
                        >
                          {contact.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p 
                          className="font-medium"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          {contact.name}
                        </p>
                        <p 
                          className="text-xs"
                          style={{ color: 'var(--color-text-tertiary)' }}
                        >
                          ID: #{1000 + contact.id}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span 
                      className="px-2.5 py-1 rounded-full text-xs font-medium border"
                      style={{
                        backgroundColor: contact.type === 'Supplier' 
                          ? 'rgba(147, 51, 234, 0.1)' 
                          : 'rgba(59, 130, 246, 0.1)',
                        color: contact.type === 'Supplier' 
                          ? 'var(--color-wholesale)' 
                          : 'var(--color-primary)',
                        borderColor: contact.type === 'Supplier' 
                          ? 'rgba(147, 51, 234, 0.2)' 
                          : 'rgba(59, 130, 246, 0.2)',
                        borderRadius: 'var(--radius-full)'
                      }}
                    >
                      {contact.type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                       <div 
                         className="flex items-center gap-2 text-xs"
                         style={{ color: 'var(--color-text-secondary)' }}
                       >
                         <Mail size={12} /> {contact.email}
                       </div>
                       <div 
                         className="flex items-center gap-2 text-xs"
                         style={{ color: 'var(--color-text-secondary)' }}
                       >
                         <Phone size={12} /> {contact.phone}
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {contact.receivables > 0 ? (
                      <span 
                        className="font-medium"
                        style={{ color: 'rgba(253, 224, 71, 1)' }}
                      >
                        ${contact.receivables.toLocaleString()}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-text-disabled)' }}>-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                     {contact.payables > 0 ? (
                      <span 
                        className="font-medium"
                        style={{ color: 'var(--color-error)' }}
                      >
                        ${contact.payables.toLocaleString()}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-text-disabled)' }}>-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span 
                      className="px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: contact.status === 'Active' 
                          ? 'rgba(16, 185, 129, 0.1)' 
                          : 'var(--color-bg-card)',
                        color: contact.status === 'Active' 
                          ? 'var(--color-success)' 
                          : 'var(--color-text-secondary)',
                        borderRadius: 'var(--radius-full)'
                      }}
                    >
                      {contact.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ color: 'var(--color-text-tertiary)' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'var(--color-text-primary)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--color-text-tertiary)';
                          }}
                        >
                          <MoreVertical size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent 
                        className="w-56" 
                        align="end"
                        style={{
                          backgroundColor: 'var(--color-bg-primary)',
                          borderColor: 'var(--color-border-primary)',
                          color: 'var(--color-text-primary)'
                        }}
                      >
                        <DropdownMenuItem 
                          className="flex items-center gap-2 cursor-pointer"
                          style={{ color: 'var(--color-text-primary)' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <Eye size={16} />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="flex items-center gap-2 cursor-pointer"
                          style={{ color: 'var(--color-text-primary)' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                          onClick={() => handleEdit(contact)}
                        >
                          <Edit size={16} />
                          Edit Contact
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="flex items-center gap-2 cursor-pointer"
                          style={{ color: 'var(--color-text-primary)' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                          onClick={() => handleTransactionsClick(contact)}
                        >
                          <Wallet size={16} />
                          Ledger / Transactions
                        </DropdownMenuItem>
                        <div 
                          className="h-px my-1"
                          style={{ backgroundColor: 'var(--color-border-primary)' }}
                        ></div>
                        <DropdownMenuItem 
                          className="flex items-center gap-2 cursor-pointer"
                          style={{ color: 'var(--color-error)' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(127, 29, 29, 0.1)';
                            e.currentTarget.style.color = 'rgba(248, 113, 113, 1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = 'var(--color-error)';
                          }}
                          onClick={() => handleDeleteClick(contact)}
                        >
                          <Trash2 size={16} />
                          Delete Contact
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODALS & DRAWERS --- */}

      {/* 1. Delete Confirmation */}
      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        contactName={selectedContact?.name || "Contact"}
      />

      {/* 2. Contact Ledger Drawer */}
      <ContactLedgerDrawer
        isOpen={isLedgerOpen}
        onClose={() => setIsLedgerOpen(false)}
        contact={selectedContact}
      />

      {/* 3. Edit Contact Modal */}
      {/* We use the same component as Add, but in Edit Mode */}
      <QuickAddContactModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleUpdateContact}
        contactType={selectedContact?.type === 'Customer' ? 'customer' : 'supplier'}
        mode="edit"
        initialData={{
           id: selectedContact?.id,
           name: selectedContact?.name,
           mobile: selectedContact?.phone,
           balance: selectedContact?.balance,
           type: 'individual' // Mock
        }}
      />

    </div>
  );
};

const GlassCard = ({ title, value, subtitle, trend, trendUp, highlightColor }: any) => {
  const valueColor = highlightColor === 'text-yellow-300' 
    ? 'rgba(253, 224, 71, 1)' 
    : 'var(--color-text-primary)';
  
  return (
    <div 
      className="backdrop-blur-md border p-6 rounded-xl shadow-lg relative overflow-hidden group transition-all"
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-lg)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
      }}
    >
      <div 
        className="absolute top-0 right-0 p-4 transition-opacity"
        style={{ opacity: '0.1' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '0.2';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '0.1';
        }}
      >
        <Users size={64} style={{ color: 'var(--color-text-primary)' }} />
      </div>
      <p 
        className="text-sm font-medium"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {title}
      </p>
      <div className="flex items-end gap-3 mt-1 mb-2">
        <h3 
          className="text-3xl font-bold"
          style={{ color: valueColor }}
        >
          {value}
        </h3>
        {trend && (
          <span 
            className="flex items-center text-xs font-medium px-1.5 py-0.5 rounded mb-1.5"
            style={{
              backgroundColor: trendUp ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              color: trendUp ? 'var(--color-success)' : 'var(--color-error)',
              borderRadius: 'var(--radius-sm)'
            }}
          >
            {trendUp ? <ArrowUpRight size={12} className="mr-0.5" /> : <ArrowDownRight size={12} className="mr-0.5" />}
            {trend}
          </span>
        )}
      </div>
      <p 
        className="text-xs"
        style={{ color: 'var(--color-text-tertiary)' }}
      >
        {subtitle}
      </p>
    </div>
  );
};
