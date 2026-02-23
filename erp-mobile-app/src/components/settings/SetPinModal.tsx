import { useState } from 'react';
import { X, Lock, Loader2 } from 'lucide-react';
import * as authApi from '../../api/auth';
import type { User } from '../../types';

interface SetPinModalProps {
  onClose: () => void;
  onSuccess: () => void;
  user: User;
  companyId: string | null;
  branchId: string | null;
}

export function SetPinModal({ onClose, onSuccess, user, companyId, branchId }: SetPinModalProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4 || pin.length > 6) {
      setError('PIN must be 4–6 digits');
      return;
    }
    if (pin !== confirmPin) {
      setError('PINs do not match');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const sessionWithRefresh = await authApi.getSessionWithRefresh();
      if (!sessionWithRefresh) {
        setError('Session lost. Please sign in again.');
        return;
      }
      await authApi.setPinWithPayload(pin, {
        refreshToken: sessionWithRefresh.refreshToken,
        userId: user.id,
        companyId,
        branchId,
        email: user.email,
      });
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save PIN.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm bg-[#1F2937] border border-[#374151] rounded-xl shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-[#374151]">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-[#3B82F6]" />
            <h2 className="font-semibold text-white">Set Quick PIN</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#374151] rounded-lg text-[#9CA3AF]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <p className="text-sm text-[#9CA3AF]">
            Enter a 4–6 digit PIN for faster unlock. You can change or remove it later in Settings.
          </p>
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoComplete="new-password"
            placeholder="New PIN (4–6 digits)"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            className="w-full px-4 py-3 bg-[#111827] border border-[#374151] rounded-lg text-white placeholder-[#6B7280] focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]"
            autoFocus
          />
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoComplete="new-password"
            placeholder="Confirm PIN"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
            className="w-full px-4 py-3 bg-[#111827] border border-[#374151] rounded-lg text-white placeholder-[#6B7280] focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#3B82F6] text-white rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Set PIN'}
          </button>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </form>
      </div>
    </div>
  );
}
