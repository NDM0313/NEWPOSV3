import { useState, useEffect, useRef } from 'react';
import { Lock, Mail, Loader2, KeyRound, AlertTriangle } from 'lucide-react';
import { erpMobileUsingDemoSupabaseAnonKey } from '../lib/supabase';
import type { User } from '../types';
import * as authApi from '../api/auth';
import { markUnlocked } from '../lib/pinLock';
import { OAUTH_COMPLETE_EVENT, type OauthCompleteDetail } from '../lib/oauthCallback';
import { CounterLoginPanel } from './auth/CounterLoginPanel';
import { getLastCounterCompanyId } from '../lib/sharedCounterMode';
import {
  finalizeCounterWorkerEnrollment,
  resolveCounterEnrollBranchId,
  shouldOfferCounterPinSync,
  subscribeCounterRegistryUpdated,
} from '../lib/counterPinFromDevicePin';
import { getWorkerUserIdForPin, listEnrolledWorkers } from '../lib/counterWorkerRegistry';
import { fullDeviceReset } from '../lib/fullDeviceReset';

interface LoginScreenProps {
  onLogin: (user: User, companyId: string | null) => void;
  /** When set, show PIN unlock instead of email/password (session already exists) */
  pinUnlockUser?: User | null;
  pinUnlockCompanyId?: string | null;
  /**
   * Optional: when the user is already logged-in and this screen is rendered
   * purely to re-lock after a period of inactivity, this is called on
   * successful PIN unlock instead of `onLogin`. This keeps the current
   * screen/state intact rather than re-running the full login flow.
   */
  onUnlock?: () => void;
  /** Open mobile create-business wizard (new account + company). */
  onCreateBusiness?: () => void;
}

const PIN_LENGTH = 6;

export function LoginScreen({ onLogin, pinUnlockUser, pinUnlockCompanyId: _pinUnlockCompanyId, onUnlock, onCreateBusiness }: LoginScreenProps) {
  const googleOAuthPendingRef = useRef(false);
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
  const [confirmCounterSync, setConfirmCounterSync] = useState(false);
  const [pendingCounterPin, setPendingCounterPin] = useState<string | null>(null);
  const [hasCounterSlots, setHasCounterSlots] = useState(false);
  const [showEmailLogin, setShowEmailLogin] = useState(false);

  const refreshCounterSlots = () => {
    listEnrolledWorkers(getLastCounterCompanyId())
      .then((slots) => {
        setHasCounterSlots(slots.length > 0);
        if (slots.length === 0) setShowEmailLogin(true);
      })
      .catch(() => {
        setHasCounterSlots(false);
        setShowEmailLogin(true);
      });
  };

  useEffect(() => {
    refreshCounterSlots();
    return subscribeCounterRegistryUpdated(refreshCounterSlots);
  }, []);

  useEffect(() => {
    authApi.hasPinSet().then(setHasPinSet);
    authApi.getPinLockedUntil().then(setPinLockedUntil);
  }, []);

  useEffect(() => {
    const onOauthComplete = (ev: Event) => {
      if (!googleOAuthPendingRef.current) return;
      googleOAuthPendingRef.current = false;
      const ce = ev as CustomEvent<OauthCompleteDetail>;
      const detail = ce.detail;
      void (async () => {
        try {
          if (!detail?.success) {
            setError(detail?.message || 'Google sign-in failed.');
            return;
          }
          const sess = await authApi.getSession();
          if (!sess) {
            setError('Could not read session after Google sign-in.');
            return;
          }
          const profile = await authApi.getProfile(sess.userId);
          if (!profile) {
            setError('Profile not found. Ask an admin to invite this account.');
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
          const freshlyHasPin = await authApi.hasPinSet();
          if (freshlyHasPin) {
            markUnlocked();
            onLogin(user, profile.companyId);
          } else {
            setShowSetPin(true);
            setUserForSetPin(user);
            setCompanyIdForSetPin(profile.companyId);
            setBranchIdForSetPin(profile.branchId ?? null);
          }
        } finally {
          setLoading(false);
        }
      })();
    };
    window.addEventListener(OAUTH_COMPLETE_EVENT, onOauthComplete);
    return () => window.removeEventListener(OAUTH_COMPLETE_EVENT, onOauthComplete);
  }, [onLogin]);

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
        const freshlyHasPin = await authApi.hasPinSet();
        if (freshlyHasPin) {
          markUnlocked();
          onLogin(user, data.companyId);
        } else {
          setShowSetPin(true);
          setUserForSetPin(user);
          setCompanyIdForSetPin(data.companyId);
          setBranchIdForSetPin(data.branchId ?? null);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const [userForSetPin, setUserForSetPin] = useState<User | null>(null);
  const [companyIdForSetPin, setCompanyIdForSetPin] = useState<string | null>(null);
  const [branchIdForSetPin, setBranchIdForSetPin] = useState<string | null>(null);

  const finishLogin = (user: User | null = userForSetPin, companyId: string | null = companyIdForSetPin) => {
    if (user) {
      markUnlocked();
      onLogin(user, companyId);
    }
    setShowSetPin(false);
    setUserForSetPin(null);
    setCompanyIdForSetPin(null);
    setBranchIdForSetPin(null);
    setSetPinValue('');
    setSetPinConfirm('');
    setConfirmCounterSync(false);
    setPendingCounterPin(null);
  };

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

      if (userForSetPin && companyIdForSetPin) {
        try {
          const prof = await authApi.getProfile(sessionWithRefresh.userId);
          const branchId = prof?.branchId ?? branchIdForSetPin ?? null;
          if (
            shouldOfferCounterPinSync(setPinValue, userForSetPin.role, companyIdForSetPin, branchId)
          ) {
            const existingUid = await getWorkerUserIdForPin(setPinValue);
            if (existingUid && existingUid !== sessionWithRefresh.userId) {
              console.warn(
                '[LoginScreen] Counter tablet PIN slot already taken by another user; skipping confirm.',
              );
            } else {
              setPendingCounterPin(setPinValue);
              setConfirmCounterSync(true);
              return;
            }
          }
        } catch (counterErr) {
          console.warn('[LoginScreen] Counter tablet PIN check error:', counterErr);
        }
      }

      finishLogin();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save PIN.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCounterYes = async () => {
    if (!pendingCounterPin || !userForSetPin || !companyIdForSetPin) {
      finishLogin();
      return;
    }
    setLoading(true);
    try {
      const prof = await authApi.getProfile(userForSetPin.id);
      const branchId = resolveCounterEnrollBranchId(
        userForSetPin.role,
        prof?.branchId ?? branchIdForSetPin ?? null,
      );
      await finalizeCounterWorkerEnrollment(
        pendingCounterPin,
        {
          userId: userForSetPin.id,
          displayName: prof?.name?.trim() || userForSetPin.name,
          email: userForSetPin.email,
          role: userForSetPin.role,
          profileId: userForSetPin.profileId,
          companyId: companyIdForSetPin,
          branchId,
        },
        companyIdForSetPin,
      );
    } catch (e) {
      console.warn('[LoginScreen] Counter tablet PIN save failed:', e);
    } finally {
      setLoading(false);
      finishLogin();
    }
  };

  const handleConfirmCounterNo = () => {
    finishLogin();
  };

  const handleSkipSetPin = () => {
    finishLogin();
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
            setError('Session expired. Sign in with email/password.');
            return;
          }
        }
        markUnlocked();
        if (onUnlock) {
          onUnlock();
          return;
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
        await authApi.signOutForTabletHandoff(_pinUnlockCompanyId ?? getLastCounterCompanyId());
        setHasPinSet(false);
      } else {
        const msg = !result.success && 'message' in result ? result.message : 'Wrong PIN';
        setError(msg || 'Wrong PIN');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUseEmailInstead = async () => {
    await authApi.signOutGlobal();
    await authApi.clearPin();
    window.location.reload();
  };

  const handleFullReset = async () => {
    if (
      !window.confirm(
        'Clear all cached data on this device?\n\nPIN, counter slots, offline queue, and login session will be removed. You will need to sign in again.',
      )
    ) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      await fullDeviceReset();
    } catch {
      setError('Could not reset app data. Use browser Settings → Clear site data for this URL.');
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const { error: e, pendingExternalBrowser } = await authApi.signInWithGoogle();
      if (e) {
        setError(e.message);
        return;
      }
      if (pendingExternalBrowser) {
        googleOAuthPendingRef.current = true;
        return;
      }
    } finally {
      if (!googleOAuthPendingRef.current) {
        setLoading(false);
      }
    }
  };

  // --- Set PIN modal (after first email/password login) ---
  const demoKeyBanner = erpMobileUsingDemoSupabaseAnonKey ? (
    <div
      role="alert"
      className="mb-4 w-full max-w-sm rounded-lg border border-amber-500/50 bg-amber-950/80 px-3 py-3 text-left text-sm text-amber-100"
    >
      <div className="flex gap-2">
        <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
        <div>
          <p className="font-semibold text-amber-50">Wrong Supabase anon key (demo JWT)</p>
          <p className="mt-1 text-amber-100/90 leading-snug">
            Copy <span className="font-mono text-xs">VITE_SUPABASE_ANON_KEY</span> from the main ERP{' '}
            <span className="font-mono text-xs">.env.production</span> into <span className="font-mono text-xs">erp-mobile-app/.env</span>, keep{' '}
            <span className="font-mono text-xs">VITE_SUPABASE_URL=https://supabase.dincouture.pk</span>, then restart{' '}
            <span className="font-mono text-xs">npm run dev</span>.
          </p>
        </div>
      </div>
    </div>
  ) : null;

  if (showSetPin && userForSetPin && confirmCounterSync) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        {demoKeyBanner}
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <KeyRound className="w-12 h-12 mx-auto mb-2 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Counter tablet PIN bhi yeh banaayein?</h2>
            <p className="text-sm text-[#9CA3AF] mt-2 leading-relaxed">
              POS aur Expense "Switch user" + shared lock screen par aapka naam isi 4-digit PIN se khulay ga. Tablet
              par har banda alag PIN choose kare — same PIN doosre user ka slot replace kar deti hai.
            </p>
            <p className="text-xs text-[#6B7280] mt-2">Device unlock PIN to already save ho chuki hai.</p>
          </div>
          <div className="space-y-3">
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleConfirmCounterYes()}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70 text-white font-medium rounded-lg flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Yes, save counter PIN'}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleConfirmCounterNo}
              className="w-full h-11 text-[#9CA3AF] text-sm hover:text-white transition-colors"
            >
              No, sirf device PIN rakhein
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showSetPin && userForSetPin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        {demoKeyBanner}
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <KeyRound className="w-12 h-12 mx-auto mb-2 text-[#3B82F6]" />
            <h2 className="text-lg font-semibold text-white">Set PIN for next time</h2>
            <p className="text-sm text-[#9CA3AF] mt-1">Enter 4–6 digits. Stored securely on this device.</p>
            <p className="text-xs text-[#6B7280] mt-2">
              Use exactly <span className="text-[#9CA3AF] font-medium">4 digits</span> if you want the same PIN on the
              shared lock screen (POS). With 5–6 digits, add Counter tablet PIN later in Settings.
            </p>
            <p className="text-xs text-[#6B7280] mt-1">
              Owner/admin: 4 digits also enrolls you on the POS lock screen (branch optional). Staff need an assigned
              branch for counter PIN.
            </p>
            <p className="text-xs text-[#6B7280] mt-1">Change or remove in Settings after login.</p>
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
        {demoKeyBanner}
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
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleFullReset()}
                className="mt-3 w-full text-xs text-[#6B7280] hover:text-amber-200"
              >
                Reset app data (clear cache)
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
      {demoKeyBanner}
      <div className="mb-8 text-center">
        <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] rounded-2xl flex items-center justify-center">
          <span className="text-3xl font-bold text-white">DC</span>
        </div>
        <h1 className="text-2xl font-bold mb-1 text-white">Din Collection</h1>
        <p className="text-sm text-[#9CA3AF]">Mobile ERP</p>
      </div>

      <div className="w-full max-w-sm">
        {!pinUnlockUser ? (
          <CounterLoginPanel
            companyId={getLastCounterCompanyId()}
            onLogin={onLogin}
            onUseFullLogin={() => {
              setError('');
              setShowEmailLogin(true);
            }}
          />
        ) : null}
        {!pinUnlockUser && (showEmailLogin || !hasCounterSlots) ? (
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
        ) : null}

        {(showEmailLogin || !hasCounterSlots) && (
        <div className="mt-4 space-y-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleGoogleSignIn()}
            className="w-full h-11 rounded-lg border border-[#374151] bg-[#1F2937] text-sm text-white hover:bg-[#374151] flex items-center justify-center gap-2 disabled:opacity-60"
          >
            Sign in with Google
          </button>
          {onCreateBusiness ? (
            <button
              type="button"
              disabled={loading}
              onClick={onCreateBusiness}
              className="w-full h-10 text-sm text-[#60A5FA] hover:text-[#93C5FD]"
            >
              New business? Create account
            </button>
          ) : null}
        </div>
        )}

        <button
          type="button"
          disabled={loading}
          onClick={() => void handleFullReset()}
          className="mt-6 w-full text-xs text-[#6B7280] hover:text-amber-200 transition-colors"
        >
          Reset app data (clear cache and reload)
        </button>
      </div>
    </div>
  );
}
