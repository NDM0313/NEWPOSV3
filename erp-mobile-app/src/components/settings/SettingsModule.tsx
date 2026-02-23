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
} from 'lucide-react';
import type { User, Branch } from '../../types';
import * as authApi from '../../api/auth';
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

  const refreshUnsynced = () => getUnsyncedCount().then(setUnsyncedCount);

  useEffect(() => {
    authApi.hasPinSet().then(setHasPin);
  }, [showChangePin, showSetPin]);

  useEffect(() => {
    refreshUnsynced();
    const t = setInterval(refreshUnsynced, 5000);
    return () => clearInterval(t);
  }, [syncing, clearing]);

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
      setSyncResult(
        synced > 0 || errors > 0
          ? `Synced: ${synced}, Errors: ${errors}`
          : unsyncedCount === 0
            ? 'Already up to date'
            : 'No pending items'
      );
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

        {/* Data & Sync */}
        <div className="space-y-2">
          <p className="text-xs text-[#6B7280] font-medium px-1">Data & Sync</p>
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
