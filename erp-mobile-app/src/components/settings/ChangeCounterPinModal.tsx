import { useState } from 'react';
import { X, KeyRound, Loader2 } from 'lucide-react';
import { notifyCounterRegistryUpdated } from '../../lib/counterPinFromDevicePin';
import {
  getWorkerUserIdForPin,
  saveCounterWorker,
  type EnrolledCounterWorker,
} from '../../lib/counterWorkerRegistry';

interface ChangeCounterPinModalProps {
  enrollment: EnrolledCounterWorker;
  onClose: () => void;
  onSuccess: () => void;
}

export function ChangeCounterPinModal({ enrollment, onClose, onSuccess }: ChangeCounterPinModalProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(pin)) {
      setError('Counter PIN exactly 4 digits hona chahiye.');
      return;
    }
    if (pin !== confirmPin) {
      setError('PIN match nahi kar raha.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const existingUid = await getWorkerUserIdForPin(pin);
      if (existingUid && existingUid !== enrollment.userId) {
        setError('Yeh PIN is tablet par kisi aur ke naam par hai. Alag PIN choose karein.');
        return;
      }
      await saveCounterWorker(pin, {
        userId: enrollment.userId,
        displayName: enrollment.displayName,
        email: enrollment.email,
        role: enrollment.role,
        profileId: enrollment.profileId,
        companyId: enrollment.companyId,
        branchId: enrollment.branchId ?? null,
      });
      notifyCounterRegistryUpdated();
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm bg-[#1F2937] border border-[#374151] rounded-xl shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-[#374151]">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-emerald-400" />
            <h2 className="font-semibold text-white">Change counter PIN</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#374151] rounded-lg text-[#9CA3AF]">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="p-4 space-y-4">
          <p className="text-sm text-[#9CA3AF]">
            POS lock screen par <span className="text-white font-medium">{enrollment.displayName}</span> ke liye naya
            4-digit PIN set karein.
          </p>
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            autoComplete="new-password"
            placeholder="New 4-digit PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            className="w-full px-4 py-3 bg-[#111827] border border-[#374151] rounded-lg text-white placeholder-[#6B7280] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            autoFocus
          />
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            autoComplete="new-password"
            placeholder="Confirm PIN"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
            className="w-full px-4 py-3 bg-[#111827] border border-[#374151] rounded-lg text-white placeholder-[#6B7280] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70 text-white font-medium rounded-lg flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save counter PIN'}
          </button>
        </form>
      </div>
    </div>
  );
}
