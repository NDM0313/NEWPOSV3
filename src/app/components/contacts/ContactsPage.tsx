import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Search, Filter, Download, Upload, Users, DollarSign, TrendingUp, 
  MoreVertical, Eye, Edit, Trash2, FileText, X, Phone, Mail, MapPin,
  Check, User, AlertCircle, Briefcase, CheckCircle, Clock, UserCheck, Loader2
} from 'lucide-react';
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Badge } from "@/app/components/ui/badge";
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/app/components/ui/dropdown-menu";
import { cn } from "@/app/components/ui/utils";
import { useNavigation } from '@/app/context/NavigationContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { contactService } from '@/app/services/contactService';
import { saleService } from '@/app/services/saleService';
import { purchaseService } from '@/app/services/purchaseService';
import { UnifiedPaymentDialog } from '@/app/components/shared/UnifiedPaymentDialog';
import { UnifiedLedgerView } from '@/app/components/shared/UnifiedLedgerView';
import { CustomerLedgerPage } from '@/app/components/accounting/CustomerLedgerPage';
import CustomerLedgerPageOriginal from '@/app/components/customer-ledger-test/CustomerLedgerPageOriginal';
import { ViewContactProfile } from './ViewContactProfile';
import { toast } from 'sonner';
import { Pagination } from '@/app/components/ui/pagination';
import { CustomSelect } from '@/app/components/ui/custom-select';
import { ListToolbar } from '@/app/components/ui/list-toolbar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog";

type ContactType = 'all' | 'customers' | 'suppliers' | 'workers';
type WorkerRole = 'tailor' | 'stitching-master' | 'cutter' | 'hand-worker' | 'dyer' | 'helper' | 'embroidery';
type BalanceType = 'all' | 'due' | 'paid';
type StatusType = 'all' | 'active' | 'inactive' | 'onhold';

interface Contact {
  id: number;
  uuid: string; // Supabase UUID
  name: string;
  code: string;
  type: 'customer' | 'supplier' | 'worker';
  workerRole?: WorkerRole;
  email: string;
  phone: string;
  receivables: number;
  payables: number;
  netBalance: number;
  status: 'active' | 'inactive' | 'onhold';
  branch: string;
  address?: string;
  lastTransaction?: string;
}

const workerRoleLabels: Record<WorkerRole, string> = {
  'tailor': 'Tailor',
  'stitching-master': 'Stitching Master',
  'cutter': 'Cutter',
  'hand-worker': 'Hand Worker',
  'dyer': 'Dyer',
  'helper': 'Helper / Labour',
  'embroidery': 'Embroidery',
};

export const ContactsPage = () => {
  const { openDrawer, setCurrentView, createdContactId, setCreatedContactId } = useNavigation();
  const { companyId, branchId } = useSupabase();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ContactType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  
  // Action states
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledgerType, setLedgerType] = useState<'classic' | 'modern' | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editContactOpen, setEditContactOpen] = useState(false);
  const [viewProfileOpen, setViewProfileOpen] = useState(false);

  // Convert Supabase contact to app format (receivables = due from customer, payables = due to supplier/worker)
  const convertFromSupabaseContact = useCallback((supabaseContact: any, index: number, sales: any[], purchases: any[]): Contact => {
    // Determine contact type first (needed for worker payables)
    let contactType: 'customer' | 'supplier' | 'worker' = 'customer';
    if (supabaseContact.type === 'supplier') {
      contactType = 'supplier';
    } else if (supabaseContact.type === 'worker') {
      contactType = 'worker';
    }

    // Receivables: from sales where this contact is customer (due balance from them)
    const contactSales = sales.filter(s =>
      s.customer_id === supabaseContact.id || (s.customer_name && s.customer_name === supabaseContact.name)
    );
    const receivables = contactSales.reduce((sum, s) => {
      const due = s.due_amount != null ? Number(s.due_amount) : (Number(s.total) || 0) - (Number(s.paid_amount) || 0);
      return sum + Math.max(0, due);
    }, 0);

    // Payables: from purchases where this contact is supplier, OR for workers use current_balance (amount we owe)
    let payables = 0;
    if (contactType === 'worker') {
      payables = Math.max(0, Number(supabaseContact.current_balance) || 0);
    } else {
      const contactPurchases = purchases.filter(p =>
        p.supplier_id === supabaseContact.id || (p.supplier_name && p.supplier_name === supabaseContact.name)
      );
      payables = contactPurchases.reduce((sum, p) => {
        const due = p.due_amount != null ? Number(p.due_amount) : (Number(p.total) || 0) - (Number(p.paid_amount) || 0);
        return sum + Math.max(0, due);
      }, 0);
    }

    // Generate code if missing
    const code = supabaseContact.code || 
      (contactType === 'supplier' ? `SUP-${String(index + 1).padStart(3, '0')}` :
       contactType === 'customer' ? `CUS-${String(index + 1).padStart(3, '0')}` :
       `WRK-${String(index + 1).padStart(3, '0')}`);

    // Map status
    let status: 'active' | 'inactive' | 'onhold' = 'active';
    if (!supabaseContact.is_active) {
      status = 'inactive';
    } else if (supabaseContact.status === 'onhold') {
      status = 'onhold';
    }

    return {
      id: index + 1, // Display ID
      uuid: supabaseContact.id, // Supabase UUID
      name: supabaseContact.name || '',
      code,
      type: contactType,
      workerRole: supabaseContact.worker_role as WorkerRole | undefined,
      email: supabaseContact.email || '-',
      phone: supabaseContact.phone || supabaseContact.mobile || '-',
      receivables,
      payables,
      netBalance: receivables - payables,
      status,
      branch: supabaseContact.branch_id || 'Main Branch (HQ)',
      address: supabaseContact.address,
      lastTransaction: supabaseContact.updated_at ? new Date(supabaseContact.updated_at).toISOString().split('T')[0] : undefined,
    };
  }, []);

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
      const convertedContacts: Contact[] = contactsData.map((c: any, index: number) => 
        convertFromSupabaseContact(c, index, salesData, purchasesData)
      );
      
      setContacts(convertedContacts);
    } catch (error: any) {
      console.error('[CONTACTS PAGE] Error loading contacts:', error);
      toast.error('Failed to load contacts: ' + (error.message || 'Unknown error'));
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId, convertFromSupabaseContact]);

  // Load contacts on mount (TASK 1 FIX - Ensure data loads on mount)
  useEffect(() => {
    if (companyId) {
      loadContacts();
    } else {
      setLoading(false);
    }
  }, [companyId, loadContacts]);
  
  // TASK 1 FIX - Force reload if no data and not loading
  useEffect(() => {
    if (companyId && contacts.length === 0 && !loading) {
      loadContacts();
    }
  }, [companyId, contacts.length, loading, loadContacts]);

  // Refetch list when a new contact is created (e.g. Add Worker) so it shows without refresh
  useEffect(() => {
    if (createdContactId) {
      loadContacts();
      setCreatedContactId?.(null);
    }
  }, [createdContactId, loadContacts, setCreatedContactId]);

  // Refetch when page gains focus so receivables/payables stay updated (e.g. after payment or ledger)
  useEffect(() => {
    const onFocus = () => { if (companyId) loadContacts(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [companyId, loadContacts]);
  
  // Filter states
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [workerRoleFilter, setWorkerRoleFilter] = useState<WorkerRole[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusType>('all');
  const [balanceFilter, setBalanceFilter] = useState<BalanceType>('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [phoneFilter, setPhoneFilter] = useState<'all' | 'has' | 'no'>('all');

  // Filtered contacts
  const filteredContacts = useMemo(() => {
    return contacts.filter(contact => {
      // Tab filter
      if (activeTab !== 'all' && contact.type !== activeTab.slice(0, -1)) return false;
      
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch = 
          contact.name.toLowerCase().includes(search) ||
          contact.code.toLowerCase().includes(search) ||
          contact.email.toLowerCase().includes(search) ||
          contact.phone.toLowerCase().includes(search) ||
          contact.branch.toLowerCase().includes(search) ||
          (contact.workerRole && workerRoleLabels[contact.workerRole].toLowerCase().includes(search));
        if (!matchesSearch) return false;
      }

      // Type filter (for advanced filters)
      if (typeFilter.length > 0 && !typeFilter.includes(contact.type)) return false;
      
      // Worker role filter
      if (workerRoleFilter.length > 0 && contact.type === 'worker' && contact.workerRole && !workerRoleFilter.includes(contact.workerRole)) return false;
      
      // Status filter
      if (statusFilter !== 'all' && contact.status !== statusFilter) return false;
      
      // Balance filter
      if (balanceFilter === 'due' && contact.netBalance === 0) return false;
      if (balanceFilter === 'paid' && contact.netBalance !== 0) return false;
      
      // Branch filter
      if (branchFilter !== 'all' && contact.branch !== branchFilter) return false;

      // Phone filter
      if (phoneFilter === 'has' && (contact.phone === '-' || !contact.phone)) return false;
      if (phoneFilter === 'no' && contact.phone !== '-' && contact.phone) return false;
      
      return true;
    });
  }, [contacts, activeTab, searchTerm, typeFilter, workerRoleFilter, statusFilter, balanceFilter, branchFilter, phoneFilter]);

  // Calculate summary based on active tab
  const summary = useMemo(() => {
    const filtered = contacts.filter(c => activeTab === 'all' || c.type === activeTab.slice(0, -1));
    return {
      totalReceivables: filtered.reduce((sum, c) => sum + c.receivables, 0),
      totalPayables: filtered.reduce((sum, c) => sum + c.payables, 0),
      activeCount: filtered.filter(c => c.status === 'active').length,
      totalCount: filtered.length,
    };
  }, [activeTab, contacts]);

  // Calculate tab counts
  const tabCounts = useMemo(() => ({
    all: contacts.length,
    customers: contacts.filter(c => c.type === 'customer').length,
    suppliers: contacts.filter(c => c.type === 'supplier').length,
    workers: contacts.filter(c => c.type === 'worker').length,
  }), [contacts]);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getAvatarColor = (type: string) => {
    switch (type) {
      case 'customer': return 'bg-blue-600';
      case 'supplier': return 'bg-purple-600';
      case 'worker': return 'bg-orange-600';
      default: return 'bg-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle size={14} className="text-green-500" />;
      case 'inactive': return <Clock size={14} className="text-gray-500" />;
      case 'onhold': return <AlertCircle size={14} className="text-yellow-500" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'inactive': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      case 'onhold': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const clearAllFilters = () => {
    setTypeFilter([]);
    setWorkerRoleFilter([]);
    setStatusFilter('all');
    setBalanceFilter('all');
    setBranchFilter('all');
    setPhoneFilter('all');
  };

  const activeFilterCount = [
    typeFilter.length > 0,
    workerRoleFilter.length > 0,
    statusFilter !== 'all',
    balanceFilter !== 'all',
    branchFilter !== 'all',
    phoneFilter !== 'all',
  ].filter(Boolean).length;

  const toggleTypeFilter = (type: string) => {
    setTypeFilter(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const toggleWorkerRoleFilter = (role: WorkerRole) => {
    setWorkerRoleFilter(prev => 
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  // Paginated contacts
  const paginatedContacts = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredContacts.slice(startIndex, endIndex);
  }, [filteredContacts, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredContacts.length / pageSize);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm, typeFilter, workerRoleFilter, statusFilter, balanceFilter, branchFilter, phoneFilter]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  // Action handlers
  const handleDeleteContact = async () => {
    if (!selectedContact) return;
    
    try {
      await contactService.deleteContact(selectedContact.uuid);
      toast.success('Contact deleted successfully');
      setDeleteDialogOpen(false);
      setSelectedContact(null);
      // Reload contacts from database
      await loadContacts();
    } catch (error: any) {
      toast.error('Failed to delete contact: ' + (error.message || 'Unknown error'));
    }
  };

  const refreshContacts = async () => {
    await loadContacts();
  };

  return (
    <div className="h-screen flex flex-col bg-[#0B0F19]">
      {/* Page Header - Fixed */}
      <div className="shrink-0 px-6 py-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Contacts</h1>
            <p className="text-sm text-gray-400 mt-0.5">Manage your suppliers, customers, and workers</p>
          </div>
          <Button 
            onClick={() => openDrawer('addContact')}
            className="bg-blue-600 hover:bg-blue-500 text-white h-10 gap-2"
          >
            <Users size={16} />
            Add Contact
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2">
          {[
            { key: 'all', label: 'All Contacts', count: tabCounts.all },
            { key: 'customers', label: 'Customers', count: tabCounts.customers },
            { key: 'suppliers', label: 'Suppliers', count: tabCounts.suppliers },
            { key: 'workers', label: 'Workers', count: tabCounts.workers },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as ContactType)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                activeTab === tab.key
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-750 hover:text-white"
              )}
            >
              {tab.label} <span className="ml-1.5 opacity-75">({tab.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards - Fixed */}
      <div className="shrink-0 px-6 py-4 bg-[#0F1419] border-b border-gray-800">
        <div className="grid grid-cols-3 gap-4">
          {/* Total Receivables */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Total Receivables</p>
                <p className="text-2xl font-bold text-green-400 mt-1">${summary.totalReceivables.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Money to receive
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <DollarSign size={24} className="text-green-500" />
              </div>
            </div>
          </div>

          {/* Total Payables */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Total Payables</p>
                <p className="text-2xl font-bold text-red-400 mt-1">${summary.totalPayables.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Money to pay
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <DollarSign size={24} className="text-red-500" />
              </div>
            </div>
          </div>

          {/* Active Contacts */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Active {activeTab === 'all' ? 'Contacts' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</p>
                <p className="text-2xl font-bold text-white mt-1">{summary.activeCount}</p>
                <p className="text-xs text-gray-500 mt-1">
                  out of {summary.totalCount} total
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <UserCheck size={24} className="text-blue-500" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Actions Bar - Fixed */}
      <div className="shrink-0 px-6 py-3 bg-[#0B0F19] border-b border-gray-800">
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, code, phone, email or branch..."
              className="pl-10 bg-gray-900 border-gray-700 text-white h-10"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Rows Per Page Selector - Custom Styled */}
          <CustomSelect
            value={pageSize}
            onChange={handlePageSizeChange}
            options={[
              { value: 25, label: '25' },
              { value: 50, label: '50' },
              { value: 100, label: '100' },
              { value: 500, label: '500' },
              { value: 1000, label: '1000' },
              { value: filteredContacts.length, label: `All (${filteredContacts.length})` },
            ]}
          />

          {/* Filter Button */}
          <div className="relative">
            <Button
              variant="outline"
              onClick={() => setFilterOpen(!filterOpen)}
              className={cn(
                "h-10 gap-2 bg-gray-900 border-gray-700",
                activeFilterCount > 0 && "border-blue-500 text-blue-400"
              )}
            >
              <Filter size={16} />
              Filter
              {activeFilterCount > 0 && (
                <Badge className="ml-1 bg-blue-600 text-white text-xs px-1.5 py-0 h-5 flex items-center justify-center min-w-[20px]">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>

            {/* Filter Dropdown */}
            {filterOpen && (
              <>
                {/* Backdrop */}
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setFilterOpen(false)}
                />
                
                <div className="absolute right-0 top-12 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-4 z-50">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-white">Advanced Filters</h3>
                    <button
                      onClick={clearAllFilters}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Clear All
                    </button>
                  </div>

                  <div className="space-y-4 max-h-[500px] overflow-y-auto">
                    {/* Contact Type Filter */}
                    <div>
                      <label className="text-xs text-gray-400 mb-2 block font-medium">Contact Type</label>
                      <div className="space-y-2">
                        {[
                          { value: 'customer', label: 'Customer' },
                          { value: 'supplier', label: 'Supplier' },
                          { value: 'worker', label: 'Worker' },
                        ].map(opt => (
                          <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={typeFilter.includes(opt.value)}
                              onChange={() => toggleTypeFilter(opt.value)}
                              className="w-4 h-4 rounded bg-gray-950 border-gray-700"
                            />
                            <span className="text-sm text-gray-300">{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Worker Role Filter - Show only when Worker is selected */}
                    {(typeFilter.includes('worker') || activeTab === 'workers') && (
                      <div>
                        <label className="text-xs text-gray-400 mb-2 block font-medium">Worker Role</label>
                        <div className="space-y-2">
                          {Object.entries(workerRoleLabels).map(([key, label]) => (
                            <label key={key} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={workerRoleFilter.includes(key as WorkerRole)}
                                onChange={() => toggleWorkerRoleFilter(key as WorkerRole)}
                                className="w-4 h-4 rounded bg-gray-950 border-gray-700"
                              />
                              <span className="text-sm text-gray-300">{label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Status Filter */}
                    <div>
                      <label className="text-xs text-gray-400 mb-2 block font-medium">Status</label>
                      <div className="space-y-2">
                        {[
                          { value: 'all', label: 'All Status' },
                          { value: 'active', label: 'Active' },
                          { value: 'onhold', label: 'On Hold' },
                          { value: 'inactive', label: 'Inactive' },
                        ].map(opt => (
                          <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="status"
                              checked={statusFilter === opt.value}
                              onChange={() => setStatusFilter(opt.value as StatusType)}
                              className="w-4 h-4 bg-gray-950 border-gray-700"
                            />
                            <span className="text-sm text-gray-300">{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Payment Status / Balance Filter */}
                    <div>
                      <label className="text-xs text-gray-400 mb-2 block font-medium">Payment Status</label>
                      <div className="space-y-2">
                        {[
                          { value: 'all', label: 'All Balances' },
                          { value: 'due', label: 'Due (Has Balance)' },
                          { value: 'paid', label: 'Paid (Zero Balance)' },
                        ].map(opt => (
                          <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="balance"
                              checked={balanceFilter === opt.value}
                              onChange={() => setBalanceFilter(opt.value as BalanceType)}
                              className="w-4 h-4 bg-gray-950 border-gray-700"
                            />
                            <span className="text-sm text-gray-300">{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Branch Filter */}
                    <div>
                      <label className="text-xs text-gray-400 mb-2 block font-medium">Branch</label>
                      <div className="space-y-2">
                        {[
                          { value: 'all', label: 'All Branches' },
                          { value: 'Main Branch (HQ)', label: 'Main Branch (HQ)' },
                          { value: 'Mall Outlet', label: 'Mall Outlet' },
                          { value: 'Warehouse', label: 'Warehouse' },
                        ].map(opt => (
                          <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="branch"
                              checked={branchFilter === opt.value}
                              onChange={() => setBranchFilter(opt.value)}
                              className="w-4 h-4 bg-gray-950 border-gray-700"
                            />
                            <span className="text-sm text-gray-300">{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Phone Number Filter */}
                    <div>
                      <label className="text-xs text-gray-400 mb-2 block font-medium">Phone Number</label>
                      <div className="space-y-2">
                        {[
                          { value: 'all', label: 'All Contacts' },
                          { value: 'has', label: 'Has Phone Number' },
                          { value: 'no', label: 'No Phone Number' },
                        ].map(opt => (
                          <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="phone"
                              checked={phoneFilter === opt.value}
                              onChange={() => setPhoneFilter(opt.value as 'all' | 'has' | 'no')}
                              className="w-4 h-4 bg-gray-950 border-gray-700"
                            />
                            <span className="text-sm text-gray-300">{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Import Button */}
          <Button variant="outline" className="h-10 gap-2 bg-gray-900 border-gray-700">
            <Upload size={16} />
            Import
          </Button>

          {/* Export Button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-10 gap-2 bg-gray-900 border-gray-700">
                <Download size={16} />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-gray-900 border-gray-700 text-white">
              <DropdownMenuItem className="hover:bg-gray-800 cursor-pointer">
                <FileText size={14} className="mr-2 text-green-400" />
                Export as Excel
              </DropdownMenuItem>
              <DropdownMenuItem className="hover:bg-gray-800 cursor-pointer">
                <FileText size={14} className="mr-2 text-blue-400" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-gray-700" />
              <DropdownMenuItem className="hover:bg-gray-800 cursor-pointer">
                <Download size={14} className="mr-2 text-purple-400" />
                Download Sample Template
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Contacts Table - Scrollable */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
          {loading ? (
            <div className="py-12 text-center">
              <Loader2 size={48} className="mx-auto text-blue-500 mb-3 animate-spin" />
              <p className="text-gray-400 text-sm">Loading contacts...</p>
            </div>
          ) : (
            <>
              {/* Wrapper for horizontal scroll */}
              <div className="overflow-x-auto">
                <div className="min-w-[1000px]">
                  {/* Table Header - Fixed within scroll container */}
                  <div className="sticky top-0 bg-gray-950/95 backdrop-blur-sm z-10 border-b border-gray-800">
                    <div className="grid grid-cols-[40px_1fr_120px_160px_100px_100px_110px_60px] gap-3 px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      <div className="text-left">#</div>
                      <div className="text-left">Name</div>
                      <div className="text-left">Type</div>
                      <div className="text-left">Contact Info</div>
                      <div className="text-right">Receivables</div>
                      <div className="text-right">Payables</div>
                      <div className="text-center">Status</div>
                      <div className="text-center">Actions</div>
                    </div>
                  </div>

                  {/* Table Body */}
                  <div>
                    {paginatedContacts.length === 0 ? (
                  <div className="py-12 text-center">
                    <Users size={48} className="mx-auto text-gray-600 mb-3" />
                    <p className="text-gray-400 text-sm">No contacts found</p>
                    <p className="text-gray-600 text-xs mt-1">Try adjusting your search or filters</p>
                  </div>
                ) : (
                  paginatedContacts.map((contact, index) => (
                    <div
                      key={contact.id}
                      onMouseEnter={() => setHoveredRow(contact.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                      className="grid grid-cols-[40px_1fr_120px_160px_100px_100px_110px_60px] gap-3 px-4 h-14 hover:bg-gray-800/30 transition-colors items-center border-b border-gray-800/50 last:border-b-0"
                    >
                      {/* # */}
                      <div className="text-sm text-gray-500 font-medium">{index + 1}</div>

                      {/* Name */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar className={cn("w-9 h-9 shrink-0", getAvatarColor(contact.type))}>
                          <AvatarFallback className="text-white text-xs font-semibold">
                            {getInitials(contact.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-white truncate leading-[1.3]">{contact.name}</div>
                          <div className="text-xs text-gray-500 font-mono leading-[1.3] mt-0.5">{contact.code}</div>
                        </div>
                      </div>

                      {/* Type */}
                      <div className="flex flex-col gap-0.5">
                        <Badge className={cn(
                          "text-xs font-medium capitalize w-fit px-2 py-0.5 h-5",
                          contact.type === 'customer' && "bg-blue-500/20 text-blue-400 border-blue-500/30",
                          contact.type === 'supplier' && "bg-purple-500/20 text-purple-400 border-purple-500/30",
                          contact.type === 'worker' && "bg-orange-500/20 text-orange-400 border-orange-500/30"
                        )}>
                          {contact.type}
                        </Badge>
                        {contact.type === 'worker' && contact.workerRole && (
                          <span className="text-[10px] text-gray-500 leading-[1.2]">
                            {workerRoleLabels[contact.workerRole]}
                          </span>
                        )}
                      </div>

                      {/* Contact Info */}
                      <div className="text-xs text-gray-400 space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5 truncate leading-[1.4]">
                          <Phone size={10} className="text-gray-600 shrink-0" />
                          <span className="truncate">{contact.phone}</span>
                        </div>
                        <div className="flex items-center gap-1.5 truncate leading-[1.4]">
                          <Mail size={10} className="text-gray-600 shrink-0" />
                          <span className="truncate">{contact.email}</span>
                        </div>
                      </div>

                      {/* Receivables */}
                      <div className="text-right">
                        <div className={cn(
                          "text-sm font-semibold tabular-nums leading-[1.4]",
                          contact.receivables > 0 ? "text-green-400" : "text-gray-600"
                        )}>
                          ${contact.receivables.toLocaleString()}
                        </div>
                      </div>

                      {/* Payables */}
                      <div className="text-right">
                        <div className={cn(
                          "text-sm font-semibold tabular-nums leading-[1.4]",
                          contact.payables > 0 ? "text-red-400" : "text-gray-600"
                        )}>
                          ${contact.payables.toLocaleString()}
                        </div>
                      </div>

                      {/* Status */}
                      <div className="flex justify-center">
                        <Badge className={cn(
                          "text-xs font-medium capitalize gap-1 h-6 px-2",
                          getStatusColor(contact.status)
                        )}>
                          {getStatusIcon(contact.status)}
                          <span className="leading-none">
                            {contact.status === 'onhold' ? 'On Hold' : contact.status}
                          </span>
                        </Badge>
                      </div>

                      {/* Actions - Show only on hover */}
                      <div className="flex justify-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button 
                              className={cn(
                                "w-8 h-8 rounded-lg bg-gray-800/50 hover:bg-gray-700 transition-all flex items-center justify-center text-gray-400 hover:text-white",
                                hoveredRow === contact.id ? "opacity-100" : "opacity-0"
                              )}
                            >
                              <MoreVertical size={16} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-gray-900 border-gray-700 text-white w-52">
                            {/* Customer Actions */}
                            {contact.type === 'customer' && (
                              <>
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setCurrentView('sales');
                                    // CRITICAL FIX: Use contact.uuid (database UUID) not contact.id (number)
                                    // sale.customer_id matches contacts.id (UUID) in database
                                    sessionStorage.setItem('salesFilter_customerId', contact.uuid || contact.id?.toString() || '');
                                    sessionStorage.setItem('salesFilter_customerName', contact.name || '');
                                    toast.info(`Filtering sales for ${contact.name}`);
                                  }}
                                  className="hover:bg-gray-800 cursor-pointer"
                                >
                                  <FileText size={14} className="mr-2 text-blue-400" />
                                  View Sales
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setSelectedContact(contact);
                                    setPaymentDialogOpen(true);
                                  }}
                                  className="hover:bg-gray-800 cursor-pointer"
                                >
                                  <DollarSign size={14} className="mr-2 text-green-400" />
                                  Receive Payment
                                </DropdownMenuItem>
                                {/* Ledger Submenu */}
                                <DropdownMenuSub>
                                  <DropdownMenuSubTrigger className="hover:bg-gray-800 cursor-pointer">
                                    <FileText size={14} className="mr-2 text-purple-400" />
                                    Ledger / Transactions
                                  </DropdownMenuSubTrigger>
                                  <DropdownMenuSubContent className="bg-gray-900 border-gray-700 text-white">
                                    <DropdownMenuItem 
                                      onClick={() => {
                                        setSelectedContact(contact);
                                        setLedgerType('classic');
                                        setLedgerOpen(true);
                                      }}
                                      className="hover:bg-gray-800 cursor-pointer"
                                    >
                                      <FileText size={14} className="mr-2 text-blue-400" />
                                      Classic Ledger
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={() => {
                                        setSelectedContact(contact);
                                        setLedgerType('modern');
                                        setLedgerOpen(true);
                                      }}
                                      className="hover:bg-gray-800 cursor-pointer"
                                    >
                                      <FileText size={14} className="mr-2 text-green-400" />
                                      Modern Ledger (New Design)
                                    </DropdownMenuItem>
                                  </DropdownMenuSubContent>
                                </DropdownMenuSub>
                                <DropdownMenuSeparator className="bg-gray-700" />
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setSelectedContact(contact);
                                    setEditContactOpen(true);
                                  }}
                                  className="hover:bg-gray-800 cursor-pointer"
                                >
                                  <Edit size={14} className="mr-2 text-gray-400" />
                                  Edit Contact
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setSelectedContact(contact);
                                    setDeleteDialogOpen(true);
                                  }}
                                  className="hover:bg-gray-800 cursor-pointer text-red-400"
                                >
                                  <Trash2 size={14} className="mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}

                            {/* Supplier Actions */}
                            {contact.type === 'supplier' && (
                              <>
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setCurrentView('purchases');
                                    // Store supplier filter in sessionStorage for PurchasesPage to read
                                    sessionStorage.setItem('purchasesFilter_supplierId', contact.id || '');
                                    sessionStorage.setItem('purchasesFilter_supplierName', contact.name || '');
                                    toast.info(`Filtering purchases for ${contact.name}`);
                                  }}
                                  className="hover:bg-gray-800 cursor-pointer"
                                >
                                  <FileText size={14} className="mr-2 text-purple-400" />
                                  View Purchases
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setSelectedContact(contact);
                                    setPaymentDialogOpen(true);
                                  }}
                                  className="hover:bg-gray-800 cursor-pointer"
                                >
                                  <DollarSign size={14} className="mr-2 text-red-400" />
                                  Make Payment
                                </DropdownMenuItem>
                                {/* Ledger Submenu for Suppliers */}
                                <DropdownMenuSub>
                                  <DropdownMenuSubTrigger className="hover:bg-gray-800 cursor-pointer">
                                    <FileText size={14} className="mr-2 text-blue-400" />
                                    Ledger / Transactions
                                  </DropdownMenuSubTrigger>
                                  <DropdownMenuSubContent className="bg-gray-900 border-gray-700 text-white">
                                    <DropdownMenuItem 
                                      onClick={() => {
                                        setSelectedContact(contact);
                                        setLedgerType('classic');
                                        setLedgerOpen(true);
                                      }}
                                      className="hover:bg-gray-800 cursor-pointer"
                                    >
                                      <FileText size={14} className="mr-2 text-blue-400" />
                                      Classic Ledger
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={() => {
                                        setSelectedContact(contact);
                                        setLedgerType('modern');
                                        setLedgerOpen(true);
                                      }}
                                      className="hover:bg-gray-800 cursor-pointer"
                                    >
                                      <FileText size={14} className="mr-2 text-green-400" />
                                      Modern Ledger (New Design)
                                    </DropdownMenuItem>
                                  </DropdownMenuSubContent>
                                </DropdownMenuSub>
                                <DropdownMenuSeparator className="bg-gray-700" />
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setSelectedContact(contact);
                                    setEditContactOpen(true);
                                  }}
                                  className="hover:bg-gray-800 cursor-pointer"
                                >
                                  <Edit size={14} className="mr-2 text-gray-400" />
                                  Edit Contact
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setSelectedContact(contact);
                                    setDeleteDialogOpen(true);
                                  }}
                                  className="hover:bg-gray-800 cursor-pointer text-red-400"
                                >
                                  <Trash2 size={14} className="mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}

                            {/* Worker Actions */}
                            {contact.type === 'worker' && (
                              <>
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setCurrentView('studio-workflow');
                                    // TODO: Filter by worker
                                    toast.info('Work history for worker');
                                  }}
                                  className="hover:bg-gray-800 cursor-pointer"
                                >
                                  <FileText size={14} className="mr-2 text-orange-400" />
                                  Work History
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setCurrentView('studio-workflow');
                                    toast.info('Assign job to worker');
                                  }}
                                  className="hover:bg-gray-800 cursor-pointer"
                                >
                                  <Users size={14} className="mr-2 text-blue-400" />
                                  Assign Job
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setSelectedContact(contact);
                                    setPaymentDialogOpen(true);
                                  }}
                                  className="hover:bg-gray-800 cursor-pointer"
                                >
                                  <DollarSign size={14} className="mr-2 text-green-400" />
                                  Payments
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-gray-700" />
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setSelectedContact(contact);
                                    setEditContactOpen(true);
                                  }}
                                  className="hover:bg-gray-800 cursor-pointer"
                                >
                                  <Edit size={14} className="mr-2 text-gray-400" />
                                  Edit Contact
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setSelectedContact(contact);
                                    setDeleteDialogOpen(true);
                                  }}
                                  className="hover:bg-gray-800 cursor-pointer text-red-400"
                                >
                                  <Trash2 size={14} className="mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
            </>
          )}
        </div>
      </div>

      {/* Pagination Footer - Fixed */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={filteredContacts.length}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />

      {/* Unified Payment Dialog */}
      {selectedContact && (
        <UnifiedPaymentDialog
          isOpen={paymentDialogOpen}
          onClose={() => {
            setPaymentDialogOpen(false);
            setSelectedContact(null);
          }}
          context={selectedContact.type === 'customer' ? 'customer' : 'supplier'}
          entityName={selectedContact.name}
          entityId={selectedContact.id.toString()}
          outstandingAmount={
            selectedContact.type === 'customer' 
              ? selectedContact.receivables 
              : selectedContact.payables
          }
          referenceNo={selectedContact.code}
          onSuccess={async () => {
            toast.success('Payment recorded successfully');
            setPaymentDialogOpen(false);
            setSelectedContact(null);
            refreshContacts();
          }}
        />
      )}

      {/* Customer Ledger - Full Screen (for customers only) */}
      {selectedContact && selectedContact.type === 'customer' && ledgerOpen && (
        <div className="fixed inset-0 z-50 bg-[#111827] overflow-y-auto">
          {ledgerType === 'modern' ? (
            <CustomerLedgerPageOriginal 
              initialCustomerId={selectedContact.uuid}
              onClose={() => {
                setLedgerOpen(false);
                setLedgerType(null);
                setSelectedContact(null);
              }}
            />
          ) : (
            <CustomerLedgerPage
              customerId={selectedContact.uuid}
              customerName={selectedContact.name}
              customerCode={selectedContact.code}
              onClose={() => {
                setLedgerOpen(false);
                setLedgerType(null);
                setSelectedContact(null);
              }}
            />
          )}
        </div>
      )}

      {/* Unified Ledger View (for suppliers and workers) */}
      {selectedContact && selectedContact.type !== 'customer' && (
        <UnifiedLedgerView
          isOpen={ledgerOpen}
          onClose={() => {
            setLedgerOpen(false);
            setSelectedContact(null);
          }}
          entityType={selectedContact.type === 'supplier' ? 'supplier' : 'worker'}
          entityName={selectedContact.name}
          entityId={selectedContact.id.toString()}
        />
      )}

      {/* View Contact Profile */}
      {selectedContact && (
        <ViewContactProfile
          isOpen={viewProfileOpen}
          onClose={() => {
            setViewProfileOpen(false);
            setSelectedContact(null);
          }}
          contact={selectedContact}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {selectedContact && (
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="bg-gray-900 border-gray-700 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Contact</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-400">
                Are you sure you want to delete {selectedContact.name}? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setSelectedContact(null);
                }}
                className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteContact}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};