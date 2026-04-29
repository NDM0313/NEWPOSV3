/**
 * Create Business Wizard — Multi-step onboarding
 * Steps: Business Info → Financial → Inventory → Modules → Branch Setup
 */

import React, { useState, useMemo } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Building2,
  User,
  Mail,
  Lock,
  AlertCircle,
  Loader2,
  DollarSign,
  Package,
  Layers,
  Settings,
  ChevronRight,
  ChevronLeft,
  Check,
  ShoppingCart,
  Truck,
  Shirt,
  Store,
  Camera,
  BookOpen,
  Receipt,
  BarChart3,
  MapPin,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { businessService } from '@/app/services/businessService';

const CURRENCIES = [
  { code: 'PKR', label: 'PKR (Pakistani Rupee)' },
  { code: 'USD', label: 'USD (US Dollar)' },
  { code: 'EUR', label: 'EUR (Euro)' },
  { code: 'GBP', label: 'GBP (British Pound)' },
  { code: 'AED', label: 'AED (UAE Dirham)' },
  { code: 'SAR', label: 'SAR (Saudi Riyal)' },
];

const BUSINESS_TYPES = [
  { value: 'retail', label: 'Retail' },
  { value: 'rental', label: 'Rental' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'mixed', label: 'Mixed' },
];

/** Default modules per business type (wizard module ids). User can change in Step 4. */
const BUSINESS_TYPE_MODULES: Record<string, string[]> = {
  retail: ['sales', 'pos', 'accounting', 'reports'],
  wholesale: ['sales', 'purchases', 'accounting', 'reports'],
  manufacturing: ['purchases', 'studio', 'sales', 'accounting', 'reports'],
  rental: ['rentals', 'sales', 'accounting', 'reports'],
  mixed: ['sales', 'purchases', 'rentals', 'pos', 'studio', 'accounting', 'expenses', 'payroll', 'reports'],
};

const FISCAL_MONTHS = [
  { value: '1', label: 'January' },
  { value: '4', label: 'April' },
  { value: '7', label: 'July' },
  { value: '10', label: 'October' },
];

const COSTING_METHODS = [
  { value: 'FIFO', label: 'FIFO (First In First Out)' },
  { value: 'Weighted Average', label: 'Weighted Average' },
];

const MODULES: { id: string; label: string; description: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: 'sales', label: 'Sales', description: 'Create invoices and manage customers', icon: ShoppingCart },
  { id: 'purchases', label: 'Purchases', description: 'Track supplier purchases', icon: Truck },
  { id: 'rentals', label: 'Rentals', description: 'Manage rental bookings and returns', icon: Shirt },
  { id: 'pos', label: 'POS', description: 'Point of sale and quick checkout', icon: Store },
  { id: 'studio', label: 'Studio Production', description: 'Orders and production stages', icon: Camera },
  { id: 'accounting', label: 'Accounting', description: 'Financial reporting and ledgers', icon: BookOpen },
  { id: 'expenses', label: 'Expenses', description: 'Record and track expenses', icon: Receipt },
  { id: 'payroll', label: 'Payroll', description: 'Worker payments (future)', icon: User },
  { id: 'reports', label: 'Reports', description: 'Analytics and reports', icon: BarChart3 },
];

const BASE_UNITS = [
  { value: 'pcs', label: 'Piece (pcs)' },
  { value: 'meter', label: 'Meter (m)' },
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'liter', label: 'Liter (L)' },
];

function getFiscalYearStartFromMonth(monthValue: string): string {
  const month = parseInt(monthValue, 10) || 7;
  const now = new Date();
  const year = now.getMonth() + 1 >= month ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

function getDefaultFiscalYearStart(): string {
  return getFiscalYearStartFromMonth('7');
}

interface CreateBusinessWizardProps {
  onSuccess: (email: string, password: string) => void;
  onCancel: () => void;
}

export const CreateBusinessWizard: React.FC<CreateBusinessWizardProps> = ({ onSuccess, onCancel }) => {
  const defaultFiscalStart = useMemo(() => getDefaultFiscalYearStart(), []);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    // Step 1
    businessName: '',
    businessType: 'mixed',
    logoUrl: '',
    phone: '',
    email: '',
    address: '',
    country: 'Pakistan',
    timezone: 'Asia/Karachi',
    ownerName: '',
    password: '',
    confirmPassword: '',
    // Step 2
    currency: 'PKR',
    fiscalYearStart: defaultFiscalStart,
    fiscalMonth: '7',
    accountingMethod: 'Accrual' as 'Accrual' | 'Cash',
    taxMode: 'Inclusive' as 'Inclusive' | 'Exclusive',
    defaultTaxRate: 0,
    enableMultiBranch: false,
    // Step 3
    costingMethod: 'FIFO',
    allowNegativeStock: false,
    defaultUnit: 'pcs',
    baseUnits: ['pcs'] as string[],
    // Step 4 (default from mixed template; synced when businessType changes)
    modules: [...BUSINESS_TYPE_MODULES.mixed] as string[],
    // Step 5
    branchName: 'Main Branch',
    branchCode: 'HQ',
    defaultWarehouse: 'Main',
  });

  const validateStep = (s: number): string | null => {
    if (s === 1) {
      if (!formData.businessName.trim()) return 'Business name is required';
      if (!formData.ownerName.trim()) return 'Owner name is required';
      if (!formData.email.trim()) return 'Email is required';
      if (formData.password.length < 6) return 'Password must be at least 6 characters';
      if (formData.password !== formData.confirmPassword) return 'Passwords do not match';
    }
    if (s === 2) {
      if (!formData.currency) return 'Currency is required';
      if (!formData.fiscalMonth) return 'Financial year start month is required';
    }
    if (s === 4) {
      if (formData.modules.length === 0) return 'At least one module is required';
    }
    if (s === 5) {
      if (!formData.branchName.trim()) return 'Branch name is required';
      if (!formData.branchCode.trim()) return 'Branch code is required';
    }
    return null;
  };

  const totalSteps = 5;
  const canGoNext = step < totalSteps;
  const canPrev = step > 1;
  const stepError = validateStep(step);
  const isStepValid = !stepError;
  const canProceed = canGoNext ? isStepValid : isStepValid;

  const handleNext = () => {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError('');
    setStep((p) => Math.min(p + 1, totalSteps));
  };

  const handlePrev = () => {
    setError('');
    setStep((p) => Math.max(p - 1, 1));
  };

  const toggleModule = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      modules: prev.modules.includes(id)
        ? prev.modules.filter((m) => m !== id)
        : [...prev.modules, id],
    }));
  };

  const handleSubmit = async () => {
    const err = validateStep(5);
    if (err) {
      setError(err);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const fiscalYearStart = getFiscalYearStartFromMonth(formData.fiscalMonth);
      const result = await businessService.createBusiness({
        businessName: formData.businessName,
        ownerName: formData.ownerName,
        email: formData.email,
        password: formData.password,
        currency: formData.currency,
        fiscalYearStart,
        branchName: formData.branchName,
        branchCode: formData.branchCode,
        phone: formData.phone || undefined,
        address: formData.address || undefined,
        country: formData.country || undefined,
        timezone: formData.timezone || undefined,
        businessType: formData.businessType,
        modules: formData.modules,
        accountingMethod: formData.accountingMethod,
        taxMode: formData.taxMode,
        defaultTaxRate: formData.defaultTaxRate,
        costingMethod: formData.costingMethod as 'FIFO' | 'Weighted Average',
        allowNegativeStock: formData.allowNegativeStock,
        defaultUnit: formData.defaultUnit,
        baseUnits: formData.baseUnits,
      });
      if (!result.success) throw new Error(result.error || 'Failed to create business');
      onSuccess(formData.email, formData.password);
    } catch (err: any) {
      setError(err.message || 'Failed to create business. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const steps: { n: number; title: string; description: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
    { n: 1, title: 'Business Information', description: 'Company profile and owner details', icon: Building2 },
    { n: 2, title: 'Financial Settings', description: 'Currency, fiscal year, and tax', icon: DollarSign },
    { n: 3, title: 'Inventory Settings', description: 'Costing and units', icon: Package },
    { n: 4, title: 'Module Selection', description: 'Choose modules to enable', icon: Layers },
    { n: 5, title: 'Branch Setup', description: 'First branch and system setup', icon: Settings },
  ];

  const currentStepInfo = steps.find((s) => s.n === step);

  return (
    <div className="min-h-screen bg-[#111827] flex items-center justify-center p-8">
      <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">Create Business</h1>
          <p className="text-gray-400 text-sm md:text-base">Set up your company profile and system settings.</p>
          <p className="text-gray-500 text-sm mt-1">Step {step} of {totalSteps}</p>
          <div className="flex justify-center gap-2 mt-4">
            {steps.map((s) => (
              <div
                key={s.n}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${step >= s.n ? 'bg-blue-500' : 'bg-gray-600'}`}
              />
            ))}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 space-y-6">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2 text-red-400">
              <AlertCircle size={20} />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Step header with icon and description */}
          {currentStepInfo && (() => {
            const StepIcon = currentStepInfo.icon;
            return (
              <div className="flex items-start gap-4 pb-4 border-b border-gray-800">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <StepIcon size={24} className="text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">{currentStepInfo.title}</h2>
                  <p className="text-sm text-gray-400 mt-0.5">{currentStepInfo.description}</p>
                </div>
              </div>
            );
          })()}

          {/* Step 1: Business Information */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-4">Business Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-gray-400">Business Name *</Label>
                    <div className="relative mt-1">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                      <Input
                        value={formData.businessName}
                        onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                        placeholder="Din Collection"
                        className="pl-10 bg-gray-800 border-gray-700 text-white"
                        disabled={loading}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-gray-400">Business Type</Label>
                    <Select
                      value={formData.businessType}
                      onValueChange={(v) => {
                        const templateModules = BUSINESS_TYPE_MODULES[v] ?? BUSINESS_TYPE_MODULES.mixed;
                        setFormData({ ...formData, businessType: v, modules: [...templateModules] });
                      }}
                    >
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BUSINESS_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-gray-400">Phone</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+92 300 1234567"
                      className="bg-gray-800 border-gray-700 text-white mt-1"
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <Label className="text-gray-400">Email *</Label>
                    <div className="relative mt-1">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="owner@business.com"
                        className="pl-10 bg-gray-800 border-gray-700 text-white"
                        disabled={loading}
                      />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-gray-400">Address</Label>
                    <div className="relative mt-1">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                      <Input
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        placeholder="Street, City, Country"
                        className="pl-10 bg-gray-800 border-gray-700 text-white"
                        disabled={loading}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-gray-400">Owner Name *</Label>
                    <div className="relative mt-1">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                      <Input
                        value={formData.ownerName}
                        onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                        placeholder="John Doe"
                        className="pl-10 bg-gray-800 border-gray-700 text-white"
                        disabled={loading}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-gray-400">Password *</Label>
                    <div className="relative mt-1">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                      <Input
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="••••••••"
                        className="pl-10 bg-gray-800 border-gray-700 text-white"
                        disabled={loading}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-gray-400">Confirm Password *</Label>
                    <div className="relative mt-1">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                      <Input
                        type="password"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        placeholder="••••••••"
                        className="pl-10 bg-gray-800 border-gray-700 text-white"
                        disabled={loading}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Financial Settings */}
          {step === 2 && (
            <div className="space-y-6">
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">Financial Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-gray-400">Currency *</Label>
                  <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v })}>
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-gray-400">Financial Year Start *</Label>
                  <Select
                    value={formData.fiscalMonth}
                    onValueChange={(v) => setFormData({ ...formData, fiscalMonth: v, fiscalYearStart: getFiscalYearStartFromMonth(v) })}
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      {FISCAL_MONTHS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">First month of your financial year</p>
                </div>
                <div>
                  <Label className="text-gray-400">Accounting Method</Label>
                  <Select
                    value={formData.accountingMethod}
                    onValueChange={(v: 'Accrual' | 'Cash') => setFormData({ ...formData, accountingMethod: v })}
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Accrual">Accrual</SelectItem>
                      <SelectItem value="Cash">Cash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-gray-400">Default Tax Mode</Label>
                  <Select
                    value={formData.taxMode}
                    onValueChange={(v: 'Inclusive' | 'Exclusive') => setFormData({ ...formData, taxMode: v })}
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Inclusive">Tax Inclusive</SelectItem>
                      <SelectItem value="Exclusive">Tax Exclusive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-gray-400">Default Tax %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={formData.defaultTaxRate}
                    onChange={(e) => setFormData({ ...formData, defaultTaxRate: Number(e.target.value) || 0 })}
                    className="bg-gray-800 border-gray-700 text-white mt-1"
                    disabled={loading}
                  />
                </div>
                <div className="flex items-center gap-2 md:col-span-2">
                  <input
                    type="checkbox"
                    id="multiBranch"
                    checked={formData.enableMultiBranch}
                    onChange={(e) => setFormData({ ...formData, enableMultiBranch: e.target.checked })}
                    className="rounded border-gray-600"
                  />
                  <Label htmlFor="multiBranch" className="text-gray-400 cursor-pointer">Enable multi-branch?</Label>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Inventory Settings */}
          {step === 3 && (
            <div className="space-y-6">
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">Inventory Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-gray-400">Default Costing Method</Label>
                  <Select
                    value={formData.costingMethod}
                    onValueChange={(v) => setFormData({ ...formData, costingMethod: v })}
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COSTING_METHODS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="negStock"
                    checked={formData.allowNegativeStock}
                    onChange={(e) => setFormData({ ...formData, allowNegativeStock: e.target.checked })}
                    className="rounded border-gray-600"
                  />
                  <Label htmlFor="negStock" className="text-gray-400 cursor-pointer">Allow negative stock?</Label>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-gray-400">Default Unit</Label>
                  <Select
                    value={formData.defaultUnit}
                    onValueChange={(v) => setFormData({ ...formData, defaultUnit: v })}
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BASE_UNITS.map((u) => (
                        <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-2">Base units (pcs, meter, kg) will be created automatically.</p>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Module Selection — cards with icon, name, description */}
          {step === 4 && (
            <div className="space-y-6">
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">Module Selection</h3>
              <p className="text-sm text-gray-400">Pre-selected by business type. You can change them. At least one required.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {MODULES.map((m) => {
                  const Icon = m.icon;
                  const selected = formData.modules.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleModule(m.id)}
                      className={`p-4 rounded-xl border-2 text-left transition-all flex items-start gap-3 ${
                        selected
                          ? 'border-blue-500 bg-blue-500/10 text-white'
                          : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600 hover:bg-gray-800'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${selected ? 'bg-blue-500/20' : 'bg-gray-700'}`}>
                        <Icon size={20} className={selected ? 'text-blue-400' : 'text-gray-500'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-white">{m.label}</span>
                          {selected && <Check size={18} className="text-blue-400 shrink-0" />}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{m.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
              {formData.modules.length === 0 && (
                <p className="text-sm text-amber-400">At least one module is required.</p>
              )}
            </div>
          )}

          {/* Step 5: Branch Setup */}
          {step === 5 && (
            <div className="space-y-6">
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">Branch Setup</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-gray-400">First Branch Name *</Label>
                  <Input
                    value={formData.branchName}
                    onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
                    placeholder="Main Branch"
                    className="bg-gray-800 border-gray-700 text-white mt-1"
                    disabled={loading}
                  />
                </div>
                <div>
                  <Label className="text-gray-400">Branch Code *</Label>
                  <Input
                    value={formData.branchCode}
                    onChange={(e) => setFormData({ ...formData, branchCode: e.target.value })}
                    placeholder="HQ"
                    className="bg-gray-800 border-gray-700 text-white mt-1"
                    disabled={loading}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-gray-400">Default Warehouse</Label>
                  <Input
                    value={formData.defaultWarehouse}
                    onChange={(e) => setFormData({ ...formData, defaultWarehouse: e.target.value })}
                    placeholder="Main"
                    className="bg-gray-800 border-gray-700 text-white mt-1"
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
                <p className="text-sm font-medium text-gray-300 mb-3">On submit, the system will:</p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-400">
                  <li className="flex items-center gap-2">• Create company</li>
                  <li className="flex items-center gap-2">• Create branch</li>
                  <li className="flex items-center gap-2">• Generate chart of accounts</li>
                  <li className="flex items-center gap-2">• Create default payment methods</li>
                  <li className="flex items-center gap-2">• Create base units</li>
                  <li className="flex items-center gap-2">• Enable selected modules</li>
                  <li className="flex items-center gap-2">• Generate document numbering</li>
                  <li className="flex items-center gap-2">• Create Super Admin role</li>
                </ul>
              </div>
            </div>
          )}

          {/* Step Navigation: Back, Next, Create Business */}
          <div className="flex flex-wrap gap-3 pt-6 border-t border-gray-800">
            <Button
              type="button"
              onClick={onCancel}
              disabled={loading}
              variant="outline"
              className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
            >
              Cancel
            </Button>
            {canPrev && (
              <Button
                type="button"
                onClick={handlePrev}
                disabled={loading}
                variant="outline"
                className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
              >
                <ChevronLeft size={18} className="mr-1" />
                Back
              </Button>
            )}
            {canGoNext ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={loading || !canProceed}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Next
                <ChevronRight size={18} className="ml-1" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !canProceed}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Business'
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
