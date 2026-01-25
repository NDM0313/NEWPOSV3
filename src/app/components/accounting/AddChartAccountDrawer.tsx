import React, { useState, useEffect } from 'react';
import { X, Hash, FileText, Tags, Link2, Calculator, Shield, AlertCircle, Save } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Switch } from '@/app/components/ui/switch';
import { Badge } from '@/app/components/ui/badge';
import { cn } from '@/app/components/ui/utils';
import { toast } from 'sonner';
import { ChartAccount, AccountCategory, AccountModule } from '@/app/services/chartAccountService';
import * as Dialog from '@radix-ui/react-dialog';

// ============================================
// 🎯 SUB-CATEGORY OPTIONS
// ============================================

const subCategoryOptions: Record<AccountCategory, string[]> = {
  'Assets': [
    'Current Assets',
    'Non-Current Assets',
    'Fixed Assets',
    'Intangible Assets'
  ],
  'Liabilities': [
    'Current Liabilities',
    'Long Term Liabilities',
    'Deferred Liabilities'
  ],
  'Equity': [
    'Capital',
    'Retained Earnings',
    'Reserves'
  ],
  'Income': [
    'POS Sales',
    'Rental Income',
    'Studio Income',
    'Other Income',
    'Service Income'
  ],
  'Cost of Sales': [
    'POS COGS',
    'Rental Usage Cost',
    'Studio Production Cost'
  ],
  'Expenses': [
    'Admin Expenses',
    'POS Expenses',
    'Rental Expenses',
    'Studio Expenses',
    'HR Expenses',
    'Marketing Expenses',
    'Operating Expenses'
  ]
};

// ============================================
// 🎯 COMPONENT
// ============================================

interface AddChartAccountDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: ChartAccount | null;
  onSave?: (account: ChartAccount) => void;
  onClose: () => void;
  allAccounts?: ChartAccount[];
}

export const AddChartAccountDrawer = ({ 
  open, 
  onOpenChange, 
  account, 
  onClose, 
  onSave,
  allAccounts = []
}: AddChartAccountDrawerProps) => {
  // Form State
  const [accountCode, setAccountCode] = useState('');
  const [autoGenerateCode, setAutoGenerateCode] = useState(true);
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<AccountCategory>('Assets');
  const [subCategory, setSubCategory] = useState('');
  const [parentAccount, setParentAccount] = useState<string>('');
  const [selectedModules, setSelectedModules] = useState<AccountModule[]>(['General Accounting']);
  const [openingBalance, setOpeningBalance] = useState('0');
  const [nature, setNature] = useState<'Debit' | 'Credit'>('Debit');
  const [taxApplicable, setTaxApplicable] = useState(false);
  const [taxType, setTaxType] = useState('GST');
  const [active, setActive] = useState(true);
  const [showInReports, setShowInReports] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load account data if editing
  useEffect(() => {
    if (account) {
      setAccountCode(account.code);
      setAutoGenerateCode(false);
      setAccountName(account.name);
      setAccountType(account.category);
      setSubCategory(account.sub_category);
      setParentAccount(account.parent_account_id || 'none');
      setSelectedModules((account.modules as AccountModule[]) || ['General Accounting']);
      setOpeningBalance(account.opening_balance.toString());
      setNature(account.nature);
      setTaxApplicable(account.tax_applicable);
      setTaxType(account.tax_type || 'GST');
      setActive(account.active);
      setShowInReports(account.show_in_reports);
    } else {
      resetForm();
    }
    setErrors({});
  }, [account, open]);

  const resetForm = () => {
    setAccountCode('');
    setAutoGenerateCode(true);
    setAccountName('');
    setAccountType('Assets');
    setSubCategory('');
    setParentAccount('none');
    setSelectedModules(['General Accounting']);
    setOpeningBalance('0');
    setNature('Debit');
    setTaxApplicable(false);
    setTaxType('GST');
    setActive(true);
    setShowInReports(true);
  };

  // Auto-set nature based on account type
  useEffect(() => {
    if (accountType === 'Assets' || accountType === 'Expenses' || accountType === 'Cost of Sales') {
      setNature('Debit');
    } else {
      setNature('Credit');
    }
  }, [accountType]);

  // Auto-generate code
  useEffect(() => {
    if (autoGenerateCode && !account) {
      const prefix = {
        'Assets': '1',
        'Liabilities': '2',
        'Equity': '3',
        'Income': '4',
        'Cost of Sales': '5',
        'Expenses': '6'
      }[accountType];
      
      // Find next available code
      const existingCodes = allAccounts
        .filter(a => a.category === accountType)
        .map(a => parseInt(a.code.replace(/[^0-9]/g, '')))
        .filter(n => !isNaN(n));
      
      const maxCode = existingCodes.length > 0 ? Math.max(...existingCodes) : 0;
      const nextCode = maxCode + 1;
      setAccountCode(`${prefix}${String(nextCode).padStart(3, '0')}`);
    }
  }, [autoGenerateCode, accountType, account, allAccounts]);

  const toggleModule = (module: AccountModule) => {
    setSelectedModules(prev => 
      prev.includes(module) 
        ? prev.filter(m => m !== module)
        : [...prev, module]
    );
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!accountCode.trim()) {
      newErrors.accountCode = 'Account code is required';
    }

    if (!accountName.trim()) {
      newErrors.accountName = 'Account name is required';
    }

    if (!subCategory) {
      newErrors.subCategory = 'Sub-category is required';
    }

    if (selectedModules.length === 0) {
      newErrors.modules = 'At least one module must be selected';
    }

    const balance = parseFloat(openingBalance);
    if (isNaN(balance) || balance < 0) {
      newErrors.openingBalance = 'Opening balance must be a valid positive number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error('Validation failed', {
        description: 'Please fix the errors in the form',
      });
      return;
    }

    setLoading(true);

    try {
      const balance = parseFloat(openingBalance);

      const accountData: Partial<ChartAccount> = {
        code: accountCode,
        name: accountName,
        category: accountType,
        sub_category: subCategory,
        parent_account_id: parentAccount || null,
        modules: selectedModules,
        opening_balance: balance,
        current_balance: account?.current_balance ?? balance,
        nature,
        tax_applicable: taxApplicable,
        tax_type: taxApplicable ? taxType : null,
        active,
        show_in_reports: showInReports,
      };

      if (onSave) {
        const savedAccount: ChartAccount = {
          ...accountData,
          id: account?.id || '',
          created_at: account?.created_at || new Date().toISOString(),
          created_by: account?.created_by || null,
          updated_at: new Date().toISOString(),
          updated_by: null,
        } as ChartAccount;
        
        onSave(savedAccount);
      }

      toast.success(account ? 'Account updated successfully' : 'Account created successfully', {
        description: `${accountCode} - ${accountName}`,
      });

      setLoading(false);
      onClose();
      resetForm();
    } catch (error: any) {
      console.error('[ADD CHART ACCOUNT] Error:', error);
      toast.error('Failed to save account', {
        description: error.message || 'An error occurred',
      });
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" />
        <Dialog.Content className="fixed right-0 top-0 z-50 h-full w-full max-w-2xl bg-[#0B0F17] shadow-2xl flex flex-col border-l border-gray-800">
          
          {/* HEADER */}
          <div className="px-6 py-5 border-b border-gray-800 bg-[#111827] flex items-center justify-between">
            <div>
              <Dialog.Title className="text-lg font-bold text-white tracking-tight">
                {account ? 'Edit Account' : 'Add New Account'}
              </Dialog.Title>
              <Dialog.Description className="text-sm text-gray-400">
                {account ? 'Modify account details and settings' : 'Create a new account for Chart of Accounts'}
              </Dialog.Description>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose} 
              className="text-gray-400 hover:text-white hover:bg-gray-800"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* FORM CONTENT */}
          <div className="flex-1 p-6 space-y-6 overflow-y-auto">
            
            {/* ACCOUNT CODE */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  Account Code *
                </Label>
                {!account && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Auto Generate</span>
                    <Switch
                      checked={autoGenerateCode}
                      onCheckedChange={setAutoGenerateCode}
                      className="data-[state=checked]:bg-blue-600"
                    />
                  </div>
                )}
              </div>
              <Input
                value={accountCode}
                onChange={(e) => setAccountCode(e.target.value)}
                placeholder={autoGenerateCode ? "Auto-generated (e.g. 1001)" : "Enter code manually"}
                disabled={autoGenerateCode}
                className={cn(
                  "bg-gray-800 border-gray-700 text-white h-11 font-mono",
                  autoGenerateCode && "opacity-50 cursor-not-allowed",
                  errors.accountCode && "border-red-500"
                )}
              />
              {errors.accountCode && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.accountCode}
                </p>
              )}
            </div>

            {/* ACCOUNT NAME */}
            <div className="space-y-3">
              <Label className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Account Name *
                {account?.is_system && (
                  <Badge variant="outline" className="text-xs text-amber-400 border-amber-500/50 bg-amber-500/10 ml-2">
                    System Account
                  </Badge>
                )}
              </Label>
              <Input
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="e.g. Cash in Hand, Office Rent, etc."
                disabled={account?.is_system}
                className={cn(
                  "bg-gray-800 border-gray-700 text-white h-11",
                  errors.accountName && "border-red-500",
                  account?.is_system && "opacity-50 cursor-not-allowed"
                )}
              />
              {account?.is_system && (
                <p className="text-xs text-amber-400 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  System account name cannot be changed
                </p>
              )}
              {errors.accountName && !account?.is_system && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.accountName}
                </p>
              )}
            </div>

            {/* ACCOUNT TYPE & SUB-CATEGORY */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-2">
                  <Tags className="h-4 w-4" />
                  Account Type *
                </Label>
                <Select value={accountType} onValueChange={(value) => {
                  setAccountType(value as AccountCategory);
                  setSubCategory('');
                }}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    <SelectItem value="Assets">Assets</SelectItem>
                    <SelectItem value="Liabilities">Liabilities</SelectItem>
                    <SelectItem value="Equity">Equity</SelectItem>
                    <SelectItem value="Income">Income</SelectItem>
                    <SelectItem value="Cost of Sales">Cost of Sales</SelectItem>
                    <SelectItem value="Expenses">Expenses</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-xs text-gray-500 uppercase tracking-wider">Sub Category *</Label>
                <Select value={subCategory} onValueChange={setSubCategory}>
                  <SelectTrigger className={cn(
                    "bg-gray-800 border-gray-700 text-white h-11",
                    errors.subCategory && "border-red-500"
                  )}>
                    <SelectValue placeholder="Select sub-category" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    {subCategoryOptions[accountType].map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.subCategory && (
                  <p className="text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.subCategory}
                  </p>
                )}
              </div>
            </div>

            {/* PARENT ACCOUNT */}
            <div className="space-y-3">
              <Label className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Parent Account (Optional)
              </Label>
              <Select value={parentAccount || 'none'} onValueChange={(value) => setParentAccount(value === 'none' ? '' : value)}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white h-11">
                  <SelectValue placeholder="Select parent account (optional)" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 text-white">
                  <SelectItem value="none">None</SelectItem>
                  {allAccounts
                    .filter(a => a.category === accountType && a.id && a.id !== account?.id)
                    .map((acc) => (
                      <SelectItem key={acc.id} value={acc.id!}>
                        {acc.code} - {acc.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* MODULES */}
            <div className="space-y-3">
              <Label className="text-xs text-gray-500 uppercase tracking-wider">Modules *</Label>
              <div className="grid grid-cols-2 gap-2">
                {(['POS', 'Rental', 'Studio', 'General Accounting'] as AccountModule[]).map((module) => (
                  <button
                    key={module}
                    type="button"
                    onClick={() => toggleModule(module)}
                    className={cn(
                      "p-3 rounded-lg border text-sm transition-all",
                      selectedModules.includes(module)
                        ? "bg-blue-600/20 border-blue-500 text-blue-400"
                        : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
                    )}
                  >
                    {module}
                  </button>
                ))}
              </div>
              {errors.modules && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.modules}
                </p>
              )}
            </div>

            {/* OPENING BALANCE & NATURE */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  Opening Balance *
                </Label>
                <Input
                  type="number"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  placeholder="0.00"
                  className={cn(
                    "bg-gray-800 border-gray-700 text-white h-11",
                    errors.openingBalance && "border-red-500"
                  )}
                />
                {errors.openingBalance && (
                  <p className="text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.openingBalance}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <Label className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Nature
                </Label>
                <Select value={nature} onValueChange={(value) => setNature(value as 'Debit' | 'Credit')}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    <SelectItem value="Debit">Debit</SelectItem>
                    <SelectItem value="Credit">Credit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* TAX SETTINGS */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg border border-gray-700">
                <div>
                  <Label className="text-white font-medium">Tax Applicable</Label>
                  <p className="text-sm text-gray-400">Enable if this account is subject to tax</p>
                </div>
                <Switch
                  checked={taxApplicable}
                  onCheckedChange={setTaxApplicable}
                  className="data-[state=checked]:bg-blue-600"
                />
              </div>
              {taxApplicable && (
                <Select value={taxType} onValueChange={setTaxType}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    <SelectItem value="GST">GST</SelectItem>
                    <SelectItem value="VAT">VAT</SelectItem>
                    <SelectItem value="Sales Tax">Sales Tax</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* STATUS SETTINGS */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg border border-gray-700">
                <div>
                  <Label className="text-white font-medium">Active</Label>
                  <p className="text-sm text-gray-400">
                    {account?.is_system
                      ? 'System accounts are always active'
                      : 'Inactive accounts won\'t appear in transaction forms'}
                  </p>
                </div>
                <Switch
                  checked={active}
                  onCheckedChange={setActive}
                  disabled={account?.is_system}
                  className={cn(
                    "data-[state=checked]:bg-blue-600",
                    account?.is_system && "opacity-50 cursor-not-allowed"
                  )}
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg border border-gray-700">
                <div>
                  <Label className="text-white font-medium">Show in Reports</Label>
                  <p className="text-sm text-gray-400">Include this account in financial reports</p>
                </div>
                <Switch
                  checked={showInReports}
                  onCheckedChange={setShowInReports}
                  className="data-[state=checked]:bg-blue-600"
                />
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <div className="px-6 py-4 border-t border-gray-800 bg-[#111827] flex items-center justify-end gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-500 text-white"
            >
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Saving...' : account ? 'Update Account' : 'Create Account'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
