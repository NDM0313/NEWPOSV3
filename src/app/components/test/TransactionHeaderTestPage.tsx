import React, { useState } from 'react';
import { 
  User, 
  Calendar, 
  FileText, 
  Hash, 
  CheckCircle, 
  UserCheck, 
  Tag,
  MoreVertical,
  Settings,
  X,
  Building2,
  ChevronRight,
  ArrowRight,
  Plus,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Wallet,
  Info
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { CalendarDatePicker } from '../ui/CalendarDatePicker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import { cn } from '../ui/utils';
import { format } from 'date-fns';
import { useNavigation } from '@/app/context/NavigationContext';
import { useEffect } from 'react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { contactService } from '@/app/services/contactService';

type DesignOption = 'A' | 'B' | 'C' | 'D' | 'D1' | 'D1-A' | 'D1-B' | 'D2' | 'E' | 'F' | 'G';

export const TransactionHeaderTestPage = () => {
  const { openDrawer, createdContactId, createdContactType } = useNavigation();
  const { companyId } = useSupabase();
  const [selectedOption, setSelectedOption] = useState<DesignOption>('A');
  const [selectedPurchaseOption, setSelectedPurchaseOption] = useState<DesignOption>('D1-B');
  const [moreOpen, setMoreOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  
  // Purchase/Supplier state
  const [supplierSearchOpen, setSupplierSearchOpen] = useState(false);
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const [supplier, setSupplier] = useState('Supplier A');
  
  // Due Balance Display Variant (A, B, C)
  const [dueBalanceVariant, setDueBalanceVariant] = useState<'A' | 'B' | 'C'>('A');
  
  // Add Customer UX Variant (1, 2, 3)
  const [addCustomerVariant, setAddCustomerVariant] = useState<'1' | '2' | '3'>('1');
  
  // Mock state for form fields
  const [customer, setCustomer] = useState('Walk-in Customer');
  const [date, setDate] = useState<Date>(new Date());
  const [refNumber, setRefNumber] = useState('REF-001');
  const [invoiceNumber, setInvoiceNumber] = useState('INV-2024-001');
  const [status, setStatus] = useState<'draft' | 'quotation' | 'order' | 'final'>('final');
  const [salesman, setSalesman] = useState('John Doe');
  const [type, setType] = useState<'regular' | 'studio'>('regular');
  const [branch, setBranch] = useState('Main Branch');

  // Mock customer data with due balances (state so we can update it)
  const [mockCustomers, setMockCustomers] = useState([
    { name: 'Walk-in Customer', due: 0 },
    { name: 'Ahmed Traders', due: -12500 }, // Negative = credit/advance (green)
    { name: 'ABC Corporation', due: 8500 }, // Positive = due amount (red)
    { name: 'XYZ Limited', due: 0 },
    { name: 'John Smith', due: -500 }, // Credit
    { name: 'Sarah Enterprises', due: 12000 }, // Due
  ]);

  // Listen for newly created contact and add to list
  useEffect(() => {
    const handleNewContact = async () => {
      if (createdContactId && createdContactType && (createdContactType === 'customer' || createdContactType === 'both')) {
        try {
          // Fetch the actual contact details
          const contact = await contactService.getContact(createdContactId);
          if (contact && contact.name) {
            const newCustomer = { name: contact.name, due: 0 };
            
            // Check if customer already exists
            if (!mockCustomers.find(c => c.name === contact.name)) {
              setMockCustomers(prev => [...prev, newCustomer]);
              setCustomer(contact.name);
              setCustomerSearchOpen(false);
              setCustomerSearchTerm('');
            } else {
              // If exists, just select it
              setCustomer(contact.name);
              setCustomerSearchOpen(false);
              setCustomerSearchTerm('');
            }
          }
        } catch (error) {
          console.error('[TEST PAGE] Error fetching new contact:', error);
          // Fallback: add generic customer
          const newCustomerName = `New Customer ${Date.now().toString().slice(-4)}`;
          const newCustomer = { name: newCustomerName, due: 0 };
          if (!mockCustomers.find(c => c.name === newCustomerName)) {
            setMockCustomers(prev => [...prev, newCustomer]);
            setCustomer(newCustomerName);
            setCustomerSearchOpen(false);
            setCustomerSearchTerm('');
          }
        }
      }
    };

    handleNewContact();
  }, [createdContactId, createdContactType]);

  // Mock supplier data with payable balances (for Purchase section) - state so we can update it
  const [mockSuppliers, setMockSuppliers] = useState([
    { name: 'Supplier A', payable: 0 },
    { name: 'Supplier B', payable: 15000 }, // Positive = payable (red - supplier ko dene hain)
    { name: 'Supplier C', payable: -3000 }, // Negative = advance/credit (green)
    { name: 'Supplier D', payable: 0 },
    { name: 'Supplier E', payable: 8500 }, // Payable
    { name: 'Supplier F', payable: -1200 }, // Credit
  ]);

  // Filter customers based on search term
  const filteredCustomers = mockCustomers.filter(c =>
    c.name.toLowerCase().includes(customerSearchTerm.toLowerCase())
  );

  // Filter suppliers based on search term
  const filteredSuppliers = mockSuppliers.filter(s =>
    s.name.toLowerCase().includes(supplierSearchTerm.toLowerCase())
  );

  // Get selected customer's due balance
  const selectedCustomerDue = mockCustomers.find(c => c.name === customer)?.due || 0;

  // Helper to format due balance
  const formatDueBalance = (due: number) => {
    if (due === 0) return 'Due: 0';
    if (due < 0) return `Advance: ${Math.abs(due).toLocaleString()}`;
    return `Due: ${due.toLocaleString()}`;
  };

  // Helper to format due balance for dropdown (compact)
  const formatDueBalanceCompact = (due: number) => {
    if (due === 0) return '0';
    if (due < 0) return `-${Math.abs(due).toLocaleString()}`;
    return `+${due.toLocaleString()}`;
  };

  // Helper to get due balance color
  const getDueBalanceColor = (due: number) => {
    if (due < 0) return 'text-green-400'; // Credit/Advance (green)
    if (due > 0) return 'text-red-400'; // Due amount (red)
    return 'text-gray-500'; // Zero
  };

  // Helper to get payable balance color (Purchase - opposite logic)
  const getPayableBalanceColor = (payable: number) => {
    if (payable < 0) return 'text-green-400'; // Advance/Credit (green)
    if (payable > 0) return 'text-red-400'; // Payable (red - supplier ko dene hain)
    return 'text-gray-500'; // Zero
  };

  // Get selected supplier's payable balance
  const selectedSupplierPayable = mockSuppliers.find(s => s.name === supplier)?.payable || 0;

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'draft': return 'bg-gray-500/20 text-gray-400 border-gray-600/50';
      case 'quotation': return 'bg-yellow-500/20 text-yellow-400 border-yellow-600/50';
      case 'order': return 'bg-blue-500/20 text-blue-400 border-blue-600/50';
      case 'final': return 'bg-green-500/20 text-green-400 border-green-600/50';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-600/50';
    }
  };

  // Reusable Customer Selector Component
  const renderCustomerSelector = (showDueBalanceDisplay: boolean = true) => {
    const hasNoResults = filteredCustomers.length === 0 && customerSearchTerm.length > 0;
    const showAddCustomerOption = 
      (addCustomerVariant === '2' && !hasNoResults) || 
      (addCustomerVariant === '3' && hasNoResults);

    return (
      <div className="flex-1 min-w-0">
        {/* Label with Due Balance on Right Side */}
        <div className="flex items-center justify-between mb-1.5">
          <Label className="text-xs text-gray-500">Customer</Label>
          {/* Due Balance Display - On Same Line as Label */}
          {showDueBalanceDisplay && customer && (
            <>
              {/* Option A: Plain text near Customer label */}
              {dueBalanceVariant === 'A' && (
                <span className={cn("text-[10px] font-medium tabular-nums", getDueBalanceColor(selectedCustomerDue))}>
                  {formatDueBalanceCompact(selectedCustomerDue)}
                </span>
              )}

              {/* Option B: Small chip near Customer label */}
              {dueBalanceVariant === 'B' && (
                <Badge className={cn(
                  "text-[10px] font-medium px-1.5 py-0.5 h-4 border",
                  selectedCustomerDue < 0 && "bg-green-500/20 text-green-400 border-green-600/50",
                  selectedCustomerDue > 0 && "bg-red-500/20 text-red-400 border-red-600/50",
                  selectedCustomerDue === 0 && "bg-gray-500/20 text-gray-400 border-gray-600/50"
                )}>
                  {formatDueBalanceCompact(selectedCustomerDue)}
                </Badge>
              )}

              {/* Option C: Info icon near Customer label (hover reveals details) */}
              {dueBalanceVariant === 'C' && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="p-0.5 hover:bg-gray-800 rounded transition-colors"
                    >
                      <Info size={12} className={cn(
                        "transition-colors",
                        selectedCustomerDue < 0 && "text-green-400",
                        selectedCustomerDue > 0 && "text-red-400",
                        selectedCustomerDue === 0 && "text-gray-500"
                      )} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-56 bg-gray-900 border-gray-800 text-white p-3"
                    align="end"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">Due Balance</span>
                        <span className={cn("text-xs font-semibold tabular-nums", getDueBalanceColor(selectedCustomerDue))}>
                          {formatDueBalance(selectedCustomerDue)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">Credit Limit</span>
                        <span className="text-xs text-gray-500">$50,000</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">Payment Terms</span>
                        <span className="text-xs text-gray-500">Net 30</span>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </>
          )}
        </div>
        <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 bg-gray-900/50 border border-gray-800 rounded-lg px-2.5 py-1 hover:bg-gray-800 transition-colors cursor-pointer w-full text-left"
            >
              <User size={14} className="text-gray-500 shrink-0" />
              <span className="text-xs text-white flex-1 truncate">{customer}</span>
              {/* Plus icon inside search field (Option 1) */}
              {addCustomerVariant === '1' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Open Add Customer drawer
                    openDrawer('addContact', undefined, {
                      contactType: 'customer',
                      prefillName: customerSearchTerm.trim() || undefined
                    });
                    setCustomerSearchOpen(false);
                  }}
                  className="p-0.5 hover:bg-gray-700 rounded transition-colors"
                >
                  <Plus size={12} className="text-gray-400 hover:text-blue-400" />
                </button>
              )}
              <ChevronRight size={12} className="text-gray-500 rotate-90 shrink-0" />
            </button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-80 bg-gray-900 border-gray-800 text-white p-2"
            align="start"
          >
            <div className="space-y-2">
              {/* Search Input */}
              <Input
                placeholder="Search customers..."
                value={customerSearchTerm}
                onChange={(e) => setCustomerSearchTerm(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white text-sm h-9"
              />
              {/* Customer List - WITH DUE BALANCE */}
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {hasNoResults && addCustomerVariant === '3' ? (
                  // Option 3: Empty search result state with CTA
                  <div className="px-3 py-6 text-center space-y-3">
                    <div className="text-sm text-gray-400">No customers found</div>
                    <button
                      type="button"
                      onClick={() => {
                        // Open Add Customer drawer
                        openDrawer('addContact', undefined, {
                          contactType: 'customer',
                          prefillName: customerSearchTerm.trim() || undefined
                        });
                        setCustomerSearchOpen(false);
                      }}
                      className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus size={14} />
                      Create new customer
                    </button>
                  </div>
                ) : filteredCustomers.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-400 text-center">
                    No customers found
                  </div>
                ) : (
                  <>
                    {filteredCustomers.map((cust) => (
                      <button
                        key={cust.name}
                        type="button"
                        onClick={() => {
                          setCustomer(cust.name);
                          setCustomerSearchOpen(false);
                          setCustomerSearchTerm('');
                        }}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center justify-between",
                          customer === cust.name
                            ? "bg-gray-800 text-white"
                            : "text-gray-400 hover:bg-gray-800 hover:text-white"
                        )}
                      >
                        <span className="font-medium">{cust.name}</span>
                        <span className={cn(
                          "text-xs font-semibold tabular-nums ml-2",
                          cust.due < 0 && "text-green-400",
                          cust.due > 0 && "text-red-400",
                          cust.due === 0 && "text-gray-500"
                        )}>
                          {formatDueBalanceCompact(cust.due)}
                        </span>
                      </button>
                    ))}
                    {/* Option 2: "+ Add New Customer" at bottom of list */}
                    {showAddCustomerOption && (
                      <button
                        type="button"
                        onClick={() => {
                          // Open Add Customer drawer
                          openDrawer('addContact', undefined, {
                            contactType: 'customer',
                            prefillName: customerSearchTerm.trim() || undefined
                          });
                          setCustomerSearchOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-md text-sm transition-all text-blue-400 hover:bg-gray-800 hover:text-blue-300 flex items-center gap-2 border-t border-gray-800 mt-1 pt-2"
                      >
                        <Plus size={14} />
                        Add New Customer
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>

      </div>
    );
  };

  // Reusable Supplier Selector Component (for Purchase section)
  const renderSupplierSelector = () => {
    const hasNoResults = filteredSuppliers.length === 0 && supplierSearchTerm.length > 0;

    return (
      <div className="flex-1 min-w-0">
        {/* Label with Payable Balance on Right Side */}
        <div className="flex items-center justify-between mb-1.5">
          <Label className="text-xs text-gray-500">Supplier</Label>
          {/* Payable Balance Display - Plain Text (Option A) */}
          {supplier && (
            <span className={cn("text-[10px] font-medium tabular-nums", getPayableBalanceColor(selectedSupplierPayable))}>
              {formatDueBalanceCompact(selectedSupplierPayable)}
            </span>
          )}
        </div>
        <Popover open={supplierSearchOpen} onOpenChange={setSupplierSearchOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 bg-gray-900/50 border border-gray-800 rounded-lg px-2.5 py-1 hover:bg-gray-800 transition-colors cursor-pointer w-full text-left"
            >
              <User size={14} className="text-gray-500 shrink-0" />
              <span className="text-xs text-white flex-1 truncate">{supplier}</span>
              {/* Plus icon inside search field */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const newSupplierName = supplierSearchTerm.trim() || `New Supplier ${Date.now()}`;
                  const newSupplier = { name: newSupplierName, payable: 0 };
                  setMockSuppliers(prev => [...prev, newSupplier]);
                  setSupplier(newSupplierName);
                  setSupplierSearchOpen(false);
                  setSupplierSearchTerm('');
                  alert(`Supplier "${newSupplierName}" added successfully!`);
                }}
                className="p-0.5 hover:bg-gray-700 rounded transition-colors"
              >
                <Plus size={12} className="text-gray-400 hover:text-blue-400" />
              </button>
              <ChevronRight size={12} className="text-gray-500 rotate-90 shrink-0" />
            </button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-80 bg-gray-900 border-gray-800 text-white p-2"
            align="start"
          >
            <div className="space-y-2">
              {/* Search Input */}
              <Input
                placeholder="Search suppliers..."
                value={supplierSearchTerm}
                onChange={(e) => setSupplierSearchTerm(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white text-sm h-9"
              />
              {/* Supplier List - WITH PAYABLE BALANCE */}
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {hasNoResults ? (
                  <div className="px-3 py-6 text-center space-y-3">
                    <div className="text-sm text-gray-400">No suppliers found</div>
                    <button
                      type="button"
                      onClick={() => {
                        const newSupplierName = supplierSearchTerm.trim() || `New Supplier ${Date.now()}`;
                        const newSupplier = { name: newSupplierName, payable: 0 };
                        setMockSuppliers(prev => [...prev, newSupplier]);
                        setSupplier(newSupplierName);
                        setSupplierSearchOpen(false);
                        setSupplierSearchTerm('');
                        alert(`Supplier "${newSupplierName}" created successfully!`);
                      }}
                      className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus size={14} />
                      Create new supplier
                    </button>
                  </div>
                ) : filteredSuppliers.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-400 text-center">
                    No suppliers found
                  </div>
                ) : (
                  <>
                    {filteredSuppliers.map((sup) => (
                      <button
                        key={sup.name}
                        type="button"
                        onClick={() => {
                          setSupplier(sup.name);
                          setSupplierSearchOpen(false);
                          setSupplierSearchTerm('');
                        }}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center justify-between",
                          supplier === sup.name
                            ? "bg-gray-800 text-white"
                            : "text-gray-400 hover:bg-gray-800 hover:text-white"
                        )}
                      >
                        <span className="font-medium">{sup.name}</span>
                        <span className={cn(
                          "text-xs font-semibold tabular-nums ml-2",
                          sup.payable < 0 && "text-green-400",
                          sup.payable > 0 && "text-red-400",
                          sup.payable === 0 && "text-gray-500"
                        )}>
                          {formatDueBalanceCompact(sup.payable)}
                        </span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  };

  // Option A: Priority + Compression (Single Row)
  const renderOptionA = () => (
    <div className="flex items-center gap-3 w-full">
      {/* Customer - Takes maximum space */}
      {renderCustomerSelector(true)}

      {/* Date */}
      <div className="w-32">
        <Label className="text-xs text-gray-500 mb-1.5 block">Date</Label>
        <div className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
          <div className="text-sm text-white">{format(date, 'MMM dd, yyyy')}</div>
        </div>
      </div>

      {/* Ref # - Compressed, muted */}
      <div className="w-24">
        <Label className="text-xs text-gray-500 mb-1.5 block">Ref #</Label>
        <Input
          value={refNumber}
          onChange={(e) => setRefNumber(e.target.value)}
          className="bg-gray-900/50 border-gray-800/50 text-gray-400 text-xs h-8"
          placeholder="REF"
        />
      </div>

      {/* Invoice # */}
      <div className="w-32">
        <Label className="text-xs text-gray-500 mb-1.5 block">Invoice #</Label>
        <Input
          value={invoiceNumber}
          onChange={(e) => setInvoiceNumber(e.target.value)}
          className="bg-gray-900 border border-gray-800 text-white text-sm h-8"
        />
      </div>

      {/* Status */}
      <div className="w-28">
        <Label className="text-xs text-gray-500 mb-1.5 block">Status</Label>
        <Badge className={cn("w-full justify-center text-xs", getStatusColor(status))}>
          {status}
        </Badge>
      </div>

      {/* Salesman - Compressed with icon */}
      <div className="w-28">
        <Label className="text-xs text-gray-500 mb-1.5 block">Salesman</Label>
        <div className="flex items-center gap-1.5 bg-gray-900/50 border-gray-800/50 rounded-lg px-2 py-1.5">
          <UserCheck size={12} className="text-gray-500 shrink-0" />
          <span className="text-xs text-gray-400 truncate">{salesman}</span>
        </div>
      </div>

      {/* Type - Compressed with icon */}
      <div className="w-24">
        <Label className="text-xs text-gray-500 mb-1.5 block">Type</Label>
        <div className="flex items-center gap-1.5 bg-gray-900/50 border-gray-800/50 rounded-lg px-2 py-1.5">
          <Tag size={12} className="text-gray-500 shrink-0" />
          <span className="text-xs text-gray-400">{type}</span>
        </div>
      </div>
    </div>
  );

  // Option B: Grouped Single Row
  const renderOptionB = () => (
    <div className="flex items-center gap-4 w-full">
      {/* Left Group: Customer, Date, Ref */}
      <div className="flex items-center gap-3 flex-1 pr-4 border-r border-gray-800">
        {/* Customer */}
        {renderCustomerSelector(true)}

        {/* Date */}
        <div className="w-32">
          <Label className="text-xs text-gray-500 mb-1.5 block">Date</Label>
          <div className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
            <div className="text-sm text-white">{format(date, 'MMM dd, yyyy')}</div>
          </div>
        </div>

        {/* Ref # */}
        <div className="w-24">
          <Label className="text-xs text-gray-500 mb-1.5 block">Ref #</Label>
          <Input
            value={refNumber}
            onChange={(e) => setRefNumber(e.target.value)}
            className="bg-gray-900 border border-gray-800 text-white text-xs h-8"
            placeholder="REF"
          />
        </div>
      </div>

      {/* Right Group: Invoice, Status, Salesman, Type */}
      <div className="flex items-center gap-3 pl-4">
        {/* Invoice # */}
        <div className="w-32">
          <Label className="text-xs text-gray-500 mb-1.5 block">Invoice #</Label>
          <Input
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            className="bg-gray-900 border border-gray-800 text-white text-sm h-8"
          />
        </div>

        {/* Status */}
        <div className="w-28">
          <Label className="text-xs text-gray-500 mb-1.5 block">Status</Label>
          <Badge className={cn("w-full justify-center text-xs", getStatusColor(status))}>
            {status}
          </Badge>
        </div>

        {/* Salesman */}
        <div className="w-32">
          <Label className="text-xs text-gray-500 mb-1.5 block">Salesman</Label>
          <Select value={salesman} onValueChange={setSalesman}>
            <SelectTrigger className="bg-gray-900 border-gray-800 text-white text-xs h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-800 text-white">
              <SelectItem value="John Doe">John Doe</SelectItem>
              <SelectItem value="Jane Smith">Jane Smith</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Type */}
        <div className="w-28">
          <Label className="text-xs text-gray-500 mb-1.5 block">Type</Label>
          <Select value={type} onValueChange={(v: any) => setType(v)}>
            <SelectTrigger className="bg-gray-900 border-gray-800 text-white text-xs h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-800 text-white">
              <SelectItem value="regular">Regular</SelectItem>
              <SelectItem value="studio">Studio</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  // Option C: Smart Collapse
  const renderOptionC = () => (
    <div className="flex items-center gap-3 w-full">
      {/* Customer */}
      {renderCustomerSelector(true)}

      {/* Date */}
      <div className="w-32">
        <Label className="text-xs text-gray-500 mb-1.5 block">Date</Label>
        <div className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
          <div className="text-sm text-white">{format(date, 'MMM dd, yyyy')}</div>
        </div>
      </div>

      {/* Invoice # */}
      <div className="w-32">
        <Label className="text-xs text-gray-500 mb-1.5 block">Invoice #</Label>
        <Input
          value={invoiceNumber}
          onChange={(e) => setInvoiceNumber(e.target.value)}
          className="bg-gray-900 border border-gray-800 text-white text-sm h-8"
        />
      </div>

      {/* Status */}
      <div className="w-28">
        <Label className="text-xs text-gray-500 mb-1.5 block">Status</Label>
        <Badge className={cn("w-full justify-center text-xs", getStatusColor(status))}>
          {status}
        </Badge>
      </div>

      {/* More Button */}
      <div className="w-auto pt-6">
        <Popover open={moreOpen} onOpenChange={setMoreOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-800"
            >
              <MoreVertical size={16} />
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-64 bg-gray-900 border-gray-800 text-white p-4"
            align="end"
          >
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-gray-500 mb-1.5 block">Ref #</Label>
                <Input
                  value={refNumber}
                  onChange={(e) => setRefNumber(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white text-sm h-8"
                  placeholder="REF"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-1.5 block">Salesman</Label>
                <Select value={salesman} onValueChange={setSalesman}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white text-sm h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    <SelectItem value="John Doe">John Doe</SelectItem>
                    <SelectItem value="Jane Smith">Jane Smith</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-1.5 block">Type</Label>
                <Select value={type} onValueChange={(v: any) => setType(v)}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white text-sm h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="studio">Studio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );

  // Option D: Invoice in Top Header
  const renderOptionD = () => (
    <div className="flex items-center gap-3 w-full">
      {/* Customer */}
      {renderCustomerSelector(true)}

      {/* Date */}
      <div className="w-32">
        <Label className="text-xs text-gray-500 mb-1.5 block">Date</Label>
        <div className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
          <div className="text-sm text-white">{format(date, 'MMM dd, yyyy')}</div>
        </div>
      </div>

      {/* Ref # */}
      <div className="w-24">
        <Label className="text-xs text-gray-500 mb-1.5 block">Ref #</Label>
        <Input
          value={refNumber}
          onChange={(e) => setRefNumber(e.target.value)}
          className="bg-gray-900 border border-gray-800 text-white text-xs h-8"
          placeholder="REF"
        />
      </div>

      {/* Status */}
      <div className="w-28">
        <Label className="text-xs text-gray-500 mb-1.5 block">Status</Label>
        <Badge className={cn("w-full justify-center text-xs", getStatusColor(status))}>
          {status}
        </Badge>
      </div>

      {/* Salesman */}
      <div className="w-32">
        <Label className="text-xs text-gray-500 mb-1.5 block">Salesman</Label>
        <Select value={salesman} onValueChange={setSalesman}>
          <SelectTrigger className="bg-gray-900 border-gray-800 text-white text-xs h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-gray-900 border-gray-800 text-white">
            <SelectItem value="John Doe">John Doe</SelectItem>
            <SelectItem value="Jane Smith">Jane Smith</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Type */}
      <div className="w-28">
        <Label className="text-xs text-gray-500 mb-1.5 block">Type</Label>
        <Select value={type} onValueChange={(v: any) => setType(v)}>
          <SelectTrigger className="bg-gray-900 border-gray-800 text-white text-xs h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-gray-900 border-gray-800 text-white">
            <SelectItem value="regular">Regular</SelectItem>
            <SelectItem value="studio">Studio</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  // Option D1: Invoice, Status (Badge Dropdown), Salesman in Top Header
  const renderOptionD1 = () => (
    <div className="flex items-center gap-3 w-full">
      {/* Customer - Chip Style with Search */}
      {renderCustomerSelector(true)}

      {/* Date - Soft Input Style */}
      <div className="w-32">
        <Label className="text-xs text-gray-500 mb-1.5 block">Date</Label>
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg px-2.5 py-1">
          <div className="text-xs text-white">{format(date, 'MMM dd, yyyy')}</div>
        </div>
      </div>

      {/* Ref # - Soft Input Style */}
      <div className="w-24">
        <Label className="text-xs text-gray-500 mb-1.5 block">Ref #</Label>
        <Input
          value={refNumber}
          onChange={(e) => setRefNumber(e.target.value)}
          className="bg-gray-900/50 border border-gray-800 text-white text-xs h-[28px] px-2.5 py-1 rounded-lg focus-visible:ring-1 focus-visible:ring-gray-700 focus-visible:border-gray-700"
          placeholder="REF"
        />
      </div>

      {/* Type - Chip Style */}
      <div className="w-auto">
        <Label className="text-xs text-gray-500 mb-1.5 block">Type</Label>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 bg-gray-900/50 border border-gray-800 rounded-lg px-2.5 py-1 hover:bg-gray-800 transition-colors cursor-pointer"
            >
              <Tag size={14} className="text-gray-500 shrink-0" />
              <span className="text-xs text-white capitalize">{type}</span>
              <ChevronRight size={12} className="text-gray-500 rotate-90" />
            </button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-48 bg-gray-900 border-gray-800 text-white p-2"
            align="start"
          >
            <div className="space-y-1">
              {(['regular', 'studio'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setType(t);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center gap-2",
                    type === t
                      ? "bg-gray-800 text-white"
                      : "text-gray-400 hover:bg-gray-800 hover:text-white"
                  )}
                >
                  <Tag size={16} className={cn(
                    type === t ? "text-blue-400" : "text-gray-500"
                  )} />
                  <span className="capitalize">{t}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );

  // Option D1-A: Avatar + Popover List for Salesman
  const renderOptionD1A = () => (
    <div className="flex items-center gap-3 w-full">
      {/* Customer - Chip Style with Search */}
      {renderCustomerSelector(true)}

      {/* Date - Soft Input Style */}
      <div className="w-32">
        <Label className="text-xs text-gray-500 mb-1.5 block">Date</Label>
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg px-2.5 py-1">
          <div className="text-xs text-white">{format(date, 'MMM dd, yyyy')}</div>
        </div>
      </div>

      {/* Ref # - Soft Input Style */}
      <div className="w-24">
        <Label className="text-xs text-gray-500 mb-1.5 block">Ref #</Label>
        <Input
          value={refNumber}
          onChange={(e) => setRefNumber(e.target.value)}
          className="bg-gray-900/50 border border-gray-800 text-white text-xs h-[28px] px-2.5 py-1 rounded-lg focus-visible:ring-1 focus-visible:ring-gray-700 focus-visible:border-gray-700"
          placeholder="REF"
        />
      </div>

      {/* Type - Chip Style */}
      <div className="w-auto">
        <Label className="text-xs text-gray-500 mb-1.5 block">Type</Label>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 bg-gray-900/50 border border-gray-800 rounded-lg px-2.5 py-1 hover:bg-gray-800 transition-colors cursor-pointer"
            >
              <Tag size={14} className="text-gray-500 shrink-0" />
              <span className="text-xs text-white capitalize">{type}</span>
              <ChevronRight size={12} className="text-gray-500 rotate-90" />
            </button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-48 bg-gray-900 border-gray-800 text-white p-2"
            align="start"
          >
            <div className="space-y-1">
              {(['regular', 'studio'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setType(t);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center gap-2",
                    type === t
                      ? "bg-gray-800 text-white"
                      : "text-gray-400 hover:bg-gray-800 hover:text-white"
                  )}
                >
                  <Tag size={16} className={cn(
                    type === t ? "text-blue-400" : "text-gray-500"
                  )} />
                  <span className="capitalize">{t}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );

  // Option D1-B: Status + Salesman Chips
  const renderOptionD1B = () => (
    <div className="flex items-center gap-3 w-full">
      {/* Customer - Chip Style with Search */}
      {renderCustomerSelector(true)}

      {/* Date - Soft Input Style */}
      <div className="w-32">
        <Label className="text-xs text-gray-500 mb-1.5 block">Date</Label>
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg px-2.5 py-1">
          <div className="text-xs text-white">{format(date, 'MMM dd, yyyy')}</div>
        </div>
      </div>

      {/* Ref # - Soft Input Style */}
      <div className="w-24">
        <Label className="text-xs text-gray-500 mb-1.5 block">Ref #</Label>
        <Input
          value={refNumber}
          onChange={(e) => setRefNumber(e.target.value)}
          className="bg-gray-900/50 border border-gray-800 text-white text-xs h-[28px] px-2.5 py-1 rounded-lg focus-visible:ring-1 focus-visible:ring-gray-700 focus-visible:border-gray-700"
          placeholder="REF"
        />
      </div>

      {/* Type - Chip Style */}
      <div className="w-auto">
        <Label className="text-xs text-gray-500 mb-1.5 block">Type</Label>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 bg-gray-900/50 border border-gray-800 rounded-lg px-2.5 py-1 hover:bg-gray-800 transition-colors cursor-pointer"
            >
              <Tag size={14} className="text-gray-500 shrink-0" />
              <span className="text-xs text-white capitalize">{type}</span>
              <ChevronRight size={12} className="text-gray-500 rotate-90" />
            </button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-48 bg-gray-900 border-gray-800 text-white p-2"
            align="start"
          >
            <div className="space-y-1">
              {(['regular', 'studio'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setType(t);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center gap-2",
                    type === t
                      ? "bg-gray-800 text-white"
                      : "text-gray-400 hover:bg-gray-800 hover:text-white"
                  )}
                >
                  <Tag size={16} className={cn(
                    type === t ? "text-blue-400" : "text-gray-500"
                  )} />
                  <span className="capitalize">{t}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );

  // Option D2: Invoice, Status (Segmented Pills), Salesman in Top Header
  const renderOptionD2 = () => (
    <div className="flex items-center gap-3 w-full">
      {/* Customer - Chip Style with Search */}
      {renderCustomerSelector(true)}

      {/* Date - Soft Input Style */}
      <div className="w-32">
        <Label className="text-xs text-gray-500 mb-1.5 block">Date</Label>
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg px-2.5 py-1">
          <div className="text-xs text-white">{format(date, 'MMM dd, yyyy')}</div>
        </div>
      </div>

      {/* Ref # - Soft Input Style */}
      <div className="w-24">
        <Label className="text-xs text-gray-500 mb-1.5 block">Ref #</Label>
        <Input
          value={refNumber}
          onChange={(e) => setRefNumber(e.target.value)}
          className="bg-gray-900/50 border border-gray-800 text-white text-xs h-[28px] px-2.5 py-1 rounded-lg focus-visible:ring-1 focus-visible:ring-gray-700 focus-visible:border-gray-700"
          placeholder="REF"
        />
      </div>

      {/* Type - Chip Style */}
      <div className="w-auto">
        <Label className="text-xs text-gray-500 mb-1.5 block">Type</Label>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 bg-gray-900/50 border border-gray-800 rounded-lg px-2.5 py-1 hover:bg-gray-800 transition-colors cursor-pointer"
            >
              <Tag size={14} className="text-gray-500 shrink-0" />
              <span className="text-xs text-white capitalize">{type}</span>
              <ChevronRight size={12} className="text-gray-500 rotate-90" />
            </button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-48 bg-gray-900 border-gray-800 text-white p-2"
            align="start"
          >
            <div className="space-y-1">
              {(['regular', 'studio'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setType(t);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center gap-2",
                    type === t
                      ? "bg-gray-800 text-white"
                      : "text-gray-400 hover:bg-gray-800 hover:text-white"
                  )}
                >
                  <Tag size={16} className={cn(
                    type === t ? "text-blue-400" : "text-gray-500"
                  )} />
                  <span className="capitalize">{t}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );

  // Option E: Status Pills + Salesman
  const renderOptionE = () => {
    const statusOptions: Array<{ value: typeof status; label: string }> = [
      { value: 'draft', label: 'Draft' },
      { value: 'quotation', label: 'Quotation' },
      { value: 'final', label: 'Final' }
    ];

    return (
      <div className="flex items-center gap-3 w-full">
        {/* Customer */}
        {renderCustomerSelector(true)}

        {/* Date */}
        <div className="w-32">
          <Label className="text-xs text-gray-500 mb-1.5 block">Date</Label>
          <div className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
            <div className="text-sm text-white">{format(date, 'MMM dd, yyyy')}</div>
          </div>
        </div>

        {/* Ref # */}
        <div className="w-24">
          <Label className="text-xs text-gray-500 mb-1.5 block">Ref #</Label>
          <Input
            value={refNumber}
            onChange={(e) => setRefNumber(e.target.value)}
            className="bg-gray-900 border border-gray-800 text-white text-xs h-8"
            placeholder="REF"
          />
        </div>

        {/* Status Pills */}
        <div className="flex items-end gap-2">
          <Label className="text-xs text-gray-500 mb-1.5 block w-full">Status</Label>
          <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatus(option.value)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  status === option.value
                    ? cn(
                        "bg-blue-600 text-white shadow-lg shadow-blue-500/30",
                        getStatusColor(option.value)
                      )
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Salesman - Compact */}
        <div className="w-auto">
          <Label className="text-xs text-gray-500 mb-1.5 block">Salesman</Label>
          <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-1.5">
            <UserCheck size={14} className="text-gray-500 shrink-0" />
            <Select value={salesman} onValueChange={setSalesman}>
              <SelectTrigger className="border-0 bg-transparent text-white text-xs h-auto p-0 w-auto min-w-[80px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-800 text-white">
                <SelectItem value="John Doe">John Doe</SelectItem>
                <SelectItem value="Jane Smith">Jane Smith</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Type */}
        <div className="w-28">
          <Label className="text-xs text-gray-500 mb-1.5 block">Type</Label>
          <Select value={type} onValueChange={(v: any) => setType(v)}>
            <SelectTrigger className="bg-gray-900 border-gray-800 text-white text-xs h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-800 text-white">
              <SelectItem value="regular">Regular</SelectItem>
              <SelectItem value="studio">Studio</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  };

  // Option F: Status Badge Dropdown
  const renderOptionF = () => {
    return (
      <div className="flex items-center gap-3 w-full">
        {/* Customer */}
        {renderCustomerSelector(true)}

        {/* Date */}
        <div className="w-32">
          <Label className="text-xs text-gray-500 mb-1.5 block">Date</Label>
          <div className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
            <div className="text-sm text-white">{format(date, 'MMM dd, yyyy')}</div>
          </div>
        </div>

        {/* Ref # */}
        <div className="w-24">
          <Label className="text-xs text-gray-500 mb-1.5 block">Ref #</Label>
          <Input
            value={refNumber}
            onChange={(e) => setRefNumber(e.target.value)}
            className="bg-gray-900 border border-gray-800 text-white text-xs h-8"
            placeholder="REF"
          />
        </div>

        {/* Status Badge Dropdown */}
        <div className="flex items-center gap-2">
          <Label className="text-xs text-gray-500 mb-1.5 block w-16">Status</Label>
          <Popover open={statusDropdownOpen} onOpenChange={setStatusDropdownOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                  getStatusColor(status),
                  "hover:opacity-80 cursor-pointer"
                )}
              >
                {status}
              </button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-48 bg-gray-900 border-gray-800 text-white p-2"
              align="start"
            >
              <div className="space-y-1">
                {(['draft', 'quotation', 'order', 'final'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setStatus(s);
                      setStatusDropdownOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md text-sm transition-all",
                      status === s
                        ? "bg-gray-800 text-white"
                        : "text-gray-400 hover:bg-gray-800 hover:text-white"
                    )}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Salesman - Inline */}
        <div className="w-auto">
          <Label className="text-xs text-gray-500 mb-1.5 block">Salesman</Label>
          <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-1.5">
            <UserCheck size={14} className="text-gray-500 shrink-0" />
            <Select value={salesman} onValueChange={setSalesman}>
              <SelectTrigger className="border-0 bg-transparent text-white text-xs h-auto p-0 w-auto min-w-[80px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-800 text-white">
                <SelectItem value="John Doe">John Doe</SelectItem>
                <SelectItem value="Jane Smith">Jane Smith</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Type */}
        <div className="w-28">
          <Label className="text-xs text-gray-500 mb-1.5 block">Type</Label>
          <Select value={type} onValueChange={(v: any) => setType(v)}>
            <SelectTrigger className="bg-gray-900 border-gray-800 text-white text-xs h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-800 text-white">
              <SelectItem value="regular">Regular</SelectItem>
              <SelectItem value="studio">Studio</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  };

  // Option G: Workflow Step Bar
  const renderOptionG = () => {
    const workflowSteps = [
      { value: 'draft' as const, label: 'Draft' },
      { value: 'quotation' as const, label: 'Quotation' },
      { value: 'final' as const, label: 'Final' }
    ];

    const getCurrentStepIndex = () => {
      return workflowSteps.findIndex(s => s.value === status);
    };

    const currentStepIndex = getCurrentStepIndex();

    return (
      <div className="flex items-center gap-3 w-full">
        {/* Customer */}
        {renderCustomerSelector(true)}

        {/* Date */}
        <div className="w-32">
          <Label className="text-xs text-gray-500 mb-1.5 block">Date</Label>
          <div className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
            <div className="text-sm text-white">{format(date, 'MMM dd, yyyy')}</div>
          </div>
        </div>

        {/* Ref # */}
        <div className="w-24">
          <Label className="text-xs text-gray-500 mb-1.5 block">Ref #</Label>
          <Input
            value={refNumber}
            onChange={(e) => setRefNumber(e.target.value)}
            className="bg-gray-900 border border-gray-800 text-white text-xs h-8"
            placeholder="REF"
          />
        </div>

        {/* Workflow Step Bar */}
        <div className="flex items-end gap-2">
          <Label className="text-xs text-gray-500 mb-1.5 block w-16">Status</Label>
          <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1.5">
            {workflowSteps.map((step, index) => (
              <React.Fragment key={step.value}>
                <button
                  type="button"
                  onClick={() => setStatus(step.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium transition-all relative",
                    currentStepIndex >= index
                      ? cn(
                          "bg-blue-600 text-white shadow-lg shadow-blue-500/30",
                          getStatusColor(step.value)
                        )
                      : "text-gray-500 hover:text-gray-300 bg-gray-800"
                  )}
                >
                  {step.label}
                </button>
                {index < workflowSteps.length - 1 && (
                  <ChevronRight 
                    size={14} 
                    className={cn(
                      "mx-1",
                      currentStepIndex > index ? "text-blue-400" : "text-gray-600"
                    )} 
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Salesman - Right Side */}
        <div className="w-auto ml-auto">
          <Label className="text-xs text-gray-500 mb-1.5 block">Salesman</Label>
          <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-1.5">
            <UserCheck size={14} className="text-gray-500 shrink-0" />
            <Select value={salesman} onValueChange={setSalesman}>
              <SelectTrigger className="border-0 bg-transparent text-white text-xs h-auto p-0 w-auto min-w-[80px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-800 text-white">
                <SelectItem value="John Doe">John Doe</SelectItem>
                <SelectItem value="Jane Smith">Jane Smith</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Type */}
        <div className="w-28">
          <Label className="text-xs text-gray-500 mb-1.5 block">Type</Label>
          <Select value={type} onValueChange={(v: any) => setType(v)}>
            <SelectTrigger className="bg-gray-900 border-gray-800 text-white text-xs h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-800 text-white">
              <SelectItem value="regular">Regular</SelectItem>
              <SelectItem value="studio">Studio</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#111827] text-white p-8">
      <div className="max-w-[1100px] mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Transaction Header Layout Test</h1>
          <p className="text-sm text-gray-400">
            Experimenting with different header layouts for Add Sale / Add Purchase forms
          </p>
        </div>

        {/* Variant Controls */}
        <div className="mb-4 p-4 bg-gray-900/50 border border-gray-800 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Due Balance Display Variant */}
            <div>
              <Label className="text-xs text-gray-400 mb-2 block">Due Balance Display</Label>
              <div className="flex gap-2">
                {(['A', 'B', 'C'] as const).map((variant) => (
                  <Button
                    key={variant}
                    variant={dueBalanceVariant === variant ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDueBalanceVariant(variant)}
                    className={cn(
                      "text-xs h-8",
                      dueBalanceVariant === variant
                        ? 'bg-blue-600 hover:bg-blue-500 text-white'
                        : 'border-gray-700 text-gray-300 hover:bg-gray-800'
                    )}
                  >
                    {variant === 'A' && 'Plain Text'}
                    {variant === 'B' && 'Chip'}
                    {variant === 'C' && 'Info Icon'}
                  </Button>
                ))}
              </div>
            </div>

            {/* Add Customer UX Variant */}
            <div>
              <Label className="text-xs text-gray-400 mb-2 block">Add Customer UX</Label>
              <div className="flex gap-2">
                {(['1', '2', '3'] as const).map((variant) => (
                  <Button
                    key={variant}
                    variant={addCustomerVariant === variant ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAddCustomerVariant(variant)}
                    className={cn(
                      "text-xs h-8",
                      addCustomerVariant === variant
                        ? 'bg-purple-600 hover:bg-purple-500 text-white'
                        : 'border-gray-700 text-gray-300 hover:bg-gray-800'
                    )}
                  >
                    {variant === '1' && 'Plus Icon'}
                    {variant === '2' && 'Bottom List'}
                    {variant === '3' && 'Empty State'}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Option Selector */}
        <div className="mb-6 flex flex-wrap gap-2">
          <Button
            variant={selectedOption === 'A' ? 'default' : 'outline'}
            onClick={() => setSelectedOption('A')}
            className={cn(
              selectedOption === 'A' 
                ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                : 'border-gray-700 text-gray-300 hover:bg-gray-800'
            )}
          >
            Option A: Priority + Compression
          </Button>
          <Button
            variant={selectedOption === 'B' ? 'default' : 'outline'}
            onClick={() => setSelectedOption('B')}
            className={cn(
              selectedOption === 'B' 
                ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                : 'border-gray-700 text-gray-300 hover:bg-gray-800'
            )}
          >
            Option B: Grouped Single-Row
          </Button>
          <Button
            variant={selectedOption === 'C' ? 'default' : 'outline'}
            onClick={() => setSelectedOption('C')}
            className={cn(
              selectedOption === 'C' 
                ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                : 'border-gray-700 text-gray-300 hover:bg-gray-800'
            )}
          >
            Option C: Smart Collapse
          </Button>
          <Button
            variant={selectedOption === 'D' ? 'default' : 'outline'}
            onClick={() => setSelectedOption('D')}
            className={cn(
              selectedOption === 'D' 
                ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                : 'border-gray-700 text-gray-300 hover:bg-gray-800'
            )}
          >
            Option D: Invoice in Top Header
          </Button>
          <Button
            variant={selectedOption === 'D1' ? 'default' : 'outline'}
            onClick={() => setSelectedOption('D1')}
            className={cn(
              selectedOption === 'D1' 
                ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                : 'border-gray-700 text-gray-300 hover:bg-gray-800'
            )}
          >
            Option D1: Badge Dropdown
          </Button>
          <Button
            variant={selectedOption === 'D1-A' ? 'default' : 'outline'}
            onClick={() => setSelectedOption('D1-A')}
            className={cn(
              selectedOption === 'D1-A' 
                ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                : 'border-gray-700 text-gray-300 hover:bg-gray-800'
            )}
          >
            Option D1-A: Avatar Popover
          </Button>
          <Button
            variant={selectedOption === 'D1-B' ? 'default' : 'outline'}
            onClick={() => setSelectedOption('D1-B')}
            className={cn(
              selectedOption === 'D1-B' 
                ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                : 'border-gray-700 text-gray-300 hover:bg-gray-800'
            )}
          >
            Option D1-B: Status + Salesman Chips
          </Button>
          <Button
            variant={selectedOption === 'D2' ? 'default' : 'outline'}
            onClick={() => setSelectedOption('D2')}
            className={cn(
              selectedOption === 'D2' 
                ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                : 'border-gray-700 text-gray-300 hover:bg-gray-800'
            )}
          >
            Option D2: Segmented Pills
          </Button>
          <Button
            variant={selectedOption === 'E' ? 'default' : 'outline'}
            onClick={() => setSelectedOption('E')}
            className={cn(
              selectedOption === 'E' 
                ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                : 'border-gray-700 text-gray-300 hover:bg-gray-800'
            )}
          >
            Option E: Status Pills
          </Button>
          <Button
            variant={selectedOption === 'F' ? 'default' : 'outline'}
            onClick={() => setSelectedOption('F')}
            className={cn(
              selectedOption === 'F' 
                ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                : 'border-gray-700 text-gray-300 hover:bg-gray-800'
            )}
          >
            Option F: Badge Dropdown
          </Button>
          <Button
            variant={selectedOption === 'G' ? 'default' : 'outline'}
            onClick={() => setSelectedOption('G')}
            className={cn(
              selectedOption === 'G' 
                ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                : 'border-gray-700 text-gray-300 hover:bg-gray-800'
            )}
          >
            Option G: Workflow Steps
          </Button>
        </div>

        {/* Test Container - Matches drawer width */}
        <div className="bg-[#0B1019] border border-gray-800 rounded-lg overflow-hidden">
          {/* Top Bar - Simulated Header */}
          <div className="h-12 flex items-center justify-between px-6 border-b border-gray-800/50 bg-[#0B1019]">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white h-8 w-8">
                <X size={18} />
              </Button>
              <div>
                <h2 className="text-sm font-bold text-white">New Sale Invoice</h2>
                <p className="text-[10px] text-gray-500">Standard Entry</p>
              </div>
              {/* Invoice # in Top Header - For Options D, E, F, G */}
              {(selectedOption === 'D' || selectedOption === 'E' || selectedOption === 'F' || selectedOption === 'G') && (
                <div className="ml-4 pl-4 border-l border-gray-800">
                  <div className="flex items-center gap-2">
                    <Hash size={14} className="text-cyan-500" />
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase">Invoice #</p>
                      <p className="text-sm font-mono text-cyan-400">{invoiceNumber}</p>
                    </div>
                  </div>
                </div>
              )}
              {/* D1, D1-A, D1-B & D2: Invoice, Status, Salesman in Top Header */}
              {(selectedOption === 'D1' || selectedOption === 'D1-A' || selectedOption === 'D1-B' || selectedOption === 'D2') && (
                <div className="ml-4 flex items-center gap-4">
                  {/* Invoice Number */}
                  <div className="flex items-center gap-2">
                    <Hash size={14} className="text-cyan-500" />
                    <span className="text-sm font-mono text-cyan-400">{invoiceNumber}</span>
                  </div>
                  
                  {/* Status - Badge Dropdown (D1, D1-A) */}
                  {(selectedOption === 'D1' || selectedOption === 'D1-A') && (
                    <Popover open={statusDropdownOpen} onOpenChange={setStatusDropdownOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            "px-3 py-1 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5",
                            getStatusColor(status),
                            "hover:opacity-80 cursor-pointer"
                          )}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent 
                        className="w-48 bg-gray-900 border-gray-800 text-white p-2"
                        align="start"
                      >
                        <div className="space-y-1">
                          {(['draft', 'quotation', 'order', 'final'] as const).map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => {
                                setStatus(s);
                                setStatusDropdownOpen(false);
                              }}
                              className={cn(
                                "w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center gap-2",
                                status === s
                                  ? "bg-gray-800 text-white"
                                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
                              )}
                            >
                              <span className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                s === 'draft' && "bg-gray-500",
                                s === 'quotation' && "bg-yellow-500",
                                s === 'final' && "bg-green-500"
                              )}></span>
                              {s.charAt(0).toUpperCase() + s.slice(1)}
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                  
                  {/* Status - D1-B: Status Chip (inline with Salesman chip) */}
                  {selectedOption === 'D1-B' && (
                    <Popover open={statusDropdownOpen} onOpenChange={setStatusDropdownOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            "px-3 py-1 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5",
                            getStatusColor(status),
                            "hover:opacity-80 cursor-pointer"
                          )}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent 
                        className="w-48 bg-gray-900 border-gray-800 text-white p-2"
                        align="start"
                      >
                        <div className="space-y-1">
                          {(['draft', 'quotation', 'order', 'final'] as const).map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => {
                                setStatus(s);
                                setStatusDropdownOpen(false);
                              }}
                              className={cn(
                                "w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center gap-2",
                                status === s
                                  ? "bg-gray-800 text-white"
                                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
                              )}
                            >
                              <span className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                s === 'draft' && "bg-gray-500",
                                s === 'quotation' && "bg-yellow-500",
                                s === 'final' && "bg-green-500"
                              )}></span>
                              {s.charAt(0).toUpperCase() + s.slice(1)}
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}

                  {/* Status - Segmented Pills (D2) */}
                  {selectedOption === 'D2' && (
                    <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1">
                      {(['draft', 'quotation', 'final'] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setStatus(s)}
                          className={cn(
                            "px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                            status === s
                              ? cn(
                                  "bg-blue-600 text-white shadow-lg shadow-blue-500/30",
                                  getStatusColor(s)
                                )
                              : "text-gray-400 hover:text-white hover:bg-gray-800"
                          )}
                        >
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {/* Salesman - D1: Compact Dropdown */}
                  {selectedOption === 'D1' && (
                    <div className="flex items-center gap-2 bg-gray-900/50 border border-gray-800 rounded-lg px-2.5 py-1">
                      <UserCheck size={14} className="text-gray-500 shrink-0" />
                      <Select value={salesman} onValueChange={setSalesman}>
                        <SelectTrigger className="border-0 bg-transparent text-white text-xs h-auto p-0 w-auto min-w-[100px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-900 border-gray-800 text-white">
                          <SelectItem value="John Doe">John Doe</SelectItem>
                          <SelectItem value="Jane Smith">Jane Smith</SelectItem>
                          <SelectItem value="Ali Hassan">Ali Hassan</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Salesman - D1-A: Avatar + Popover List */}
                  {selectedOption === 'D1-A' && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="flex items-center gap-2 bg-gray-900/50 border border-gray-800 rounded-lg px-2.5 py-1 hover:bg-gray-800 transition-colors cursor-pointer"
                        >
                          <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-semibold">
                            {salesman.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs text-white">{salesman}</span>
                          <ChevronRight size={12} className="text-gray-500 rotate-90" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent 
                        className="w-56 bg-gray-900 border-gray-800 text-white p-2"
                        align="start"
                      >
                        <div className="space-y-1">
                          {(['John Doe', 'Jane Smith', 'Ali Hassan'] as const).map((name) => (
                            <button
                              key={name}
                              type="button"
                              onClick={() => {
                                setSalesman(name);
                              }}
                              className={cn(
                                "w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center gap-2",
                                salesman === name
                                  ? "bg-gray-800 text-white"
                                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
                              )}
                            >
                              <div className={cn(
                                "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold",
                                salesman === name ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300"
                              )}>
                                {name.charAt(0).toUpperCase()}
                              </div>
                              <span>{name}</span>
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}

                  {/* Salesman - D1-B: Status + Salesman Chips (Status chip is already rendered above) */}
                  {selectedOption === 'D1-B' && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="flex items-center gap-2 bg-gray-900/50 border border-gray-800 rounded-lg px-2.5 py-1 hover:bg-gray-800 transition-colors cursor-pointer"
                        >
                          <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-semibold">
                            {salesman.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs text-white">{salesman}</span>
                          <ChevronRight size={12} className="text-gray-500 rotate-90" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent 
                        className="w-56 bg-gray-900 border-gray-800 text-white p-2"
                        align="start"
                      >
                        <div className="space-y-1">
                          {(['John Doe', 'Jane Smith', 'Ali Hassan'] as const).map((name) => (
                            <button
                              key={name}
                              type="button"
                              onClick={() => {
                                setSalesman(name);
                              }}
                              className={cn(
                                "w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center gap-2",
                                salesman === name
                                  ? "bg-gray-800 text-white"
                                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
                              )}
                            >
                              <div className={cn(
                                "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold",
                                salesman === name ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300"
                              )}>
                                {name.charAt(0).toUpperCase()}
                              </div>
                              <span>{name}</span>
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              )}
            </div>
            {/* Branch Selector - Chip Style */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 bg-gray-900/50 border border-gray-800 rounded-lg px-2.5 py-1 hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  <Building2 size={14} className="text-gray-500 shrink-0" />
                  <span className="text-xs text-white">{branch}</span>
                  <ChevronRight size={12} className="text-gray-500 rotate-90" />
                </button>
              </PopoverTrigger>
              <PopoverContent 
                className="w-56 bg-gray-900 border-gray-800 text-white p-2"
                align="end"
              >
                <div className="space-y-1">
                  {(['Main Branch', 'Branch 2'] as const).map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        setBranch(name);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center gap-2",
                        branch === name
                          ? "bg-gray-800 text-white"
                          : "text-gray-400 hover:bg-gray-800 hover:text-white"
                      )}
                    >
                      <Building2 size={16} className={cn(
                        branch === name ? "text-blue-400" : "text-gray-500"
                      )} />
                      <span>{name}</span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Header Fields Section */}
          <div className="bg-[#0F1419] px-6 py-4">
            {selectedOption === 'A' && renderOptionA()}
            {selectedOption === 'B' && renderOptionB()}
            {selectedOption === 'C' && renderOptionC()}
            {selectedOption === 'D' && renderOptionD()}
            {selectedOption === 'D1' && renderOptionD1()}
            {selectedOption === 'D1-A' && renderOptionD1A()}
            {selectedOption === 'D1-B' && renderOptionD1B()}
            {selectedOption === 'D2' && renderOptionD2()}
            {selectedOption === 'E' && renderOptionE()}
            {selectedOption === 'F' && renderOptionF()}
            {selectedOption === 'G' && renderOptionG()}
          </div>

          {/* Option Description */}
          <div className="p-4 bg-gray-900/50 border-t border-gray-800">
            <h3 className="text-sm font-semibold text-white mb-2">
              {selectedOption === 'A' && 'Option A: Priority + Compression Layout'}
              {selectedOption === 'B' && 'Option B: Grouped Single-Row Layout'}
              {selectedOption === 'C' && 'Option C: Smart Collapse Layout'}
              {selectedOption === 'D' && 'Option D: Invoice in Top Header (Original)'}
              {selectedOption === 'D1' && 'Option D1: ERP-Style Top Header (Badge Dropdown)'}
              {selectedOption === 'D1-A' && 'Option D1-A: ERP-Style Top Header (Avatar + Popover)'}
              {selectedOption === 'D1-B' && 'Option D1-B: ERP-Style Top Header (Status + Salesman Chips)'}
              {selectedOption === 'D2' && 'Option D2: ERP-Style Top Header (Segmented Pills)'}
              {selectedOption === 'E' && 'Option E: Status Pills + Salesman'}
              {selectedOption === 'F' && 'Option F: Status Badge Dropdown'}
              {selectedOption === 'G' && 'Option G: Workflow Step Bar'}
            </h3>
            <p className="text-xs text-gray-400">
              {selectedOption === 'A' && 
                'Customer takes maximum space (flex-1). Lower priority fields (Ref, Type, Salesman) are visually compressed with icons and muted styling. Invoice # remains in the row.'}
              {selectedOption === 'B' && 
                'Fields grouped into two logical sections: Left (Customer, Date, Ref) and Right (Invoice, Status, Salesman, Type) with visual separator.'}
              {selectedOption === 'C' && 
                'Default view shows only essential fields (Customer, Date, Invoice, Status). Click the "More" icon to access Ref #, Salesman, and Type in a popover.'}
              {selectedOption === 'D' && 
                'Invoice # moved to top header area (system info). Form header contains only: Customer, Date, Ref, Status, Salesman, Type. Tests if system-generated data feels better in title area.'}
              {selectedOption === 'D1' && 
                'ERP-style layout: Invoice, Status (badge dropdown), and Salesman (dropdown) in top header. Form header contains only: Customer, Date, Ref #, Type. Clean separation between system info and data entry fields.'}
              {selectedOption === 'D1-A' && 
                'ERP-style layout: Invoice, Status (badge dropdown), and Salesman (avatar + popover list) in top header. Salesman shown as compact chip with avatar icon. Click opens popover with list. Form header contains only: Customer, Date, Ref #, Type.'}
              {selectedOption === 'D1-B' && 
                'ERP-style layout: Invoice, Status chip, and Salesman chip in top header. Both chips are clickable and aligned inline. Status chip colored by state. Salesman chip with avatar icon. Form header contains only: Customer, Date, Ref #, Type.'}
              {selectedOption === 'D2' && 
                'ERP-style layout: Invoice, Status (segmented pills), and Salesman in top header. Form header contains only: Customer, Date, Ref #, Type. Modern workflow controls in header area.'}
              {selectedOption === 'E' && 
                'Status shown as segmented pills (Draft | Quotation | Final). Active status visually highlighted. Pills clickable. Salesman shown as compact selector with icon + name.'}
              {selectedOption === 'F' && 
                'Status displayed as a colored badge. Clicking badge opens dropdown with all statuses. Badge color changes per status. Salesman shown inline next to status.'}
              {selectedOption === 'G' && 
                'Horizontal workflow indicator: Draft → Quotation → Final. Current step highlighted. Steps clickable. Salesman placed on the right side. Shows progression visually.'}
            </p>
          </div>
        </div>

        {/* Visual Width Indicator */}
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            Container width: <span className="text-gray-400 font-mono">1100px</span> (matches drawer width)
          </p>
        </div>

        {/* ============ ADD PURCHASE / SUPPLIER TEST SECTION ============ */}
        <div className="mt-12 pt-12 border-t border-gray-800">
          {/* Section Header */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">Add Purchase / Supplier Test</h2>
            <p className="text-sm text-gray-400">
              Testing supplier search UX with payable balance (same design as Add Sale)
            </p>
          </div>

          {/* Test Container - Matches drawer width */}
          <div className="bg-[#0B1019] border border-gray-800 rounded-lg overflow-hidden">
            {/* Top Bar - Simulated Header */}
            <div className="h-12 flex items-center justify-between px-6 border-b border-gray-800/50 bg-[#0B1019]">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white h-8 w-8">
                  <X size={18} />
                </Button>
                <div>
                  <h2 className="text-sm font-bold text-white">New Purchase Order</h2>
                  <p className="text-[10px] text-gray-500">Standard Entry</p>
                </div>
              </div>
              {/* Branch Selector - Chip Style */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 bg-gray-900/50 border border-gray-800 rounded-lg px-2.5 py-1 hover:bg-gray-800 transition-colors cursor-pointer"
                  >
                    <Building2 size={14} className="text-gray-500 shrink-0" />
                    <span className="text-xs text-white">{branch}</span>
                    <ChevronRight size={12} className="text-gray-500 rotate-90" />
                  </button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-56 bg-gray-900 border-gray-800 text-white p-2"
                  align="end"
                >
                  <div className="space-y-1">
                    {(['Main Branch', 'Branch 2'] as const).map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => {
                          setBranch(name);
                        }}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center gap-2",
                          branch === name
                            ? "bg-gray-800 text-white"
                            : "text-gray-400 hover:bg-gray-800 hover:text-white"
                        )}
                      >
                        <Building2 size={16} className={cn(
                          branch === name ? "text-blue-400" : "text-gray-500"
                        )} />
                        <span>{name}</span>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Form Header Section */}
            <div className="bg-[#0F1419] px-6 py-4">
              <div className="flex items-center gap-3 w-full">
                {/* Supplier - Same design as Customer */}
                {renderSupplierSelector()}

                {/* Date - Soft Input Style */}
                <div className="w-32">
                  <Label className="text-xs text-gray-500 mb-1.5 block">Date</Label>
                  <div className="bg-gray-900/50 border border-gray-800 rounded-lg px-2.5 py-1">
                    <div className="text-xs text-white">{format(date, 'MMM dd, yyyy')}</div>
                  </div>
                </div>

                {/* Ref # - Soft Input Style */}
                <div className="w-24">
                  <Label className="text-xs text-gray-500 mb-1.5 block">Ref #</Label>
                  <Input
                    value={refNumber}
                    onChange={(e) => setRefNumber(e.target.value)}
                    className="bg-gray-900/50 border border-gray-800 text-white text-xs h-[28px] px-2.5 py-1 rounded-lg focus-visible:ring-1 focus-visible:ring-gray-700 focus-visible:border-gray-700"
                    placeholder="REF"
                  />
                </div>

                {/* Type - Chip Style */}
                <div className="w-auto">
                  <Label className="text-xs text-gray-500 mb-1.5 block">Type</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center gap-2 bg-gray-900/50 border border-gray-800 rounded-lg px-2.5 py-1 hover:bg-gray-800 transition-colors cursor-pointer"
                      >
                        <Tag size={14} className="text-gray-500 shrink-0" />
                        <span className="text-xs text-white capitalize">{type}</span>
                        <ChevronRight size={12} className="text-gray-500 rotate-90" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent 
                      className="w-48 bg-gray-900 border-gray-800 text-white p-2"
                      align="start"
                    >
                      <div className="space-y-1">
                        {(['regular', 'studio'] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => {
                              setType(t);
                            }}
                            className={cn(
                              "w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center gap-2",
                              type === t
                                ? "bg-gray-800 text-white"
                                : "text-gray-400 hover:bg-gray-800 hover:text-white"
                            )}
                          >
                            <Tag size={16} className={cn(
                              type === t ? "text-blue-400" : "text-gray-500"
                            )} />
                            <span className="capitalize">{t}</span>
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="p-4 bg-gray-900/50 border-t border-gray-800">
              <h3 className="text-sm font-semibold text-white mb-2">
                Add Purchase / Supplier Test Section
              </h3>
              <p className="text-xs text-gray-400">
                Same design as Add Sale, but for suppliers. Payable balance shown:
                <span className="text-red-400 ml-1">Red (+amount) = Payable (supplier ko dene hain)</span>,
                <span className="text-green-400 ml-1">Green (-amount) = Advance/Credit</span>,
                <span className="text-gray-500 ml-1">Gray = Zero</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
