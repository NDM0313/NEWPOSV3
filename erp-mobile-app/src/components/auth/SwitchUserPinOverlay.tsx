import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import * as authApi from '../../api/auth';
import { getCounterUserForPin } from '../../lib/counterUserVault';

interface SwitchUserPinOverlayProps {
  open: boolean;
  onClose: () => void;
  onSessionReplaced: (profile: authApi.AuthProfile) => void | Promise<void>;
}

export function SwitchUserPinOverlay({ open, onClose, onSessionReplaced }: SwitchUserPinOverlayProps) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

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
    if (pin.length !== 4) {
      setError('Enter 4 digits.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = await getCounterUserForPin(pin);
      if (!payload?.refreshToken) {
        setError('Unknown PIN or could not unlock.');
        setBusy(false);
        return;
      }
      const refreshed = await authApi.refreshSessionFromRefreshToken(payload.refreshToken);
      if (!refreshed.ok) {
        setError(refreshed.error || 'Session refresh failed.');
        setBusy(false);
        return;
      }
      const session = await authApi.getSession();
      if (!session) {
        setError('No session after refresh.');
        setBusy(false);
        return;
      }
      const profile = await authApi.getProfile(session.userId);
      if (!profile) {
        setError('Could not load profile.');
        setBusy(false);
        return;
      }
      await onSessionReplaced(profile);
      setPin('');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Switch failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-[#1F2937] border border-[#374151] p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Switch user</h2>
          <button
            type="button"
            onClick={() => { if (!busy) { setPin(''); setError(null); onClose(); } }}
            className="p-2 rounded-lg text-[#9CA3AF] hover:bg-[#374151] hover:text-white"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-[#9CA3AF] mb-4">Enter the 4-digit counter PIN saved for this device.</p>
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
        {error ? <p className="text-sm text-red-400 mb-3 text-center">{error}</p> : null}
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
          className="w-full h-12 rounded-xl bg-[#3B82F6] text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          {busy ? 'Switching…' : 'Switch'}
        </button>
      </div>
    </div>
  );
}
