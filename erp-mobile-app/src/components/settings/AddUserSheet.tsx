import { useState } from 'react';
import { ArrowLeft, Loader2, Mail, User, Key } from 'lucide-react';
import * as usersApi from '../../api/users';

const ROLES = [
  { value: 'staff', label: 'Staff' },
  { value: 'salesman', label: 'Salesman' },
  { value: 'cashier', label: 'Cashier' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Admin' },
] as const;

interface AddUserSheetProps {
  companyId: string;
  branchId: string | null;
  onBack: () => void;
  onSuccess: () => void;
}

export function AddUserSheet({ companyId, branchId, onBack, onSuccess }: AddUserSheetProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('staff');
  const [passwordOption, setPasswordOption] = useState<'invite' | 'temp'>('invite');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    const name = fullName.trim();
    const em = email.trim().toLowerCase();
    if (!name || !em) {
      setError('Name and email are required.');
      return;
    }
    if (passwordOption === 'temp' && (!temporaryPassword || temporaryPassword.length < 8)) {
      setError('Temporary password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    const branch_ids = branchId && branchId !== 'all' ? [branchId] : undefined;
    const { error: err } = await usersApi.createUserWithAuth({
      full_name: name,
      email: em,
      role,
      company_id: companyId,
      send_invite_email: passwordOption === 'invite',
      temporary_password: passwordOption === 'temp' ? temporaryPassword : undefined,
      branch_ids,
      default_branch_id: branchId && branchId !== 'all' ? branchId : undefined,
      is_active: true,
    });
    setSubmitting(false);
    if (err) {
      setError(err);
      return;
    }
    onSuccess();
    onBack();
  };

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
        <div className="flex items-center gap-3 px-4 h-14">
          <button type="button" onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-white font-semibold text-base">Add user</h1>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-md mx-auto">
        <p className="text-xs text-[#9CA3AF]">
          Creates a login via the same server action as web ERP (invite email or temporary password).
        </p>

        <div>
          <label className="text-xs text-[#9CA3AF] block mb-1">Full name</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-[#1F2937] border border-[#374151] rounded-xl pl-10 pr-3 py-3 text-white placeholder-[#6B7280]"
              placeholder="Full name"
              autoComplete="name"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-[#9CA3AF] block mb-1">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#1F2937] border border-[#374151] rounded-xl pl-10 pr-3 py-3 text-white placeholder-[#6B7280]"
              placeholder="email@example.com"
              autoComplete="email"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-[#9CA3AF] block mb-1">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full bg-[#1F2937] border border-[#374151] rounded-xl px-3 py-3 text-white"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-[#9CA3AF] font-medium">Access</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="pwd"
              checked={passwordOption === 'invite'}
              onChange={() => setPasswordOption('invite')}
              className="text-[#3B82F6]"
            />
            <span className="text-sm text-[#E5E7EB]">Send invite email (user sets password)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="pwd"
              checked={passwordOption === 'temp'}
              onChange={() => setPasswordOption('temp')}
              className="text-[#3B82F6]"
            />
            <span className="text-sm text-[#E5E7EB]">Temporary password</span>
          </label>
        </div>

        {passwordOption === 'temp' && (
          <div>
            <label className="text-xs text-[#9CA3AF] block mb-1">Temporary password (min 8 chars)</label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
              <input
                type="password"
                value={temporaryPassword}
                onChange={(e) => setTemporaryPassword(e.target.value)}
                className="w-full bg-[#1F2937] border border-[#374151] rounded-xl pl-10 pr-3 py-3 text-white"
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>
          </div>
        )}

        {branchId && branchId !== 'all' && (
          <p className="text-xs text-[#6B7280]">New user will be assigned to the current branch.</p>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="button"
          disabled={submitting}
          onClick={() => void handleSubmit()}
          className="w-full py-3.5 bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-50 rounded-xl text-white font-semibold flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          Create user
        </button>
      </div>
    </div>
  );
}
