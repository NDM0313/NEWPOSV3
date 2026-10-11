import { useEffect, useState } from 'react';
import { Loader2, Lock, LogOut } from 'lucide-react';
import { subscribeCounterRegistryUpdated } from '../../lib/counterPinFromDevicePin';
import {
  listEnrolledWorkers,
  type EnrolledCounterWorker,
} from '../../lib/counterWorkerRegistry';
import { useCounterWorker } from '../../context/CounterWorkerContext';
import { getFunctionalRoleLabel } from '../../config/functionalRoles';

interface POSLockScreenProps {
  companyId: string | null;
  showPermanentSignOut: boolean;
  /** Full sign-out (email/password login). */
  onUseFullLogin: () => void;
  title?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

function avatarColor(seed: string): string {
  const palette = [
    'bg-[#3B82F6]',
    'bg-[#10B981]',
    'bg-[#8B5CF6]',
    'bg-[#F59E0B]',
    'bg-[#EC4899]',
    'bg-[#06B6D4]',
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h + seed.charCodeAt(i)) % palette.length;
  return palette[h] ?? palette[0];
}

export function POSLockScreen({
  companyId,
  showPermanentSignOut,
  onUseFullLogin,
  title = 'Who is using this counter?',
}: POSLockScreenProps) {
  const { selectWorker } = useCounterWorker();
  const [profiles, setProfiles] = useState<EnrolledCounterWorker[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [selected, setSelected] = useState<EnrolledCounterWorker | null>(null);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadProfiles = () => {
      listEnrolledWorkers(companyId)
        .then((rows) => {
          if (!cancelled) setProfiles(rows);
        })
        .catch(() => {
          if (!cancelled) setProfiles([]);
        })
        .finally(() => {
          if (!cancelled) setLoadingProfiles(false);
        });
    };

    loadProfiles();
    const unsubRegistry = subscribeCounterRegistryUpdated(loadProfiles);

    return () => {
      cancelled = true;
      unsubRegistry();
    };
  }, [companyId]);

  const submit = async (pinValue?: string) => {
    const attempt = pinValue ?? pin;
    if (!selected || attempt.length !== 4) {
      if (!pinValue) setError('Select your name and enter your 4-digit PIN.');
      return;
    }
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await selectWorker(attempt, selected.userId, companyId);
      if (!result.ok) {
        setError(result.error);
        setPin('');
        return;
      }
      setPin('');
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unlock failed.');
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  const append = (d: string) => {
    setError(null);
    if (busy || pin.length >= 4) return;
    const next = (pin + d).slice(0, 4);
    setPin(next);
    if (next.length === 4 && selected) {
      void submit(next);
    }
  };

  const backspace = () => {
    if (busy) return;
    setError(null);
    setPin((p) => p.slice(0, -1));
  };

  return (
    <div className="min-h-screen bg-[#111827] text-[#F9FAFB] flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-lg mx-auto w-full">
        <div className="flex items-center gap-2 mb-2">
          <Lock className="w-6 h-6 text-[#10B981]" />
          <h1 className="text-xl font-semibold text-white text-center">{title}</h1>
        </div>
        <div className="text-sm text-[#9CA3AF] mb-8 text-center space-y-1">
          <p>Tap your name, then enter your 4-digit counter PIN (saved in Settings → Counter tablet PIN).</p>
          <p className="text-xs text-[#6B7280]">
            This is not the same as your device quick PIN (4–6 digits after email login).
          </p>
        </div>

        {loadingProfiles ? (
          <Loader2 className="w-10 h-10 text-[#3B82F6] animate-spin" />
        ) : profiles.length === 0 ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-[#9CA3AF]">No users enrolled on this device.</p>
            <p className="text-xs text-[#6B7280]">
              Ask an admin to enroll counter PINs in Settings, or sign in with email.
            </p>
            {showPermanentSignOut ? (
              <button
                type="button"
                onClick={onUseFullLogin}
                className="text-sm text-[#3B82F6] hover:text-white underline"
              >
                Use email / password
              </button>
            ) : null}
          </div>
        ) : !selected ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full">
            {profiles.map((profile) => (
              <button
                key={profile.pinHash}
                type="button"
                onClick={() => {
                  setSelected(profile);
                  setPin('');
                  setError(null);
                }}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-[#1F2937] border border-[#374151] hover:border-[#3B82F6] transition-colors"
              >
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-semibold text-white ${avatarColor(
                    profile.pinHash,
                  )}`}
                >
                  {initials(profile.displayName)}
                </div>
                <span className="text-sm font-medium text-white text-center line-clamp-2">
                  {profile.displayName}
                </span>
                <span className="text-xs text-[#9CA3AF] text-center line-clamp-1">
                  {profile.role ? getFunctionalRoleLabel(profile.role) : 'Staff'}
                </span>
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
              className="self-start text-xs text-[#3B82F6] mb-4"
            >
              ← All users
            </button>
            <div className="flex flex-col items-center mb-6">
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-semibold text-white mb-2 ${avatarColor(
                  selected.pinHash,
                )}`}
              >
                {initials(selected.displayName)}
              </div>
              <p className="text-lg font-medium text-white">{selected.displayName}</p>
              {selected.email ? (
                <p className="text-xs text-[#6B7280] mt-0.5">{selected.email}</p>
              ) : null}
            </div>
            <div className="flex justify-center gap-2 mb-6">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-11 h-14 rounded-lg bg-[#1F2937] border border-[#374151] flex items-center justify-center text-xl text-white font-mono"
                >
                  {pin[i] ? '•' : ''}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 w-full max-w-xs mb-4">
              {(['1', '2', '3', '4', '5', '6', '7', '8', '9', 'spacer', '0', 'del'] as const).map((key, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={busy || key === 'spacer'}
                  onClick={() => {
                    if (key === 'del') backspace();
                    else if (key !== 'spacer') append(key);
                  }}
                  className="h-14 rounded-xl bg-[#374151] text-white font-medium text-lg disabled:opacity-30 hover:bg-[#4B5563]"
                >
                  {key === 'del' ? '⌫' : key === 'spacer' ? '' : key}
                </button>
              ))}
            </div>
            {busy ? (
              <div className="flex items-center justify-center gap-2 text-sm text-[#9CA3AF] mt-2">
                <Loader2 className="w-5 h-5 animate-spin text-[#3B82F6]" />
                Unlocking…
              </div>
            ) : null}
          </>
        )}

        {error ? (
          <div className="mt-6 text-center space-y-3 max-w-sm">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        ) : null}
      </div>

      {showPermanentSignOut ? (
        <div className="p-6 border-t border-[#374151] flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={onUseFullLogin}
            className="inline-flex items-center gap-2 text-sm text-[#9CA3AF] hover:text-white"
          >
            <LogOut className="w-4 h-4" />
            Sign out completely (email / password)
          </button>
        </div>
      ) : null}
    </div>
  );
}
