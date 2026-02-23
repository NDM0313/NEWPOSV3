import { useState } from 'react';
import { X, Lock, Loader2 } from 'lucide-react';
import * as authApi from '../../api/auth';

interface ChangePinModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'current' | 'new' | 'confirm';

export function ChangePinModal({ onClose, onSuccess }: ChangePinModalProps) {
  const [step, setStep] = useState<Step>('current');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerifyCurrent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentPin.length < 4) {
      setError('Enter your 4–6 digit PIN');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await authApi.verifyPin(currentPin);
      if (result.success) {
        setStep('new');
      } else if (result.locked) {
        setError('Too many attempts. Try again later.');
      } else {
        setError(result.message || 'Wrong PIN');
      }
    } catch {
      setError('Failed to verify');
    } finally {
      setLoading(false);
    }
  };

  const handleSetNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length < 4 || newPin.length > 6) {
      setError('PIN must be 4–6 digits');
      return;
    }
    setStep('confirm');
    setConfirmPin('');
    setError('');
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin !== confirmPin) {
      setError('PINs do not match');
      return;
    }
    if (confirmPin.length < 4) {
      setError('PIN must be 4–6 digits');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await authApi.changePin(currentPin, newPin);
      if (result.ok) {
        onSuccess();
        onClose();
      } else {
        setError(result.error || 'Failed to change PIN');
      }
    } catch {
      setError('Failed to change PIN');
    } finally {
      setLoading(false);
    }
  };

  const handleBackFromNew = () => {
    setStep('current');
    setNewPin('');
    setError('');
  };

  const handleBackFromConfirm = () => {
    setStep('new');
    setConfirmPin('');
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm bg-[#1F2937] border border-[#374151] rounded-xl shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-[#374151]">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-[#3B82F6]" />
            <h2 className="font-semibold text-white">
              {step === 'current' && 'Enter current PIN'}
              {step === 'new' && 'Enter new PIN'}
              {step === 'confirm' && 'Confirm new PIN'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#374151] rounded-lg text-[#9CA3AF]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={
            step === 'current' ? handleVerifyCurrent : step === 'new' ? handleSetNew : handleConfirm
          }
          className="p-4 space-y-4"
        >
          {step === 'current' && (
            <>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoComplete="off"
                placeholder="Current PIN"
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 bg-[#111827] border border-[#374151] rounded-lg text-white placeholder-[#6B7280] focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]"
                autoFocus
              />
            </>
          )}
          {step === 'new' && (
            <>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoComplete="new-password"
                placeholder="New PIN (4–6 digits)"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 bg-[#111827] border border-[#374151] rounded-lg text-white placeholder-[#6B7280] focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleBackFromNew}
                  className="flex-1 py-2.5 text-[#9CA3AF] hover:bg-[#374151] rounded-lg"
                >
                  Back
                </button>
                <button type="submit" className="flex-1 py-2.5 bg-[#3B82F6] text-white rounded-lg font-medium">
                  Next
                </button>
              </div>
            </>
          )}
          {step === 'confirm' && (
            <>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoComplete="new-password"
                placeholder="Confirm new PIN"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 bg-[#111827] border border-[#374151] rounded-lg text-white placeholder-[#6B7280] focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleBackFromConfirm}
                  className="flex-1 py-2.5 text-[#9CA3AF] hover:bg-[#374151] rounded-lg"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 bg-[#3B82F6] text-white rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Change PIN'}
                </button>
              </div>
            </>
          )}

          {step === 'current' && (
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#3B82F6] text-white rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Continue'}
            </button>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}
        </form>
      </div>
    </div>
  );
}
