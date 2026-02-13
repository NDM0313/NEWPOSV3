import React, { useState, useMemo } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Building2, User, Mail, Lock, AlertCircle, Loader2, DollarSign, Calendar } from 'lucide-react';
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

function getDefaultFiscalYearStart(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  if (month >= 6) return `${year}-07-01`;
  return `${year - 1}-07-01`;
}

interface CreateBusinessFormProps {
  onSuccess: (email: string, password: string) => void;
  onCancel: () => void;
}

export const CreateBusinessForm: React.FC<CreateBusinessFormProps> = ({ onSuccess, onCancel }) => {
  const defaultFiscalStart = useMemo(() => getDefaultFiscalYearStart(), []);
  const [formData, setFormData] = useState({
    businessName: '',
    ownerName: '',
    email: '',
    password: '',
    confirmPassword: '',
    currency: 'PKR',
    fiscalYearStart: defaultFiscalStart,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validation
    if (!formData.businessName.trim()) {
      setError('Business name is required');
      setLoading(false);
      return;
    }

    if (!formData.ownerName.trim()) {
      setError('Owner name is required');
      setLoading(false);
      return;
    }

    if (!formData.email.trim()) {
      setError('Email is required');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const result = await businessService.createBusiness({
        businessName: formData.businessName,
        ownerName: formData.ownerName,
        email: formData.email,
        password: formData.password,
        currency: formData.currency,
        fiscalYearStart: formData.fiscalYearStart,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to create business');
      }

      // Success - call onSuccess callback with credentials for auto-login
      onSuccess(formData.email, formData.password);
    } catch (err: any) {
      setError(err.message || 'Failed to create business. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#111827] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Create Business</h1>
          <p className="text-gray-400">Set up your ERP system</p>
        </div>

        {/* Form */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400">
              <AlertCircle size={18} />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Business Name */}
            <div>
              <Label htmlFor="businessName" className="text-gray-400 mb-2 block">
                Business Name
              </Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <Input
                  id="businessName"
                  type="text"
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  placeholder="Din Collection"
                  className="pl-10 bg-gray-800 border-gray-700 text-white"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Owner Name */}
            <div>
              <Label htmlFor="ownerName" className="text-gray-400 mb-2 block">
                Owner Name
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <Input
                  id="ownerName"
                  type="text"
                  value={formData.ownerName}
                  onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                  placeholder="John Doe"
                  className="pl-10 bg-gray-800 border-gray-700 text-white"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <Label htmlFor="email" className="text-gray-400 mb-2 block">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="owner@business.com"
                  className="pl-10 bg-gray-800 border-gray-700 text-white"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <Label htmlFor="password" className="text-gray-400 mb-2 block">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                  className="pl-10 bg-gray-800 border-gray-700 text-white"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Default Currency */}
            <div>
              <Label htmlFor="currency" className="text-gray-400 mb-2 block flex items-center gap-2">
                <DollarSign size={16} />
                Default Currency
              </Label>
              <Select
                value={formData.currency}
                onValueChange={(v) => setFormData({ ...formData, currency: v })}
                disabled={loading}
              >
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Financial Year Start */}
            <div>
              <Label htmlFor="fiscalYearStart" className="text-gray-400 mb-2 block flex items-center gap-2">
                <Calendar size={16} />
                Financial Year Start
              </Label>
              <Input
                id="fiscalYearStart"
                type="date"
                value={formData.fiscalYearStart}
                onChange={(e) => setFormData({ ...formData, fiscalYearStart: e.target.value })}
                className="bg-gray-800 border-gray-700 text-white"
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">Default: July 1 of current fiscal year</p>
            </div>

            {/* Confirm Password */}
            <div>
              <Label htmlFor="confirmPassword" className="text-gray-400 mb-2 block">
                Confirm Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  placeholder="••••••••"
                  className="pl-10 bg-gray-800 border-gray-700 text-white"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                onClick={onCancel}
                disabled={loading}
                variant="outline"
                className="flex-1 bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
              >
                Cancel
              </Button>
              <Button
                type="submit"
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
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
