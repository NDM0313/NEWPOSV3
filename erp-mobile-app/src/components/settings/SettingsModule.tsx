import { useState, useEffect, useMemo, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  ArrowLeft,
  Settings as SettingsIcon,
  LogOut,
  Info,
  MapPin,
  ChevronRight,
  Building2,
  Lock,
  KeyRound,
  RefreshCw,
  Trash2,
  Shield,
  Database,
  Loader2,
  UserCog,
  UserPlus,
  Briefcase,
  Shirt,
  Plus,
} from 'lucide-react';
import { createBranch as createBranchApi, getBranches } from '../../api/branches';
import type { User, Branch } from '../../types';
import * as authApi from '../../api/auth';
import * as settingsApi from '../../api/settings';
import { runSync } from '../../lib/syncEngine';
import { getUnsyncedCount, clearAllPending } from '../../lib/offlineStore';
import { ChangePinModal } from './ChangePinModal';
import {
  getPinLockSettings,
  setPinLockSettings,
  type PinIdleTimeoutId,
} from '../../lib/pinLock';
import { ChangeCounterPinModal } from './ChangeCounterPinModal';
import { SetPinModal } from './SetPinModal';
import { ConnectionDebug } from '../dev/ConnectionDebug';
import { UserPermissionsScreen } from './UserPermissionsScreen';
import { EmployeesSection } from './EmployeesSection';
import { AddUserSheet } from './AddUserSheet';
import { usePermissions } from '../../context/PermissionContext';
import { FEATURE_MOBILE_PERMISSION_V2 } from '../../config/featureFlags';
import { APP_VERSION, registerAppVersionTap } from '../../lib/developerMode';
import { DeveloperToolsSection } from './DeveloperToolsSection';
import { ModuleTogglesSection } from './ModuleTogglesSection';
import { SettingsCollapsible, SettingsRow } from './settingsUi';
import { SettingsCounterSection } from './SettingsCounterSection';
import { CounterPinEnrollModal } from './CounterPinEnrollModal';
import { SettingsPrinterSection } from './SettingsPrinterSection';
import {
  countWorkers,
  findEnrolledWorkerByIdentity,
  listEnrolledWorkers,
  removeCounterWorker,
  type EnrolledCounterWorker,
} from '../../lib/counterWorkerRegistry';
import { subscribeCounterRegistryUpdated } from '../../lib/counterPinFromDevicePin';
import { useEffectiveWorkerProfile, useEffectiveWorkerId, useEffectiveWorkerProfileId } from '../../context/CounterWorkerContext';
import { getCounterSessionPolicy, type CounterSessionPolicyId } from '../../lib/counterSessionPolicy';
import {
  isSharedCounterModeEnabled,
  subscribeSharedCounterMode,
} from '../../lib/sharedCounterMode';
import {
  getCachedPrinterBackendLabel,
  printTestReceipt,
  probePrinterBackend,
} from '../../services/printService';
import {
  getMergedPrintingSettings,
  updateReceiptFieldToggles,
  DEFAULT_RECEIPT_FIELDS,
  type ReceiptFieldToggles,
} from '../../api/printingSettings';
import { getCompanyBrand } from '../../api/reports';
import { listPairedBluetoothDevices } from '../../lib/erpPrinterNative';

interface SettingsModuleProps {
  onBack: () => void;
  user: User;
  branch: Branch | null;
  companyId: string | null;
  isOnline: boolean;
  onChangeBranch: () => void;
  onLogout: () => void;
  onSyncTriggered?: () => void;
}

const IDLE_LOCK_OPTIONS: { id: PinIdleTimeoutId; label: string }[] = [
  { id: 'off', label: 'Off' },
  { id: '1m', label: '1 minute' },
  { id: '2m', label: '2 minutes' },
];

function PinLockPolicyRows() {
  const [lockOnBackground, setLockOnBackground] = useState(
    () => getPinLockSettings().lockOnBackground,
  );
  const [idleTimeout, setIdleTimeout] = useState<PinIdleTimeoutId>(
    () => getPinLockSettings().idleTimeout,
  );

  const apply = (patch: Partial<{ lockOnBackground: boolean; idleTimeout: PinIdleTimeoutId }>) => {
    setPinLockSettings(patch);
    if (patch.lockOnBackground !== undefined) setLockOnBackground(patch.lockOnBackground);
    if (patch.idleTimeout !== undefined) setIdleTimeout(patch.idleTimeout);
  };

  return (
    <>
      <div className="px-4 py-3 border-b border-[#374151]/60">
        <label className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-white font-medium">Lock on app switch</p>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Re-lock uses idle timeout below — quick app switches stay unlocked if you were active recently
            </p>
          </div>
          <input
            type="checkbox"
            checked={lockOnBackground}
            onChange={(e) => apply({ lockOnBackground: e.target.checked })}
            className="w-5 h-5 rounded border-[#374151] bg-[#111827] text-[#3B82F6]"
          />
        </label>
      </div>
      <div className="px-4 py-3 border-b border-[#374151]/60">
        <p className="text-sm text-white font-medium mb-1">Idle lock</p>
        <p className="text-xs text-[#6B7280] mb-2">Default 1 minute without tap, scroll, or key. Off = session limit only.</p>
        <div className="flex gap-2">
          {IDLE_LOCK_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => apply({ idleTimeout: opt.id })}
              className={`flex-1 py-2 rounded-lg text-xs font-medium border ${
                idleTimeout === opt.id
                  ? 'border-[#3B82F6] bg-[#3B82F6]/15 text-white'
                  : 'border-[#374151] text-[#9CA3AF]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export function SettingsModule({
  onBack,
  user,
  branch,
  companyId,
  isOnline,
  onChangeBranch,
  onLogout,
  onSyncTriggered,
}: SettingsModuleProps) {
  const [hasPin, setHasPin] = useState(false);
  const [showChangePin, setShowChangePin] = useState(false);
  const [showChangeCounterPin, setShowChangeCounterPin] = useState(false);
  const [showSetPin, setShowSetPin] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [clearing, setClearing] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [lastSyncFromDb, setLastSyncFromDb] = useState<settingsApi.MobileSyncStatus | null>(null);
  const [printerConfig, setPrinterConfig] = useState<settingsApi.MobilePrinterSettings>({
    mode: 'a4',
    paperSize: '80mm',
    autoPrintReceipt: false,
  });
  const [barcodeSettings, setBarcodeSettings] = useState<settingsApi.MobileBarcodeScannerSettings>({
    method: 'keyboard_wedge',
  });
  const [printerSaving, setPrinterSaving] = useState(false);
  const [printerError, setPrinterError] = useState<string | null>(null);
  const [printerBackendLabel, setPrinterBackendLabel] = useState('');
  const [receiptFields, setReceiptFields] = useState<ReceiptFieldToggles>({ ...DEFAULT_RECEIPT_FIELDS });
  const [receiptBrandPreview, setReceiptBrandPreview] = useState('');
  const [receiptFieldsSaving, setReceiptFieldsSaving] = useState(false);
  const [bluetoothDevices, setBluetoothDevices] = useState<{ name: string; address: string }[]>([]);
  const [labelSettings, setLabelSettings] = useState<settingsApi.MobileBarcodeLabelSettings>(
    settingsApi.DEFAULT_BARCODE_LABEL,
  );
  const [barcodeSaving, setBarcodeSaving] = useState(false);
  const [showUserPermissions, setShowUserPermissions] = useState(false);
  const [showEmployees, setShowEmployees] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [defaultDressDevaluation, setDefaultDressDevaluation] = useState<number>(5000);
  const [showCounterPinEnroll, setShowCounterPinEnroll] = useState(false);
  const [counterSlotCount, setCounterSlotCount] = useState(0);
  const [lockScreenProfiles, setLockScreenProfiles] = useState<EnrolledCounterWorker[]>([]);
  const [lockProfilesLoading, setLockProfilesLoading] = useState(false);
  const [sharedCounterMode, setSharedCounterMode] = useState(() => isSharedCounterModeEnabled());
  const [counterSessionPolicy, setCounterSessionPolicyState] = useState<CounterSessionPolicyId>(() =>
    getCounterSessionPolicy()
  );
  const [showCreateBranch, setShowCreateBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchCode, setNewBranchCode] = useState('');
  const [createBranchBusy, setCreateBranchBusy] = useState(false);
  const [createBranchMsg, setCreateBranchMsg] = useState<string | null>(null);
  const [rlsBranches, setRlsBranches] = useState<Branch[]>([]);
  const [branchAccessLoading, setBranchAccessLoading] = useState(true);
  const [myCounterEnrollment, setMyCounterEnrollment] = useState<EnrolledCounterWorker | null>(null);

  const effectiveUserId = useEffectiveWorkerId(user.id);
  const effectiveProfileId = useEffectiveWorkerProfileId() ?? user.profileId ?? null;
  const profile = useEffectiveWorkerProfile(user);
  const displayName = profile?.displayName ?? user.name;
  const displayRole = profile?.role ?? user.role;
  const displayEmail = profile?.email ?? user.email;
  const { hasPermission, isAdminOrOwner, branchIds, isPermissionLoaded } = usePermissions();
  const mergedBranchIds = useMemo(
    () => [...new Set([...branchIds, ...rlsBranches.map((b) => b.id)])],
    [branchIds, rlsBranches],
  );
  const canManageSettings =
    isAdminOrOwner || (FEATURE_MOBILE_PERMISSION_V2 && hasPermission('settings.modify'));
  const canSwitchBranch = isAdminOrOwner || mergedBranchIds.length > 1 || rlsBranches.length > 1;
  const accessibleBranchNames = useMemo(() => {
    if (!companyId || isAdminOrOwner) return [];
    if (rlsBranches.length > 1) return rlsBranches.map((b) => b.name);
    if (mergedBranchIds.length === 0) return [];
    return rlsBranches.filter((b) => mergedBranchIds.includes(b.id)).map((b) => b.name);
  }, [companyId, isAdminOrOwner, rlsBranches, mergedBranchIds]);

  const refreshUnsynced = () => getUnsyncedCount().then(setUnsyncedCount);

  const refreshBluetoothDevices = useCallback(() => {
    if (!Capacitor.isNativePlatform()) return;
    void listPairedBluetoothDevices().then(setBluetoothDevices);
  }, []);

  useEffect(() => {
    if (!companyId) {
      setRlsBranches([]);
      setBranchAccessLoading(false);
      return;
    }
    if (!isPermissionLoaded) {
      setBranchAccessLoading(true);
      return;
    }
    let cancelled = false;
    setBranchAccessLoading(true);
    void getBranches(companyId).then((branchesRes) => {
      if (cancelled) return;
      setRlsBranches(branchesRes.data ?? []);
      setBranchAccessLoading(false);
    });
    return () => { cancelled = true; };
  }, [companyId, isPermissionLoaded]);

  useEffect(() => {
    if (!companyId || isAdminOrOwner) {
      setMyCounterEnrollment(null);
      return;
    }
    let cancelled = false;
    const loadMyEnrollment = () => {
      void findEnrolledWorkerByIdentity(effectiveUserId, effectiveProfileId, companyId).then((entry) => {
        if (!cancelled) setMyCounterEnrollment(entry);
      });
    };
    loadMyEnrollment();
    const unsub = subscribeCounterRegistryUpdated(loadMyEnrollment);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [companyId, isAdminOrOwner, effectiveUserId, effectiveProfileId]);

  useEffect(() => {
    if (!companyId || !isAdminOrOwner) {
      setCounterSlotCount(0);
      setLockScreenProfiles([]);
      return;
    }
    setLockProfilesLoading(true);
    void Promise.all([listEnrolledWorkers(companyId), countWorkers(companyId)])
      .then(([profiles, count]) => {
        setLockScreenProfiles(profiles);
        setCounterSlotCount(count);
      })
      .catch(() => {
        setLockScreenProfiles([]);
        setCounterSlotCount(0);
      })
      .finally(() => setLockProfilesLoading(false));
  }, [companyId, isAdminOrOwner, showCounterPinEnroll]);

  useEffect(() => subscribeSharedCounterMode(() => setSharedCounterMode(isSharedCounterModeEnabled())), []);

  useEffect(() => {
    authApi.hasPinSet().then(setHasPin);
  }, [showChangePin, showSetPin]);

  useEffect(() => {
    refreshUnsynced();
    const t = setInterval(refreshUnsynced, 5000);
    return () => clearInterval(t);
  }, [syncing, clearing]);

  useEffect(() => {
    if (!companyId) return;
    settingsApi.getMobileSyncStatus(companyId).then(({ data }) => {
      if (data) setLastSyncFromDb(data);
    });
  }, [companyId, syncing, clearing]);

  useEffect(() => {
    if (!companyId) return;
    settingsApi
      .getEffectivePrinterSettings(companyId, { syncFromCompany: isAdminOrOwner })
      .then(({ data, error }) => {
        setPrinterConfig(data);
        if (error) setPrinterError(error);
      });
    settingsApi.getMobileBarcodeScannerSettings(companyId).then(({ data }) => setBarcodeSettings(data));
    settingsApi.getMobileBarcodeLabelSettings(companyId).then(({ data }) => setLabelSettings(data));
    settingsApi.getDefaultDressDevaluation(companyId).then(({ data }) => setDefaultDressDevaluation(data));
    void probePrinterBackend(null).then(() => setPrinterBackendLabel(getCachedPrinterBackendLabel()));
    getMergedPrintingSettings(companyId).then(({ data }) => setReceiptFields(data.fields));
    getCompanyBrand(companyId).then((b) => {
      const parts = [b.name, b.phone, b.address].filter(Boolean);
      setReceiptBrandPreview(parts.join(' · '));
    });
  }, [companyId, isAdminOrOwner]);

  const toggleReceiptField = async (key: keyof ReceiptFieldToggles, value: boolean) => {
    if (!companyId || receiptFieldsSaving) return;
    const prev = receiptFields;
    const next = { ...receiptFields, [key]: value };
    setReceiptFields(next);
    setReceiptFieldsSaving(true);
    const { error } = await updateReceiptFieldToggles(companyId, { [key]: value });
    setReceiptFieldsSaving(false);
    if (error) setReceiptFields(prev);
  };

  if (showUserPermissions) {
    return (
      <UserPermissionsScreen
        onBack={() => setShowUserPermissions(false)}
        user={user}
        companyId={companyId}
      />
    );
  }

  const persistPrinterConfig = async (next: settingsApi.MobilePrinterSettings) => {
    if (!companyId) return;
    setPrinterSaving(true);
    setPrinterError(null);
    const { error } = await settingsApi.setEffectivePrinterSettings(companyId, next, {
      mirrorToCompany: isAdminOrOwner,
    });
    if (error) {
      setPrinterError(error);
    } else {
      void probePrinterBackend(next.bluetoothDeviceAddress).then(() =>
        setPrinterBackendLabel(getCachedPrinterBackendLabel())
      );
    }
    setPrinterSaving(false);
    return error;
  };

  const handlePrinterMode = async (mode: settingsApi.MobilePrinterMode) => {
    if (printerSaving || !companyId) return;
    const prev = printerConfig;
    const next = { ...printerConfig, mode };
    setPrinterConfig(next);
    if (mode === 'thermal') refreshBluetoothDevices();
    const err = await persistPrinterConfig(next);
    if (err) setPrinterConfig(prev);
  };

  const handlePaperSize = async (paperSize: settingsApi.MobilePrinterPaperSize) => {
    if (printerSaving || !companyId) return;
    const prev = printerConfig;
    const next = { ...printerConfig, paperSize };
    setPrinterConfig(next);
    const err = await persistPrinterConfig(next);
    if (err) setPrinterConfig(prev);
  };

  const handleAutoPrint = async (enabled: boolean) => {
    if (printerSaving || !companyId) return;
    const prev = printerConfig;
    const next = { ...printerConfig, autoPrintReceipt: enabled };
    setPrinterConfig(next);
    const err = await persistPrinterConfig(next);
    if (err) setPrinterConfig(prev);
  };

  const handleBluetoothSelect = async (address: string) => {
    if (printerSaving || !companyId) return;
    const prev = printerConfig;
    const next = { ...printerConfig, bluetoothDeviceAddress: address || null };
    setPrinterConfig(next);
    const err = await persistPrinterConfig(next);
    if (err) setPrinterConfig(prev);
  };

  const handleTestPrint = async () => {
    setPrinterError(null);
    const res = await printTestReceipt(printerConfig);
    if (!res.ok && res.hint) setPrinterError(res.hint);
  };

  const handleBarcodeMethod = async (method: settingsApi.BarcodeScannerMethod) => {
    if (barcodeSaving || !companyId) return;
    const prev = barcodeSettings;
    setBarcodeSaving(true);
    setBarcodeSettings((s) => ({ ...s, method }));
    const { error } = await settingsApi.setMobileBarcodeScannerSettings(companyId, { ...barcodeSettings, method });
    if (error) setBarcodeSettings(prev);
    setBarcodeSaving(false);
  };

  const handleSyncNow = async () => {
    if (syncing) return;
    if (!isOnline) {
      setSyncResult('Offline. Connect to sync.');
      return;
    }
    setSyncing(true);
    setSyncResult(null);
    try {
      const { synced, errors } = await runSync();
      refreshUnsynced();
      const message =
        synced > 0 || errors > 0
          ? `Synced: ${synced}, Errors: ${errors}`
          : unsyncedCount === 0
            ? 'Already up to date'
            : 'No pending items';
      setSyncResult(message);
      await settingsApi.setMobileSyncStatus(companyId, {
        last_sync_at: new Date().toISOString(),
        last_synced_count: synced,
        last_errors_count: errors,
      });
      setLastSyncFromDb({
        last_sync_at: new Date().toISOString(),
        last_synced_count: synced,
        last_errors_count: errors,
      });
      onSyncTriggered?.();
    } catch {
      setSyncResult('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleClearCache = async () => {
    if (!clearConfirm) {
      setClearConfirm(true);
      return;
    }
    setClearing(true);
    try {
      const deleted = await clearAllPending();
      refreshUnsynced();
      setSyncResult(deleted > 0 ? `Cleared ${deleted} offline record(s)` : 'Cache cleared');
      setClearConfirm(false);
    } catch {
      setSyncResult('Failed to clear');
    } finally {
      setClearing(false);
    }
  };

  const handleAppVersionTap = () => {
    const r = registerAppVersionTap();
    if (r.justUnlocked) {
      setSyncResult('Developer Tools enabled — see below.');
    }
  };

  const handleRemovePin = async () => {
    if (!window.confirm('Remove PIN? You will need to sign in with email/password next time.')) return;
    await authApi.clearPin();
    await authApi.signOutForTabletHandoff(companyId);
    setHasPin(false);
    onLogout();
  };

  if (showEmployees && companyId) {
    return (
      <EmployeesSection
        onBack={() => setShowEmployees(false)}
        companyId={companyId}
        isAdminOrOwner={isAdminOrOwner}
        userId={user.id}
      />
    );
  }

  if (showAddUser && companyId) {
    return (
      <AddUserSheet
        companyId={companyId}
        branchId={branch?.id ?? null}
        onBack={() => setShowAddUser(false)}
        onSuccess={() => setSyncResult('User created successfully')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40 flow-screen-header">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 bg-[#6B7280] rounded-lg flex items-center justify-center">
              <SettingsIcon size={18} className="text-white" />
            </div>
            <h1 className="text-white font-semibold text-base">Settings</h1>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <SettingsCollapsible
          title="Account & branch"
          subtitle={`${displayName} · ${branch?.name ?? 'No branch'}`}
          defaultOpen
        >
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <p className="text-xs text-[#9CA3AF] mb-1">Logged in as</p>
            <p className="font-medium text-white">{displayName}</p>
            <p className="text-sm text-[#6B7280]">{displayEmail}</p>
            <span className="inline-block mt-2 px-2 py-0.5 bg-[#6B7280]/20 text-[#9CA3AF] text-xs rounded-full capitalize">
              {displayRole}
            </span>
          </div>
          {branchAccessLoading && !isAdminOrOwner ? (
            <div className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-4 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-[#6B7280] animate-spin" />
              <p className="text-sm text-[#9CA3AF]">Loading branch access…</p>
            </div>
          ) : canSwitchBranch ? (
            <button
              onClick={onChangeBranch}
              className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-4 flex items-center justify-between hover:border-[#3B82F6] transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#3B82F6]/20 rounded-lg flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-[#3B82F6]" />
                </div>
                <div>
                  <p className="font-medium text-white">Current Branch</p>
                  <p className="text-sm text-[#9CA3AF]">{branch?.name ?? 'Not selected'}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#6B7280]" />
            </button>
          ) : (
            <div className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-4 flex items-center gap-3 text-left">
              <div className="w-10 h-10 bg-[#6B7280]/20 rounded-lg flex items-center justify-center">
                <MapPin className="w-5 h-5 text-[#9CA3AF]" />
              </div>
              <div>
                <p className="font-medium text-white">Branch (set by admin)</p>
                <p className="text-sm text-[#9CA3AF]">{branch?.name ?? '—'}</p>
              </div>
            </div>
          )}
          {canSwitchBranch && accessibleBranchNames.length > 1 ? (
            <p className="text-xs text-[#9CA3AF] px-1">
              Branch access: {accessibleBranchNames.join(', ')}
            </p>
          ) : null}
          {isAdminOrOwner && companyId && (
            <button
              type="button"
              onClick={() => {
                setCreateBranchMsg(null);
                setNewBranchName('');
                setNewBranchCode('');
                setShowCreateBranch(true);
              }}
              className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-4 flex items-center justify-between hover:border-[#3B82F6] transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                  <Plus className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="font-medium text-white">Create branch</p>
                  <p className="text-sm text-[#9CA3AF]">Same as Web ERP</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#6B7280]" />
            </button>
          )}
        </SettingsCollapsible>

        {isAdminOrOwner && companyId ? (
          <SettingsCollapsible title="Company" subtitle="Modules, users, payroll" badge="Admin">
            <ModuleTogglesSection
              companyId={companyId}
              userId={user.id}
              userRole={user.role}
              profileId={user.profileId}
            />
            {canManageSettings && (
              <SettingsRow
                icon={UserCog}
                iconColor="bg-[#8B5CF6]/20"
                title="User Permissions"
                subtitle="Roles & permission matrix"
                onClick={() => setShowUserPermissions(true)}
              />
            )}
            <SettingsRow
              icon={UserPlus}
              iconColor="bg-emerald-500/20"
              title="Add user"
              subtitle="Invite or temp password"
              onClick={() => setShowAddUser(true)}
            />
            <SettingsRow
              icon={Shirt}
              iconColor="bg-pink-500/20"
              title="Default dress devaluation"
              subtitle={`Rs. ${defaultDressDevaluation.toLocaleString()}`}
              onClick={async () => {
                if (!companyId) return;
                const nextRaw = window.prompt('Set default dress devaluation (Rs.)', String(defaultDressDevaluation));
                if (nextRaw == null) return;
                const next = Math.max(0, Math.round(Number(nextRaw) || 0));
                const { error } = await settingsApi.setDefaultDressDevaluation(companyId, next);
                if (error) {
                  setSyncResult(`Failed to save: ${error}`);
                  return;
                }
                setDefaultDressDevaluation(next);
                setSyncResult('Default dress devaluation updated');
              }}
            />
            <SettingsRow
              icon={Briefcase}
              iconColor="bg-blue-500/20"
              title="Employees"
              subtitle="Payroll & commissions"
              onClick={() => setShowEmployees(true)}
            />
          </SettingsCollapsible>
        ) : null}

        {isAdminOrOwner ? (
          <SettingsCollapsible title="Security" subtitle={hasPin ? 'PIN enabled' : 'No quick PIN'}>
            {hasPin && (
              <>
                <SettingsRow
                  icon={KeyRound}
                  iconColor="bg-[#3B82F6]/20"
                  title="Change PIN"
                  subtitle="Update your 4–6 digit PIN"
                  onClick={() => setShowChangePin(true)}
                />
                <PinLockPolicyRows />
                <SettingsRow
                  icon={Lock}
                  iconColor="bg-amber-500/20"
                  title="Remove PIN"
                  subtitle="Sign in with email/password"
                  onClick={handleRemovePin}
                />
              </>
            )}
            {!hasPin && (
              <SettingsRow
                icon={Shield}
                iconColor="bg-[#3B82F6]/20"
                title="Set Quick PIN"
                subtitle="4–6 digits for faster unlock"
                onClick={() => setShowSetPin(true)}
              />
            )}
          </SettingsCollapsible>
        ) : myCounterEnrollment ? (
          <SettingsCollapsible title="Security" subtitle="Counter PIN">
            <SettingsRow
              icon={KeyRound}
              iconColor="bg-emerald-500/20"
              title="Change counter PIN"
              subtitle="POS lock screen ka apna 4-digit PIN"
              onClick={() => setShowChangeCounterPin(true)}
            />
          </SettingsCollapsible>
        ) : null}

        {isAdminOrOwner && companyId ? (
          <SettingsCollapsible
            title="Counter & lock screen"
            subtitle={`${counterSlotCount} enrolled`}
            badge={sharedCounterMode ? 'On' : undefined}
          >
            <SettingsCounterSection
              companyId={companyId}
              counterSlotCount={counterSlotCount}
              lockScreenProfiles={lockScreenProfiles}
              lockProfilesLoading={lockProfilesLoading}
              sharedCounterMode={sharedCounterMode}
              setSharedCounterMode={setSharedCounterMode}
              counterSessionPolicy={counterSessionPolicy}
              setCounterSessionPolicyState={setCounterSessionPolicyState}
              onOpenCounterPinEnroll={() => setShowCounterPinEnroll(true)}
              onRemoveWorker={async (userId) => {
                await removeCounterWorker(userId, companyId);
                const [profiles, count] = await Promise.all([
                  listEnrolledWorkers(companyId),
                  countWorkers(companyId),
                ]);
                setLockScreenProfiles(profiles);
                setCounterSlotCount(count);
              }}
            />
          </SettingsCollapsible>
        ) : null}

        <SettingsCollapsible title="Printer & barcode" subtitle={printerConfig.mode === 'thermal' ? 'Thermal' : 'A4'}>
          <SettingsPrinterSection
            companyId={companyId}
            isAdminOrOwner={isAdminOrOwner}
            printerConfig={printerConfig}
            printerSaving={printerSaving}
            printerError={printerError}
            printerBackendLabel={printerBackendLabel}
            receiptFields={receiptFields}
            receiptFieldsSaving={receiptFieldsSaving}
            receiptBrandPreview={receiptBrandPreview}
            bluetoothDevices={bluetoothDevices}
            labelSettings={labelSettings}
            barcodeSettings={barcodeSettings}
            barcodeSaving={barcodeSaving}
            onPrinterMode={handlePrinterMode}
            onPaperSize={handlePaperSize}
            onAutoPrint={handleAutoPrint}
            onBluetoothSelect={handleBluetoothSelect}
            onTestPrint={() => void handleTestPrint()}
            onToggleReceiptField={toggleReceiptField}
            onLabelSettingsChange={setLabelSettings}
            onBarcodeMethod={handleBarcodeMethod}
            onPersistLabelSettings={async (next) => {
              if (!companyId) return;
              await settingsApi.setMobileBarcodeLabelSettings(companyId, next);
            }}
            onRefreshBluetooth={refreshBluetoothDevices}
          />
        </SettingsCollapsible>

        <SettingsCollapsible
          title="Data & sync"
          subtitle={isOnline ? (unsyncedCount > 0 ? `${unsyncedCount} pending` : 'Up to date') : 'Offline'}
          badge={isOnline ? 'Online' : 'Offline'}
        >
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  isOnline ? 'bg-[#10B981]/20' : 'bg-[#F59E0B]/20'
                }`}
              >
                <span
                  className={`inline-block w-3 h-3 rounded-full ${isOnline ? 'bg-[#10B981]' : 'bg-[#F59E0B]'}`}
                  title={isOnline ? 'Online' : 'Offline'}
                />
              </div>
              <div>
                <p className="font-medium text-white">{isOnline ? 'Online' : 'Offline'}</p>
                <p className="text-sm text-[#9CA3AF]">
                  {isOnline
                    ? unsyncedCount > 0
                      ? `${unsyncedCount} item(s) pending sync`
                      : 'All data synced with server'
                    : 'Connect to internet to sync'}
                </p>
                {lastSyncFromDb?.last_sync_at && (
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    Last sync: {new Date(lastSyncFromDb.last_sync_at).toLocaleString()}
                    {lastSyncFromDb.last_synced_count > 0 || lastSyncFromDb.last_errors_count > 0
                      ? ` (${lastSyncFromDb.last_synced_count} synced, ${lastSyncFromDb.last_errors_count} errors)`
                      : ''}
                  </p>
                )}
              </div>
            </div>
          </div>

          <SettingsRow
            icon={RefreshCw}
            iconColor="bg-emerald-500/20"
            title="Sync now"
            subtitle={
              !isOnline
                ? 'Offline – connect to sync'
                : unsyncedCount > 0
                  ? `${unsyncedCount} pending`
                  : 'Online'
            }
            onClick={handleSyncNow}
            right={
              syncing ? (
                <Loader2 className="w-5 h-5 text-[#3B82F6] animate-spin" />
              ) : (
                <ChevronRight className="w-5 h-5 text-[#6B7280]" />
              )
            }
          />
          {syncResult && (
            <p className="text-sm text-[#9CA3AF] px-2">{syncResult}</p>
          )}
          <SettingsRow
            icon={Trash2}
            iconColor="bg-red-500/20"
            title={clearConfirm ? 'Confirm clear' : 'Clear offline data'}
            subtitle={
              clearConfirm
                ? 'Tap again to delete unsynced records'
                : unsyncedCount > 0
                  ? `${unsyncedCount} unsynced – sync first`
                  : 'Remove pending queue'
            }
            onClick={handleClearCache}
            right={
              clearing ? (
                <Loader2 className="w-5 h-5 text-red-400 animate-spin" />
              ) : clearConfirm ? (
                <span className="text-xs text-red-400">{'Tap to confirm'}</span>
              ) : (
                <ChevronRight className="w-5 h-5 text-[#6B7280]" />
              )
            }
          />
          {clearConfirm && (
            <button
              onClick={() => setClearConfirm(false)}
              className="text-sm text-[#9CA3AF] px-2"
            >
              Cancel
            </button>
          )}
        </SettingsCollapsible>

        <SettingsCollapsible title="App" subtitle={APP_VERSION}>
          <SettingsRow
            icon={Building2}
            iconColor="bg-[#8B5CF6]/20"
            title="App version"
            subtitle={APP_VERSION}
            onClick={handleAppVersionTap}
          />
          <SettingsRow
            icon={Info}
            iconColor="bg-[#6B7280]/20"
            title="About"
            subtitle="ERP for bridal & rental business"
          />
          <DeveloperToolsSection />
          <ConnectionDebug
            supabaseUrl={import.meta.env.VITE_SUPABASE_URL || ''}
            companyId={companyId}
            branchId={branch?.id ?? null}
            userEmail={user.email}
          />
        </SettingsCollapsible>

        {isAdminOrOwner && hasPin && (
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-[#9CA3AF]" />
              <div>
                <p className="font-medium text-white">PIN backup</p>
                <p className="text-sm text-[#9CA3AF]">Forgot PIN? Use full login instead.</p>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 h-12 bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] rounded-xl font-medium hover:bg-[#EF4444]/20 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>

      {showCounterPinEnroll && companyId && isAdminOrOwner ? (
        <CounterPinEnrollModal
          open={showCounterPinEnroll}
          companyId={companyId}
          companyBranches={rlsBranches}
          enrolledWorkers={lockScreenProfiles}
          onClose={() => setShowCounterPinEnroll(false)}
          onEnrolled={async () => {
            const [profiles, count] = await Promise.all([
              listEnrolledWorkers(companyId),
              countWorkers(companyId),
            ]);
            setLockScreenProfiles(profiles);
            setCounterSlotCount(count);
            setSharedCounterMode(isSharedCounterModeEnabled());
          }}
          onSyncResult={(msg) => setSyncResult(msg)}
        />
      ) : null}
      {showCreateBranch && companyId && isAdminOrOwner && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#1F2937] border border-[#374151] p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-1">Create branch</h3>
            <p className="text-xs text-[#9CA3AF] mb-4">
              Naya branch is company ke liye add karein. Yeh wahi <span className="text-[#D1D5DB] font-medium">branches</span>
              {' '}table mein jaata hai jo Web ERP istemaal karta hai, isliye Web par bhi turant dikh jaayega.
            </p>
            {createBranchMsg ? <p className="text-sm text-red-400 mb-3">{createBranchMsg}</p> : null}
            <label className="block text-xs text-[#9CA3AF] mb-1">Branch name (required)</label>
            <input
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              className="w-full mb-3 rounded-lg bg-[#111827] border border-[#374151] px-3 py-2 text-white"
              maxLength={80}
              placeholder="e.g. DHA Branch"
              autoComplete="off"
            />
            <label className="block text-xs text-[#9CA3AF] mb-1">Code (optional)</label>
            <input
              value={newBranchCode}
              onChange={(e) => setNewBranchCode(e.target.value.toUpperCase().slice(0, 20))}
              className="w-full mb-4 rounded-lg bg-[#111827] border border-[#374151] px-3 py-2 text-white"
              maxLength={20}
              placeholder="BR-002"
              autoComplete="off"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCreateBranch(false)}
                className="flex-1 h-11 rounded-xl bg-[#374151] text-white font-medium disabled:opacity-50"
                disabled={createBranchBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={createBranchBusy}
                onClick={() => {
                  void (async () => {
                    setCreateBranchMsg(null);
                    const name = newBranchName.trim();
                    if (!name) {
                      setCreateBranchMsg('Branch name required.');
                      return;
                    }
                    setCreateBranchBusy(true);
                    try {
                      const { data, error } = await createBranchApi(companyId, name, newBranchCode.trim() || undefined);
                      if (error) {
                        setCreateBranchMsg(error);
                        return;
                      }
                      setSyncResult(`Branch "${data?.name ?? name}" created.`);
                      setShowCreateBranch(false);
                      setNewBranchName('');
                      setNewBranchCode('');
                      onChangeBranch();
                    } catch (e) {
                      setCreateBranchMsg(e instanceof Error ? e.message : 'Create failed.');
                    } finally {
                      setCreateBranchBusy(false);
                    }
                  })();
                }}
                className="flex-1 h-11 rounded-xl bg-emerald-600 text-white font-medium disabled:opacity-50"
              >
                {createBranchBusy ? 'Saving…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showChangePin && isAdminOrOwner && (
        <ChangePinModal
          onClose={() => setShowChangePin(false)}
          onSuccess={() => setHasPin(true)}
        />
      )}
      {showSetPin && isAdminOrOwner && (
        <SetPinModal
          onClose={() => setShowSetPin(false)}
          onSuccess={() => setHasPin(true)}
          user={user}
          companyId={companyId}
          branchId={branch?.id ?? null}
        />
      )}
      {showChangeCounterPin && myCounterEnrollment && !isAdminOrOwner && (
        <ChangeCounterPinModal
          enrollment={myCounterEnrollment}
          onClose={() => setShowChangeCounterPin(false)}
          onSuccess={() => {
            void findEnrolledWorkerByIdentity(effectiveUserId, effectiveProfileId, companyId).then(
              setMyCounterEnrollment,
            );
            setSyncResult('Counter PIN updated.');
          }}
        />
      )}
    </div>
  );
}
