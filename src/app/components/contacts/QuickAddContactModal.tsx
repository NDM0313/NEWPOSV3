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
      <DialogContent 
        className="sm:max-w-[450px] p-0 gap-0 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"
        style={{
          backgroundColor: 'var(--color-bg-card)',
          borderColor: 'var(--color-border-primary)',
          color: 'var(--color-text-primary)'
        }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{isEdit ? 'Edit Contact' : `Quick Add ${contactType === 'customer' ? 'Customer' : 'Supplier'}`}</DialogTitle>
        </DialogHeader>
        {/* Header */}
        <div 
          className="p-5 border-b"
          style={{
            borderBottomColor: 'var(--color-border-primary)',
            backgroundColor: 'var(--color-bg-tertiary)'
          }}
        >
          <div 
            className="text-lg font-bold flex items-center justify-between"
            style={{ color: 'var(--color-text-primary)' }}
          >
            <div className="flex items-center gap-2">
               {isEdit ? (
                 <Edit size={18} style={{ color: 'var(--color-primary)' }} />
               ) : (
                 <Plus size={18} style={{ color: 'var(--color-primary)' }} />
               )}
               <span>{isEdit ? 'Edit Contact' : `Quick Add ${contactType === 'customer' ? 'Customer' : 'Supplier'}`}</span>
            </div>
            <Badge 
              variant="outline" 
              className="capitalize text-xs font-normal"
              style={{
                borderColor: 'var(--color-border-secondary)',
                color: 'var(--color-text-secondary)'
              }}
            >
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
              <TabsList 
                className="grid w-full grid-cols-2"
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  color: 'var(--color-text-secondary)'
                }}
              >
                <TabsTrigger 
                  value="individual"
                  style={{
                    backgroundColor: isBusiness ? 'transparent' : 'var(--color-hover-bg)',
                    color: isBusiness ? 'var(--color-text-secondary)' : 'var(--color-text-primary)'
                  }}
                >
                  <User size={14} className="mr-2" /> Individual
                </TabsTrigger>
                <TabsTrigger 
                  value="business"
                  style={{
                    backgroundColor: isBusiness ? 'var(--color-hover-bg)' : 'transparent',
                    color: isBusiness ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'
                  }}
                >
                  <Building2 size={14} className="mr-2" /> Business
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="space-y-4">
            {/* Name Input */}
            <div className="space-y-2">
              <Label 
                className="text-xs uppercase tracking-wider"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                Name
              </Label>
              <Input 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isBusiness ? "Company Name" : "Full Name"}
                className="font-medium"
                autoFocus={!isEdit}
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  borderColor: 'var(--color-border-secondary)',
                  color: 'var(--color-text-primary)'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--color-primary)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--color-border-secondary)';
                }}
              />
            </div>

            {/* Mobile Input */}
            <div className="space-y-2">
              <Label 
                className="text-xs uppercase tracking-wider"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                Mobile Number
              </Label>
              <div className="relative">
                <Phone 
                  size={14} 
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--color-text-tertiary)' }}
                />
                <Input 
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="pl-9"
                  type="tel"
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-primary)'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--color-primary)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--color-border-secondary)';
                  }}
                />
              </div>
            </div>

            {/* Opening Balance */}
            <div className="space-y-2">
              <Label 
                className="text-xs uppercase tracking-wider"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                 {isEdit ? 'Current Balance' : 'Opening Balance (Optional)'}
              </Label>
              <div className="relative">
                <Wallet 
                  size={14} 
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--color-text-tertiary)' }}
                />
                <Input 
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  placeholder="0.00"
                  type="number"
                  className="pl-9"
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-primary)'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--color-primary)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--color-border-secondary)';
                  }}
                />
              </div>
              <p 
                className="text-[10px]"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                Positive value = They owe you. Negative = You owe them.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div 
          className="p-5 border-t flex justify-end gap-3"
          style={{
            borderTopColor: 'var(--color-border-primary)',
            backgroundColor: 'var(--color-bg-tertiary)'
          }}
        >
          <Button 
            variant="ghost" 
            onClick={onClose}
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--color-text-secondary)';
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isLoading || !name.trim()}
            className="font-semibold min-w-[140px]"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-text-primary)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-primary)';
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-primary)';
              e.currentTarget.style.opacity = '1';
            }}
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