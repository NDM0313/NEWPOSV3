import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Trash2, Wrench, Eye, EyeOff } from 'lucide-react';
import {
  clearClientCaches,
  isDeveloperModeUnlocked,
  isVerboseApiErrorsEnabled,
  setDeveloperModeUnlocked,
  setVerboseApiErrorsEnabled,
  subscribeDeveloperMode,
} from '../../lib/developerMode';
import { getUnsynced, getOfflineQueueMetrics, type PendingRecord } from '../../lib/offlineStore';
import { subscribeNetworkConnectivity } from '../../lib/networkBridge';
import { MobileDebugLogSection } from './MobileDebugLogSection';

const LAST_AUTOSYNC_KEY = 'erp_mobile_last_autosync_at';

export function DeveloperToolsSection() {
  const [visible, setVisible] = useState(() => isDeveloperModeUnlocked());
  const [verbose, setVerbose] = useState(() => isVerboseApiErrorsEnabled());
  const [queue, setQueue] = useState<PendingRecord[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [cacheHint, setCacheHint] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [lastAutosync, setLastAutosync] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LAST_AUTOSYNC_KEY);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    return subscribeDeveloperMode(() => {
      setVisible(isDeveloperModeUnlocked());
      setVerbose(isVerboseApiErrorsEnabled());
    });
  }, []);

  const loadQueue = useCallback(async () => {
    setLoadingQueue(true);
    try {
      const [rows, metrics] = await Promise.all([getUnsynced(), getOfflineQueueMetrics()]);
      setQueue(rows);
      setPendingCount(metrics.pending);
      setErrorCount(metrics.error);
      try {
        setLastAutosync(localStorage.getItem(LAST_AUTOSYNC_KEY));
      } catch {
        setLastAutosync(null);
      }
    } finally {
      setLoadingQueue(false);
    }
  }, []);

  useEffect(() => {
    if (visible) void loadQueue();
  }, [visible, loadQueue]);

  useEffect(() => {
    if (!visible) return;
    const onRefresh = () => void loadQueue();
    window.addEventListener('online', onRefresh);
    window.addEventListener('offline', onRefresh);
    window.addEventListener('erp-mobile:autosync-complete', onRefresh);
    const unsubNet = subscribeNetworkConnectivity(() => void loadQueue());
    const t = window.setInterval(() => void loadQueue(), 5000);
    return () => {
      window.removeEventListener('online', onRefresh);
      window.removeEventListener('offline', onRefresh);
      window.removeEventListener('erp-mobile:autosync-complete', onRefresh);
      unsubNet();
      window.clearInterval(t);
    };
  }, [visible, loadQueue]);

  const onClearLocal = () => {
    const { removedKeys } = clearClientCaches();
    void loadQueue();
    setCacheHint(`Cleared ${removedKeys} localStorage key(s).`);
    window.setTimeout(() => setCacheHint(null), 4000);
  };

  if (!visible) return null;

  const lastAutosyncLabel = lastAutosync
    ? (() => {
        const n = Number(lastAutosync);
        const d = Number.isFinite(n) ? new Date(n) : new Date(lastAutosync);
        return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
      })()
    : '—';

  return (
    <div className="space-y-2">
      <p className="text-xs text-[#6B7280] font-medium px-1 flex items-center gap-2">
        <Wrench className="w-3.5 h-3.5" />
        Developer Tools
      </p>
      <div className="bg-[#1F2937] border border-amber-900/40 rounded-xl p-4 space-y-4">
        <p className="text-xs text-[#9CA3AF]">
          Local debugging only. Clearing local cache does not remove the offline queue (use Clear offline data above for that).
        </p>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-medium text-white text-sm">Raw API errors</p>
            <p className="text-xs text-[#9CA3AF]">Sync and helpers show full messages when enabled.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={verbose}
            onClick={() => {
              const next = !verbose;
              setVerboseApiErrorsEnabled(next);
              setVerbose(next);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
              verbose ? 'bg-amber-600/30 text-amber-200' : 'bg-[#374151] text-[#9CA3AF]'
            }`}
          >
            {verbose ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {verbose ? 'On' : 'Off'}
          </button>
        </div>

        <div>
          <button
            type="button"
            onClick={() => {
              onClearLocal();
            }}
            className="inline-flex items-center gap-2 px-3 py-2 bg-[#374151] text-white rounded-lg text-sm hover:bg-[#4B5563]"
          >
            <Trash2 className="w-4 h-4" />
            Clear local cache
          </button>
          <p className="text-xs text-[#6B7280] mt-1">Keeps login (Supabase session keys) and developer flags.</p>
          {cacheHint ? <p className="text-xs text-emerald-400 mt-1">{cacheHint}</p> : null}
        </div>

        <MobileDebugLogSection />

        <div className="border-t border-[#374151] pt-3">
          <div className="flex items-center justify-between mb-2">
            <p className="font-medium text-white text-sm">Offline sync queue</p>
            <button
              type="button"
              onClick={() => void loadQueue()}
              disabled={loadingQueue}
              className="text-[#3B82F6] text-xs flex items-center gap-1 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingQueue ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
          <p className="text-xs text-[#9CA3AF] mb-2">
            Pending: <span className="text-amber-200/90 font-mono">{pendingCount}</span>
            {' · '}
            Errors: <span className="text-red-400 font-mono">{errorCount}</span>
            {' · '}
            Last auto-sync: <span className="text-[#D1D5DB] font-mono">{lastAutosyncLabel}</span>
          </p>
          {queue.length === 0 ? (
            <p className="text-xs text-[#9CA3AF]">No unsynced records.</p>
          ) : (
            <ul className="max-h-40 overflow-y-auto space-y-2 text-xs">
              {queue.map((r) => (
                <li key={r.id} className="bg-[#111827] rounded p-2 font-mono text-[#D1D5DB]">
                  <span className="text-amber-200/90">{r.type}</span> · {r.id.slice(0, 8)}…
                  <br />
                  <span className="text-[#6B7280]">{new Date(r.created_at).toLocaleString()}</span>
                  {r.status ? (
                    <>
                      <br />
                      <span className="text-[#9CA3AF]">status: {r.status}</span>
                    </>
                  ) : null}
                  {r.sync_error ? (
                    <>
                      <br />
                      <span className="text-red-400">{r.sync_error}</span>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={() => setDeveloperModeUnlocked(false)}
          className="text-xs text-[#9CA3AF] underline"
        >
          Hide Developer Tools
        </button>
      </div>
    </div>
  );
}
