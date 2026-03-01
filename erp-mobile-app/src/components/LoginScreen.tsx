import { useState, useEffect } from 'react';
import { Lock, Mail, Zap, Loader2, KeyRound } from 'lucide-react';
import type { User } from '../types';
import * as authApi from '../api/auth';

interface LoginScreenProps {
  onLogin: (user: User, companyId: string | null) => void;
  /** When set, show PIN unlock instead of email/password (session already exists) */
  pinUnlockUser?: User | null;
  pinUnlockCompanyId?: string | null;
}

const PIN_LENGTH = 6;

export function LoginScreen({ onLogin, pinUnlockUser, pinUnlockCompanyId: _pinUnlockCompanyId }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSetPin, setShowSetPin] = useState(false);
  const [setPinValue, setSetPinValue] = useState('');
  const [setPinConfirm, setSetPinConfirm] = useState('');
  const [hasPinSet, setHasPinSet] = useState(false);
  const [pinLockedUntil, setPinLockedUntil] = useState(0);

  useEffect(() => {
    authApi.hasPinSet().then(setHasPinSet);
    authApi.getPinLockedUntil().then(setPinLockedUntil);
  }, []);

  const isPinMode = hasPinSet;
  const isLocked = pinLockedUntil > Date.now();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { data, error: err } = await authApi.signIn(email, password);
      if (err) {
        setError(err.message);
        return;
      }
      if (data) {
        const user: User = {
          id: data.userId,
          name: data.name,
          email: data.email,
          role: data.role,
          profileId: data.profileId,
          branchId: data.branchId ?? undefined,
          branchLocked: data.branchLocked,
        };
        setShowSetPin(true);
        setUserForSetPin(user);
        setCompanyIdForSetPin(data.companyId);
        setBranchIdForSetPin(data.branchId ?? null);
      }
    } finally {
      setLoading(false);
    }
  };

  const [userForSetPin, setUserForSetPin] = useState<User | null>(null);
  const [companyIdForSetPin, setCompanyIdForSetPin] = useState<string | null>(null);
  const [branchIdForSetPin, setBranchIdForSetPin] = useState<string | null>(null);

  const handleSetPinSubmit = async () => {
    if (setPinValue.length < 4 || setPinValue.length > 6 || setPinValue !== setPinConfirm) {
      setError('PIN must be 4–6 digits and match.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const sessionWithRefresh = await authApi.getSessionWithRefresh();
      if (!sessionWithRefresh || !userForSetPin) {
        setError('Session lost. Please sign in again.');
        return;
      }
      await authApi.setPinWithPayload(setPinValue, {
        refreshToken: sessionWithRefresh.refreshToken,
        userId: userForSetPin.id,
        companyId: companyIdForSetPin,
        branchId: branchIdForSetPin,
        email: userForSetPin.email,
      });
      onLogin(userForSetPin, companyIdForSetPin);
      setShowSetPin(false);
      setUserForSetPin(null);
      setCompanyIdForSetPin(null);
      setBranchIdForSetPin(null);
      setSetPinValue('');
      setSetPinConfirm('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save PIN.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkipSetPin = () => {
    if (userForSetPin) onLogin(userForSetPin, companyIdForSetPin);
    setShowSetPin(false);
    setUserForSetPin(null);
    setCompanyIdForSetPin(null);
    setBranchIdForSetPin(null);
  };

  const handlePinUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) {
      setError('Enter your 4–6 digit PIN');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await authApi.verifyPin(pin);
      if (result.success && result.payload) {
        const { payload } = result;
        const session = await authApi.getSession();
        if (!session) {
          const refreshed = await authApi.refreshSessionFromRefreshToken(payload.refreshToken);
          if (!refreshed.ok) {
            setError(refreshed.error || 'Could not restore session.');
            return;
          }
        }
        const profile = await authApi.getProfile(payload.userId);
        if (!profile) {
          setError('Profile not found.');
          return;
        }
        const user: User = {
          id: profile.userId,
          name: profile.name,
          email: profile.email,
          role: profile.role,
          profileId: profile.profileId,
          branchId: profile.branchId ?? undefined,
          branchLocked: profile.branchLocked,
        };
        onLogin(user, profile.companyId);
      } else if (!result.success && 'lockedUntil' in result && result.locked) {
        setPinLockedUntil(result.lockedUntil);
        setError(`Too many attempts. Try again after ${new Date(result.lockedUntil).toLocaleTimeString()}.`);
      } else if (!result.success && 'expired' in result && result.expired) {
        setError(result.message || 'Session expired. Please sign in again.');
        await authApi.signOut();
        setHasPinSet(false);
      } else {
        const msg = !result.success && 'message' in result ? result.message : 'Wrong PIN';
        setError(msg || 'Wrong PIN');
      }
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (em: string, pw: string) => {
    setEmail(em);
    setPassword(pw);
    setError('');
    setLoading(true);
    try {
      const { data, error: err } = await authApi.signIn(em, pw);
      if (err) {
        setError(err.message);
        return;
      }
      if (data) {
        const user: User = {
          id: data.userId,
          name: data.name,
          email: data.email,
          role: data.role,
          profileId: data.profileId,
          branchId: data.branchId ?? undefined,
          branchLocked: data.branchLocked,
        };
        setShowSetPin(true);
        setUserForSetPin(user);
        setCompanyIdForSetPin(data.companyId);
        setBranchIdForSetPin(data.branchId ?? null);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMainLogin = () => quickLogin('ndm313@yahoo.com', 'iPhone@14max');
  const handleInfoLogin = () => quickLogin('info@dincouture.pk', 'InfoDincouture2026');
  const handleAdminLogin = () => quickLogin('admin@dincouture.pk', 'AdminDincouture2026');
  const handleDemoLogin = () => quickLogin('demo@dincollection.com', 'demo123');

  const handleUseEmailInstead = async () => {
    await authApi.signOut();
    await authApi.clearPin();
    window.location.reload();
  };

  // --- Set PIN modal (after first email/password login) ---
  if (showSetPin && userForSetPin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <KeyRound className="w-12 h-12 mx-auto mb-2 text-[#3B82F6]" />
            <h2 className="text-lg font-semibold text-white">Set PIN for next time</h2>
            <p className="text-sm text-[#9CA3AF] mt-1">Enter 4–6 digits. Stored securely on this device.</p>
            <p className="text-xs text-[#6B7280] mt-2">Change or remove in Settings after login.</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-[#6B7280] mb-2">PIN</label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoComplete="new-password"
                value={setPinValue}
                onChange={(e) => setSetPinValue(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg px-4 text-center text-lg tracking-widest text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#6B7280] mb-2">Confirm PIN</label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoComplete="new-password"
                value={setPinConfirm}
                onChange={(e) => setSetPinConfirm(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg px-4 text-center text-lg tracking-widest text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="button"
              disabled={loading}
              onClick={handleSetPinSubmit}
              className="w-full h-12 bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-70 text-white font-medium rounded-lg flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Set PIN & continue'}
            </button>
            <button
              type="button"
              onClick={handleSkipSetPin}
              className="w-full h-11 text-[#9CA3AF] text-sm hover:text-white transition-colors"
            >
              Skip (set PIN later in Settings)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- PIN unlock (session exists or restore from vault) ---
  if (isPinMode) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="mb-8 text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] rounded-2xl flex items-center justify-center">
            <span className="text-3xl font-bold text-white">DC</span>
          </div>
          <h1 className="text-2xl font-bold mb-1 text-white">Din Collection</h1>
          <p className="text-sm text-[#9CA3AF]">Enter PIN to continue</p>
          {pinUnlockUser?.email && <p className="text-xs text-[#6B7280] mt-2">{pinUnlockUser.email}</p>}
        </div>
        <div className="w-full max-w-sm">
          {isLocked ? (
            <div className="text-center py-4">
              <p className="text-amber-400 text-sm">Too many wrong attempts.</p>
              <p className="text-[#9CA3AF] text-sm mt-2">Try again after {new Date(pinLockedUntil).toLocaleTimeString()}</p>
              <button
                type="button"
                onClick={handleUseEmailInstead}
                className="mt-6 text-sm text-[#3B82F6]"
              >
                Use full login instead
              </button>
            </div>
          ) : (
            <>
              <form onSubmit={handlePinUnlock} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#6B7280] mb-2">PIN</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={PIN_LENGTH}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••••"
                      className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg pl-11 pr-4 text-center text-lg tracking-widest text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
                    />
                  </div>
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-70 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                  Unlock
                </button>
              </form>
              <button
                type="button"
                onClick={handleUseEmailInstead}
                className="mt-4 w-full text-sm text-[#9CA3AF]"
              >
                Use full login instead
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // --- Email / password login ---
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center">
        <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] rounded-2xl flex items-center justify-center">
          <span className="text-3xl font-bold text-white">DC</span>
        </div>
        <h1 className="text-2xl font-bold mb-1 text-white">Din Collection</h1>
        <p className="text-sm text-[#9CA3AF]">Mobile ERP</p>
      </div>

      <div className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-2">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg pl-11 pr-4 text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg pl-11 pr-4 text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-70 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            Sign In
          </button>
        </form>

        <p className="mt-4 mb-2 text-xs text-[#6B7280] text-center">
          Quick login (auto-fills and signs in):
        </p>
        <button
          type="button"
          disabled={loading}
          onClick={handleMainLogin}
          className="mt-2 w-full h-12 bg-[#3B82F6]/20 border border-[#3B82F6]/40 text-[#60A5FA] font-medium rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-70"
        >
          <Zap className="w-5 h-5" />
          Main (ndm313@yahoo.com)
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={handleInfoLogin}
          className="mt-2 w-full h-12 bg-[#10B981]/20 border border-[#10B981]/40 text-[#34D399] font-medium rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-70"
        >
          <Zap className="w-5 h-5" />
          Info (info@dincouture.pk)
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={handleAdminLogin}
          className="mt-2 w-full h-12 bg-[#F59E0B]/20 border border-[#F59E0B]/40 text-[#FBBF24] font-medium rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-70"
        >
          <Zap className="w-5 h-5" />
          Admin (admin@dincouture.pk)
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={handleDemoLogin}
          className="mt-2 w-full h-12 bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 text-[#A78BFA] font-medium rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-70"
        >
          <Zap className="w-5 h-5" />
          Demo (demo@dincollection.com)
        </button>
      </div>
    </div>
  );
}
