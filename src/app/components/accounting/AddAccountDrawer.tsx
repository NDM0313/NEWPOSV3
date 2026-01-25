import React, { useState } from 'react';
import { X, Landmark, Wallet, Smartphone } from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { accountService } from '@/app/services/accountService';
import { useSupabase } from '@/app/context/SupabaseContext';
import { toast } from 'sonner';

interface AddAccountDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AddAccountDrawer = ({ isOpen, onClose, onSuccess }: AddAccountDrawerProps) => {
  const { companyId, branchId } = useSupabase();
  const [accountType, setAccountType] = useState<"Cash" | "Bank" | "Mobile Wallet">("Bank");
  const [accountCategory, setAccountCategory] = useState("Asset");
  const [accountName, setAccountName] = useState("");
  const [accountCode, setAccountCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [openingBalance, setOpeningBalance] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [isDefaultCash, setIsDefaultCash] = useState(false);
  const [isDefaultBank, setIsDefaultBank] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) {
      toast.error('Company ID is required');
      return;
    }

    if (!accountName.trim()) {
      toast.error('Account name is required');
      return;
    }

    setIsSaving(true);
    try {
      // CRITICAL FIX: Remove non-existent fields (account_type, is_default_cash, is_default_bank)
      // These fields don't exist in the actual accounts table schema
      // Default account selection is handled by defaultAccountsService using account codes
      
      // Create account (only fields that exist in actual schema)
      await accountService.createAccount({
        company_id: companyId,
        name: accountName,
        code: accountCode || undefined,
        type: accountType, // Use accountType (Cash/Bank/Mobile Wallet) as type
        balance: openingBalance,
        is_active: isActive,
        // DO NOT include: account_type, branch_id, is_default_cash, is_default_bank
        // These fields don't exist in the actual schema
      });

      toast.success('Account created successfully');
      
      // Reset form
      setAccountName("");
      setAccountCode("");
      setAccountNumber("");
      setOpeningBalance(0);
      setIsActive(true);
      setIsDefaultCash(false);
      setIsDefaultBank(false);
      
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('[ADD ACCOUNT] Error creating account:', error);
      toast.error(`Failed to create account: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

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
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <div className="flex-1 p-6 space-y-6 overflow-y-auto">
             {/* Account Type Selection */}
             <div className="space-y-3">
                <Label className="text-xs text-gray-500 uppercase tracking-wider">Account Type *</Label>
                <Select value={accountType} onValueChange={(value: "Cash" | "Bank" | "Mobile Wallet") => {
                  setAccountType(value);
                  setIsDefaultCash(false);
                  setIsDefaultBank(false);
                }}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white h-12">
                    <div className="flex items-center gap-2">
                       {accountType === 'Bank' && <Landmark size={16} className="text-blue-400" />}
                       {accountType === 'Cash' && <Wallet size={16} className="text-green-400" />}
                       {accountType === 'Mobile Wallet' && <Smartphone size={16} className="text-purple-400" />}
                       <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    <SelectItem value="Bank">
                       <div className="flex items-center gap-2"><Landmark size={16} className="text-blue-400" /> Bank Account</div>
                    </SelectItem>
                    <SelectItem value="Cash">
                       <div className="flex items-center gap-2"><Wallet size={16} className="text-green-400" /> Cash Account</div>
                    </SelectItem>
                    <SelectItem value="Mobile Wallet">
                       <div className="flex items-center gap-2"><Smartphone size={16} className="text-purple-400" /> Mobile Wallet</div>
                    </SelectItem>
                  </SelectContent>
                </Select>
             </div>

             {/* Account Category */}
             <div className="space-y-3">
                <Label className="text-xs text-gray-500 uppercase tracking-wider">Category *</Label>
                <Select value={accountCategory} onValueChange={setAccountCategory}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    <SelectItem value="Asset">Asset</SelectItem>
                    <SelectItem value="Liability">Liability</SelectItem>
                    <SelectItem value="Expense">Expense</SelectItem>
                    <SelectItem value="Revenue">Revenue</SelectItem>
                  </SelectContent>
                </Select>
             </div>

             {/* Account Name */}
             <div className="space-y-3">
                <Label className="text-xs text-gray-500 uppercase tracking-wider">Account Name *</Label>
                <Input 
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder={accountType === 'Bank' ? "e.g. Meezan Bank Corporate" : accountType === 'Cash' ? "e.g. Shop Cash Drawer" : "e.g. JazzCash"}
                  className="bg-gray-800 border-gray-700 text-white h-11"
                  required
                />
             </div>

             {/* Account Code */}
             <div className="space-y-3">
                <Label className="text-xs text-gray-500 uppercase tracking-wider">Account Code</Label>
                <Input 
                  value={accountCode}
                  onChange={(e) => setAccountCode(e.target.value)}
                  placeholder="e.g. CASH-001"
                  className="bg-gray-800 border-gray-700 text-white h-11"
                />
             </div>

             {/* Account Number / IBAN */}
             <div className="space-y-3">
                <Label className="text-xs text-gray-500 uppercase tracking-wider">
                   {accountType === 'Bank' ? "IBAN / Account Number" : accountType === 'Mobile Wallet' ? "Mobile Number" : "Reference ID"}
                </Label>
                <Input 
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder={accountType === 'Bank' ? "PK36MEZN..." : "0300..."}
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
                     value={openingBalance}
                     onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
                     placeholder="0.00"
                     step="0.01"
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

             {/* Default Account Toggles */}
             {accountType === 'Cash' && (
               <div className="flex items-center justify-between bg-gray-900 border border-gray-800 p-4 rounded-lg">
                 <div className="space-y-0.5">
                   <Label className="text-base text-white">Default Cash Account</Label>
                   <p className="text-xs text-gray-500">Use as default for cash payments.</p>
                 </div>
                 <Switch 
                   checked={isDefaultCash} 
                   onCheckedChange={setIsDefaultCash}
                   className="data-[state=checked]:bg-green-600"
                 />
               </div>
             )}

             {accountType === 'Bank' && (
               <div className="flex items-center justify-between bg-gray-900 border border-gray-800 p-4 rounded-lg">
                 <div className="space-y-0.5">
                   <Label className="text-base text-white">Default Bank Account</Label>
                   <p className="text-xs text-gray-500">Use as default for bank payments.</p>
                 </div>
                 <Switch 
                   checked={isDefaultBank} 
                   onCheckedChange={setIsDefaultBank}
                   className="data-[state=checked]:bg-green-600"
                 />
               </div>
             )}

          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-800 bg-[#111827] space-y-3 shrink-0">
             <Button 
               type="submit" 
               disabled={isSaving}
               className="w-full bg-blue-600 hover:bg-blue-500 text-white h-12 text-base font-semibold shadow-lg shadow-blue-600/20 disabled:opacity-50"
             >
               {isSaving ? 'Creating...' : 'Create Account'}
             </Button>
             <Button 
               type="button"
               variant="outline" 
               onClick={onClose} 
               className="w-full border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800 h-12"
             >
               Cancel
             </Button>
          </div>
        </form>

      </div>
    </div>
  );
};
