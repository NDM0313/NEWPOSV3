import React, { useState, useEffect } from 'react';
import { User, Building2, Phone, Save, Loader2, Wallet, Edit, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { Badge } from "../ui/badge";

export interface Contact {
  id: number;
  name: string;
  type: 'individual' | 'business';
  mobile: string;
  email?: string; // Added email
  balance?: number;
}

interface QuickAddContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (contact: Contact) => void;
  initialName?: string;
  contactType: 'customer' | 'supplier';
  mode?: 'add' | 'edit'; // New prop
  initialData?: Contact | null; // New prop
}

export const QuickAddContactModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  initialName = '', 
  contactType,
  mode = 'add',
  initialData = null
}: QuickAddContactModalProps) => {
  const [isBusiness, setIsBusiness] = useState(false);
  const [name, setName] = useState(initialName);
  const [mobile, setMobile] = useState('');
  const [balance, setBalance] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Update form when prop changes or modal opens
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && initialData) {
         // Pre-fill for Edit Mode
         setName(initialData.name);
         setMobile(initialData.mobile);
         setBalance(initialData.balance?.toString() || '');
         setIsBusiness(initialData.type === 'business');
      } else {
         // Reset for Add Mode
         setName(initialName);
         setMobile('');
         setBalance('');
         setIsBusiness(false);
      }
      setIsLoading(false);
    }
  }, [isOpen, initialName, mode, initialData]);

  const handleSave = async () => {
    if (!name.trim()) return;
    
    setIsLoading(true);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 600));
    
    const contactData: Contact = {
      id: mode === 'edit' && initialData ? initialData.id : Date.now(),
      name,
      type: isBusiness ? 'business' : 'individual',
      mobile,
      balance: parseFloat(balance) || 0
    };

    onSave(contactData);
    setIsLoading(false);
    onClose();
  };

  const isEdit = mode === 'edit';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[450px] bg-gray-900 text-white border-gray-800 p-0 gap-0 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <DialogHeader className="sr-only">
          <DialogTitle>{isEdit ? 'Edit Contact' : `Quick Add ${contactType === 'customer' ? 'Customer' : 'Supplier'}`}</DialogTitle>
        </DialogHeader>
        {/* Header */}
        <div className="p-5 border-b border-gray-800 bg-gray-950">
          <div className="text-lg font-bold text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
               {isEdit ? <Edit size={18} className="text-blue-400" /> : <Plus size={18} className="text-blue-400" />}
               <span>{isEdit ? 'Edit Contact' : `Quick Add ${contactType === 'customer' ? 'Customer' : 'Supplier'}`}</span>
            </div>
            <Badge variant="outline" className="capitalize text-xs font-normal border-gray-700 text-gray-400">
              {contactType}
            </Badge>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Toggle Type */}
          <div className="flex justify-center">
            <Tabs 
              value={isBusiness ? 'business' : 'individual'} 
              className="w-full" 
              onValueChange={(v) => setIsBusiness(v === 'business')}
            >
              <TabsList className="grid w-full grid-cols-2 bg-gray-800 text-gray-400">
                <TabsTrigger value="individual" className="data-[state=active]:bg-gray-700 data-[state=active]:text-white">
                  <User size={14} className="mr-2" /> Individual
                </TabsTrigger>
                <TabsTrigger value="business" className="data-[state=active]:bg-gray-700 data-[state=active]:text-white">
                  <Building2 size={14} className="mr-2" /> Business
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="space-y-4">
            {/* Name Input */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-500 uppercase tracking-wider">Name</Label>
              <Input 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isBusiness ? "Company Name" : "Full Name"}
                className="bg-gray-800 border-gray-700 text-white focus:ring-blue-500/20 font-medium"
                autoFocus={!isEdit} // Don't autofocus on edit to avoid jarring jump if they want to edit something else
              />
            </div>

            {/* Mobile Input */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-500 uppercase tracking-wider">Mobile Number</Label>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <Input 
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="bg-gray-800 border-gray-700 text-white pl-9"
                  type="tel"
                />
              </div>
            </div>

            {/* Opening Balance */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-500 uppercase tracking-wider">
                 {isEdit ? 'Current Balance' : 'Opening Balance (Optional)'}
              </Label>
              <div className="relative">
                <Wallet size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <Input 
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  placeholder="0.00"
                  type="number"
                  className="bg-gray-800 border-gray-700 text-white pl-9"
                />
              </div>
              <p className="text-[10px] text-gray-500">
                Positive value = They owe you. Negative = You owe them.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-800 bg-gray-950 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} className="text-gray-400 hover:text-white">
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isLoading || !name.trim()}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold min-w-[140px]"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" /> Saving...
              </>
            ) : (
              <>
                {isEdit ? 'Update Contact' : 'Save & Select'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};