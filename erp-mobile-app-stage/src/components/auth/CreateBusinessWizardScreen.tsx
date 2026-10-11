import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft,
  Building2,
  User as UserIcon,
  Mail,
  Phone,
  Lock,
  Loader2,
  ChevronRight,
  KeyRound,
} from 'lucide-react';
import * as authApi from '../../api/auth';
import { runCreateBusinessTransaction } from '../../api/business';
import { supabase } from '../../lib/supabase';
import { resetLocalDataPlaneForNewCompany } from '../../lib/sessionIsolation';
import { WIZARD_BUSINESS_TYPES, modulesForBusinessType } from '../../config/businessTypeTemplates';
import type { User } from '../../types';

function authProfileToUser(p: authApi.AuthProfile): User {
  const r = p.role;
  const role: User['role'] =
    r === 'owner' ? 'owner' : r === 'admin' ? 'admin' : r === 'manager' ? 'manager' : 'salesman';
  return {
    id: p.userId,
    name: p.name,
    email: p.email,
    role,
    profileId: p.profileId,
    branchId: p.branchId ?? undefined,
    branchLocked: p.branchLocked,
  };
}

type Phase = 'details' | 'password' | 'otp' | 'creating';

interface CreateBusinessWizardScreenProps {
  onCancel: () => void;
  onComplete: (user: User, companyId: string | null) => void;
}

const RESEND_SECONDS = 60;

export function CreateBusinessWizardScreen({ onCancel, onComplete }: CreateBusinessWizardScreenProps) {
  const [phase, setPhase] = useState<Phase>('details');
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [businessType, setBusinessType] = useState<string>('mixed');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  /** Where to return if session/RPC fails after leaving that phase (e.g. `creating`). */
  const phaseToRestoreOnSessionFailure = useRef<Phase>('password');

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(t);
  }, [resendIn]);

  const startOtpCountdown = useCallback(() => {
    setResendIn(RESEND_SECONDS);
  }, []);

  const validateDetails = () => {
    if (!businessName.trim()) return 'Business name is required.';
    if (!ownerName.trim()) return 'Owner full name is required.';
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Valid email is required.';
    if (!mobile.trim()) return 'Mobile number is required.';
    return null;
  };

  const validatePassword = () => {
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (password !== passwordConfirm) return 'Passwords do not match.';
    return null;
  };

  const goPassword = () => {
    const v = validateDetails();
    if (v) {
      setError(v);
      return;
    }
    setError('');
    setPhase('password');
  };

  const submitSignUp = async () => {
    const v = validatePassword();
    if (v) {
      setError(v);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { needsEmailVerification, hasSession, error: e } = await authApi.signUpForNewBusiness({
        email: email.trim(),
        password,
        ownerName: ownerName.trim(),
        phone: mobile.trim(),
        businessName: businessName.trim(),
        businessType,
      });
      if (e) {
        setError(e.message);
        return;
      }
      if (needsEmailVerification) {
        setPhase('otp');
        startOtpCountdown();
        return;
      }
      if (hasSession) {
        phaseToRestoreOnSessionFailure.current = 'password';
        const sessionReady = await authApi.ensureAuthenticatedSession();
        if (!sessionReady.ok) {
          setError(sessionReady.message || 'Could not establish session. Try again.');
          return;
        }
        await runRpcAndFinish();
      } else {
        setError('Could not start session. Try again or confirm email settings in Supabase.');
      }
    } finally {
      setLoading(false);
    }
  };

  const runRpcAndFinish = async () => {
    setPhase('creating');
    setLoading(true);
    setError('');
    try {
      const sessionReady = await authApi.ensureAuthenticatedSession();
      if (!sessionReady.ok) {
        setPhase(phaseToRestoreOnSessionFailure.current);
        setError(sessionReady.message || 'Could not establish session.');
        return;
      }
      const modules = modulesForBusinessType(businessType);
      const tx = await runCreateBusinessTransaction({
        businessName: businessName.trim(),
        ownerName: ownerName.trim(),
        email: email.trim(),
        password,
        phone: mobile.trim(),
        businessType,
        modules,
      });
      if (!tx.success) {
        setPhase('password');
        setError(tx.error || 'Could not create business.');
        return;
      }
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser?.id) {
        setPhase('password');
        setError('Session lost after signup.');
        return;
      }
      const profile = await authApi.getProfile(authUser.id);
      if (!profile) {
        setPhase('password');
        setError('Profile not found after business creation.');
        return;
      }
      await resetLocalDataPlaneForNewCompany();
      onComplete(authProfileToUser(profile), profile.companyId);
    } finally {
      setLoading(false);
    }
  };

  const submitOtp = async () => {
    setError('');
    setLoading(true);
    try {
      phaseToRestoreOnSessionFailure.current = 'otp';
      const { error: e, sessionEstablished } = await authApi.verifySignupEmailOtp(email.trim(), otp);
      if (e) {
        setError(e.message);
        return;
      }
      if (!sessionEstablished) {
        setError('Could not establish session after verification. Try again or resend the code.');
        return;
      }
      await runRpcAndFinish();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendIn > 0 || loading) return;
    setError('');
    setLoading(true);
    try {
      const { error: e } = await authApi.resendSignupEmailOtp(email.trim());
      if (e) setError(e.message);
      else startOtpCountdown();
    } finally {
      setLoading(false);
    }
  };

  const header = (
    <div className="sticky top-0 z-10 flow-screen-header bg-[#111827] border-b border-[#374151] px-4 py-3 flex items-center gap-3">
      <button type="button" onClick={onCancel} className="p-2 rounded-lg hover:bg-[#1F2937] text-white">
        <ArrowLeft className="w-5 h-5" />
      </button>
      <div>
        <h1 className="text-base font-semibold text-white">Create business</h1>
        <p className="text-xs text-[#6B7280]">Register a new company on this device</p>
      </div>
    </div>
  );

  if (phase === 'creating') {
    return (
      <div className="min-h-screen bg-[#111827] flex flex-col">
        {header}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
          <Loader2 className="w-10 h-10 text-[#3B82F6] animate-spin" />
          <p className="text-sm text-[#9CA3AF] text-center">Creating your workspace…</p>
        </div>
      </div>
    );
  }

  if (phase === 'otp') {
    return (
      <div className="min-h-screen bg-[#111827] flex flex-col">
        {header}
        <div className="p-4 max-w-md mx-auto w-full space-y-5 pt-6">
          <div className="flex items-center gap-3 text-[#3B82F6]">
            <KeyRound className="w-8 h-8" />
            <div>
              <h2 className="text-lg font-semibold text-white">Check your email</h2>
              <p className="text-xs text-[#9CA3AF] mt-1">
                Enter the verification code sent to <span className="text-white font-medium">{email}</span>
              </p>
            </div>
          </div>
          <div>
            <label className="block text-xs text-[#6B7280] mb-2">Verification code</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={12}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\s/g, ''))}
              placeholder="6-digit code"
              className="w-full h-14 bg-[#1F2937] border border-[#374151] rounded-xl px-4 text-center text-xl tracking-widest text-white placeholder-[#4B5563] focus:outline-none focus:border-[#3B82F6]"
            />
          </div>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button
            type="button"
            disabled={loading || otp.length < 4}
            onClick={() => void submitOtp()}
            className="w-full h-12 bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-50 text-white font-medium rounded-xl flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            Verify & continue
          </button>
          <div className="flex flex-col items-center gap-2 pt-2">
            <button
              type="button"
              disabled={resendIn > 0 || loading}
              onClick={() => void handleResend()}
              className="text-sm text-[#3B82F6] disabled:text-[#6B7280] disabled:cursor-not-allowed"
            >
              {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
            </button>
            <button type="button" className="text-xs text-[#6B7280]" onClick={() => setPhase('password')}>
              Back to password
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'password') {
    return (
      <div className="min-h-screen bg-[#111827] flex flex-col">
        {header}
        <div className="p-4 max-w-md mx-auto w-full space-y-4 pt-4">
          <div className="flex items-center gap-2 text-[#9CA3AF] text-xs mb-2">
            <Lock className="w-4 h-4" />
            <span>Choose a secure password for your owner account</span>
          </div>
          <div>
            <label className="block text-xs text-[#6B7280] mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-11 bg-[#1F2937] border border-[#374151] rounded-lg px-3 text-sm text-white focus:outline-none focus:border-[#3B82F6]"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-xs text-[#6B7280] mb-1.5">Confirm password</label>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className="w-full h-11 bg-[#1F2937] border border-[#374151] rounded-lg px-3 text-sm text-white focus:outline-none focus:border-[#3B82F6]"
              autoComplete="new-password"
            />
          </div>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button
            type="button"
            disabled={loading}
            onClick={() => void submitSignUp()}
            className="w-full h-12 bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-50 text-white font-medium rounded-xl flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            Create account
          </button>
          <button
            type="button"
            className="w-full text-sm text-[#9CA3AF] py-2"
            onClick={() => {
              setError('');
              setPhase('details');
            }}
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  // details phase
  return (
    <div className="min-h-screen bg-[#111827] flex flex-col text-[#F9FAFB]">
      {header}
      <div className="p-4 max-w-md mx-auto w-full flex-1 overflow-y-auto pb-10 space-y-3.5">
        <div className="rounded-xl border border-[#374151] bg-[#0f172a]/80 p-4 space-y-3.5">
          <div>
            <label className="block text-[11px] uppercase tracking-wide text-[#6B7280] mb-1">Business name *</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
              <input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full h-10 bg-[#1F2937] border border-[#374151] rounded-lg pl-9 pr-3 text-sm text-white placeholder-[#4B5563] focus:outline-none focus:border-[#3B82F6]"
                placeholder="e.g. Din Couture"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wide text-[#6B7280] mb-1">Owner full name *</label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
              <input
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full h-10 bg-[#1F2937] border border-[#374151] rounded-lg pl-9 pr-3 text-sm text-white focus:outline-none focus:border-[#3B82F6]"
                placeholder="Full legal name"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wide text-[#6B7280] mb-1">Mobile number *</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
              <input
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="w-full h-10 bg-[#1F2937] border border-[#374151] rounded-lg pl-9 pr-3 text-sm text-white focus:outline-none focus:border-[#3B82F6]"
                placeholder="+92 300 1234567"
                inputMode="tel"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wide text-[#6B7280] mb-1">Email *</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-10 bg-[#1F2937] border border-[#374151] rounded-lg pl-9 pr-3 text-sm text-white focus:outline-none focus:border-[#3B82F6]"
                placeholder="owner@company.com"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wide text-[#6B7280] mb-1">Business type *</label>
            <select
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              className="w-full h-10 bg-[#1F2937] border border-[#374151] rounded-lg px-3 text-sm text-white focus:outline-none focus:border-[#3B82F6]"
            >
              {WIZARD_BUSINESS_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {error ? <p className="text-sm text-red-400 px-1">{error}</p> : null}
        <button
          type="button"
          onClick={goPassword}
          className="w-full h-12 bg-[#3B82F6] hover:bg-[#2563EB] text-white font-medium rounded-xl flex items-center justify-center gap-2"
        >
          Continue
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
