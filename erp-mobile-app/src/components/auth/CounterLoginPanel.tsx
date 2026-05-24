import { useEffect, useState } from 'react';
import { Loader2, Users } from 'lucide-react';
import {
  listEnrolledCounterProfiles,
  type EnrolledCounterProfile,
} from '../../lib/counterUserVault';
import { unlockWithCounterPin } from '../../lib/counterPinUnlock';
import { getCounterSyncStaleWarning } from '../../lib/counterSessionPolicy';
import { maintainCounterVaultTokens } from '../../lib/counterVaultMaintenance';
import type { User } from '../../types';

interface CounterLoginPanelProps {
  companyId?: string | null;
  onLogin: (user: User, companyId: string | null) => void;
  onUseFullLogin: () => void;
}

export function CounterLoginPanel({ companyId, onLogin, onUseFullLogin }: CounterLoginPanelProps) {
  const [slots, setSlots] = useState<EnrolledCounterProfile[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [selected, setSelected] = useState<EnrolledCounterProfile | null>(null);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vaultRefreshing, setVaultRefreshing] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void maintainCounterVaultTokens().finally(() => {
      if (cancelled) return;
      listEnrolledCounterProfiles(companyId)
        .then(setSlots)
        .catch(() => setSlots([]))
        .finally(() => {
          if (!cancelled) {
            setLoadingSlots(false);
            setVaultRefreshing(false);
          }
        });
    });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const append = (d: string) => {
    setError(null);
    if (pin.length >= 4) return;
    setPin((p) => (p + d).slice(0, 4));
  };

  const backspace = () => {
    setError(null);
    setPin((p) => p.slice(0, -1));
  };

  const submit = async () => {
    if (!selected || pin.length !== 4) {
      setError('Select your name and enter 4-digit PIN.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await unlockWithCounterPin(pin, {
        expectedUserId: selected.userId,
        companyId,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const profile = result.profile;
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  if (loadingSlots || vaultRefreshing) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2">
        <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin" />
        <p className="text-xs text-[#6B7280]">Refreshing tablet session…</p>
      </div>
    );
  }

  if (slots.length === 0) return null;

  return (
    <div className="w-full max-w-sm mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-5 h-5 text-[#10B981]" />
        <h2 className="text-sm font-semibold text-white">Counter sign-in</h2>
      </div>
      <p className="text-xs text-[#9CA3AF] mb-3">Tap your name, then enter your 4-digit PIN.</p>

      {!selected ? (
        <div className="grid grid-cols-2 gap-2 mb-4">
          {slots.map((slot) => (
            <button
              key={slot.pinHash}
              type="button"
              onClick={() => {
                setSelected(slot);
                setPin('');
                setError(null);
              }}
              className="py-3 px-3 rounded-xl bg-[#1F2937] border border-[#374151] text-left hover:border-[#3B82F6] transition-colors"
            >
              <span className="text-sm font-medium text-white block truncate">{slot.displayName}</span>
            </button>
          ))}
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setPin('');
              setError(null);
            }}
            className="text-xs text-[#3B82F6] mb-3"
          >
            ← Choose another user
          </button>
          <p className="text-sm text-white font-medium mb-2">{selected.displayName}</p>
          {getCounterSyncStaleWarning(selected.lastTokenSyncAt) ? (
            <p className="text-xs text-amber-200/90 text-center mb-3 px-2">
              {getCounterSyncStaleWarning(selected.lastTokenSyncAt)}
            </p>
          ) : null}
          <div className="flex justify-center gap-2 mb-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-10 h-12 rounded-lg bg-[#111827] border border-[#374151] flex items-center justify-center text-xl text-white font-mono"
              >
                {pin[i] ? '•' : ''}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {(['1', '2', '3', '4', '5', '6', '7', '8', '9', 'spacer', '0', 'del'] as const).map((key, idx) => (
              <button
                key={idx}
                type="button"
                disabled={busy || key === 'spacer'}
                onClick={() => {
                  if (key === 'del') backspace();
                  else if (key !== 'spacer') append(key);
                }}
                className="h-12 rounded-xl bg-[#374151] text-white font-medium text-lg disabled:opacity-30 hover:bg-[#4B5563]"
              >
                {key === 'del' ? '⌫' : key === 'spacer' ? '' : key}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={busy || pin.length !== 4}
            onClick={() => void submit()}
            className="w-full h-12 rounded-xl bg-[#3B82F6] text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50 mb-3"
          >
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            Sign in
          </button>
        </>
      )}

      {error ? <p className="text-sm text-red-400 mb-3 text-center">{error}</p> : null}

      <button type="button" onClick={onUseFullLogin} className="w-full text-sm text-[#9CA3AF] hover:text-white">
        Use email / password instead
      </button>
    </div>
  );
}
