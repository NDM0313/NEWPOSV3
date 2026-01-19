import React, { useState } from 'react';
import { Plus, Search, Users, Phone, Mail, MoreVertical, Eye, Edit, Trash2, Receipt, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { cn } from "../ui/utils";
import { useNavigation } from '../../context/NavigationContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { QuickAddContactModal, Contact } from './QuickAddContactModal';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { UnifiedLedgerView } from '../shared/UnifiedLedgerView';
import { UnifiedPaymentDialog } from '../shared/UnifiedPaymentDialog';
import { toast } from 'sonner';

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
  
  // ✅ Unified Components State
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);

  // Handlers
  const handleEdit = (contact: any) => {
    setSelectedContact(contact);
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (contact: any) => {
    setSelectedContact(contact);
    setIsDeleteModalOpen(true);
  };

  const handleViewLedger = (contact: any) => {
    setSelectedContact(contact);
    setIsLedgerOpen(true);
  };

  const handleMakePayment = (contact: any) => {
    if (contact.type === 'Supplier' && contact.payables === 0) {
      toast.error('No outstanding payables for this supplier');
      return;
    }
    if (contact.type === 'Customer' && contact.receivables === 0) {
      toast.error('No outstanding receivables for this customer');
      return;
    }
    setSelectedContact(contact);
    setIsPaymentDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (selectedContact) {
      setContacts(prev => prev.filter(c => c.id !== selectedContact.id));
      setIsDeleteModalOpen(false);
      setSelectedContact(null);
      toast.success(`${selectedContact.name} deleted successfully`);
    }
  };

  const handleUpdateContact = (updatedContact: Contact) => {
    setContacts(prev => prev.map(c => 
      c.id === updatedContact.id 
        ? { ...c, ...updatedContact, email: updatedContact.email || c.email } 
        : c
    ));
    if (selectedContact && selectedContact.id === updatedContact.id) {
       setSelectedContact({ ...selectedContact, ...updatedContact });
    }
    toast.success('Contact updated successfully');
  };

  const handlePaymentComplete = (paymentData: any) => {
    // Update contact balance
    if (selectedContact) {
      setContacts(prev => prev.map(c => {
        if (c.id === selectedContact.id) {
          if (c.type === 'Supplier') {
            return {
              ...c,
              payables: Math.max(0, c.payables - paymentData.amount),
              balance: c.balance + paymentData.amount
            };
          } else {
            return {
              ...c,
              receivables: Math.max(0, c.receivables - paymentData.amount),
              balance: c.balance - paymentData.amount
            };
          }
        }
        return c;
      }));
      toast.success('Payment recorded successfully');
    }
    setIsPaymentDialogOpen(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Top Action Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Contacts</h2>
          <p className="text-gray-400 text-sm">Manage your suppliers and customers.</p>
        </div>
        <Button 
          onClick={() => openDrawer('addContact')}
          className="bg-blue-600 hover:bg-blue-500 text-white gap-2 shadow-lg shadow-blue-500/20"
        >
          <Plus size={18} />
          Add Contact
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard 
          title="Total Receivables" 
          value={`Rs ${contacts.reduce((sum, c) => sum + c.receivables, 0).toLocaleString()}`}
          subtitle={`From ${contacts.filter(c => c.type === 'Customer').length} Customers`}
          trend="+12%"
          trendUp={true}
          highlightColor="text-yellow-300" 
        />
        <GlassCard 
          title="Total Payables" 
          value={`Rs ${contacts.reduce((sum, c) => sum + c.payables, 0).toLocaleString()}`}
          subtitle={`To ${contacts.filter(c => c.type === 'Supplier').length} Suppliers`}
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
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-sm">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-gray-800 flex gap-4 bg-gray-900/50">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <Input 
              placeholder="Search contacts..." 
              className="pl-9 bg-gray-950 border-gray-800 text-white focus:border-blue-500 transition-all" 
            />
          </div>
          <div className="flex gap-2 ml-auto">
             <Button variant="outline" className="border-gray-800 text-gray-300 hover:bg-gray-800">Filter</Button>
             <Button variant="outline" className="border-gray-800 text-gray-300 hover:bg-gray-800">Export</Button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-950/50 text-gray-400 font-medium border-b border-gray-800">
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
            <tbody className="divide-y divide-gray-800">
              {contacts.map((contact) => {
                const hasOutstanding = contact.type === 'Supplier' ? contact.payables > 0 : contact.receivables > 0;
                
                return (
                  <tr key={contact.id} className="hover:bg-gray-800/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border border-gray-700">
                          <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${contact.name}`} />
                          <AvatarFallback className="bg-blue-900 text-blue-200">{contact.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-white">{contact.name}</p>
                          <p className="text-xs text-gray-500">ID: #{1000 + contact.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-medium border",
                        contact.type === 'Supplier' 
                          ? "bg-purple-500/10 text-purple-400 border-purple-500/20" 
                          : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                      )}>
                        {contact.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                         <div className="flex items-center gap-2 text-gray-400 text-xs">
                           <Mail size={12} /> {contact.email}
                         </div>
                         <div className="flex items-center gap-2 text-gray-400 text-xs">
                           <Phone size={12} /> {contact.phone}
                         </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {contact.receivables > 0 ? (
                        <span className="text-yellow-300 font-medium">Rs {contact.receivables.toLocaleString()}</span>
                      ) : <span className="text-gray-600">-</span>}
                    </td>
                    <td className="px-6 py-4 text-right">
                       {contact.payables > 0 ? (
                        <span className="text-red-400 font-medium">Rs {contact.payables.toLocaleString()}</span>
                      ) : <span className="text-gray-600">-</span>}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-medium",
                        contact.status === 'Active' ? "bg-green-500/10 text-green-500" : "bg-gray-800 text-gray-400"
                      )}>
                        {contact.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreVertical size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56 bg-gray-900 border-gray-800 text-white" align="end">
                          {/* View Ledger - ALWAYS AVAILABLE */}
                          <DropdownMenuItem 
                            className="flex items-center gap-2 hover:bg-gray-800 cursor-pointer"
                            onClick={() => handleViewLedger(contact)}
                          >
                            <Receipt size={16} />
                            View Ledger
                          </DropdownMenuItem>

                          {/* Payment Option - ONLY if outstanding balance */}
                          {hasOutstanding && (
                            <DropdownMenuItem 
                              className="flex items-center gap-2 hover:bg-gray-800 cursor-pointer"
                              onClick={() => handleMakePayment(contact)}
                            >
                              <DollarSign size={16} />
                              {contact.type === 'Supplier' ? 'Make Payment' : 'Receive Payment'}
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuSeparator className="bg-gray-800" />

                          {/* Standard Actions */}
                          <DropdownMenuItem className="flex items-center gap-2 hover:bg-gray-800 cursor-pointer">
                            <Eye size={16} />
                            View Details
                          </DropdownMenuItem>
                          
                          <DropdownMenuItem 
                            className="flex items-center gap-2 hover:bg-gray-800 cursor-pointer"
                            onClick={() => handleEdit(contact)}
                          >
                            <Edit size={16} />
                            Edit Contact
                          </DropdownMenuItem>

                          <DropdownMenuSeparator className="bg-gray-800" />
                          
                          <DropdownMenuItem 
                            className="flex items-center gap-2 text-red-500 hover:bg-red-900/10 hover:text-red-400 cursor-pointer"
                            onClick={() => handleDeleteClick(contact)}
                          >
                            <Trash2 size={16} />
                            Delete Contact
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODALS & DIALOGS --- */}

      {/* 1. Delete Confirmation */}
      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        contactName={selectedContact?.name || "Contact"}
      />

      {/* 2. Unified Ledger View */}
      <UnifiedLedgerView
        isOpen={isLedgerOpen}
        onClose={() => setIsLedgerOpen(false)}
        entityType={selectedContact?.type === 'Supplier' ? 'supplier' : 'customer'}
        entityName={selectedContact?.name || ''}
        entityId={selectedContact?.id?.toString()}
      />

      {/* 3. Unified Payment Dialog */}
      <UnifiedPaymentDialog
        isOpen={isPaymentDialogOpen}
        onClose={() => setIsPaymentDialogOpen(false)}
        context={selectedContact?.type === 'Supplier' ? 'supplier' : 'customer'}
        entityName={selectedContact?.name || ''}
        entityId={selectedContact?.id?.toString()}
        outstandingAmount={selectedContact?.type === 'Supplier' ? selectedContact?.payables || 0 : selectedContact?.receivables || 0}
        onSuccess={handlePaymentComplete}
      />

      {/* 4. Edit Contact Modal */}
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
           type: 'individual'
        }}
      />

    </div>
  );
};

const GlassCard = ({ title, value, subtitle, trend, trendUp, highlightColor }: any) => (
  <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-xl shadow-lg relative overflow-hidden group hover:border-white/20 transition-all">
    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
      <Users size={64} className="text-white" />
    </div>
    <p className="text-gray-400 text-sm font-medium">{title}</p>
    <div className="flex items-end gap-3 mt-1 mb-2">
      <h3 className={cn("text-3xl font-bold", highlightColor || "text-white")}>{value}</h3>
      {trend && (
        <span className={cn(
          "flex items-center text-xs font-medium px-1.5 py-0.5 rounded mb-1.5",
          trendUp ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
        )}>
          {trendUp ? <ArrowUpRight size={12} className="mr-0.5" /> : <ArrowDownRight size={12} className="mr-0.5" />}
          {trend}
        </span>
      )}
    </div>
    <p className="text-gray-500 text-xs">{subtitle}</p>
  </div>
);