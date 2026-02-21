import { toast } from "sonner";
import { TransactionForm } from '../transactions/TransactionForm';
import { PurchaseForm } from '../purchases/PurchaseForm';
import { SaleForm } from '../sales/SaleForm';
import { EnhancedProductForm } from '../products/EnhancedProductForm';
import React, { useState } from 'react';
import { useNavigation } from '../../context/NavigationContext';
import { useSupabase } from '../../context/SupabaseContext';
import { contactService } from '../../services/contactService';
import { contactGroupService } from '../../services/contactGroupService';
import { getOrCreateLedger, updateLedgerOpeningBalance } from '../../services/ledgerService';
import { supabase } from '@/lib/supabase';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { RefreshCcw } from 'lucide-react';
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "../ui/accordion";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";
import { Switch } from "../ui/switch";
import { PackingEntryModal } from '../transactions/PackingEntryModal';

export const GlobalDrawer = () => {
  const { activeDrawer, openDrawer, closeDrawer, drawerData, parentDrawer, packingModalOpen, closePackingModal, packingModalData } = useNavigation();
  const { companyId, user, enablePacking } = useSupabase();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [saving, setSaving] = useState(false);

  const isOpen = activeDrawer !== 'none';
  const handleOpenChange = (open: boolean) => {
    if (!open) closeDrawer();
  };
  
  // Determine if we should show parent drawer (Sale/Purchase) when child drawer (Contact) is open
  const shouldShowParentDrawer = (drawerType: 'addSale' | 'addPurchase' | 'edit-sale' | 'edit-purchase') => {
    // Show if it's the active drawer OR if it's the parent of the current drawer
    return activeDrawer === drawerType || parentDrawer === drawerType;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!companyId || !user) {
      toast.error('Company ID or user not found. Please login again.');
      return;
    }

    setSaving(true);

    try {
      if (activeDrawer === 'addContact') {
        // Contact form submission is handled in ContactFormContent
        // This is just a fallback
        toast.success('Contact created successfully');
        closeDrawer();
      } else {
        // For other drawer types (Product, etc.)
        const action = 'Product';
        toast.success(`${action} created successfully`);
        closeDrawer();
      }
    } catch (error: any) {
      console.error('Submit error:', error);
      toast.error(error.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Determine width and side based on content type and device
  const isSale = activeDrawer === 'addSale' || activeDrawer === 'edit-sale';
  const isPurchase = activeDrawer === 'addPurchase' || activeDrawer === 'edit-purchase';
  const isProduct = activeDrawer === 'addProduct' || activeDrawer === 'edit-product';
  const isContact = activeDrawer === 'addContact';
  const side = isMobile ? "bottom" : "right";
  
  // Check if we have a nested drawer (Contact opened from Sale/Purchase)
  const hasNestedDrawer = isContact && parentDrawer && (parentDrawer === 'addSale' || parentDrawer === 'addPurchase' || parentDrawer === 'edit-sale' || parentDrawer === 'edit-purchase');
  
  // Custom classes for the sheet content
  // IMPORTANT: Responsive widths, isolated from global layout
  let contentClasses = "border-l border-gray-800 bg-gray-950 text-white p-0 gap-0 "; 
  
  if (isMobile) {
    contentClasses += "h-[90vh] rounded-t-xl border-t"; // Bottom sheet style
  } else {
    contentClasses += "h-full flex flex-col ";
    if (isSale || isPurchase) {
      // Responsive width for Sale/Purchase: full width on mobile/tablet, 1200px on desktop (lg+)
      // Override base Sheet's sm:max-w-md (448px) so drawer gets actual size
      contentClasses += "!max-w-none w-full lg:w-[1200px] lg:max-w-[1200px]";
    } else if (isProduct) {
       contentClasses += "!w-[900px] !max-w-[95vw] sm:!max-w-[900px] flex flex-col min-h-0"; // Product form + variations table; flex so form can scroll
    } else if (isContact) {
      // Contact form: Fixed 580-600px width; min-h-0 + overflow-hidden so inner form can scroll
      contentClasses += "!w-[580px] !max-w-[600px] sm:!max-w-[600px] min-h-0 overflow-hidden flex flex-col";
    } else {
      contentClasses += "w-[400px] sm:w-[540px]"; // Standard for simple forms
    }
  }
  
  // For nested Contact drawer, ensure higher z-index and proper overflow
  if (hasNestedDrawer) {
    contentClasses += " !z-[70]"; // Higher z-index than parent drawer (z-50)
  }

  // Render parent drawer content (Sale/Purchase only)
  // CRITICAL: Use display: none/block instead of conditional rendering to prevent unmounting
  // This preserves component state (like customerId) when contact drawer opens/closes
  const renderParentContent = () => {
    return (
      <>
        {/* Sale Form - Add */}
        <div style={{ display: shouldShowParentDrawer('addSale') ? 'block' : 'none' }}>
          <SaleForm onClose={() => closeDrawer()} />
        </div>

        {/* Sale Form - Edit */}
        <div style={{ display: shouldShowParentDrawer('edit-sale') ? 'block' : 'none' }}>
          <SaleForm key={`edit-sale-${drawerData?.sale?.id ?? 'none'}`} sale={drawerData?.sale} onClose={() => closeDrawer()} />
        </div>

        {/* Purchase Form - Add */}
        <div style={{ display: shouldShowParentDrawer('addPurchase') ? 'block' : 'none' }}>
          <PurchaseForm onClose={() => closeDrawer()} />
        </div>

        {/* Purchase Form - Edit */}
        <div style={{ display: shouldShowParentDrawer('edit-purchase') ? 'block' : 'none' }}>
          <PurchaseForm purchase={drawerData?.purchase} onClose={() => closeDrawer()} />
        </div>
      </>
    );
  };

  // Render content based on active drawer
  const renderContent = () => {
    // Render all forms but hide inactive ones - this preserves state
    return (
      <>
        {/* Sale Form - Add */}
        <div style={{ display: shouldShowParentDrawer('addSale') ? 'block' : 'none' }}>
          <SaleForm onClose={() => closeDrawer()} />
        </div>

        {/* Sale Form - Edit */}
        <div style={{ display: shouldShowParentDrawer('edit-sale') ? 'block' : 'none' }}>
          <SaleForm key={`edit-sale-${drawerData?.sale?.id ?? 'none'}`} sale={drawerData?.sale} onClose={() => closeDrawer()} />
        </div>

        {/* Purchase Form - Add */}
        <div style={{ display: shouldShowParentDrawer('addPurchase') ? 'block' : 'none' }}>
          <PurchaseForm onClose={() => closeDrawer()} />
        </div>

        {/* Purchase Form - Edit */}
        <div style={{ display: shouldShowParentDrawer('edit-purchase') ? 'block' : 'none' }}>
          <PurchaseForm purchase={drawerData?.purchase} onClose={() => closeDrawer()} />
        </div>

        {/* Product Form - Add */}
        {activeDrawer === 'addProduct' && (
          <EnhancedProductForm 
            onCancel={() => closeDrawer()}
            onSave={() => {
              toast.success('Product created successfully');
              closeDrawer();
              window.dispatchEvent(new CustomEvent('products-updated'));
            }}
          />
        )}

        {/* Product Form - Edit */}
        {activeDrawer === 'edit-product' && (
          <EnhancedProductForm 
            product={drawerData?.product}
            onCancel={() => closeDrawer()}
            onSave={() => {
              toast.success('Product updated successfully');
              closeDrawer();
              window.dispatchEvent(new CustomEvent('products-updated'));
            }}
          />
        )}

        {/* Contact Form - Only mount when active; wrapper ensures scroll works */}
        {activeDrawer === 'addContact' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <ContactFormContent onClose={() => closeDrawer()} />
          </div>
        )}

      </>
    );
  };

  // Render nested drawers: When Contact is opened from Sale/Purchase, render both drawers
  if (hasNestedDrawer) {
    // Render parent drawer (Sale/Purchase) with lower z-index
    const parentIsSale = parentDrawer === 'addSale' || parentDrawer === 'edit-sale';
    const parentIsPurchase = parentDrawer === 'addPurchase';
    const parentContentClasses = "border-l border-gray-800 bg-gray-950 text-white p-0 gap-0 h-full !max-w-none w-full lg:w-[1200px] lg:max-w-[1200px] !z-[60] overflow-y-auto";
    
    return (
      <>
        {/* Parent Drawer (Sale/Purchase) - Lower z-index, stays open */}
        <Sheet open={true} onOpenChange={() => {}}>
          <SheetContent side={side} className={parentContentClasses}>
            <SheetHeader className="sr-only">
              <SheetTitle>
                {parentIsSale ? 'Add Sale' : parentIsPurchase ? 'Add Purchase' : 'Drawer'}
              </SheetTitle>
              <SheetDescription className="sr-only">
                {parentIsSale ? 'Create a new sale' : parentIsPurchase ? 'Create a new purchase' : 'Drawer content'}
              </SheetDescription>
            </SheetHeader>
            {renderParentContent()}
          </SheetContent>
        </Sheet>
        
        {/* Child Drawer (Contact) - Higher z-index, appears on top, proper overflow */}
        <Sheet open={isOpen} onOpenChange={handleOpenChange}>
          <SheetContent side={side} className={contentClasses}>
            <SheetHeader className="sr-only">
              <SheetTitle>Add Contact</SheetTitle>
              <SheetDescription className="sr-only">Create a new contact</SheetDescription>
            </SheetHeader>
            {activeDrawer === 'addContact' && (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <ContactFormContent onClose={() => closeDrawer()} />
              </div>
            )}
          </SheetContent>
        </Sheet>
        
        {/* Global Packing Modal - Only when Enable Packing is ON */}
        {enablePacking && packingModalData && (
          <PackingEntryModal
            open={packingModalOpen || false}
            onOpenChange={(open) => {
              if (!open) closePackingModal?.();
            }}
            onSave={(details) => {
              if (packingModalData.onSave) {
                packingModalData.onSave(details);
              }
              closePackingModal?.();
            }}
            initialData={packingModalData.initialData}
            productName={packingModalData.productName}
          />
        )}
      </>
    );
  }
  
  // Single drawer (normal case)
  return (
    <>
      <Sheet open={isOpen} onOpenChange={handleOpenChange}>
        <SheetContent side={side} className={contentClasses}>
          {/* Hidden title for accessibility */}
          <SheetHeader className="sr-only">
            <SheetTitle>
              {isSale ? 'Add Sale' : 
               isPurchase ? 'Add Purchase' : 
               isProduct ? 'Add Product' : 
               isContact ? 'Add Contact' : 
               'Drawer'}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {isSale ? 'Create a new sale' : 
               isPurchase ? 'Create a new purchase' : 
               isProduct ? 'Create a new product' : 
               isContact ? 'Create a new contact' : 
               'Drawer content'}
            </SheetDescription>
          </SheetHeader>
          <div className={isProduct || isContact ? "flex flex-col flex-1 min-h-0 overflow-hidden" : ""}>
            {renderContent()}
          </div>
        </SheetContent>
      </Sheet>
      
      {/* Global Packing Modal - Only when Enable Packing is ON */}
      {enablePacking && packingModalData && (
        <PackingEntryModal
          open={packingModalOpen || false}
          onOpenChange={(open) => {
            if (!open) closePackingModal?.();
          }}
          onSave={(details) => {
            if (packingModalData.onSave) {
              packingModalData.onSave(details);
            }
            closePackingModal?.();
          }}
          initialData={packingModalData.initialData}
          productName={packingModalData.productName}
        />
      )}
    </>
  );
};

// Contact Form Component
const ContactFormContent = ({ onClose }: { onClose: () => void }) => {
  const { drawerContactType, setCreatedContactId, parentDrawer, drawerPrefillName, drawerPrefillPhone, drawerData } = useNavigation();
  const { companyId, branchId, user } = useSupabase();
  const [contactRoles, setContactRoles] = useState<{
    customer: boolean;
    supplier: boolean;
    worker: boolean;
  }>({
    // All roles initially UNSELECTED (no default selection)
    customer: drawerContactType === 'customer' ? true : false,
    supplier: drawerContactType === 'supplier' ? true : false,
    worker: drawerContactType === 'worker' ? true : false,
  });
  // Worker role = DB value. Must match Studio category filter: Dyeing (dyer) | Stitching (tailor, stitching-master, cutter) | Handwork (hand-worker, helper, embroidery)
  const WORKER_ROLES = [
    { value: 'dyer', label: 'Dyer', category: 'Dyeing' },
    { value: 'tailor', label: 'Tailor', category: 'Stitching' },
    { value: 'stitching-master', label: 'Stitching Master', category: 'Stitching' },
    { value: 'cutter', label: 'Cutter', category: 'Stitching' },
    { value: 'hand-worker', label: 'Hand Worker', category: 'Handwork' },
    { value: 'helper', label: 'Helper / Labour', category: 'Handwork' },
    { value: 'embroidery', label: 'Embroidery', category: 'Handwork' },
  ] as const;
  const [workerType, setWorkerType] = useState<string>(WORKER_ROLES[0].value);
  const [saving, setSaving] = useState(false);
  const [country, setCountry] = useState<string>('pk');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('none');
  const [contactGroups, setContactGroups] = useState<any[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  
  // Prefill name and phone from search text
  const [prefillName, setPrefillName] = useState<string>(drawerPrefillName || '');
  const [prefillPhone, setPrefillPhone] = useState<string>(drawerPrefillPhone || '');
  
  // Update prefill when drawerPrefillName changes
  React.useEffect(() => {
    if (drawerPrefillName) {
      setPrefillName(drawerPrefillName);
    }
    if (drawerPrefillPhone) {
      setPrefillPhone(drawerPrefillPhone);
    }
  }, [drawerPrefillName, drawerPrefillPhone]);
  
  // Update contactRoles when drawerContactType changes (only if explicitly set)
  React.useEffect(() => {
    if (drawerContactType) {
      setContactRoles({
        customer: drawerContactType === 'customer' ? true : false,
        supplier: drawerContactType === 'supplier' ? true : false,
        worker: drawerContactType === 'worker' ? true : false,
      });
      if (drawerContactType === 'worker') setWorkerType('dyer');
    } else {
      setContactRoles({
        customer: false,
        supplier: false,
        worker: false,
      });
    }
  }, [drawerContactType]);

  // Load contact groups based on selected roles
  React.useEffect(() => {
    const loadGroups = async () => {
      if (!companyId) return;
      
      setLoadingGroups(true);
      try {
        // Load groups for Customer and Supplier only (Worker doesn't need groups)
        const groupPromises: Promise<any[]>[] = [];
        if (contactRoles.customer) {
          groupPromises.push(contactGroupService.getAllGroups(companyId, 'customer'));
        }
        if (contactRoles.supplier) {
          groupPromises.push(contactGroupService.getAllGroups(companyId, 'supplier'));
        }
        
        // If no Customer/Supplier selected, don't load groups (Worker doesn't use groups)
        if (groupPromises.length === 0) {
          setContactGroups([]);
          setLoadingGroups(false);
          return;
        }
        
        const groupsArrays = await Promise.all(groupPromises);
        const allGroups = groupsArrays.flat();
        console.log('[CONTACT FORM] Loaded contact groups:', allGroups.length, allGroups);
        setContactGroups(allGroups);
      } catch (error: any) {
        // Service already handles 404/table not found gracefully
        // Just set empty array, form will work without groups
        setContactGroups([]);
      } finally {
        setLoadingGroups(false);
      }
    };
    
    loadGroups();
  }, [companyId, contactRoles.customer, contactRoles.supplier]);
  
  // Role toggle logic: Customer/Supplier disable Worker, Worker only when both Customer/Supplier unselected
  const handleRoleToggle = (role: 'customer' | 'supplier' | 'worker') => {
    if (role === 'customer' || role === 'supplier') {
      // If Customer or Supplier is being toggled ON, turn Worker OFF
      const newValue = !contactRoles[role];
      setContactRoles({
        ...contactRoles,
        [role]: newValue,
        worker: false, // Auto-disable Worker when Customer/Supplier selected
      });
    } else if (role === 'worker') {
      // Worker can only be ON when Customer AND Supplier both are OFF
      const newWorkerValue = !contactRoles.worker;
      if (newWorkerValue) {
        // Turning Worker ON - ensure Customer and Supplier are OFF
        setContactRoles({
          customer: false,
          supplier: false,
          worker: true,
        });
      } else {
        // Turning Worker OFF - just update worker
        setContactRoles({
          ...contactRoles,
          worker: false,
        });
      }
    }
  };

  // Determine primary type for database (backward compatibility)
  const getPrimaryType = (): 'customer' | 'supplier' | 'worker' | 'both' => {
    if (contactRoles.worker) return 'worker';
    if (contactRoles.customer && contactRoles.supplier) return 'both';
    if (contactRoles.supplier) return 'supplier';
    return 'customer';
  };

  // Handle form submission
  const handleContactSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!companyId || !user) {
      toast.error('Company ID or user not found. Please login again.');
      return;
    }

    setSaving(true);

    try {
      const formData = new FormData(e.currentTarget);
      const primaryType = getPrimaryType();
      
      // Check for duplicate contact by phone number (mandatory check)
      const existingContacts = await contactService.getAllContacts(companyId);
      const phone = formData.get('mobile') as string;
      const name = formData.get('business-name') as string;
      
      const editingId = drawerData?.contact?.uuid;
      if (phone && phone.trim() !== '') {
        const duplicateByPhone = existingContacts.find(
          (c: any) => c.id !== editingId && (c.phone === phone || c.mobile === phone)
        );
        if (duplicateByPhone) {
          toast.error(`Ye number pehle se "${duplicateByPhone.name}" ke naam se save hai`);
          setSaving(false);
          return;
        }
      }
      
      const contactData: Record<string, unknown> = {
        company_id: companyId,
        type: primaryType === 'both' ? 'customer' : primaryType,
        name: (name || '').trim() || undefined,
        phone: (phone || '').trim() || undefined,
        email: (formData.get('email') as string)?.trim() || undefined,
        address: (formData.get('address') as string)?.trim() || undefined,
        city: (formData.get('city') as string)?.trim() || undefined,
        country: country === 'pk' ? 'Pakistan' : country === 'in' ? 'India' : country === 'bd' ? 'Bangladesh' : 'Pakistan',
        opening_balance: parseFloat(formData.get('opening-balance') as string) || 0,
        credit_limit: parseFloat(formData.get('credit-limit') as string) || 0,
        payment_terms: parseInt(formData.get('pay-term') as string) || 0,
        tax_number: (formData.get('tax-id') as string)?.trim() || undefined,
        notes: (formData.get('notes') as string)?.trim() || undefined,
        created_by: user.id,
      };
      // Only set branch_id when it's a valid UUID (not "all" or other non-UUID)
      if (branchId && branchId !== 'all' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(branchId)) {
        contactData.branch_id = branchId;
      }
      if (selectedGroupId && selectedGroupId !== 'none') contactData.group_id = selectedGroupId;

      if (contactRoles.supplier) {
        const supplierBusinessName = (formData.get('supplier-business-name') as string)?.trim();
        const contactPerson = (formData.get('contact-person') as string)?.trim();
        const ntn = (formData.get('supplier-ntn') as string)?.trim();
        const payableAccount = (formData.get('supplier-payable-account') as string)?.trim();
        const supplierOpeningBalance = formData.get('supplier-opening-balance') as string;
        if (supplierBusinessName) contactData.business_name = supplierBusinessName;
        if (contactPerson) contactData.contact_person = contactPerson;
        if (ntn) contactData.ntn = ntn;
        if (payableAccount) contactData.payable_account_id = payableAccount;
        if (supplierOpeningBalance != null && supplierOpeningBalance !== '') contactData.supplier_opening_balance = parseFloat(supplierOpeningBalance) || 0;
      }
      if (contactRoles.worker && workerType) contactData.worker_role = workerType;

      // Remove undefined so API doesn't receive invalid payload
      Object.keys(contactData).forEach((k) => {
        if (contactData[k] === undefined) delete contactData[k];
      });
      if (!contactData.name) {
        toast.error('Contact name is required');
        setSaving(false);
        return;
      }

      // Validate at least one role is selected
      if (!contactRoles.customer && !contactRoles.supplier && !contactRoles.worker) {
        toast.error('Please select at least one contact role');
        setSaving(false);
        return;
      }
      if (contactRoles.worker) {
        const validWorkerRoles = ['dyer', 'tailor', 'stitching-master', 'cutter', 'hand-worker', 'helper', 'embroidery'];
        if (!workerType || !validWorkerRoles.includes(workerType)) {
          toast.error('Please select a worker role (Dyeing / Stitching / Handwork)');
          setSaving(false);
          return;
        }
      }

      const editingContactId = drawerData?.contact?.uuid;
      if (editingContactId) {
        await contactService.updateContact(editingContactId, contactData as any);
        toast.success('Contact updated successfully');
        setCreatedContactId?.(editingContactId);
        onClose();
        setSaving(false);
        return;
      }

      const createdContact = await contactService.createContact(contactData);
      
      // Use the ID from the created contact (uuid)
      const contactId = createdContact?.id || (createdContact as { uuid?: string })?.uuid;
      const contactName = (createdContact as { name?: string })?.name || (formData.get('business-name') as string) || '';

      // 🔧 FIX 1: CUSTOMER LEDGER AUTO-CREATION (MANDATORY)
      // CRITICAL: ALL customers MUST have ledger (opening balance or not)
      if (contactId && companyId && (contactRoles.customer || primaryType === 'customer')) {
        try {
          const customerLedger = await getOrCreateLedger(companyId, 'customer', contactId, contactName);
          if (customerLedger) {
            const customerOpening = Number(contactData.opening_balance ?? 0) || 0;
            if (customerOpening > 0) {
              await updateLedgerOpeningBalance(customerLedger.id, customerOpening);
            }
            console.log('[CONTACT FORM] ✅ Customer ledger created/verified:', customerLedger.id);
          } else {
            console.error('[CONTACT FORM] ❌ CRITICAL: Failed to create customer ledger');
          }
        } catch (ledgerErr: any) {
          console.error('[CONTACT FORM] ❌ CRITICAL: Customer ledger creation failed:', ledgerErr?.message);
          // Don't block contact creation, but log error
        }
      }

      // 🔧 FIX 1: SUPPLIER LEDGER AUTO-CREATION (MANDATORY)
      // CRITICAL: ALL suppliers MUST have ledger (opening balance or not)
      if (contactId && companyId && (contactRoles.supplier || primaryType === 'supplier')) {
        try {
          const supplierLedger = await getOrCreateLedger(companyId, 'supplier', contactId, contactName);
          if (supplierLedger) {
            const supplierOpening = Number(contactData.supplier_opening_balance ?? contactData.opening_balance ?? 0) || 0;
            if (supplierOpening > 0) {
              await updateLedgerOpeningBalance(supplierLedger.id, supplierOpening);
            }
            console.log('[CONTACT FORM] ✅ Supplier ledger created/verified:', supplierLedger.id);
          } else {
            console.error('[CONTACT FORM] ❌ CRITICAL: Failed to create supplier ledger');
          }
        } catch (ledgerErr: any) {
          console.error('[CONTACT FORM] ❌ CRITICAL: Supplier ledger creation failed:', ledgerErr?.message);
          // Don't block contact creation, but log error
        }
      }

      // Link worker opening balance to workers.current_balance so balance shows in contacts list and studio
      if (contactId && contactRoles.worker) {
        const workerOpening = Number(contactData.opening_balance ?? 0) || 0;
        if (workerOpening > 0) {
          try {
            await supabase.from('workers').update({
              current_balance: workerOpening,
              updated_at: new Date().toISOString(),
            }).eq('id', contactId);
          } catch (workerErr: any) {
            console.warn('[CONTACT FORM] Could not set worker opening balance:', workerErr?.message);
          }
        }
      }

      if (contactId && setCreatedContactId) {
        // Determine the contact type for filtering
        let contactTypeForFilter: 'customer' | 'supplier' | 'both' | null = null;
        if (contactRoles.customer && contactRoles.supplier) {
          contactTypeForFilter = 'both';
        } else if (contactRoles.customer) {
          contactTypeForFilter = 'customer';
        } else if (contactRoles.supplier) {
          contactTypeForFilter = 'supplier';
        }
        
        setCreatedContactId(contactId, contactTypeForFilter);
        console.log('[CONTACT FORM] Created contact ID stored:', contactId, 'Type:', contactTypeForFilter);
      }
      
      // If both customer and supplier selected, create a second record for supplier (if 'both' type not supported)
      // Note: This creates duplicate records but maintains backward compatibility
      if (contactRoles.customer && contactRoles.supplier && primaryType !== 'both') {
        try {
          const supplierData = {
            ...contactData,
            type: 'supplier' as const,
            name: (formData.get('supplier-business-name') as string) || contactData.name,
          };
          await contactService.createContact(supplierData);
        } catch (supplierError: any) {
          // If supplier record creation fails, log but don't fail the whole operation
          console.warn('[CONTACT FORM] Failed to create supplier record:', supplierError);
        }
      }
      
      toast.success('Contact created successfully!');
      
      // CRITICAL FIX: If opened from Sale/Purchase, keep drawer open briefly to allow auto-select
      // The parent form's useEffect will detect createdContactId and reload immediately
      if (parentDrawer === 'addSale' || parentDrawer === 'addPurchase') {
        // Keep drawer open for a moment to allow parent form to detect createdContactId
        // Parent form will reload and auto-select, then we can close
        setTimeout(() => {
          onClose();
        }, 500); // Delay to allow parent form to process createdContactId
      } else {
        // If not from Sale/Purchase, close immediately
        onClose();
      }
    } catch (error: any) {
      console.error('Error creating contact:', error);
      toast.error(error.message || 'Failed to create contact. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-6 border-b border-gray-800 bg-gray-950 sticky top-0 z-10 shrink-0">
        <h2 className="text-xl font-bold text-white">{drawerData?.contact ? 'Edit Contact' : 'Add New Contact'}</h2>
        <p className="text-sm text-gray-400 mt-1">
          {drawerData?.contact
            ? 'Update contact details below.'
            : drawerContactType 
            ? `Adding new ${drawerContactType}. Other roles disabled.`
            : 'Select contact roles (Customer/Supplier can be combined, Worker is separate)'}
        </p>
        
        {/* Contact Roles - Segmented Buttons / Pills */}
        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleRoleToggle('customer')}
              disabled={drawerContactType && drawerContactType !== 'customer'}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${
                contactRoles.customer
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 border-2 border-blue-500'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border-2 border-gray-700'
              } ${
                (drawerContactType && drawerContactType !== 'customer')
                  ? 'opacity-50 cursor-not-allowed' 
                  : ''
              }`}
              title={
                (drawerContactType && drawerContactType !== 'customer')
                  ? `Only ${drawerContactType} role allowed from this context`
                  : 'Select Customer role'
              }
            >
              <span className={`w-2 h-2 rounded-full ${contactRoles.customer ? 'bg-white' : 'bg-blue-500'}`}></span>
              Customer
            </button>
            
            <button
              type="button"
              onClick={() => handleRoleToggle('supplier')}
              disabled={drawerContactType && drawerContactType !== 'supplier'}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${
                contactRoles.supplier
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30 border-2 border-purple-500'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border-2 border-gray-700'
              } ${
                (drawerContactType && drawerContactType !== 'supplier')
                  ? 'opacity-50 cursor-not-allowed' 
                  : ''
              }`}
              title={
                (drawerContactType && drawerContactType !== 'supplier')
                  ? `Only ${drawerContactType} role allowed from this context`
                  : 'Select Supplier role'
              }
            >
              <span className={`w-2 h-2 rounded-full ${contactRoles.supplier ? 'bg-white' : 'bg-purple-500'}`}></span>
              Supplier
            </button>
            
            <button
              type="button"
              onClick={() => handleRoleToggle('worker')}
              disabled={contactRoles.customer || contactRoles.supplier || (drawerContactType && drawerContactType !== 'worker')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${
                contactRoles.worker
                  ? 'bg-green-600 text-white shadow-lg shadow-green-500/30 border-2 border-green-500'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border-2 border-gray-700'
              } ${
                (contactRoles.customer || contactRoles.supplier || (drawerContactType && drawerContactType !== 'worker'))
                  ? 'opacity-50 cursor-not-allowed' 
                  : ''
              }`}
              title={
                (drawerContactType && drawerContactType !== 'worker')
                  ? `Only ${drawerContactType} role allowed from this context`
                  : (contactRoles.customer || contactRoles.supplier)
                  ? 'Worker cannot be selected with Customer or Supplier'
                  : 'Select Worker role'
              }
            >
              <span className={`w-2 h-2 rounded-full ${contactRoles.worker ? 'bg-white' : 'bg-green-500'}`}></span>
              Worker
            </button>
          </div>
          
          {!contactRoles.customer && !contactRoles.supplier && !contactRoles.worker && (
            <p className="text-xs text-red-400 mt-2">Please select at least one role</p>
          )}
          
          {(contactRoles.customer || contactRoles.supplier) && contactRoles.worker && (
            <p className="text-xs text-amber-400 mt-2">Worker cannot be selected with Customer or Supplier</p>
          )}
        </div>
      </div>

      <form onSubmit={handleContactSubmit} className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
        {/* Contact Group / Category - Show for Customer and Supplier, hide for Worker */}
        {(contactRoles.customer || contactRoles.supplier) && (
          <div className="space-y-2">
            <Label htmlFor="contact-group" className="text-gray-200">Group / Category (Optional)</Label>
            {loadingGroups ? (
              <div className="text-sm text-gray-400 py-2">Loading groups...</div>
            ) : contactGroups.length > 0 ? (
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                <SelectTrigger className="bg-gray-900 border-gray-800 text-white">
                  <SelectValue placeholder="Select a group (optional)" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-800 text-white max-h-[280px] overflow-y-auto">
                  <SelectItem value="none">None</SelectItem>
                  {contactGroups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name} {group.type && `(${group.type})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="text-sm text-gray-500 italic py-2 px-3 bg-gray-900/50 rounded border border-gray-800">
                No groups available. Groups will appear here once created in settings.
              </div>
            )}
            <p className="text-xs text-gray-500">Organize contacts into groups for easier management</p>
          </div>
        )}

        {/* Basic Info */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wider">Basic Information</h3>
          
          {/* Name field - role-based labels */}
          <div className="space-y-2">
            <Label htmlFor="business-name" className="text-gray-200">
              {contactRoles.worker 
                ? 'Worker Name *' 
                : contactRoles.customer && !contactRoles.supplier
                ? 'Business / Person Name *'
                : contactRoles.supplier && !contactRoles.customer
                ? 'Business Name *'
                : 'Business / Contact Name *'}
            </Label>
            <Input 
              id="business-name"
              name="business-name"
              defaultValue={prefillName}
              placeholder={
                contactRoles.worker 
                  ? 'e.g. Ahmed Ali' 
                  : contactRoles.supplier
                  ? 'e.g. ABC Trading Company'
                  : 'e.g. Ahmed Retailers'
              } 
              className="bg-gray-900 border-gray-800 text-white" 
              required 
            />
          </div>

          {/* Contact Person - Only for Suppliers */}
          {contactRoles.supplier && (
            <div className="space-y-2">
              <Label htmlFor="contact-person" className="text-gray-200">Contact Person</Label>
              <Input 
                id="contact-person"
                name="contact-person"
                placeholder="e.g. John Doe (optional)" 
                className="bg-gray-900 border-gray-800 text-white" 
              />
              <p className="text-xs text-gray-500">Primary contact person at supplier</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="mobile" className="text-gray-200">Mobile Number *</Label>
            <Input 
              id="mobile"
              name="mobile"
              defaultValue={prefillPhone}
              placeholder="+92 300 1234567" 
              className="bg-gray-900 border-gray-800 text-white" 
              required 
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-gray-200">Email Address</Label>
            <Input 
              id="email"
              name="email"
              type="email"
              placeholder="contact@business.com" 
              className="bg-gray-900 border-gray-800 text-white" 
            />
          </div>
        </div>

        {/* Supplier Extra Business Details - Collapsible */}
        {contactRoles.supplier && (
          <Accordion type="single" collapsible className="border border-purple-500/30 rounded-lg bg-purple-500/5">
            <AccordionItem value="supplier-details" className="border-none">
              <AccordionTrigger className="px-4 hover:bg-purple-500/10">
                <span className="text-sm font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  Supplier Business Details (Optional)
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="supplier-business-name" className="text-gray-200">Business Name</Label>
                    <Input 
                      id="supplier-business-name"
                      name="supplier-business-name"
                      placeholder="e.g. ABC Trading Company" 
                      className="bg-gray-900 border-gray-800 text-white" 
                    />
                    <p className="text-xs text-gray-500">Legal business name (if different from contact name)</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="supplier-ntn" className="text-gray-200">NTN / Tax ID</Label>
                    <Input 
                      id="supplier-ntn"
                      name="supplier-ntn"
                      placeholder="NTN-1234567" 
                      className="bg-gray-900 border-gray-800 text-white" 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="supplier-payable-account" className="text-gray-200">Payable Account</Label>
                    <Select name="supplier-payable-account" defaultValue="">
                      <SelectTrigger className="bg-gray-900 border-gray-800 text-white">
                        <SelectValue placeholder="Select account (optional)" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-900 border-gray-800 text-white">
                        {/* Accounts will be loaded dynamically if needed */}
                        {/* Note: Empty Select will show placeholder when no value selected */}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">Default account for supplier payments</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="supplier-opening-balance" className="text-gray-200">Opening Balance (Payable)</Label>
                    <Input 
                      id="supplier-opening-balance"
                      name="supplier-opening-balance"
                      type="number"
                      placeholder="0.00" 
                      className="bg-gray-900 border-gray-800 text-white" 
                    />
                    <p className="text-xs text-gray-500">Initial amount owed to supplier</p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {/* Worker Role (category) – Only these values; matches Studio assignment filter */}
        {contactRoles.worker && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 space-y-4">
            <h3 className="text-sm font-semibold text-green-400 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              Worker Role (required)
            </h3>
            <p className="text-xs text-gray-500">Used for Studio: Dyeing / Stitching / Handwork task assignment.</p>
            <Select value={workerType} onValueChange={(v) => setWorkerType(v)} required>
              <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                <SelectValue placeholder="Select role..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dyer" className="text-white focus:bg-gray-800">Dyeing → Dyer</SelectItem>
                <SelectItem value="tailor" className="text-white focus:bg-gray-800">Stitching → Tailor</SelectItem>
                <SelectItem value="stitching-master" className="text-white focus:bg-gray-800">Stitching → Stitching Master</SelectItem>
                <SelectItem value="cutter" className="text-white focus:bg-gray-800">Stitching → Cutter</SelectItem>
                <SelectItem value="hand-worker" className="text-white focus:bg-gray-800">Handwork → Hand Worker</SelectItem>
                <SelectItem value="helper" className="text-white focus:bg-gray-800">Handwork → Helper / Labour</SelectItem>
                <SelectItem value="embroidery" className="text-white focus:bg-gray-800">Handwork → Embroidery</SelectItem>
              </SelectContent>
            </Select>

            {/* Worker Rate */}
            <div className="space-y-2">
              <Label htmlFor="worker-rate" className="text-gray-200">Rate / Payment</Label>
              <Input 
                id="worker-rate" 
                type="number"
                placeholder="e.g. 500 per piece / day" 
                className="bg-gray-900 border-gray-700 text-white" 
              />
              <p className="text-xs text-gray-500">Standard payment rate for this worker</p>
            </div>
          </div>
        )}

        {/* Advanced Details Accordion */}
        <Accordion type="multiple" className="border border-gray-800 rounded-lg">
          <AccordionItem value="financial" className="border-b border-gray-800">
            <AccordionTrigger className="px-4 hover:bg-gray-800/50">
              <span className="text-sm font-medium">Financial Details</span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="opening-balance" className="text-gray-200">Opening Balance</Label>
                    <Input 
                      id="opening-balance"
                      name="opening-balance"
                      type="number"
                      placeholder="0.00" 
                      className="bg-gray-900 border-gray-800 text-white" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="credit-limit" className="text-gray-200">Credit Limit</Label>
                    <Input 
                      id="credit-limit"
                      name="credit-limit"
                      type="number"
                      placeholder="0.00" 
                      className="bg-gray-900 border-gray-800 text-white" 
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="pay-term" className="text-gray-200">Payment Terms (Days)</Label>
                  <Input 
                    id="pay-term"
                    name="pay-term"
                    type="number"
                    placeholder="30" 
                    className="bg-gray-900 border-gray-800 text-white" 
                    />
                  <p className="text-xs text-gray-500">Number of days to settle payments</p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="tax" className="border-b border-gray-800">
            <AccordionTrigger className="px-4 hover:bg-gray-800/50">
              <span className="text-sm font-medium">Tax Information</span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tax-id" className="text-gray-200">Tax / VAT ID</Label>
                  <Input 
                    id="tax-id"
                    name="tax-id"
                    placeholder="NTN-1234567" 
                    className="bg-gray-900 border-gray-800 text-white" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gst" className="text-gray-200">GST Number</Label>
                  <Input 
                    id="gst"
                    name="gst"
                    placeholder="GST-1234567890" 
                    className="bg-gray-900 border-gray-800 text-white" 
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="address">
            <AccordionTrigger className="px-4 hover:bg-gray-800/50">
              <span className="text-sm font-medium">Billing Address</span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="address" className="text-gray-200">Street Address</Label>
                  <Textarea 
                    id="address"
                    name="address"
                    placeholder="Enter full address"
                    className="bg-gray-900 border-gray-800 text-white min-h-[80px]" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city" className="text-gray-200">City</Label>
                    <Input 
                      id="city"
                      name="city"
                      placeholder="Karachi" 
                      className="bg-gray-900 border-gray-800 text-white" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country" className="text-gray-200">Country</Label>
                    <Select value={country} onValueChange={setCountry}>
                      <SelectTrigger className="bg-gray-900 border-gray-800 text-white">
                        <SelectValue placeholder="Pakistan" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-900 border-gray-800 text-white">
                        <SelectItem value="pk">Pakistan</SelectItem>
                        <SelectItem value="in">India</SelectItem>
                        <SelectItem value="bd">Bangladesh</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="p-6 border-t border-gray-800 bg-gray-950 sticky bottom-0 z-10 flex gap-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onClose}
            className="flex-1 border-gray-700 text-gray-300"
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={saving}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Contact'}
          </Button>
        </div>
      </form>
    </div>
  );
};

// User Form Component - REBUILT FROM SCRATCH
// UserFormContent removed - now using AddUserModal (centered modal) instead of drawer