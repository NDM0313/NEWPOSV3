import { useState } from 'react';
import { X, Lock, Loader2, KeyRound } from 'lucide-react';
import * as authApi from '../../api/auth';
import type { User } from '../../types';
import { getPinLockSettings, setPinLockSettings } from '../../lib/pinLock';
import {
  COUNTER_SESSION_POLICY_OPTIONS,
  getCounterSessionPolicy,
  getDevicePinMaxAgeMs,
} from '../../lib/counterSessionPolicy';
import {
  finalizeCounterWorkerEnrollment,
  resolveCounterEnrollBranchId,
  shouldOfferCounterPinSync,
} from '../../lib/counterPinFromDevicePin';
import { getWorkerUserIdForPin } from '../../lib/counterWorkerRegistry';
import { PinNumericInput } from '../common/PinNumericInput';

interface SetPinModalProps {
  onClose: () => void;
  onSuccess: () => void;
  user: User;
  companyId: string | null;
  branchId: string | null;
}

function policyLabel(): string {
  const id = getCounterSessionPolicy();
  return COUNTER_SESSION_POLICY_OPTIONS.find((o) => o.id === id)?.label ?? '7 days (recommended)';
}

export function SetPinModal({ onClose, onSuccess, user, companyId, branchId }: SetPinModalProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const initialLockSettings = getPinLockSettings();
  const [requireOnResume, setRequireOnResume] = useState(initialLockSettings.enabled);
  const [confirmCounterEnroll, setConfirmCounterEnroll] = useState(false);
  const [savedDevicePin, setSavedDevicePin] = useState<string | null>(null);

  const finishSuccess = () => {
    onSuccess();
    onClose();
  };

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
      setPinLockSettings({ enabled: requireOnResume, timeoutMs: getDevicePinMaxAgeMs() });

      if (shouldOfferCounterPinSync(pin, user.role, companyId, branchId)) {
        try {
          const existingUid = await getWorkerUserIdForPin(pin);
          if (existingUid && existingUid !== user.id) {
            finishSuccess();
            return;
          }
          setSavedDevicePin(pin);
          setConfirmCounterEnroll(true);
          return;
        } catch {
          /* skip counter prompt */
        }
      }
      finishSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save PIN.');
    } finally {
      setLoading(false);
    }
  };

  const handleCounterEnrollYes = async () => {
    if (!savedDevicePin || !companyId) {
      finishSuccess();
      return;
    }
    setLoading(true);
    try {
      await finalizeCounterWorkerEnrollment(
        savedDevicePin,
        {
          userId: user.id,
          displayName: user.name?.trim() || user.email?.split('@')[0] || 'User',
          email: user.email,
          role: user.role,
          profileId: user.profileId,
          companyId,
          branchId: resolveCounterEnrollBranchId(user.role, branchId),
        },
        companyId,
      );
    } catch (e) {
      console.warn('[SetPinModal] Counter worker enroll failed:', e);
    } finally {
      setLoading(false);
      finishSuccess();
    }
  };

  if (confirmCounterEnroll && savedDevicePin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="w-full max-w-sm bg-[#1F2937] border border-[#374151] rounded-xl shadow-xl p-5">
          <div className="mb-4 text-center">
            <KeyRound className="w-10 h-10 mx-auto mb-2 text-emerald-400" />
            <h2 className="font-semibold text-white">Counter tablet PIN bhi save karein?</h2>
            <p className="text-sm text-[#9CA3AF] mt-2">
              POS lock screen par isi 4-digit PIN se aapka naam khule ga. Device quick PIN already save ho chuki hai.
            </p>
          </div>
          <div className="space-y-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleCounterEnrollYes()}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70 text-white font-medium rounded-lg"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Yes, save counter PIN'}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={finishSuccess}
              className="w-full py-2 text-sm text-[#9CA3AF] hover:text-white"
            >
              No, sirf device PIN
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          <p className="text-xs text-[#6B7280]">
            Exactly 4 digits enables optional counter tablet PIN on the shared lock screen.
          </p>
          <PinNumericInput
            autoComplete="new-password"
            enterKeyHint="next"
            placeholder="New PIN (4–6 digits)"
            value={pin}
            onChange={setPin}
            className="w-full px-4 py-3 bg-[#111827] border border-[#374151] rounded-lg text-white placeholder-[#6B7280] focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]"
            autoFocus
          />
          <PinNumericInput
            autoComplete="new-password"
            enterKeyHint="done"
            placeholder="Confirm PIN"
            value={confirmPin}
            onChange={setConfirmPin}
            className="w-full px-4 py-3 bg-[#111827] border border-[#374151] rounded-lg text-white placeholder-[#6B7280] focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]"
          />

          <div className="pt-2 border-t border-[#374151]">
            <label className="flex items-center justify-between gap-3 py-2">
              <span className="text-sm text-white font-medium">Require PIN on resume</span>
              <input
                type="checkbox"
                checked={requireOnResume}
                onChange={(e) => setRequireOnResume(e.target.checked)}
                className="w-5 h-5 rounded border-[#374151] bg-[#111827] text-[#3B82F6] focus:ring-[#3B82F6]"
              />
            </label>
            <p className="text-xs text-[#6B7280] -mt-1 mb-2">
              Re-lock timing follows <strong className="text-[#9CA3AF]">PIN session freshness</strong> in Settings
              Counter ({policyLabel()}). Switching apps briefly will not ask PIN again until that window passes.
            </p>
          </div>

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
