import React, { useState, useEffect } from 'react';
import { SearchableSelect } from '../ui/searchable-select';
import { CustomerSearchV2 } from '../ui/customer-search-v2';
import { useSupabase } from '../../context/SupabaseContext';
import { useNavigation } from '../../context/NavigationContext';
import { contactService } from '../../services/contactService';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { ArrowLeft, User } from 'lucide-react';

export const ContactSearchTestPage = () => {
    const { companyId } = useSupabase();
    const { openDrawer, activeDrawer, createdContactId, createdContactType, setCreatedContactId, setCurrentView } = useNavigation();
    
    // Customer State
    const [customers, setCustomers] = useState<Array<{ id: string; name: string; dueBalance: number }>>([]);
    const [customerId, setCustomerId] = useState<string>('');
    const [customerLoading, setCustomerLoading] = useState(false);
    
    // Supplier State
    const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string; dueBalance: number }>>([]);
    const [supplierId, setSupplierId] = useState<string>('');
    const [supplierLoading, setSupplierLoading] = useState(false);
    
    // Load customers
    useEffect(() => {
        const loadCustomers = async () => {
            if (!companyId) return;
            setCustomerLoading(true);
            try {
                const contactsData = await contactService.getAllContacts(companyId);
                const customerContacts = contactsData
                    .filter(c => c.type === 'customer' || c.type === 'both')
                    .map(c => ({
                        id: c.id || c.uuid || '',
                        name: c.name || '',
                        dueBalance: c.receivables || 0
                    }));
                
                setCustomers([
                    { id: 'walk-in', name: "Walk-in Customer", dueBalance: 0 },
                    ...customerContacts
                ]);
                console.log('[TEST PAGE] Loaded customers:', customerContacts.length);
            } catch (error) {
                console.error('[TEST PAGE] Error loading customers:', error);
                toast.error('Failed to load customers');
            } finally {
                setCustomerLoading(false);
            }
        };
        loadCustomers();
    }, [companyId]);
    
    // Load suppliers
    useEffect(() => {
        const loadSuppliers = async () => {
            if (!companyId) return;
            setSupplierLoading(true);
            try {
                const contactsData = await contactService.getAllContacts(companyId);
                const supplierContacts = contactsData
                    .filter(c => c.type === 'supplier' || c.type === 'both')
                    .map(c => ({
                        id: c.id || c.uuid || '',
                        name: c.name || '',
                        dueBalance: c.payables || 0
                    }));
                
                setSuppliers(supplierContacts);
                console.log('[TEST PAGE] Loaded suppliers:', supplierContacts.length);
            } catch (error) {
                console.error('[TEST PAGE] Error loading suppliers:', error);
                toast.error('Failed to load suppliers');
            } finally {
                setSupplierLoading(false);
            }
        };
        loadSuppliers();
    }, [companyId]);
    
    // Reload customers when contact drawer closes (in case a new contact was added)
    useEffect(() => {
        const reloadCustomers = async () => {
            // Only reload when:
            // 1. Contact drawer was just closed (activeDrawer changed from 'addContact' to 'none')
            // 2. AND a contact was actually created (createdContactId is not null)
            // 3. AND the contact type is relevant (customer or both)
            if (activeDrawer === 'none' && companyId && createdContactId !== null && 
                (createdContactType === 'customer' || createdContactType === 'both')) {
                try {
                    // Store the contact ID before clearing (for auto-selection)
                    const contactIdToSelect = createdContactId;
                    const contactTypeToSelect = createdContactType;
                    
                    // Clear immediately to prevent duplicate reloads
                    if (setCreatedContactId) {
                        setCreatedContactId(null, null);
                    }
                    
                    console.log('[TEST PAGE - CUSTOMER] Reloading customers, createdContactId:', contactIdToSelect, 'Type:', contactTypeToSelect);
                    
                    // Small delay to ensure DB commit
                    await new Promise(resolve => setTimeout(resolve, 200));
                    
                    const contactsData = await contactService.getAllContacts(companyId);
                    const customerContacts = contactsData
                        .filter(c => c.type === 'customer' || c.type === 'both')
                        .map(c => ({
                            id: c.id || c.uuid || '',
                            name: c.name || '',
                            dueBalance: c.receivables || 0
                        }));
                    
                    console.log('[TEST PAGE - CUSTOMER] Reloaded customers:', customerContacts.length, 'IDs:', customerContacts.map(c => c.id));
                    
                    setCustomers([
                        { id: 'walk-in', name: "Walk-in Customer", dueBalance: 0 },
                        ...customerContacts
                    ]);
                    
                    // Auto-select newly created contact
                    const contactIdStr = contactIdToSelect.toString();
                    const foundContact = customerContacts.find(c => {
                        const cId = c.id?.toString() || '';
                        // Exact match first
                        if (cId === contactIdStr || c.id === contactIdToSelect) {
                            return true;
                        }
                        // UUID format matching (handle with/without dashes)
                        const normalizedCId = cId.replace(/-/g, '').toLowerCase();
                        const normalizedCreatedId = contactIdStr.replace(/-/g, '').toLowerCase();
                        if (normalizedCId === normalizedCreatedId) {
                            return true;
                        }
                        return false;
                    });
                    
                    if (foundContact) {
                        const selectedId = foundContact.id.toString();
                        setCustomerId(selectedId);
                        toast.success(`Customer "${foundContact.name}" selected`);
                        console.log('[TEST PAGE - CUSTOMER] ✅ Auto-selected customer:', selectedId, foundContact.name);
                    } else {
                        console.warn('[TEST PAGE - CUSTOMER] ❌ Could not find created contact:', contactIdStr, 'Available IDs:', customerContacts.map(c => c.id));
                    }
                } catch (error) {
                    console.error('[TEST PAGE - CUSTOMER] Error reloading customers:', error);
                }
            } else if (activeDrawer === 'none' && createdContactId !== null && 
                       (createdContactType === 'supplier' || createdContactType === 'worker')) {
                // Clear the ID if supplier/worker was created (no reload needed for customer section)
                if (setCreatedContactId) {
                    setCreatedContactId(null, null);
                }
            }
        };
        
        reloadCustomers();
    }, [activeDrawer, companyId, createdContactId, createdContactType, setCreatedContactId]);
    
    // Reload suppliers when contact drawer closes (in case a new contact was added)
    useEffect(() => {
        const reloadSuppliers = async () => {
            // Only reload when:
            // 1. Contact drawer was just closed (activeDrawer changed from 'addContact' to 'none')
            // 2. AND a contact was actually created (createdContactId is not null)
            // 3. AND the contact type is relevant (supplier or both)
            if (activeDrawer === 'none' && companyId && createdContactId !== null && 
                (createdContactType === 'supplier' || createdContactType === 'both')) {
                try {
                    // Store the contact ID before clearing (for auto-selection)
                    const contactIdToSelect = createdContactId;
                    const contactTypeToSelect = createdContactType;
                    
                    // Clear immediately to prevent duplicate reloads
                    if (setCreatedContactId) {
                        setCreatedContactId(null, null);
                    }
                    
                    console.log('[TEST PAGE - SUPPLIER] Reloading suppliers, createdContactId:', contactIdToSelect, 'Type:', contactTypeToSelect);
                    
                    // Small delay to ensure DB commit
                    await new Promise(resolve => setTimeout(resolve, 200));
                    
                    const contactsData = await contactService.getAllContacts(companyId);
                    const supplierContacts = contactsData
                        .filter(c => c.type === 'supplier' || c.type === 'both')
                        .map(c => ({
                            id: c.id || c.uuid || '',
                            name: c.name || '',
                            dueBalance: c.payables || 0
                        }));
                    
                    console.log('[TEST PAGE - SUPPLIER] Reloaded suppliers:', supplierContacts.length, 'IDs:', supplierContacts.map(c => c.id));
                    
                    setSuppliers(supplierContacts);
                    
                    // Auto-select newly created contact
                    const contactIdStr = contactIdToSelect.toString();
                    const foundContact = supplierContacts.find(c => {
                        const cId = c.id?.toString() || '';
                        // Exact match first
                        if (cId === contactIdStr || c.id === contactIdToSelect) {
                            return true;
                        }
                        // UUID format matching (handle with/without dashes)
                        const normalizedCId = cId.replace(/-/g, '').toLowerCase();
                        const normalizedCreatedId = contactIdStr.replace(/-/g, '').toLowerCase();
                        if (normalizedCId === normalizedCreatedId) {
                            return true;
                        }
                        return false;
                    });
                    
                    if (foundContact) {
                        const selectedId = foundContact.id.toString();
                        setSupplierId(selectedId);
                        toast.success(`Supplier "${foundContact.name}" selected`);
                        console.log('[TEST PAGE - SUPPLIER] ✅ Auto-selected supplier:', selectedId, foundContact.name);
                    } else {
                        console.warn('[TEST PAGE - SUPPLIER] ❌ Could not find created contact:', contactIdStr, 'Available IDs:', supplierContacts.map(c => c.id));
                    }
                } catch (error) {
                    console.error('[TEST PAGE - SUPPLIER] Error reloading suppliers:', error);
                }
            } else if (activeDrawer === 'none' && createdContactId !== null && 
                       (createdContactType === 'customer' || createdContactType === 'worker')) {
                // Clear the ID if customer/worker was created (no reload needed for supplier section)
                if (setCreatedContactId) {
                    setCreatedContactId(null, null);
                }
            }
        };
        
        reloadSuppliers();
    }, [activeDrawer, companyId, createdContactId, createdContactType, setCreatedContactId]);
    
    const selectedCustomer = customers.find(c => c.id === customerId);
    const selectedSupplier = suppliers.find(s => s.id === supplierId);
    
    return (
        <div className="p-6 space-y-6">
            <div className="mb-6">
                <div className="flex items-center gap-4 mb-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentView('dashboard')}
                        className="bg-gray-900 border-gray-700 text-white hover:bg-gray-800"
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Dashboard
                    </Button>
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Contact Search Test Page</h1>
                <p className="text-gray-400 text-sm">
                    Test customer and supplier search functionality separately. Check console logs for debugging.
                </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Customer Search Section - V2 (NEW) */}
                <Card className="bg-gray-900 border-gray-800 border-2 border-blue-500/30">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            Customer Search V2
                            <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">NEW</span>
                        </CardTitle>
                        <CardDescription className="text-gray-400">
                            New isolated component - Fixed positioning, reliable behavior
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Select Customer (V2)
                            </label>
                            <CustomerSearchV2
                                value={customerId}
                                onValueChange={setCustomerId}
                                options={customers}
                                placeholder="Search customer..."
                                emptyText="No customers found"
                                enableAddNew={true}
                                addNewLabel="Add New Customer"
                                onAddNew={(searchTerm) => {
                                    console.log('[TEST PAGE - CUSTOMER V2] Add New clicked, searchTerm:', searchTerm);
                                    openDrawer('addContact', undefined, { 
                                        contactType: 'customer', 
                                        prefillName: searchTerm 
                                    });
                                }}
                                badgeColor="red"
                                icon={<User size={14} className="text-gray-400" />}
                            />
                        </div>
                        
                        {selectedCustomer && (
                            <div className="mt-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
                                <h3 className="text-sm font-semibold text-white mb-2">Selected Customer:</h3>
                                <div className="space-y-1 text-sm">
                                    <p className="text-gray-300">
                                        <span className="font-medium">ID:</span> {selectedCustomer.id}
                                    </p>
                                    <p className="text-gray-300">
                                        <span className="font-medium">Name:</span> {selectedCustomer.name}
                                    </p>
                                    <p className="text-gray-300">
                                        <span className="font-medium">Due Balance:</span> ${selectedCustomer.dueBalance.toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        )}
                        
                        <div className="mt-4 p-3 bg-gray-800 rounded-lg border border-gray-700">
                            <p className="text-xs text-gray-400">
                                <span className="font-medium">Status:</span> {customerLoading ? 'Loading...' : `Loaded ${customers.length} customers`}
                            </p>
                        </div>
                    </CardContent>
                </Card>
                
                {/* Customer Search Section - OLD (for comparison) */}
                <Card className="bg-gray-900 border-gray-800 opacity-60">
                    <CardHeader>
                        <CardTitle className="text-white text-sm">Customer Search (OLD - Reference)</CardTitle>
                        <CardDescription className="text-gray-400 text-xs">
                            Original component for comparison
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Select Customer (OLD)
                            </label>
                            <SearchableSelect
                                value={customerId}
                                onValueChange={setCustomerId}
                                options={customers}
                                placeholder="Search customer..."
                                searchPlaceholder="Search customers..."
                                emptyText="No customers found"
                                enableAddNew={true}
                                addNewLabel="Add New Customer"
                                onAddNew={(searchTerm) => {
                                    console.log('[TEST PAGE - CUSTOMER OLD] Add New clicked, searchTerm:', searchTerm);
                                    openDrawer('addContact', undefined, { 
                                        contactType: 'customer', 
                                        prefillName: searchTerm 
                                    });
                                }}
                                badgeColor="red"
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                {/* Supplier Search Section */}
                <Card className="bg-gray-900 border-gray-800">
                    <CardHeader>
                        <CardTitle className="text-white">Supplier Search</CardTitle>
                        <CardDescription className="text-gray-400">
                            Test supplier search and "Add New Supplier" functionality
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Select Supplier
                            </label>
                            <SearchableSelect
                                value={supplierId}
                                onValueChange={setSupplierId}
                                options={suppliers}
                                placeholder="Search supplier..."
                                searchPlaceholder="Search suppliers..."
                                emptyText="No suppliers found"
                                enableAddNew={true}
                                addNewLabel="Add New Supplier"
                                onAddNew={(searchTerm) => {
                                    console.log('[TEST PAGE - SUPPLIER] Add New clicked, searchTerm:', searchTerm);
                                    openDrawer('addContact', undefined, { 
                                        contactType: 'supplier', 
                                        prefillName: searchTerm 
                                    });
                                }}
                                badgeColor="orange"
                            />
                        </div>
                        
                        {selectedSupplier && (
                            <div className="mt-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
                                <h3 className="text-sm font-semibold text-white mb-2">Selected Supplier:</h3>
                                <div className="space-y-1 text-sm">
                                    <p className="text-gray-300">
                                        <span className="font-medium">ID:</span> {selectedSupplier.id}
                                    </p>
                                    <p className="text-gray-300">
                                        <span className="font-medium">Name:</span> {selectedSupplier.name}
                                    </p>
                                    <p className="text-gray-300">
                                        <span className="font-medium">Due Balance:</span> ${selectedSupplier.dueBalance.toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        )}
                        
                        <div className="mt-4 p-3 bg-gray-800 rounded-lg border border-gray-700">
                            <p className="text-xs text-gray-400">
                                <span className="font-medium">Status:</span> {supplierLoading ? 'Loading...' : `Loaded ${suppliers.length} suppliers`}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
            
            {/* Debug Info */}
            <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                    <CardTitle className="text-white">Debug Information</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2 text-sm font-mono">
                        <p className="text-gray-300">
                            <span className="text-gray-500">Active Drawer:</span> {activeDrawer}
                        </p>
                        <p className="text-gray-300">
                            <span className="text-gray-500">Created Contact ID:</span> {createdContactId || 'null'}
                        </p>
                        <p className="text-gray-300">
                            <span className="text-gray-500">Created Contact Type:</span> {createdContactType || 'null'}
                        </p>
                        <p className="text-gray-300">
                            <span className="text-gray-500">Company ID:</span> {companyId || 'null'}
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
