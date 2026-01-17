import React, { useState } from 'react';
import { X, Landmark, Wallet, Smartphone } from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";

interface AddAccountDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddAccountDrawer = ({ isOpen, onClose }: AddAccountDrawerProps) => {
  const [accountType, setAccountType] = useState("bank");
  const [isActive, setIsActive] = useState(true);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md h-full shadow-2xl flex flex-col border-l animate-in slide-in-from-right duration-300"
        style={{
          backgroundColor: 'var(--color-bg-panel)',
          borderLeftColor: 'var(--color-border-primary)'
        }}
      >
        
        {/* Header */}
        <div 
          className="px-6 py-5 border-b flex items-center justify-between"
          style={{
            borderBottomColor: 'var(--color-border-primary)',
            backgroundColor: 'var(--color-bg-primary)'
          }}
        >
          <div>
            <h2 
              className="text-lg font-bold tracking-tight"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Add New Account
            </h2>
            <p 
              className="text-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Create a financial account for tracking.
            </p>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-text-primary)';
              e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--color-text-secondary)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Form Content */}
        <div className="flex-1 p-6 space-y-6 overflow-y-auto">
           
           {/* Account Type Selection */}
           <div className="space-y-3">
              <Label 
                className="text-xs uppercase tracking-wider"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                Account Type
              </Label>
              <Select value={accountType} onValueChange={setAccountType}>
                <SelectTrigger 
                  className="h-12"
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-primary)'
                  }}
                >
                  <div className="flex items-center gap-2">
                     {accountType === 'bank' && <Landmark size={16} style={{ color: 'var(--color-primary)' }} />}
                     {accountType === 'cash' && <Wallet size={16} style={{ color: 'var(--color-success)' }} />}
                     {accountType === 'wallet' && <Smartphone size={16} style={{ color: 'var(--color-wholesale)' }} />}
                     <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-primary)'
                  }}
                >
                  <SelectItem value="bank">
                     <div className="flex items-center gap-2">
                       <Landmark size={16} style={{ color: 'var(--color-primary)' }} /> Bank Account
                     </div>
                  </SelectItem>
                  <SelectItem value="cash">
                     <div className="flex items-center gap-2">
                       <Wallet size={16} style={{ color: 'var(--color-success)' }} /> Cash Account
                     </div>
                  </SelectItem>
                  <SelectItem value="wallet">
                     <div className="flex items-center gap-2">
                       <Smartphone size={16} style={{ color: 'var(--color-wholesale)' }} /> Mobile Wallet
                     </div>
                  </SelectItem>
                </SelectContent>
              </Select>
           </div>

           {/* Account Title */}
           <div className="space-y-3">
              <Label 
                className="text-xs uppercase tracking-wider"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                Account Title
              </Label>
              <Input 
                placeholder={accountType === 'bank' ? "e.g. Meezan Bank Corporate" : "e.g. Shop Cash Drawer"}
                className="h-11"
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  borderColor: 'var(--color-border-secondary)',
                  color: 'var(--color-text-primary)'
                }}
              />
           </div>

           {/* Account Number / IBAN */}
           <div className="space-y-3">
              <Label 
                className="text-xs uppercase tracking-wider"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                 {accountType === 'bank' ? "IBAN / Account Number" : accountType === 'wallet' ? "Mobile Number" : "Reference ID"}
              </Label>
              <Input 
                placeholder={accountType === 'bank' ? "PK36MEZN..." : "0300..."}
                className="h-11 font-mono"
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  borderColor: 'var(--color-border-secondary)',
                  color: 'var(--color-text-primary)'
                }}
              />
           </div>

           {/* Opening Balance */}
           <div className="space-y-3">
              <Label 
                className="text-xs uppercase tracking-wider"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                Opening Balance
              </Label>
              <div className="relative">
                 <span 
                   className="absolute left-3 top-1/2 -translate-y-1/2 font-bold"
                   style={{ color: 'var(--color-text-tertiary)' }}
                 >
                   $
                 </span>
                 <Input 
                   type="number"
                   placeholder="0.00"
                   className="h-11 pl-8 text-lg font-semibold"
                   style={{
                     backgroundColor: 'var(--color-bg-card)',
                     borderColor: 'var(--color-border-secondary)',
                     color: 'var(--color-text-primary)'
                   }}
                 />
              </div>
           </div>

           {/* Status Toggle */}
           <div 
             className="flex items-center justify-between border p-4 rounded-lg"
             style={{
               backgroundColor: 'var(--color-bg-card)',
               borderColor: 'var(--color-border-primary)',
               borderRadius: 'var(--radius-lg)'
             }}
           >
              <div className="space-y-0.5">
                 <Label 
                   className="text-base"
                   style={{ color: 'var(--color-text-primary)' }}
                 >
                   Active Status
                 </Label>
                 <p 
                   className="text-xs"
                   style={{ color: 'var(--color-text-tertiary)' }}
                 >
                   Enable or disable transactions for this account.
                 </p>
              </div>
              <Switch 
                checked={isActive} 
                onCheckedChange={setIsActive}
              />
           </div>

        </div>

        {/* Footer */}
        <div 
          className="p-6 border-t space-y-3"
          style={{
            borderTopColor: 'var(--color-border-primary)',
            backgroundColor: 'var(--color-bg-primary)'
          }}
        >
           <Button 
             className="w-full h-12 text-base font-semibold"
             style={{
               backgroundColor: 'var(--color-primary)',
               color: 'var(--color-text-primary)',
               boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.2)'
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
             Create Account
           </Button>
           <Button 
             variant="outline" 
             onClick={onClose} 
             className="w-full h-12"
             style={{
               borderColor: 'var(--color-border-secondary)',
               color: 'var(--color-text-secondary)'
             }}
             onMouseEnter={(e) => {
               e.currentTarget.style.color = 'var(--color-text-primary)';
               e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
             }}
             onMouseLeave={(e) => {
               e.currentTarget.style.color = 'var(--color-text-secondary)';
               e.currentTarget.style.backgroundColor = 'transparent';
             }}
           >
             Cancel
           </Button>
        </div>

      </div>
    </div>
  );
};
