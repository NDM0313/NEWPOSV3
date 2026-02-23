/**
 * Create Business Wizard — Multi-step onboarding
 * Replaces single-form flow with structured onboarding.
 * Old CreateBusinessForm.tsx kept as backup.
 *
 * Steps:
 * 1. Basic Business Info
 * 2. Financial Configuration
 * 3. Inventory & Units
 * 4. Modules Selection
 * 5. Initial Setup (branch, COA, roles)
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
  Calendar,
  Package,
  Layers,
  Settings,
  ChevronRight,
  ChevronLeft,
  Check,
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

const MODULES = [
  { id: 'sales', label: 'Sales', required: false },
  { id: 'purchases', label: 'Purchases', required: false },
  { id: 'rentals', label: 'Rentals', required: false },
  { id: 'pos', label: 'POS', required: false },
  { id: 'studio', label: 'Studio Production', required: false },
  { id: 'accounting', label: 'Accounting', required: false },
  { id: 'expenses', label: 'Expenses', required: false },
  { id: 'payroll', label: 'Payroll (future)', required: false },
  { id: 'reports', label: 'Reports', required: false },
];

const BASE_UNITS = [
  { value: 'pcs', label: 'Piece (pcs)' },
  { value: 'meter', label: 'Meter (m)' },
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'liter', label: 'Liter (L)' },
];

function getDefaultFiscalYearStart(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  if (month >= 6) return `${year}-07-01`;
  return `${year - 1}-07-01`;
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
    businessType: 'retail',
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
    // Step 4
    modules: ['sales', 'purchases', 'accounting', 'expenses', 'reports'] as string[],
    // Step 5
    branchName: 'Main Branch',
    branchCode: 'HQ',
    defaultWarehouse: 'Main',
  });

  const totalSteps = 5;
  const canNext = step < totalSteps;
  const canPrev = step > 1;

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
      if (!formData.fiscalYearStart) return 'Financial year start is required';
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
      const result = await businessService.createBusiness({
        businessName: formData.businessName,
        ownerName: formData.ownerName,
        email: formData.email,
        password: formData.password,
        currency: formData.currency,
        fiscalYearStart: formData.fiscalYearStart,
        branchName: formData.branchName,
        branchCode: formData.branchCode,
      });
      if (!result.success) throw new Error(result.error || 'Failed to create business');
      onSuccess(formData.email, formData.password);
    } catch (err: any) {
      setError(err.message || 'Failed to create business. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { n: 1, title: 'Basic Info', icon: Building2 },
    { n: 2, title: 'Financial', icon: DollarSign },
    { n: 3, title: 'Inventory', icon: Package },
    { n: 4, title: 'Modules', icon: Layers },
    { n: 5, title: 'Initial Setup', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#111827] flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">Create Business</h1>
          <p className="text-gray-400 text-sm">Step {step} of {totalSteps}</p>
          <div className="flex justify-center gap-2 mt-3">
            {steps.map((s) => (
              <div
                key={s.n}
                className={`w-2 h-2 rounded-full ${step >= s.n ? 'bg-blue-500' : 'bg-gray-600'}`}
              />
            ))}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400">
              <AlertCircle size={18} />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Step 1: Basic Business Info */}
          {step === 1 && (
            <div className="space-y-4">
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
                <Select value={formData.businessType} onValueChange={(v) => setFormData({ ...formData, businessType: v })}>
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
              <div>
                <Label className="text-gray-400">Address</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street, City, Country"
                  className="bg-gray-800 border-gray-700 text-white mt-1"
                  disabled={loading}
                />
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
          )}

          {/* Step 2: Financial Configuration */}
          {step === 2 && (
            <div className="space-y-4">
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
                <div className="relative mt-1">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <Input
                    type="date"
                    value={formData.fiscalYearStart}
                    onChange={(e) => setFormData({ ...formData, fiscalYearStart: e.target.value })}
                    className="pl-10 bg-gray-800 border-gray-700 text-white"
                    disabled={loading}
                  />
                </div>
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
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="multiBranch"
                  checked={formData.enableMultiBranch}
                  onChange={(e) => setFormData({ ...formData, enableMultiBranch: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="multiBranch" className="text-gray-400 cursor-pointer">Enable multi-branch?</Label>
              </div>
            </div>
          )}

          {/* Step 3: Inventory & Units */}
          {step === 3 && (
            <div className="space-y-4">
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
                  className="rounded"
                />
                <Label htmlFor="negStock" className="text-gray-400 cursor-pointer">Allow negative stock?</Label>
              </div>
              <div>
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
              </div>
              <p className="text-xs text-gray-500">Base units (pcs, meter, kg) are auto-created. Add more in Settings after creation.</p>
            </div>
          )}

          {/* Step 4: Modules Selection */}
          {step === 4 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-400">Only enabled modules appear in the sidebar.</p>
              <div className="grid grid-cols-2 gap-2">
                {MODULES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleModule(m.id)}
                    className={`p-3 rounded-xl border text-left transition ${
                      formData.modules.includes(m.id)
                        ? 'border-blue-500 bg-blue-500/10 text-white'
                        : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{m.label}</span>
                      {formData.modules.includes(m.id) && <Check size={16} className="text-blue-400" />}
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-amber-400">At least one module required.</p>
            </div>
          )}

          {/* Step 5: Initial Setup */}
          {step === 5 && (
            <div className="space-y-4">
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
              <div>
                <Label className="text-gray-400">Default Warehouse</Label>
                <Input
                  value={formData.defaultWarehouse}
                  onChange={(e) => setFormData({ ...formData, defaultWarehouse: e.target.value })}
                  placeholder="Main"
                  className="bg-gray-800 border-gray-700 text-white mt-1"
                  disabled={loading}
                />
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-sm text-gray-400">
                <p className="font-medium text-gray-300 mb-1">On submit, the system will:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Create company</li>
                  <li>Create branch</li>
                  <li>Create default financial year</li>
                  <li>Generate default chart of accounts</li>
                  <li>Insert default payment methods</li>
                  <li>Insert default units</li>
                  <li>Enable selected modules</li>
                  <li>Generate numbering sequences</li>
                  <li>Create Super Admin role</li>
                </ul>
              </div>
            </div>
          )}

          {/* Step Navigation */}
          <div className="flex gap-3 mt-6 pt-4 border-t border-gray-800">
            <Button
              type="button"
              onClick={onCancel}
              disabled={loading}
              variant="outline"
              className="flex-1 bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
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
                <ChevronLeft size={18} />
              </Button>
            )}
            {canNext ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                Next <ChevronRight size={18} />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
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
