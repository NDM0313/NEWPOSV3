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
      <div className="w-full max-w-md bg-[#0B0F17] h-full shadow-2xl flex flex-col border-l border-gray-800 animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-800 bg-[#111827] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Add New Account</h2>
            <p className="text-sm text-gray-400">Create a financial account for tracking.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-400 hover:text-white hover:bg-gray-800">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Form Content */}
        <div className="flex-1 p-6 space-y-6 overflow-y-auto">
           
           {/* Account Type Selection */}
           <div className="space-y-3">
              <Label className="text-xs text-gray-500 uppercase tracking-wider">Account Type</Label>
              <Select value={accountType} onValueChange={setAccountType}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white h-12">
                  <div className="flex items-center gap-2">
                     {accountType === 'bank' && <Landmark size={16} className="text-blue-400" />}
                     {accountType === 'cash' && <Wallet size={16} className="text-green-400" />}
                     {accountType === 'wallet' && <Smartphone size={16} className="text-purple-400" />}
                     <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 text-white">
                  <SelectItem value="bank">
                     <div className="flex items-center gap-2"><Landmark size={16} className="text-blue-400" /> Bank Account</div>
                  </SelectItem>
                  <SelectItem value="cash">
                     <div className="flex items-center gap-2"><Wallet size={16} className="text-green-400" /> Cash Account</div>
                  </SelectItem>
                  <SelectItem value="wallet">
                     <div className="flex items-center gap-2"><Smartphone size={16} className="text-purple-400" /> Mobile Wallet</div>
                  </SelectItem>
                </SelectContent>
              </Select>
           </div>

           {/* Account Title */}
           <div className="space-y-3">
              <Label className="text-xs text-gray-500 uppercase tracking-wider">Account Title</Label>
              <Input 
                placeholder={accountType === 'bank' ? "e.g. Meezan Bank Corporate" : "e.g. Shop Cash Drawer"}
                className="bg-gray-800 border-gray-700 text-white h-11"
              />
           </div>

           {/* Account Number / IBAN */}
           <div className="space-y-3">
              <Label className="text-xs text-gray-500 uppercase tracking-wider">
                 {accountType === 'bank' ? "IBAN / Account Number" : accountType === 'wallet' ? "Mobile Number" : "Reference ID"}
              </Label>
              <Input 
                placeholder={accountType === 'bank' ? "PK36MEZN..." : "0300..."}
                className="bg-gray-800 border-gray-700 text-white h-11 font-mono"
              />
           </div>

           {/* Opening Balance */}
           <div className="space-y-3">
              <Label className="text-xs text-gray-500 uppercase tracking-wider">Opening Balance</Label>
              <div className="relative">
                 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                 <Input 
                   type="number"
                   placeholder="0.00"
                   className="bg-gray-800 border-gray-700 text-white h-11 pl-8 text-lg font-semibold"
                 />
              </div>
           </div>

           {/* Status Toggle */}
           <div className="flex items-center justify-between bg-gray-900 border border-gray-800 p-4 rounded-lg">
              <div className="space-y-0.5">
                 <Label className="text-base text-white">Active Status</Label>
                 <p className="text-xs text-gray-500">Enable or disable transactions for this account.</p>
              </div>
              <Switch 
                checked={isActive} 
                onCheckedChange={setIsActive}
                className="data-[state=checked]:bg-green-600"
              />
           </div>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-800 bg-[#111827] space-y-3">
           <Button className="w-full bg-blue-600 hover:bg-blue-500 text-white h-12 text-base font-semibold shadow-lg shadow-blue-600/20">
             Create Account
           </Button>
           <Button variant="outline" onClick={onClose} className="w-full border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800 h-12">
             Cancel
           </Button>
        </div>

      </div>
    </div>
  );
};
