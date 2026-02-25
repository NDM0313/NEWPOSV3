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
} from 'lucide-react';
import type { User, Branch } from '../../types';
import * as authApi from '../../api/auth';
import * as settingsApi from '../../api/settings';
import { runSync } from '../../lib/syncEngine';
import { getUnsyncedCount, clearAllPending } from '../../lib/offlineStore';
import { ChangePinModal } from './ChangePinModal';
import { SetPinModal } from './SetPinModal';
import { ConnectionDebug } from '../dev/ConnectionDebug';

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

  const refreshUnsynced = () => getUnsyncedCount().then(setUnsyncedCount);

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
  }, [companyId]);

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

  const handleRemovePin = async () => {
    if (!window.confirm('Remove PIN? You will need to sign in with email/password next time.')) return;
    await authApi.clearPin();
    await authApi.signOut();
    setHasPin(false);
    onLogout();
  };

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
            title="Din Collection Mobile"
            subtitle="Version 0.1.0"
          />
          <SettingsRow
            icon={Info}
            iconColor="bg-[#6B7280]/20"
            title="About"
            subtitle="ERP for bridal & rental business"
          />
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
