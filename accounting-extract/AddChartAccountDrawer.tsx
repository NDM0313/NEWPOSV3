import React, { useState, useEffect } from 'react';
import { X, DollarSign, Hash, FileText, Tags, Link2, Calculator, Shield, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Switch } from '@/app/components/ui/switch';
import { Badge } from '@/app/components/ui/badge';
import { cn } from '@/app/components/ui/utils';
import { toast } from 'sonner';

// ============================================
// 🎯 TYPES
// ============================================

type AccountCategory = 'Assets' | 'Liabilities' | 'Equity' | 'Income' | 'Cost of Sales' | 'Expenses';
type AccountNature = 'Debit' | 'Credit';
type AccountModule = 'POS' | 'Rental' | 'Studio' | 'General Accounting' | 'All';

interface ChartAccount {
  id: string;
  code: string;
  name: string;
  category: AccountCategory;
  subCategory: string;
  parentAccount?: string;
  module: AccountModule[];
  openingBalance: number;
  currentBalance: number;
  nature: AccountNature;
  taxApplicable: boolean;
  taxType?: string;
  active: boolean;
  showInReports: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

interface AddChartAccountDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: ChartAccount | null;
  onClose: () => void;
  onSave?: (account: ChartAccount) => void;
}

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
// 🎯 MAIN COMPONENT
// ============================================

export const AddChartAccountDrawer = ({ open, onOpenChange, account, onClose, onSave }: AddChartAccountDrawerProps) => {
  // Form State
  const [accountCode, setAccountCode] = useState('');
  const [autoGenerateCode, setAutoGenerateCode] = useState(true);
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<AccountCategory>('Assets');
  const [subCategory, setSubCategory] = useState('');
  const [parentAccount, setParentAccount] = useState('');
  const [selectedModules, setSelectedModules] = useState<AccountModule[]>(['General Accounting']);
  const [openingBalance, setOpeningBalance] = useState('0');
  const [nature, setNature] = useState<AccountNature>('Debit');
  const [taxApplicable, setTaxApplicable] = useState(false);
  const [taxType, setTaxType] = useState('GST');
  const [active, setActive] = useState(true);
  const [showInReports, setShowInReports] = useState(true);
  const [loading, setLoading] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load account data if editing
  useEffect(() => {
    if (account) {
      setAccountCode(account.code);
      setAutoGenerateCode(false);
      setAccountName(account.name);
      setAccountType(account.category);
      setSubCategory(account.subCategory);
      setParentAccount(account.parentAccount || '');
      setSelectedModules(account.module);
      setOpeningBalance(account.openingBalance.toString());
      setNature(account.nature);
      setTaxApplicable(account.taxApplicable);
      setTaxType(account.taxType || 'GST');
      setActive(account.active);
      setShowInReports(account.showInReports);
    } else {
      // Reset form for new account
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
    setParentAccount('');
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
      const random = Math.floor(Math.random() * 900) + 100;
      setAccountCode(`${prefix}${random}`);
    }
  }, [autoGenerateCode, accountType, account]);

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

  const handleSubmit = () => {
    if (!validateForm()) {
      toast.error('Validation failed', {
        description: 'Please fix the errors in the form',
      });
      return;
    }

    setLoading(true);

    // Simulate API call
    setTimeout(() => {
      const now = new Date().toISOString();
      const balance = parseFloat(openingBalance);

      const newAccount: ChartAccount = {
        id: account?.id || Date.now().toString(),
        code: accountCode,
        name: accountName,
        category: accountType,
        subCategory,
        parentAccount: parentAccount || undefined,
        module: selectedModules,
        openingBalance: balance,
        currentBalance: account?.currentBalance ?? balance,
        nature,
        taxApplicable,
        taxType: taxApplicable ? taxType : undefined,
        active,
        showInReports,
        createdAt: account?.createdAt || now,
        createdBy: account?.createdBy || 'Admin',
        updatedAt: now,
        updatedBy: 'Admin',
      };

      if (onSave) {
        onSave(newAccount);
      }

      toast.success(account ? 'Account updated successfully' : 'Account created successfully', {
        description: `${accountCode} - ${accountName}`,
      });

      setLoading(false);
      onClose();
      resetForm();
    }, 500);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#0B0F17] h-full shadow-2xl flex flex-col border-l border-gray-800 animate-in slide-in-from-right duration-300">
        
        {/* ============================================ */}
        {/* 🎯 HEADER */}
        {/* ============================================ */}
        <div className="px-6 py-5 border-b border-gray-800 bg-[#111827] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              {account ? 'Edit Account' : 'Add New Account'}
            </h2>
            <p className="text-sm text-gray-400">
              {account ? 'Modify account details and settings' : 'Create a new account for Chart of Accounts'}
            </p>
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

        {/* ============================================ */}
        {/* 🎯 FORM CONTENT */}
        {/* ============================================ */}
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
            </Label>
            <Input
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="e.g. Cash in Hand, Office Rent, etc."
              className={cn(
                "bg-gray-800 border-gray-700 text-white h-11",
                errors.accountName && "border-red-500"
              )}
            />
            {errors.accountName && (
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
                setSubCategory(''); // Reset subcategory when type changes
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

          {/* PARENT ACCOUNT (OPTIONAL) */}
          <div className="space-y-3">
            <Label className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Parent Account <span className="text-gray-600">(Optional)</span>
            </Label>
            <Select value={parentAccount || 'none'} onValueChange={(value) => setParentAccount(value === 'none' ? '' : value)}>
              <SelectTrigger className="bg-gray-800 border-gray-700 text-white h-11">
                <SelectValue placeholder="None (Top Level Account)" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700 text-white">
                <SelectItem value="none">None (Top Level Account)</SelectItem>
                <SelectItem value="1000">1000 - Current Assets</SelectItem>
                <SelectItem value="2000">2000 - Current Liabilities</SelectItem>
                <SelectItem value="4000">4000 - Sales Revenue</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* MODULE LINKS */}
          <div className="space-y-3">
            <Label className="text-xs text-gray-500 uppercase tracking-wider">Module Links *</Label>
            <div className="flex flex-wrap gap-2">
              {(['POS', 'Rental', 'Studio', 'General Accounting'] as AccountModule[]).map((module) => (
                <Badge
                  key={module}
                  variant={selectedModules.includes(module) ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer transition-all px-3 py-1.5",
                    selectedModules.includes(module)
                      ? "bg-blue-600 text-white hover:bg-blue-500"
                      : "text-gray-400 hover:text-white hover:bg-gray-800 border-gray-700"
                  )}
                  onClick={() => toggleModule(module)}
                >
                  {module}
                </Badge>
              ))}
            </div>
            {errors.modules && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.modules}
              </p>
            )}
          </div>

          {/* FINANCIAL SETTINGS */}
          <div className="border-t border-gray-800 pt-6">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Calculator className="h-4 w-4 text-blue-400" />
              Financial Settings
            </h3>

            <div className="grid grid-cols-2 gap-4">
              {/* Opening Balance */}
              <div className="space-y-3">
                <Label className="text-xs text-gray-500 uppercase tracking-wider">Opening Balance *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">Rs.</span>
                  <Input
                    type="number"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(e.target.value)}
                    placeholder="0.00"
                    className={cn(
                      "bg-gray-800 border-gray-700 text-white h-11 pl-12 text-lg font-semibold",
                      errors.openingBalance && "border-red-500"
                    )}
                  />
                </div>
                {errors.openingBalance && (
                  <p className="text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.openingBalance}
                  </p>
                )}
              </div>

              {/* Debit/Credit Nature */}
              <div className="space-y-3">
                <Label className="text-xs text-gray-500 uppercase tracking-wider">Debit / Credit Nature</Label>
                <Select value={nature} onValueChange={(value) => setNature(value as AccountNature)}>
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
          </div>

          {/* TAX SETTINGS */}
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-gray-900 border border-gray-800 p-4 rounded-lg">
              <div className="space-y-0.5">
                <Label className="text-base text-white flex items-center gap-2">
                  <Shield className="h-4 w-4 text-green-400" />
                  Tax Applicable
                </Label>
                <p className="text-xs text-gray-500">Enable if this account is subject to tax.</p>
              </div>
              <Switch
                checked={taxApplicable}
                onCheckedChange={setTaxApplicable}
                className="data-[state=checked]:bg-green-600"
              />
            </div>

            {taxApplicable && (
              <div className="space-y-3 pl-4 border-l-2 border-green-500/30">
                <Label className="text-xs text-gray-500 uppercase tracking-wider">Tax Type</Label>
                <Select value={taxType} onValueChange={setTaxType}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    <SelectItem value="GST">GST (Goods and Services Tax)</SelectItem>
                    <SelectItem value="Sales Tax">Sales Tax</SelectItem>
                    <SelectItem value="VAT">VAT (Value Added Tax)</SelectItem>
                    <SelectItem value="Income Tax">Income Tax</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* STATUS SETTINGS */}
          <div className="border-t border-gray-800 pt-6 space-y-4">
            <h3 className="text-sm font-semibold text-white mb-4">Status Settings</h3>

            <div className="flex items-center justify-between bg-gray-900 border border-gray-800 p-4 rounded-lg">
              <div className="space-y-0.5">
                <Label className="text-base text-white">Active Status</Label>
                <p className="text-xs text-gray-500">Enable or disable transactions for this account.</p>
              </div>
              <Switch
                checked={active}
                onCheckedChange={setActive}
                className="data-[state=checked]:bg-green-600"
              />
            </div>

            <div className="flex items-center justify-between bg-gray-900 border border-gray-800 p-4 rounded-lg">
              <div className="space-y-0.5">
                <Label className="text-base text-white flex items-center gap-2">
                  {showInReports ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  Show in Reports
                </Label>
                <p className="text-xs text-gray-500">Display this account in financial reports.</p>
              </div>
              <Switch
                checked={showInReports}
                onCheckedChange={setShowInReports}
                className="data-[state=checked]:bg-blue-600"
              />
            </div>
          </div>

        </div>

        {/* ============================================ */}
        {/* 🎯 FOOTER */}
        {/* ============================================ */}
        <div className="p-6 border-t border-gray-800 bg-[#111827] space-y-3">
          <Button 
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white h-12 text-base font-semibold shadow-lg shadow-blue-600/20"
          >
            {loading ? 'Saving...' : (account ? 'Update Account' : 'Create Account')}
          </Button>
          <Button 
            variant="outline" 
            onClick={onClose} 
            disabled={loading}
            className="w-full border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800 h-12"
          >
            Cancel
          </Button>
        </div>

      </div>
    </div>
  );
};