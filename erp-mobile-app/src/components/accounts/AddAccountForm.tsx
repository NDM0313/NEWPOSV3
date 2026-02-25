import { useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import * as accountsApi from '../../api/accounts';
import { ACCOUNT_TYPES } from '../../api/accounts';

interface AddAccountFormProps {
  onBack: () => void;
  onSuccess: () => void;
  companyId: string | null;
}

export function AddAccountForm({ onBack, onSuccess, companyId }: AddAccountFormProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState(ACCOUNT_TYPES[0].value);
  const [balance, setBalance] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) {
      setError('Company not set.');
      return;
    }
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Account name is required.');
      return;
    }
    setError('');
    setSaving(true);
    const { data, error: err } = await accountsApi.createAccount(companyId, {
      code: code.trim() || undefined,
      name: trimmedName,
      type,
      balance: balance === '' ? 0 : parseFloat(balance) || 0,
      is_active: true,
    });
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    if (data) onSuccess();
  };

  return (
    <div className="min-h-screen pb-24 bg-[#111827]">
      <div className="bg-gradient-to-br from-[#F59E0B] to-[#D97706] p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-semibold text-white">Add Account</h1>
            <p className="text-xs text-white/80">Chart of Accounts (backend)</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {error && (
          <div className="p-3 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg text-[#EF4444] text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-[#9CA3AF] mb-2">Account name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Main Cash"
            className="w-full px-4 py-3 bg-[#1F2937] border border-[#374151] rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:border-[#F59E0B]"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#9CA3AF] mb-2">Code (optional – auto-generated if empty)</label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. 1000 (leave blank for auto)"
            className="w-full px-4 py-3 bg-[#1F2937] border border-[#374151] rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:border-[#F59E0B]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#9CA3AF] mb-2">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full px-4 py-3 bg-[#1F2937] border border-[#374151] rounded-xl text-white focus:outline-none focus:border-[#F59E0B]"
          >
            {ACCOUNT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#9CA3AF] mb-2">Opening balance (optional)</label>
          <input
            type="number"
            inputMode="decimal"
            pattern="[0-9.]*"
            step="0.01"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            placeholder="0"
            className="w-full px-4 py-3 bg-[#1F2937] border border-[#374151] rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:border-[#F59E0B]"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 bg-[#F59E0B] hover:bg-[#D97706] disabled:opacity-50 text-white font-semibold rounded-xl flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          {saving ? 'Saving...' : 'Create Account'}
        </button>
      </form>
    </div>
  );
}
