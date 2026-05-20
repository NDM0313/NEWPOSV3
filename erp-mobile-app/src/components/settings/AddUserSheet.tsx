import { useState } from 'react';
import { ArrowLeft, Loader2, Mail, User, Key } from 'lucide-react';
import { CustomSelect } from '../common';
import * as usersApi from '../../api/users';
import { FUNCTIONAL_ROLE_OPTIONS, normalizeAppRole } from '../../config/functionalRoles';

interface AddUserSheetProps {
  companyId: string;
  branchId: string | null;
  onBack: () => void;
  onSuccess: () => void;
}

function PinDots({ value, length = 8 }: { value: string; length?: number }) {
  return (
    <div className="flex justify-center gap-1.5 flex-wrap">
      {Array.from({ length }).map((_, i) => (
        <div
          key={i}
          className="w-8 h-10 rounded-lg bg-[#111827] border border-[#374151] flex items-center justify-center text-white font-mono"
        >
          {value[i] ? '•' : ''}
        </div>
      ))}
    </div>
  );
}

export function AddUserSheet({ companyId, branchId, onBack, onSuccess }: AddUserSheetProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('salesman');
  const [passwordOption, setPasswordOption] = useState<'invite' | 'temp'>('invite');
  const [tempMode, setTempMode] = useState<'password' | 'pin'>('password');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [pinDigits, setPinDigits] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const appendPin = (d: string) => {
    if (pinDigits.length >= 4) return;
    setPinDigits((p) => (p + d).slice(0, 4));
  };

  const handleSubmit = async () => {
    setError('');
    const name = fullName.trim();
    const em = email.trim().toLowerCase();
    if (!name || !em) {
      setError('Name and email are required.');
      return;
    }
    let tempPass: string | undefined;
    if (passwordOption === 'temp') {
      if (tempMode === 'pin') {
        if (!/^\d{4}$/.test(pinDigits)) {
          setError('Enter a 4-digit PIN (used as initial password; enroll counter PIN in Settings after login).');
          return;
        }
        tempPass = `${pinDigits}${pinDigits}`;
      } else {
        if (!temporaryPassword || temporaryPassword.length < 8) {
          setError('Temporary password must be at least 8 characters.');
          return;
        }
        tempPass = temporaryPassword;
      }
    }
    setSubmitting(true);
    const branch_ids = branchId && branchId !== 'all' ? [branchId] : undefined;
    const { error: err } = await usersApi.createUserWithAuth({
      full_name: name,
      email: em,
      role: normalizeAppRole(role),
      company_id: companyId,
      send_invite_email: passwordOption === 'invite',
      temporary_password: passwordOption === 'temp' ? tempPass : undefined,
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
          <CustomSelect
            label="Role"
            value={role}
            onChange={setRole}
            options={FUNCTIONAL_ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.label }))}
            zIndexClass="z-[100]"
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs text-[#9CA3AF] font-medium">Access</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPasswordOption('invite')}
              className={`text-left p-3 rounded-xl border transition-colors ${
                passwordOption === 'invite'
                  ? 'border-[#3B82F6] bg-[#3B82F6]/10'
                  : 'border-[#374151] bg-[#1F2937] hover:border-[#4B5563]'
              }`}
            >
              <span className="text-sm font-medium text-white block">Invite email</span>
              <span className="text-xs text-[#9CA3AF] mt-1 block">User sets their own password</span>
            </button>
            <button
              type="button"
              onClick={() => setPasswordOption('temp')}
              className={`text-left p-3 rounded-xl border transition-colors ${
                passwordOption === 'temp'
                  ? 'border-[#3B82F6] bg-[#3B82F6]/10'
                  : 'border-[#374151] bg-[#1F2937] hover:border-[#4B5563]'
              }`}
            >
              <span className="text-sm font-medium text-white block">Temporary password</span>
              <span className="text-xs text-[#9CA3AF] mt-1 block">You set initial access</span>
            </button>
          </div>
        </div>

        {passwordOption === 'temp' && (
          <div className="space-y-3 bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTempMode('password')}
                className={`flex-1 py-2 rounded-lg text-xs font-medium ${
                  tempMode === 'password' ? 'bg-[#3B82F6] text-white' : 'bg-[#111827] text-[#9CA3AF] border border-[#374151]'
                }`}
              >
                Alphanumeric (8+)
              </button>
              <button
                type="button"
                onClick={() => setTempMode('pin')}
                className={`flex-1 py-2 rounded-lg text-xs font-medium ${
                  tempMode === 'pin' ? 'bg-[#3B82F6] text-white' : 'bg-[#111827] text-[#9CA3AF] border border-[#374151]'
                }`}
              >
                4-digit PIN
              </button>
            </div>
            {tempMode === 'password' ? (
              <div>
                <label className="text-xs text-[#9CA3AF] block mb-1">Temporary password (min 8 chars)</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                  <input
                    type="password"
                    value={temporaryPassword}
                    onChange={(e) => setTemporaryPassword(e.target.value)}
                    className="w-full bg-[#111827] border border-[#374151] rounded-xl pl-10 pr-3 py-3 text-white"
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </div>
              </div>
            ) : (
              <div>
                <p className="text-xs text-[#9CA3AF] mb-2">
                  POS-style PIN entry. After first login, enroll this user under Settings → Counter tablet PIN.
                </p>
                <PinDots value={pinDigits} length={4} />
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {(['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clr', '0', 'del'] as const).map((key, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        if (key === 'del') setPinDigits((p) => p.slice(0, -1));
                        else if (key === 'clr') setPinDigits('');
                        else appendPin(key);
                      }}
                      className="h-11 rounded-lg bg-[#374151] text-white font-medium disabled:opacity-30"
                    >
                      {key === 'del' ? '⌫' : key === 'clr' ? 'C' : key}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
