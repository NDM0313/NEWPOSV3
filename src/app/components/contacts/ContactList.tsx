import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Search, Users, Phone, Mail, MoreVertical, Eye, Edit, Trash2, Receipt, DollarSign, ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { cn } from "../ui/utils";
import { useNavigation } from '../../context/NavigationContext';
import { useSupabase } from '../../context/SupabaseContext';
import { contactService } from '../../services/contactService';
import { saleService } from '../../services/saleService';
import { purchaseService } from '../../services/purchaseService';
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

interface ContactListItem {
  id: number;
  uuid: string;
  name: string;
  type: 'Supplier' | 'Customer';
  email: string;
  phone: string;
  receivables: number;
  payables: number;
  status: 'Active' | 'On Hold';
  balance: number;
}

export const ContactList = () => {
  const { openDrawer } = useNavigation();
  const { companyId, branchId } = useSupabase();
  const [contacts, setContacts] = useState<ContactListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Action States
  const [selectedContact, setSelectedContact] = useState<ContactListItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  // ✅ Unified Components State
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);

  // Load contacts from Supabase
  const loadContacts = useCallback(async () => {
    if (!companyId) return;
    
    try {
      setLoading(true);
      
      // Load contacts
      const contactsData = await contactService.getAllContacts(companyId);
      
      // Load sales and purchases to calculate balances
      const [salesData, purchasesData] = await Promise.all([
        saleService.getAllSales(companyId, branchId === 'all' ? undefined : branchId || undefined).catch(() => []),
        purchaseService.getAllPurchases(companyId, branchId === 'all' ? undefined : branchId || undefined).catch(() => []),
      ]);
      
      // Convert to app format
      const convertedContacts: ContactListItem[] = contactsData.map((c: any, index: number) => {
        // Calculate receivables (from sales)
        const receivables = salesData
          .filter((s: any) => s.customer_id === c.id)
          .reduce((sum: number, s: any) => sum + (s.due_amount || 0), 0);
        
        // Calculate payables (from purchases)
        const payables = purchasesData
          .filter((p: any) => p.supplier_id === c.id)
          .reduce((sum: number, p: any) => sum + (p.due_amount || 0), 0);
        
        // Determine type
        let contactType: 'Supplier' | 'Customer' = 'Customer';
        if (c.type === 'supplier') {
          contactType = 'Supplier';
        } else if (c.type === 'customer') {
          contactType = 'Customer';
        } else if (c.type === 'worker') {
          contactType = 'Supplier'; // Workers are treated as suppliers for payments
        }
        
        // Determine status
        let status: 'Active' | 'On Hold' = 'Active';
        if (c.status === 'onhold' || c.status === 'inactive') {
          status = 'On Hold';
        }
        
        return {
          id: index + 1,
          uuid: c.id,
          name: c.name || '',
          type: contactType,
          email: c.email || '-',
          phone: c.phone || c.mobile || '-',
          receivables,
          payables,
          status,
          balance: receivables - payables,
        };
      });
      
      setContacts(convertedContacts);
    } catch (error: any) {
      console.error('[CONTACT LIST] Error loading contacts:', error);
      toast.error('Failed to load contacts: ' + (error.message || 'Unknown error'));
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId]);

  // Load contacts on mount
  useEffect(() => {
    if (companyId) {
      loadContacts();
    } else {
      setLoading(false);
    }
  }, [companyId, loadContacts]);

  // Filter contacts by search term
  const filteredContacts = useMemo(() => {
    if (!searchTerm) return contacts;
    const term = searchTerm.toLowerCase();
    return contacts.filter(c => 
      c.name.toLowerCase().includes(term) ||
      c.email.toLowerCase().includes(term) ||
      c.phone.toLowerCase().includes(term)
    );
  }, [contacts, searchTerm]);

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

  const handleConfirmDelete = async () => {
    if (selectedContact) {
      try {
        await contactService.deleteContact(selectedContact.uuid);
        await loadContacts(); // Reload from database
        setIsDeleteModalOpen(false);
        setSelectedContact(null);
        toast.success(`${selectedContact.name} deleted successfully`);
      } catch (error: any) {
        console.error('[CONTACT LIST] Error deleting contact:', error);
        toast.error('Failed to delete contact: ' + (error.message || 'Unknown error'));
      }
    }
  };

  const handleUpdateContact = async (updatedContact: Contact) => {
    if (!selectedContact) return;
    
    try {
      // Update in Supabase
      await contactService.updateContact(selectedContact.uuid, {
        name: updatedContact.name,
        email: updatedContact.email,
        phone: updatedContact.mobile || updatedContact.phone,
        city: updatedContact.city,
        country: updatedContact.country,
        address: updatedContact.address,
      });
      
      // Reload contacts
      await loadContacts();
      
      setIsEditModalOpen(false);
      setSelectedContact(null);
      toast.success('Contact updated successfully');
    } catch (error: any) {
      console.error('[CONTACT LIST] Error updating contact:', error);
      toast.error('Failed to update contact: ' + (error.message || 'Unknown error'));
    }
  };

  const handlePaymentComplete = async (paymentData: any) => {
    // Reload contacts to get updated balances
    await loadContacts();
    setIsPaymentDialogOpen(false);
    toast.success('Payment recorded successfully');
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
          subtitle={`${contacts.filter(c => c.status === 'Active').length} Active`}
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
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <Loader2 size={48} className="mx-auto text-blue-500 mb-3 animate-spin" />
                    <p className="text-gray-400 text-sm">Loading contacts...</p>
                  </td>
                </tr>
              ) : filteredContacts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <Users size={48} className="mx-auto text-gray-600 mb-3" />
                    <p className="text-gray-400 text-sm">No contacts found</p>
                    <p className="text-gray-600 text-xs mt-1">Try adjusting your search</p>
                  </td>
                </tr>
              ) : (
                filteredContacts.map((contact) => {
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
              }))}
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
        entityId={selectedContact?.uuid}
      />

      {/* 3. Unified Payment Dialog */}
      <UnifiedPaymentDialog
        isOpen={isPaymentDialogOpen}
        onClose={() => setIsPaymentDialogOpen(false)}
        context={selectedContact?.type === 'Supplier' ? 'supplier' : 'customer'}
        entityName={selectedContact?.name || ''}
        entityId={selectedContact?.uuid}
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
           city: selectedContact?.city,
           country: selectedContact?.country,
           address: selectedContact?.address,
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