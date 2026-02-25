import { useState } from 'react';
import { ArrowLeft, User, Phone, Mail, MapPin, DollarSign, Briefcase } from 'lucide-react';
import type { ContactRole } from '../../api/contacts';

export interface AddContactFormData {
  name: string;
  roles: ContactRole[];
  phone: string;
  email: string;
  address: string;
  city: string;
  balance: number;
  creditLimit: number;
  workerType: '' | 'dyer' | 'stitcher' | 'master' | 'handwork' | 'other';
  workerRate: number;
}

interface AddContactFlowProps {
  onBack: () => void;
  onSubmit: (data: AddContactFormData) => void;
  error?: string;
}

export function AddContactFlow({ onBack, onSubmit, error }: AddContactFlowProps) {
  const [formData, setFormData] = useState<AddContactFormData>({
    name: '',
    roles: [],
    phone: '',
    email: '',
    address: '',
    city: '',
    balance: 0,
    creditLimit: 0,
    workerType: '',
    workerRate: 0,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const toggleRole = (role: ContactRole) => {
    if (formData.roles.includes(role)) {
      setFormData({ ...formData, roles: formData.roles.filter((r) => r !== role) });
    } else {
      setFormData({ ...formData, roles: [...formData.roles, role] });
    }
    setErrors({ ...errors, roles: '' });
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (formData.roles.length === 0) newErrors.roles = 'Select at least one role';
    if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
    if (formData.roles.includes('worker') && !formData.workerType) newErrors.workerType = 'Worker type is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSubmit(formData);
  };

  return (
    <div className="min-h-screen pb-40 bg-[#111827]">
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="w-8 h-8 bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] rounded-lg flex items-center justify-center shadow-lg shadow-[#8B5CF6]/30">
            <User size={18} className="text-white" />
          </div>
          <h1 className="text-white font-semibold text-base">Add New Contact</h1>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        {error && (
          <div className="p-3 bg-[#EF4444]/20 border border-[#EF4444] rounded-lg text-sm text-[#FCA5A5]">
            {error}
          </div>
        )}
        <div className="space-y-4">
          <h2 className="text-white font-semibold text-sm">Basic Information</h2>
          <div>
            <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Full Name *</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" size={18} />
              <input
                type="text"
                value={formData.name}
                onChange={(e) => { setFormData({ ...formData, name: e.target.value }); setErrors({ ...errors, name: '' }); }}
                placeholder="Enter full name"
                className={`w-full h-12 bg-[#1F2937] border rounded-lg pl-10 pr-4 text-white placeholder:text-[#6B7280] focus:outline-none ${errors.name ? 'border-[#EF4444]' : 'border-[#374151] focus:border-[#8B5CF6]'}`}
              />
            </div>
            {errors.name && <p className="text-[#EF4444] text-xs mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Phone Number *</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" size={18} />
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => { setFormData({ ...formData, phone: e.target.value }); setErrors({ ...errors, phone: '' }); }}
                placeholder="+92 300 1234567"
                className={`w-full h-12 bg-[#1F2937] border rounded-lg pl-10 pr-4 text-white placeholder:text-[#6B7280] focus:outline-none ${errors.phone ? 'border-[#EF4444]' : 'border-[#374151] focus:border-[#8B5CF6]'}`}
              />
            </div>
            {errors.phone && <p className="text-[#EF4444] text-xs mt-1">{errors.phone}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Email (Optional)</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" size={18} />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@example.com"
                className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg pl-10 pr-4 text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#8B5CF6]"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-white font-semibold text-sm">Select Roles *</h2>
          <p className="text-xs text-[#9CA3AF]">A contact can have multiple roles</p>
          <div className="grid grid-cols-3 gap-3">
            {(['customer', 'supplier', 'worker'] as const).map((role) => (
              <button
                key={role}
                onClick={() => toggleRole(role)}
                className={`p-4 rounded-xl border-2 transition-all ${formData.roles.includes(role) ? 'bg-[#8B5CF6]/10 border-[#8B5CF6]' : 'bg-[#1F2937] border-[#374151] hover:border-[#8B5CF6]/50'}`}
              >
                <div className="text-2xl mb-2">{role === 'customer' ? '👤' : role === 'supplier' ? '🏢' : '👷'}</div>
                <div className={`text-sm font-medium ${formData.roles.includes(role) ? 'text-[#8B5CF6]' : 'text-[#9CA3AF]'}`}>
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </div>
              </button>
            ))}
          </div>
          {errors.roles && <p className="text-[#EF4444] text-xs mt-1">{errors.roles}</p>}
        </div>

        {formData.roles.includes('worker') && (
          <div className="space-y-4 bg-[#1F2937] border border-[#F59E0B]/30 rounded-xl p-4">
            <div className="flex items-center gap-2 text-[#F59E0B] mb-2">
              <Briefcase size={18} />
              <h3 className="font-semibold text-sm">Worker Details</h3>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Worker Type *</label>
              <select
                value={formData.workerType}
                onChange={(e) => { setFormData({ ...formData, workerType: e.target.value as AddContactFormData['workerType'] }); setErrors({ ...errors, workerType: '' }); }}
                className={`w-full h-12 bg-[#111827] border rounded-lg px-4 text-white focus:outline-none ${errors.workerType ? 'border-[#EF4444]' : 'border-[#374151] focus:border-[#F59E0B]'}`}
              >
                <option value="">Select worker type</option>
                <option value="dyer">Dyer</option>
                <option value="stitcher">Stitcher</option>
                <option value="master">Master</option>
                <option value="handwork">Handwork</option>
                <option value="other">Other</option>
              </select>
              {errors.workerType && <p className="text-[#EF4444] text-xs mt-1">{errors.workerType}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Rate (per piece/day)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" size={18} />
                <input
                  type="number"
                  inputMode="decimal"
                  pattern="[0-9.]*"
                  value={formData.workerRate || ''}
                  onChange={(e) => setFormData({ ...formData, workerRate: parseFloat(e.target.value) || 0 })}
                  placeholder="350"
                  className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg pl-10 pr-4 text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#F59E0B]"
                />
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <h2 className="text-white font-semibold text-sm">Location (Optional)</h2>
          <div>
            <label className="block text-sm font-medium text-[#D1D5DB] mb-2">City</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" size={18} />
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Karachi"
                className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg pl-10 pr-4 text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#8B5CF6]"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Address</label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Enter full address"
              rows={3}
              className="w-full bg-[#1F2937] border border-[#374151] rounded-lg px-4 py-3 text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#8B5CF6] resize-none"
            />
          </div>
        </div>

        {(formData.roles.includes('customer') || formData.roles.includes('supplier')) && (
          <div className="space-y-4">
            <h2 className="text-white font-semibold text-sm">Financial Details (Optional)</h2>
            <div>
              <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Opening Balance</label>
              <p className="text-xs text-[#9CA3AF] mb-2">Positive = Receivable, Negative = Payable</p>
              <input
                type="number"
                inputMode="decimal"
                pattern="[0-9.]*"
                value={formData.balance || ''}
                onChange={(e) => setFormData({ ...formData, balance: parseFloat(e.target.value) || 0 })}
                placeholder="0"
                className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg px-4 text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#8B5CF6]"
              />
            </div>
            {formData.roles.includes('customer') && (
              <div>
                <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Credit Limit</label>
                <input
                  type="number"
                  inputMode="decimal"
                  pattern="[0-9.]*"
                  value={formData.creditLimit || ''}
                  onChange={(e) => setFormData({ ...formData, creditLimit: parseFloat(e.target.value) || 0 })}
                  placeholder="100000"
                  className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg px-4 text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#8B5CF6]"
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="fixed left-0 right-0 bg-[#1F2937] border-t border-[#374151] p-4 z-[60] fixed-bottom-above-nav">
        <button
          onClick={handleSubmit}
          className="w-full h-12 bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white rounded-lg font-semibold shadow-lg shadow-[#8B5CF6]/30 active:scale-[0.98] transition-transform"
        >
          Add Contact
        </button>
      </div>
    </div>
  );
}
