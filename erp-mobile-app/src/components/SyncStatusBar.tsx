import { useEffect, useState } from 'react';
import { Wifi, WifiOff, Loader2, AlertCircle } from 'lucide-react';
import type { NetworkStatus } from '../hooks/useNetworkStatus';
import { getUnsyncedCount, hasSyncErrors } from '../lib/offlineStore';

interface SyncStatusBarProps {
  status: NetworkStatus;
  onSyncClick?: () => void;
}

export function SyncStatusBar({ status, onSyncClick }: SyncStatusBarProps) {
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [hasErrors, setHasErrors] = useState(false);

  useEffect(() => {
    let mounted = true;
    const update = () => {
      getUnsyncedCount().then((n) => { if (mounted) setUnsyncedCount(n); });
      hasSyncErrors().then((b) => { if (mounted) setHasErrors(b); });
    };
    update();
    const t = setInterval(update, 5000);
    return () => { mounted = false; clearInterval(t); };
  }, [status]);

  const label =
    status === 'offline'
      ? 'Offline'
      : status === 'syncing'
        ? 'Syncing...'
        : status === 'sync_error' || hasErrors
          ? 'Sync Error'
          : unsyncedCount > 0
            ? `${unsyncedCount} pending`
            : 'Online';

  const color =
    status === 'offline'
      ? 'text-amber-400'
      : status === 'sync_error' || hasErrors
        ? 'text-red-400'
        : status === 'syncing'
          ? 'text-blue-400'
          : 'text-emerald-400';

  const Icon =
    status === 'offline'
      ? WifiOff
      : status === 'syncing'
        ? Loader2
        : status === 'sync_error' || hasErrors
          ? AlertCircle
          : Wifi;

  return (
    <button
      type="button"
      onClick={onSyncClick}
      className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${color} bg-[#1F2937]/80`}
      title={status === 'offline' ? 'No connection' : hasErrors ? 'Some items failed to sync' : 'Connection status'}
    >
      {status === 'syncing' ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Icon className="w-3.5 h-3.5" />
      )}
      <span>{label}</span>
    </button>
  );
}
