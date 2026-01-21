import { toast } from "sonner";
import { TransactionForm } from '../transactions/TransactionForm';
import { PurchaseForm } from '../purchases/PurchaseForm';
import { SaleForm } from '../sales/SaleForm';
import { EnhancedProductForm } from '../products/EnhancedProductForm';
import React, { useState } from 'react';
import { useNavigation } from '../../context/NavigationContext';
import { useSupabase } from '../../context/SupabaseContext';
import { contactService } from '../../services/contactService';
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

export const GlobalDrawer = () => {
  const { activeDrawer, openDrawer, closeDrawer, drawerData } = useNavigation();
  const { companyId, user } = useSupabase();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [saving, setSaving] = useState(false);

  const isOpen = activeDrawer !== 'none';
  const handleOpenChange = (open: boolean) => {
    if (!open) closeDrawer();
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
      } else if (activeDrawer === 'addUser') {
        // User form submission is handled separately
        toast.success('User created successfully');
        closeDrawer();
      } else {
        const action = activeDrawer === 'addUser' ? 'User' : 'Product';
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
  const isProduct = activeDrawer === 'addProduct';
  const side = isMobile ? "bottom" : "right";
  
  // Custom classes for the sheet content
  let contentClasses = "border-l border-gray-800 bg-gray-950 text-white p-0 gap-0 "; 
  
  if (isMobile) {
    contentClasses += "h-[90vh] rounded-t-xl border-t"; // Bottom sheet style
  } else {
    contentClasses += "h-full ";
    if (isSale || isPurchase) {
      contentClasses += "w-[1400px] sm:max-w-[1400px]"; // Extra wide for Sale/Purchase Form
    } else if (isProduct) {
       contentClasses += "max-w-4xl w-full"; // Match ProductDrawer width (max-w-4xl = 896px)
    } else {
      contentClasses += "w-[400px] sm:w-[540px]"; // Standard for simple forms
    }
  }

  // Render content based on active drawer
  const renderContent = () => {
    // Render all forms but hide inactive ones - this preserves state
    return (
      <>
        {/* Sale Form - Add */}
        <div style={{ display: activeDrawer === 'addSale' ? 'block' : 'none' }}>
          <SaleForm onClose={() => closeDrawer()} />
        </div>

        {/* Sale Form - Edit */}
        <div style={{ display: activeDrawer === 'edit-sale' ? 'block' : 'none' }}>
          <SaleForm sale={drawerData?.sale} onClose={() => closeDrawer()} />
        </div>

        {/* Purchase Form - Add */}
        <div style={{ display: activeDrawer === 'addPurchase' ? 'block' : 'none' }}>
          <PurchaseForm onClose={() => closeDrawer()} />
        </div>

        {/* Purchase Form - Edit */}
        <div style={{ display: activeDrawer === 'edit-purchase' ? 'block' : 'none' }}>
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

        {/* User Form - Only mount when active */}
        {activeDrawer === 'addUser' && (
          <div className="flex flex-col h-full p-6">
            <SheetHeader>
              <SheetTitle className="text-white text-xl">
                Add New User
              </SheetTitle>
              <SheetDescription className="text-gray-400">
                Create a new user account and assign roles.
              </SheetDescription>
            </SheetHeader>

            <form onSubmit={handleSubmit} className="flex flex-col gap-6 mt-8 h-full">
              {activeDrawer === 'addUser' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-gray-200">Full Name</Label>
                    <Input id="name" placeholder="John Doe" className="bg-gray-900 border-gray-800 text-white" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-gray-200">Email Address</Label>
                    <Input id="email" type="email" placeholder="john@example.com" className="bg-gray-900 border-gray-800 text-white" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-gray-200">Password</Label>
                    <Input id="password" type="password" placeholder="••••••••" className="bg-gray-900 border-gray-800 text-white" required />
                  </div>

                  {/* Advanced Details Accordion */}
                  <Accordion type="multiple" className="border border-gray-800 rounded-lg mt-4">
                    <AccordionItem value="role" className="border-b border-gray-800">
                      <AccordionTrigger className="px-4 hover:bg-gray-800/50">
                        <span className="text-sm font-medium">Roles & Permissions</span>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="role" className="text-gray-200">User Role</Label>
                            <Select>
                              <SelectTrigger className="bg-gray-900 border-gray-800 text-white">
                                <SelectValue placeholder="Select role" />
                              </SelectTrigger>
                              <SelectContent className="bg-gray-900 border-gray-800 text-white">
                                <SelectItem value="admin">Administrator</SelectItem>
                                <SelectItem value="manager">Manager</SelectItem>
                                <SelectItem value="cashier">Cashier</SelectItem>
                                <SelectItem value="inventory">Inventory Clerk</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="access">
                      <AccordionTrigger className="px-4 hover:bg-gray-800/50">
                        <span className="text-sm font-medium">Access Locations</span>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Checkbox id="loc-karachi" className="border-gray-700" />
                            <Label htmlFor="loc-karachi" className="text-gray-300 cursor-pointer">Karachi Store</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox id="loc-lahore" className="border-gray-700" />
                            <Label htmlFor="loc-lahore" className="text-gray-300 cursor-pointer">Lahore Store</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox id="loc-islamabad" className="border-gray-700" />
                            <Label htmlFor="loc-islamabad" className="text-gray-300 cursor-pointer">Islamabad Store</Label>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              )}

              <div className="mt-auto pt-6 flex gap-3">
                <Button type="button" variant="outline" onClick={() => closeDrawer()} className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white">
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-500 text-white">
                  Create User
                </Button>
              </div>
            </form>
          </div>
        )}
      </>
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent side={side} className={contentClasses}>
        {/* Hidden title for accessibility */}
        {(isSale || isPurchase || isProduct) && (
          <SheetHeader className="sr-only">
            <SheetTitle>
              {isSale ? 'Add Sale' : isPurchase ? 'Add Purchase' : 'Add Product'}
            </SheetTitle>
          </SheetHeader>
        )}
        {renderContent()}
      </SheetContent>
    </Sheet>
  );
};

// Contact Form Component
const ContactFormContent = ({ onClose }: { onClose: () => void }) => {
  const { drawerContactType } = useNavigation();
  const { companyId, branchId, user } = useSupabase();
  const [contactType, setContactType] = useState<'customer' | 'supplier' | 'worker'>(drawerContactType || 'customer');
  const [workerType, setWorkerType] = useState<string>('dyer');
  const [saving, setSaving] = useState(false);
  const [country, setCountry] = useState<string>('pk');
  
  // Update contactType when drawerContactType changes
  React.useEffect(() => {
    if (drawerContactType) {
      setContactType(drawerContactType);
    }
  }, [drawerContactType]);

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
      const contactData = {
        company_id: companyId,
        branch_id: branchId || undefined,
        type: contactType,
        name: formData.get('business-name') as string,
        phone: formData.get('mobile') as string,
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

      await contactService.createContact(contactData);
      toast.success('Contact created successfully!');
      onClose();
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
        <p className="text-sm text-gray-400 mt-1">Create a customer, supplier, or worker profile</p>
        
        {/* Toggle Contact Type - 3 Options */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <button
            type="button"
            onClick={() => setContactType('customer')}
            className={`py-2.5 px-4 rounded-lg font-medium transition-all text-sm ${
              contactType === 'customer' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Customer
          </button>
          <button
            type="button"
            onClick={() => setContactType('supplier')}
            className={`py-2.5 px-4 rounded-lg font-medium transition-all text-sm ${
              contactType === 'supplier' 
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30' 
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Supplier
          </button>
          <button
            type="button"
            onClick={() => setContactType('worker')}
            className={`py-2.5 px-4 rounded-lg font-medium transition-all text-sm ${
              contactType === 'worker' 
                ? 'bg-green-600 text-white shadow-lg shadow-green-500/30' 
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Worker
          </button>
        </div>
      </div>

      <form onSubmit={handleContactSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Basic Info */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wider">Basic Information</h3>
          
          <div className="space-y-2">
            <Label htmlFor="business-name" className="text-gray-200">
              {contactType === 'worker' ? 'Worker Name *' : 'Business Name *'}
            </Label>
            <Input 
              id="business-name"
              name="business-name"
              placeholder={contactType === 'worker' ? 'e.g. Ahmed Ali' : 'e.g. Ahmed Retailers'} 
              className="bg-gray-900 border-gray-800 text-white" 
              required 
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mobile" className="text-gray-200">Mobile Number *</Label>
            <Input 
              id="mobile"
              name="mobile"
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

        {/* Worker Type Selection - Only for Workers */}
        {contactType === 'worker' && (
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