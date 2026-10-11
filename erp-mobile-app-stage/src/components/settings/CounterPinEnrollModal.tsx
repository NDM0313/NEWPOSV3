import { useEffect, useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import type { Branch } from '../../types';
import * as employeesApi from '../../api/employees';
import {
  countWorkers,
  findEnrolledWorkerByIdentity,
  getWorkerUserIdForPin,
  saveCounterWorker,
  saveCounterWorkerWithPinHash,
  type EnrolledCounterWorker,
} from '../../lib/counterWorkerRegistry';
import { setSharedCounterModeEnabled } from '../../lib/sharedCounterMode';
import { PinNumericInput } from '../common/PinNumericInput';

interface CounterPinEnrollModalProps {
  open: boolean;
  companyId: string;
  companyBranches: Branch[];
  enrolledWorkers: EnrolledCounterWorker[];
  onClose: () => void;
  onEnrolled: () => void | Promise<void>;
  onSyncResult?: (message: string) => void;
}

function employeeDisplayName(emp: employeesApi.Employee): string {
  const u = emp.user;
  return u?.full_name?.trim() || u?.name?.trim() || u?.email?.split('@')[0] || 'Employee';
}

function isEmployeeEnrolled(emp: employeesApi.Employee, enrolled: EnrolledCounterWorker[]): boolean {
  return enrolled.some((p) => p.profileId === emp.user_id || p.userId === emp.user_id);
}

export function CounterPinEnrollModal({
  open,
  companyId,
  companyBranches,
  enrolledWorkers,
  onClose,
  onEnrolled,
  onSyncResult,
}: CounterPinEnrollModalProps) {
  const [employees, setEmployees] = useState<employeesApi.Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [lockedBranchId, setLockedBranchId] = useState<string | null>(null);
  const [lockedBranchName, setLockedBranchName] = useState<string | null>(null);
  const [loadingBranch, setLoadingBranch] = useState(false);
  const [branchError, setBranchError] = useState<string | null>(null);
  const [existingRegistryEntry, setExistingRegistryEntry] = useState<EnrolledCounterWorker | null>(null);
  const [loadingRegistry, setLoadingRegistry] = useState(false);
  const [pinA, setPinA] = useState('');
  const [pinB, setPinB] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const concreteBranches = useMemo(
    () => companyBranches.filter((b) => b.id && b.id !== 'all'),
    [companyBranches],
  );

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.is_active !== false && e.user_id),
    [employees],
  );

  const selectedEmployee = activeEmployees.find((e) => e.id === selectedEmployeeId) ?? null;
  const inheritExistingPin = Boolean(existingRegistryEntry?.pinHash);

  useEffect(() => {
    if (!open || !companyId) return;
    setError(null);
    setPinA('');
    setPinB('');
    setSelectedEmployeeId(null);
    setLockedBranchId(null);
    setLockedBranchName(null);
    setBranchError(null);
    setExistingRegistryEntry(null);
    setLoadingEmployees(true);
    void employeesApi.getEmployees(companyId).then(({ data, error: err }) => {
      setLoadingEmployees(false);
      if (err) {
        setError(err);
        setEmployees([]);
        return;
      }
      setEmployees(data ?? []);
    });
  }, [open, companyId]);

  useEffect(() => {
    if (!selectedEmployee || !companyId) {
      setLockedBranchId(null);
      setLockedBranchName(null);
      setBranchError(null);
      setExistingRegistryEntry(null);
      return;
    }
    let cancelled = false;
    setLoadingBranch(true);
    setLoadingRegistry(true);
    setBranchError(null);
    setExistingRegistryEntry(null);

    void (async () => {
      const authUserId = await employeesApi.resolveAuthUserIdForEmployee(selectedEmployee.user_id);
      if (cancelled) return;
      if (!authUserId) {
        setLoadingBranch(false);
        setLoadingRegistry(false);
        setBranchError('Is employee ka auth account nahi mila.');
        return;
      }

      const [branchRes, registryEntry] = await Promise.all([
        employeesApi.getEmployeeEffectiveBranch(selectedEmployee.user_id, companyId),
        findEnrolledWorkerByIdentity(authUserId, selectedEmployee.user_id, companyId),
      ]);

      if (cancelled) return;
      setLoadingBranch(false);
      setLoadingRegistry(false);
      setExistingRegistryEntry(registryEntry);

      if (branchRes.error || !branchRes.branchId) {
        setLockedBranchId(null);
        setLockedBranchName(null);
        setBranchError(branchRes.error || 'Branch resolve nahi ho saki.');
        return;
      }

      setLockedBranchId(branchRes.branchId);
      const branchName =
        concreteBranches.find((b) => b.id === branchRes.branchId)?.name ?? branchRes.branchId;
      setLockedBranchName(branchName);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedEmployee, companyId, concreteBranches]);

  if (!open) return null;

  const canSave =
    Boolean(selectedEmployee) &&
    !loadingBranch &&
    !loadingRegistry &&
    (inheritExistingPin || (/^\d{4}$/.test(pinA) && /^\d{4}$/.test(pinB))) &&
    (Boolean(lockedBranchId) || !branchError);

  const resolveBranchForSave = async (): Promise<string | null> => {
    if (lockedBranchId) return lockedBranchId;
    if (!selectedEmployee) return null;
    const branchRes = await employeesApi.getEmployeeEffectiveBranch(selectedEmployee.user_id, companyId);
    if (branchRes.branchId) {
      setLockedBranchId(branchRes.branchId);
      const branchName =
        concreteBranches.find((b) => b.id === branchRes.branchId)?.name ?? branchRes.branchId;
      setLockedBranchName(branchName);
      setBranchError(null);
      return branchRes.branchId;
    }
    setBranchError(branchRes.error || 'Branch resolve nahi ho saki.');
    return null;
  };

  const handleSave = async () => {
    if (!selectedEmployee) {
      setError('Pehle employee select karein.');
      return;
    }
    const branchIdForSave = await resolveBranchForSave();
    if (!branchIdForSave) {
      setError(branchError || 'Employee branch assign karein phir save karein.');
      return;
    }
    if (!inheritExistingPin) {
      if (!/^\d{4}$/.test(pinA) || !/^\d{4}$/.test(pinB)) {
        setError('PIN exactly 4 digits hona chahiye.');
        return;
      }
      if (pinA !== pinB) {
        setError('PIN match nahi kar raha.');
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      const authUserId = await employeesApi.resolveAuthUserIdForEmployee(selectedEmployee.user_id);
      if (!authUserId) {
        setError('Is employee ka auth account nahi mila.');
        return;
      }
      const hadNoSlots = (await countWorkers(companyId)) === 0;
      const displayName = employeeDisplayName(selectedEmployee);
      const email = selectedEmployee.user?.email?.trim() || '';
      const role = selectedEmployee.user?.role?.trim() || 'user';
      const workerInput = {
        userId: authUserId,
        profileId: selectedEmployee.user_id,
        displayName,
        email,
        role,
        companyId,
        branchId: branchIdForSave,
      };

      if (inheritExistingPin && existingRegistryEntry?.pinHash) {
        await saveCounterWorkerWithPinHash(existingRegistryEntry.pinHash, workerInput);
      } else {
        const existingUid = await getWorkerUserIdForPin(pinA);
        if (existingUid && existingUid !== authUserId) {
          setError('Yeh PIN is tablet par kisi aur ke naam par hai. Alag PIN choose karein.');
          return;
        }
        await saveCounterWorker(pinA, workerInput);
      }

      if (hadNoSlots) {
        setSharedCounterModeEnabled(true);
      }
      onSyncResult?.(
        inheritExistingPin
          ? `Counter PIN (existing) linked for ${displayName}.`
          : `Counter PIN saved for ${displayName}.`,
      );
      await onEnrolled();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-[#1F2937] border border-[#374151] p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-white">Counter tablet PIN</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="p-2 rounded-lg text-[#9CA3AF] hover:bg-[#374151] hover:text-white"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-[#9CA3AF] mb-4 leading-relaxed">
          Active employee choose karein. Branch employee profile se auto-lock hoti hai — admin override nahi.
        </p>

        {error ? <p className="text-sm text-red-400 mb-3">{error}</p> : null}

        <label className="block text-xs text-[#9CA3AF] mb-2">Employee</label>
        {loadingEmployees ? (
          <div className="flex items-center gap-2 py-4 text-[#9CA3AF] text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading employees…
          </div>
        ) : activeEmployees.length === 0 ? (
          <p className="text-sm text-amber-200/90 mb-4">
            Koi active employee nahi — pehle Company → Employees se staff add karein.
          </p>
        ) : (
          <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
            {activeEmployees.map((emp) => {
              const name = employeeDisplayName(emp);
              const enrolled = isEmployeeEnrolled(emp, enrolledWorkers);
              return (
                <button
                  key={emp.id}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setSelectedEmployeeId(emp.id);
                    setError(null);
                    setPinA('');
                    setPinB('');
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors ${
                    selectedEmployeeId === emp.id
                      ? 'border-[#3B82F6] bg-[#3B82F6]/10'
                      : 'border-[#374151] bg-[#111827] hover:border-[#4B5563]'
                  }`}
                >
                  <span className="text-sm font-medium text-white block">{name}</span>
                  {emp.user?.email ? (
                    <span className="text-[10px] text-[#6B7280]">{emp.user.email}</span>
                  ) : null}
                  {enrolled ? (
                    <span className="text-[10px] text-emerald-400 block mt-0.5">Already on this tablet</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}

        {selectedEmployee ? (
          <>
            <label className="block text-xs text-[#9CA3AF] mb-1">Branch (locked)</label>
            {loadingBranch ? (
              <p className="text-xs text-[#6B7280] mb-3">Loading branch…</p>
            ) : branchError ? (
              <p className="text-xs text-amber-200/90 mb-3">{branchError}</p>
            ) : lockedBranchName ? (
              <p className="text-sm text-white mb-3 rounded-lg bg-[#111827] border border-[#374151] px-3 py-2">
                {lockedBranchName}
                <span className="text-[10px] text-[#6B7280] block mt-0.5">Employee profile se auto-detected</span>
              </p>
            ) : null}

            {loadingRegistry ? (
              <p className="text-xs text-[#6B7280] mb-3">Checking existing PIN…</p>
            ) : inheritExistingPin ? (
              <p className="text-xs text-emerald-200/90 mb-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2">
                Is device par pehle se counter PIN set hai — wahi use hogi. Naya PIN enter karne ki zaroorat nahi.
              </p>
            ) : (
              <>
                <label className="block text-xs text-[#9CA3AF] mb-1">4-digit PIN</label>
                <PinNumericInput
                  value={pinA}
                  onChange={(v) => setPinA(v.slice(0, 4))}
                  maxLength={4}
                  autoComplete="off"
                  enterKeyHint="next"
                  placeholder="••••"
                  className="w-full mb-3 rounded-lg bg-[#111827] border border-[#374151] px-3 py-2 text-white text-center tracking-widest"
                />
                <label className="block text-xs text-[#9CA3AF] mb-1">Confirm PIN</label>
                <PinNumericInput
                  value={pinB}
                  onChange={(v) => setPinB(v.slice(0, 4))}
                  maxLength={4}
                  autoComplete="off"
                  enterKeyHint="done"
                  placeholder="••••"
                  className="w-full mb-4 rounded-lg bg-[#111827] border border-[#374151] px-3 py-2 text-white text-center tracking-widest"
                />
              </>
            )}
          </>
        ) : null}

        <div className="flex gap-2 sticky bottom-0 pt-2 bg-[#1F2937]">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 h-11 rounded-xl bg-[#374151] text-white font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !canSave || activeEmployees.length === 0}
            onClick={() => void handleSave()}
            className="flex-1 h-11 rounded-xl bg-emerald-600 text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {busy ? 'Saving…' : inheritExistingPin ? 'Enroll (existing PIN)' : 'Save PIN'}
          </button>
        </div>
        {!canSave && selectedEmployee && !loadingBranch && !loadingRegistry ? (
          <p className="text-[10px] text-[#6B7280] mt-2 text-center">
            {branchError
              ? branchError
              : !inheritExistingPin && (!/^\d{4}$/.test(pinA) || !/^\d{4}$/.test(pinB))
                ? '4-digit PIN do baar enter karein, phir Save dabayein.'
                : null}
          </p>
        ) : null}
      </div>
    </div>
  );
}
