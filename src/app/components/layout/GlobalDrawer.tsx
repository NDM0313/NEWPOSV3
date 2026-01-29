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
  const isPurchase = activeDrawer === 'addPurchase';
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
    contentClasses += "h-full ";
    if (isSale || isPurchase) {
      // Responsive width for Sale/Purchase: full width on mobile/tablet, 1100px on desktop (lg+)
      contentClasses += "w-full lg:w-[1200px]"; // Desktop: 1180px, Mobile/Tablet: full width
    } else if (isProduct) {
       contentClasses += "!w-[800px] !max-w-[800px] sm:!max-w-[800px]"; // Override Sheet default width (800px for comfortable form layout)
    } else if (isContact) {
      // Contact form: Fixed 580-600px width
      contentClasses += "!w-[580px] !max-w-[600px] sm:!max-w-[600px]"; // Contact form: 580-600px fixed width
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
          <SaleForm sale={drawerData?.sale} onClose={() => closeDrawer()} />
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
          <SaleForm sale={drawerData?.sale} onClose={() => closeDrawer()} />
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
              window.location.reload();
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
              window.location.reload();
            }}
          />
        )}

        {/* Contact Form - Only mount when active */}
        {activeDrawer === 'addContact' && (
          <ContactFormContent onClose={() => closeDrawer()} />
        )}

      </>
    );
  };

  // Render nested drawers: When Contact is opened from Sale/Purchase, render both drawers
  if (hasNestedDrawer) {
    // Render parent drawer (Sale/Purchase) with lower z-index
    const parentIsSale = parentDrawer === 'addSale' || parentDrawer === 'edit-sale';
    const parentIsPurchase = parentDrawer === 'addPurchase';
    const parentContentClasses = "border-l border-gray-800 bg-gray-950 text-white p-0 gap-0 h-full w-full lg:w-[1200px] !z-[60] overflow-y-auto";
    
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
          <SheetContent side={side} className={contentClasses + " overflow-y-auto"}>
            <SheetHeader className="sr-only">
              <SheetTitle>Add Contact</SheetTitle>
              <SheetDescription className="sr-only">Create a new contact</SheetDescription>
            </SheetHeader>
            {activeDrawer === 'addContact' && (
              <ContactFormContent onClose={() => closeDrawer()} />
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
          {renderContent()}
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
  const { drawerContactType, setCreatedContactId, parentDrawer, drawerPrefillName, drawerPrefillPhone } = useNavigation();
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
  const [workerType, setWorkerType] = useState<string>('dyer');
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
    } else {
      // No drawerContactType means all roles should be unselected
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
      
      if (phone) {
        const duplicateByPhone = existingContacts.find(
          (c: any) => (c.phone === phone || c.mobile === phone) && phone.trim() !== ''
        );
        
        if (duplicateByPhone) {
          toast.error(`Ye number pehle se "${duplicateByPhone.name}" ke naam se save hai`);
          setSaving(false);
          return;
        }
      }
      
      const contactData: any = {
        company_id: companyId,
        branch_id: branchId || undefined,
        type: primaryType === 'both' ? 'customer' : primaryType, // Fallback to 'customer' if 'both' not supported
        name: name,
        phone: phone,
        email: formData.get('email') as string || undefined,
        address: formData.get('address') as string || undefined,
        city: formData.get('city') as string || undefined,
        country: country === 'pk' ? 'Pakistan' : country === 'in' ? 'India' : country === 'bd' ? 'Bangladesh' : 'Pakistan',
        opening_balance: parseFloat(formData.get('opening-balance') as string) || 0,
        credit_limit: parseFloat(formData.get('credit-limit') as string) || 0,
        payment_terms: parseInt(formData.get('pay-term') as string) || 0,
        tax_number: formData.get('tax-id') as string || undefined,
        notes: formData.get('notes') as string || undefined,
        created_by: user.id,
      };
      
      // Add contact group if selected (skip if "none")
      if (selectedGroupId && selectedGroupId !== 'none') {
        contactData.group_id = selectedGroupId;
      }
      
      // Add supplier-specific fields if supplier is selected
      if (contactRoles.supplier) {
        const supplierBusinessName = formData.get('supplier-business-name') as string;
        const contactPerson = formData.get('contact-person') as string;
        const ntn = formData.get('supplier-ntn') as string;
        const payableAccount = formData.get('supplier-payable-account') as string;
        const supplierOpeningBalance = formData.get('supplier-opening-balance') as string;
        
        if (supplierBusinessName) contactData.business_name = supplierBusinessName;
        // Only add contact_person if it has a value (column may not exist in DB yet)
        if (contactPerson && contactPerson.trim() !== '') {
          contactData.contact_person = contactPerson;
        }
        if (ntn) contactData.ntn = ntn;
        if (payableAccount) contactData.payable_account_id = payableAccount;
        if (supplierOpeningBalance) contactData.supplier_opening_balance = parseFloat(supplierOpeningBalance) || 0;
      }
      
      // Add worker-specific fields if worker is selected
      if (contactRoles.worker) {
        contactData.worker_role = workerType;
      }

      // Validate at least one role is selected
      if (!contactRoles.customer && !contactRoles.supplier && !contactRoles.worker) {
        toast.error('Please select at least one contact role');
        setSaving(false);
        return;
      }

      const createdContact = await contactService.createContact(contactData);
      
      // Store created contact ID and type for auto-selection in parent form (Sale/Purchase)
      // Use the ID from the created contact (could be uuid or id field)
      const contactId = createdContact?.id || createdContact?.uuid || createdContact?.id;
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
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-gray-800 bg-gray-950 sticky top-0 z-10">
        <h2 className="text-xl font-bold text-white">Add New Contact</h2>
        <p className="text-sm text-gray-400 mt-1">
          {drawerContactType 
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

      <form onSubmit={handleContactSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
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

        {/* Worker Type Selection - Only for Workers */}
        {contactRoles.worker && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 space-y-4">
            <h3 className="text-sm font-semibold text-green-400 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              Worker Specialization
            </h3>
            
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'dyer', label: 'Dyer', icon: '🎨' },
                { value: 'stitching', label: 'Stitching Master', icon: '✂️' },
                { value: 'handwork', label: 'Handwork', icon: '🧵' },
                { value: 'embroidery', label: 'Embroidery', icon: '🪡' },
                { value: 'printing', label: 'Printing', icon: '🖨️' },
                { value: 'finishing', label: 'Finishing', icon: '✨' },
                { value: 'cutting', label: 'Cutting Master', icon: '✂️' },
                { value: 'packing', label: 'Packing', icon: '📦' },
              ].map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setWorkerType(type.value)}
                  className={`p-3 rounded-lg border-2 transition-all text-left ${
                    workerType === type.value
                      ? 'bg-green-600 border-green-500 text-white shadow-lg shadow-green-500/30'
                      : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-green-500/50 hover:bg-gray-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{type.icon}</span>
                    <span className="text-sm font-medium">{type.label}</span>
                  </div>
                </button>
              ))}
            </div>

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