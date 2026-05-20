import { useState, useEffect } from 'react';
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
  Printer,
  Scan,
  UserCog,
  UserPlus,
  Briefcase,
  Shirt,
  Users,
} from 'lucide-react';
import type { User, Branch } from '../../types';
import * as authApi from '../../api/auth';
import * as settingsApi from '../../api/settings';
import { runSync } from '../../lib/syncEngine';
import { getUnsyncedCount, clearAllPending } from '../../lib/offlineStore';
import { ChangePinModal } from './ChangePinModal';
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
import {
  countCounterUsers,
  getCounterVaultUserIdForPin,
  listEnrolledCounterProfiles,
  saveCounterUserForPin,
  type EnrolledCounterProfile,
} from '../../lib/counterUserVault';
import { getFunctionalRoleLabel } from '../../config/functionalRoles';
import {
  isSharedCounterModeEnabled,
  setSharedCounterModeEnabled,
  subscribeSharedCounterMode,
} from '../../lib/sharedCounterMode';

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

function SettingsRow({
  icon: Icon,
  iconColor,
  title,
  subtitle,
  onClick,
  right,
}: {
  icon: React.ElementType;
  iconColor: string;
  title: string;
  subtitle?: string;
  onClick?: () => void;
  right?: React.ReactNode;
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      className={`w-full bg-[#1F2937] border border-[#374151] rounded-xl p-4 flex items-center justify-between hover:border-[#3B82F6] transition-colors text-left ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="font-medium text-white">{title}</p>
          {subtitle && <p className="text-sm text-[#9CA3AF]">{subtitle}</p>}
        </div>
      </div>
      {right ?? (onClick ? <ChevronRight className="w-5 h-5 text-[#6B7280]" /> : null)}
    </Comp>
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
  const [barcodeSaving, setBarcodeSaving] = useState(false);
  const [showUserPermissions, setShowUserPermissions] = useState(false);
  const [showEmployees, setShowEmployees] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [defaultDressDevaluation, setDefaultDressDevaluation] = useState<number>(5000);
  const [showCounterPinEnroll, setShowCounterPinEnroll] = useState(false);
  const [counterPinA, setCounterPinA] = useState('');
  const [counterPinB, setCounterPinB] = useState('');
  const [counterPinBusy, setCounterPinBusy] = useState(false);
  const [counterPinMsg, setCounterPinMsg] = useState<string | null>(null);
  const [counterSlotCount, setCounterSlotCount] = useState(0);
  const [lockScreenProfiles, setLockScreenProfiles] = useState<EnrolledCounterProfile[]>([]);
  const [lockProfilesLoading, setLockProfilesLoading] = useState(false);
  const [sharedCounterMode, setSharedCounterMode] = useState(() => isSharedCounterModeEnabled());

  const { hasPermission, isAdminOrOwner } = usePermissions();
  const canManageSettings =
    isAdminOrOwner || (FEATURE_MOBILE_PERMISSION_V2 && hasPermission('settings.modify'));

  const refreshUnsynced = () => getUnsyncedCount().then(setUnsyncedCount);

  useEffect(() => {
    if (!companyId) {
      setCounterSlotCount(0);
      setLockScreenProfiles([]);
      return;
    }
    setLockProfilesLoading(true);
    void authApi
      .syncCurrentSessionToCounterVault()
      .then(() => Promise.all([listEnrolledCounterProfiles(), countCounterUsers()]))
      .then(([profiles, count]) => {
        setLockScreenProfiles(profiles);
        setCounterSlotCount(count);
      })
      .catch(() => {
        setLockScreenProfiles([]);
        setCounterSlotCount(0);
      })
      .finally(() => setLockProfilesLoading(false));
  }, [companyId, showCounterPinEnroll]);

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
    settingsApi.getMobilePrinterSettings(companyId).then(({ data }) => setPrinterConfig(data));
    settingsApi.getMobileBarcodeScannerSettings(companyId).then(({ data }) => setBarcodeSettings(data));
    settingsApi.getDefaultDressDevaluation(companyId).then(({ data }) => setDefaultDressDevaluation(data));
  }, [companyId]);

  if (showUserPermissions) {
    return (
      <UserPermissionsScreen
        onBack={() => setShowUserPermissions(false)}
        user={user}
        companyId={companyId}
      />
    );
  }

  const handlePrinterMode = async (mode: settingsApi.MobilePrinterMode) => {
    if (printerSaving || !companyId) return;
    const prev = printerConfig;
    setPrinterSaving(true);
    setPrinterConfig((c) => ({ ...c, mode }));
    const { error } = await settingsApi.setMobilePrinterSettings(companyId, { ...printerConfig, mode });
    if (error) setPrinterConfig(prev);
    setPrinterSaving(false);
  };

  const handlePaperSize = async (paperSize: settingsApi.MobilePrinterPaperSize) => {
    if (printerSaving || !companyId) return;
    const prev = printerConfig;
    setPrinterSaving(true);
    setPrinterConfig((c) => ({ ...c, paperSize }));
    const { error } = await settingsApi.setMobilePrinterSettings(companyId, { ...printerConfig, paperSize });
    if (error) setPrinterConfig(prev);
    setPrinterSaving(false);
  };

  const handleAutoPrint = async (enabled: boolean) => {
    if (printerSaving || !companyId) return;
    const prev = printerConfig;
    setPrinterSaving(true);
    setPrinterConfig((c) => ({ ...c, autoPrintReceipt: enabled }));
    const { error } = await settingsApi.setMobilePrinterSettings(companyId, { ...printerConfig, autoPrintReceipt: enabled });
    if (error) setPrinterConfig(prev);
    setPrinterSaving(false);
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
    await authApi.signOut();
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
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
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

      <div className="p-4 space-y-4">
        {/* Account */}
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <p className="text-xs text-[#9CA3AF] mb-1">Logged in as</p>
          <p className="font-medium text-white">{user.name}</p>
          <p className="text-sm text-[#6B7280]">{user.email}</p>
          <span className="inline-block mt-2 px-2 py-0.5 bg-[#6B7280]/20 text-[#9CA3AF] text-xs rounded-full capitalize">
            {user.role}
          </span>
        </div>

        {/* Branch */}
        {user.branchLocked ? (
          <div className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-4 flex items-center gap-3 text-left">
            <div className="w-10 h-10 bg-[#6B7280]/20 rounded-lg flex items-center justify-center">
              <MapPin className="w-5 h-5 text-[#9CA3AF]" />
            </div>
            <div>
              <p className="font-medium text-white">Branch (set by admin)</p>
              <p className="text-sm text-[#9CA3AF]">{branch?.name ?? '—'}</p>
            </div>
          </div>
        ) : (
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
        )}

        {isAdminOrOwner && companyId ? (
          <ModuleTogglesSection
            companyId={companyId}
            userId={user.id}
            userRole={user.role}
            profileId={user.profileId}
          />
        ) : null}

        {/* User Permissions — same as Web ERP Permissions: only for users with settings.modify (or admin when V2 off) */}
        <div className="space-y-2">
          <p className="text-xs text-[#6B7280] font-medium px-1">Permissions</p>
          {canManageSettings && (
            <SettingsRow
              icon={UserCog}
              iconColor="bg-[#8B5CF6]/20"
              title="User Permissions"
              subtitle="Role, branch access & permission matrix"
              onClick={() => setShowUserPermissions(true)}
            />
          )}

          {isAdminOrOwner && (
            <SettingsRow
              icon={UserPlus}
              iconColor="bg-emerald-500/20"
              title="Add user"
              subtitle="Invite or set temp password (same as web)"
              onClick={() => setShowAddUser(true)}
            />
          )}

          {isAdminOrOwner && (
            <SettingsRow
              icon={Shirt}
              iconColor="bg-pink-500/20"
              title="Default dress devaluation"
              subtitle={`Rs. ${defaultDressDevaluation.toLocaleString()} (auto for rental booking)`}
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
          )}

          <SettingsRow
            icon={Briefcase}
            iconColor="bg-blue-500/20"
            title="Employees"
            subtitle="Payroll, commissions & ledger"
            onClick={() => setShowEmployees(true)}
          />
        </div>

        {/* Security */}
        <div className="space-y-2">
          <p className="text-xs text-[#6B7280] font-medium px-1">Security</p>
          {hasPin && (
            <>
              <SettingsRow
                icon={KeyRound}
                iconColor="bg-[#3B82F6]/20"
                title="Change PIN"
                subtitle="Update your 4–6 digit PIN"
                onClick={() => setShowChangePin(true)}
              />
              <SettingsRow
                icon={Lock}
                iconColor="bg-amber-500/20"
                title="Remove PIN"
                subtitle="Sign in with email/password next time"
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
          {companyId && branch?.id && branch.id !== 'all' && (
            <SettingsRow
              icon={Users}
              iconColor="bg-emerald-500/20"
              title="Counter tablet PIN"
              subtitle={`Enroll signed-in user for POS/Expense PIN switch (${counterSlotCount} saved)`}
              onClick={() => {
                setCounterPinMsg(null);
                setCounterPinA('');
                setCounterPinB('');
                setShowCounterPinEnroll(true);
              }}
            />
          )}
          {companyId && branch?.id && branch.id !== 'all' && (
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-2">
                <Users className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">Who shows on the lock / home screen</p>
                  <p className="text-xs text-[#9CA3AF] mt-0.5 leading-relaxed">
                    Each person must use this tablet once: sign in with email and password, open Settings, tap{' '}
                    <span className="text-[#D1D5DB] font-medium">Counter tablet PIN</span>, and save their own 4-digit
                    code — use a <span className="text-[#D1D5DB] font-medium">different</span> PIN than anyone else on
                    this tablet (same PIN replaces the other user). You cannot add someone else from here without their
                    login on this device — that is how their session is stored safely.
                  </p>
                </div>
              </div>
              {lockProfilesLoading ? (
                <p className="text-xs text-[#6B7280] px-1">Loading…</p>
              ) : lockScreenProfiles.length === 0 ? (
                <p className="text-xs text-amber-200/90 px-1">
                  No counter users yet. Tap “Counter tablet PIN” above for the account that is signed in now.
                </p>
              ) : (
                <ul className="space-y-2">
                  {lockScreenProfiles.map((p) => (
                    <li
                      key={p.pinHash}
                      title={[p.displayName, p.email].filter(Boolean).join(' · ')}
                      className="flex items-center justify-between gap-3 rounded-lg bg-[#111827] border border-[#374151] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{p.displayName}</p>
                        {p.email ? (
                          <p className="text-xs text-[#6B7280] truncate">{p.email}</p>
                        ) : null}
                      </div>
                      <span className="text-xs text-[#9CA3AF] shrink-0">
                        {p.role ? getFunctionalRoleLabel(p.role) : 'Staff'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#10B981]/20 shrink-0">
                <Lock className="w-5 h-5 text-[#10B981]" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-white">Shared Counter Mode</p>
                <p className="text-sm text-[#9CA3AF]">
                  On boot and logout, show the POS lock screen instead of signing out ({counterSlotCount} enrolled)
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={sharedCounterMode}
              disabled={counterSlotCount === 0}
              onClick={() => {
                const next = !sharedCounterMode;
                setSharedCounterModeEnabled(next);
                setSharedCounterMode(next);
              }}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium ${
                sharedCounterMode ? 'bg-emerald-600/30 text-emerald-200' : 'bg-[#374151] text-[#9CA3AF]'
              } disabled:opacity-40`}
            >
              {sharedCounterMode ? 'On' : 'Off'}
            </button>
          </div>
        </div>

        {/* Printer & Barcode (standard: thermal/A4 + barcode scanner) */}
        <div className="space-y-2">
          <p className="text-xs text-[#6B7280] font-medium px-1">Printer & Barcode</p>
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#6B7280]/20">
                <Printer className="w-5 h-5 text-[#9CA3AF]" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-white">Printer</p>
                <p className="text-sm text-[#9CA3AF]">Thermal receipt or A4 (normal)</p>
              </div>
              {printerSaving && <Loader2 className="w-5 h-5 text-[#3B82F6] animate-spin" />}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handlePrinterMode('thermal')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  printerConfig.mode === 'thermal'
                    ? 'bg-[#3B82F6] text-white'
                    : 'bg-[#374151] text-[#9CA3AF] hover:bg-[#4B5563]'
                }`}
              >
                Thermal
              </button>
              <button
                onClick={() => handlePrinterMode('a4')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  printerConfig.mode === 'a4'
                    ? 'bg-[#3B82F6] text-white'
                    : 'bg-[#374151] text-[#9CA3AF] hover:bg-[#4B5563]'
                }`}
              >
                A4 (Normal)
              </button>
            </div>
            {printerConfig.mode === 'thermal' && (
              <div>
                <p className="text-xs text-[#9CA3AF] mb-1.5">Paper width</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePaperSize('58mm')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                      printerConfig.paperSize === '58mm' ? 'bg-[#3B82F6] text-white' : 'bg-[#374151] text-[#9CA3AF]'
                    }`}
                  >
                    58mm
                  </button>
                  <button
                    onClick={() => handlePaperSize('80mm')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                      printerConfig.paperSize === '80mm' ? 'bg-[#3B82F6] text-white' : 'bg-[#374151] text-[#9CA3AF]'
                    }`}
                  >
                    80mm
                  </button>
                </div>
              </div>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={printerConfig.autoPrintReceipt}
                onChange={(e) => handleAutoPrint(e.target.checked)}
                className="rounded border-[#4B5563] bg-[#374151] text-[#3B82F6] focus:ring-[#3B82F6]"
              />
              <span className="text-sm text-[#E5E7EB]">Auto-print receipt after sale</span>
            </label>
          </div>

          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#6B7280]/20">
                <Scan className="w-5 h-5 text-[#9CA3AF]" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-white">Barcode scanner</p>
                <p className="text-sm text-[#9CA3AF]">Hardware wedge or camera</p>
              </div>
              {barcodeSaving && <Loader2 className="w-5 h-5 text-[#3B82F6] animate-spin" />}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleBarcodeMethod('keyboard_wedge')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  barcodeSettings.method === 'keyboard_wedge'
                    ? 'bg-[#3B82F6] text-white'
                    : 'bg-[#374151] text-[#9CA3AF] hover:bg-[#4B5563]'
                }`}
              >
                Keyboard wedge
              </button>
              <button
                onClick={() => handleBarcodeMethod('camera')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  barcodeSettings.method === 'camera'
                    ? 'bg-[#3B82F6] text-white'
                    : 'bg-[#374151] text-[#9CA3AF] hover:bg-[#4B5563]'
                }`}
              >
                Camera
              </button>
            </div>
            <p className="text-xs text-[#6B7280]">
              {barcodeSettings.method === 'keyboard_wedge'
                ? 'Scanner types into focused field like a keyboard.'
                : 'Use device camera to scan barcodes.'}
            </p>
          </div>
        </div>

        {/* Offline / Online mode & Data & Sync */}
        <div className="space-y-2">
          <p className="text-xs text-[#6B7280] font-medium px-1">Offline / Online</p>
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

          <p className="text-xs text-[#6B7280] font-medium px-1 pt-2">Data & Sync</p>
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
        </div>

        <ConnectionDebug
          supabaseUrl={import.meta.env.VITE_SUPABASE_URL || ''}
          companyId={companyId}
          branchId={branch?.id ?? null}
          userEmail={user.email}
        />

        {/* App */}
        <div className="space-y-2">
          <p className="text-xs text-[#6B7280] font-medium px-1">App</p>
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
        </div>

        {hasPin && (
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

      {showCounterPinEnroll && branch?.id && branch.id !== 'all' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#1F2937] border border-[#374151] p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-1">Counter tablet PIN</h3>
            <p className="text-xs text-[#9CA3AF] mb-4">
              Saves this device session for the signed-in user under a separate 4-digit PIN (POS / Expense “Switch user”).
              Each person on this tablet must choose a <span className="text-[#D1D5DB] font-medium">different</span> PIN —
              duplicate codes replace the other user’s slot. Increases token theft risk if the device is lost — use only
              on trusted counter tablets.
            </p>
            {counterPinMsg ? <p className="text-sm text-red-400 mb-3">{counterPinMsg}</p> : null}
            <label className="block text-xs text-[#9CA3AF] mb-1">4-digit PIN</label>
            <input
              value={counterPinA}
              onChange={(e) => setCounterPinA(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="w-full mb-3 rounded-lg bg-[#111827] border border-[#374151] px-3 py-2 text-white"
              inputMode="numeric"
              maxLength={4}
              autoComplete="off"
              placeholder="••••"
            />
            <label className="block text-xs text-[#9CA3AF] mb-1">Confirm PIN</label>
            <input
              value={counterPinB}
              onChange={(e) => setCounterPinB(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="w-full mb-4 rounded-lg bg-[#111827] border border-[#374151] px-3 py-2 text-white"
              inputMode="numeric"
              maxLength={4}
              autoComplete="off"
              placeholder="••••"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCounterPinEnroll(false)}
                className="flex-1 h-11 rounded-xl bg-[#374151] text-white font-medium"
                disabled={counterPinBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={counterPinBusy}
                onClick={() => {
                  void (async () => {
                    setCounterPinMsg(null);
                    if (!/^\d{4}$/.test(counterPinA) || !/^\d{4}$/.test(counterPinB)) {
                      setCounterPinMsg('PIN must be exactly 4 digits.');
                      return;
                    }
                    if (counterPinA !== counterPinB) {
                      setCounterPinMsg('PINs do not match.');
                      return;
                    }
                    setCounterPinBusy(true);
                    const hadNoSlots = counterSlotCount === 0;
                    try {
                      if (!companyId) {
                        setCounterPinMsg('No company selected.');
                        return;
                      }
                      const session = await authApi.getSessionWithRefresh();
                      if (!session?.refreshToken) {
                        setCounterPinMsg('No refresh token in session. Sign in again with email/password.');
                        return;
                      }
                      const profileForVault = await authApi.getProfile(session.userId);
                      const displayNameForVault =
                        profileForVault?.name?.trim() ||
                        user.name?.trim() ||
                        session.email.split('@')[0] ||
                        'User';
                      const existingUid = await getCounterVaultUserIdForPin(counterPinA);
                      if (existingUid && existingUid !== session.userId) {
                        setCounterPinMsg(
                          'This 4-digit PIN is already used on this tablet by another login. Pick a different PIN for each person.',
                        );
                        return;
                      }
                      await saveCounterUserForPin(counterPinA, {
                        refreshToken: session.refreshToken,
                        userId: session.userId,
                        companyId,
                        branchId: branch.id,
                        email: session.email,
                        savedAt: Date.now(),
                        displayName: displayNameForVault,
                        publicUsersId: user.profileId,
                        role: user.role,
                      });
                      setShowCounterPinEnroll(false);
                      setCounterPinA('');
                      setCounterPinB('');
                      void countCounterUsers().then((n) => {
                        setCounterSlotCount(n);
                        if (hadNoSlots && n > 0) {
                          setSharedCounterModeEnabled(true);
                          setSharedCounterMode(true);
                        }
                      });
                      setSyncResult('Counter PIN saved for this user.');
                    } catch (e) {
                      setCounterPinMsg(e instanceof Error ? e.message : 'Save failed.');
                    } finally {
                      setCounterPinBusy(false);
                    }
                  })();
                }}
                className="flex-1 h-11 rounded-xl bg-emerald-600 text-white font-medium disabled:opacity-50"
              >
                {counterPinBusy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showChangePin && (
        <ChangePinModal
          onClose={() => setShowChangePin(false)}
          onSuccess={() => setHasPin(true)}
        />
      )}
      {showSetPin && (
        <SetPinModal
          onClose={() => setShowSetPin(false)}
          onSuccess={() => setHasPin(true)}
          user={user}
          companyId={companyId}
          branchId={branch?.id ?? null}
        />
      )}
    </div>
  );
}
