import { useCallback, useEffect, useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Bug, Copy, RefreshCw, Share2, Trash2, Zap } from 'lucide-react';
import { APP_VERSION } from '../../lib/developerMode';
import {
  clearMobileDebugLog,
  getMobileDebugLogEntries,
  getMobileDebugLogText,
  isStorageRelatedEntry,
  lastProductImageDebugFailReason,
  lastProductImageDebugRef,
  subscribeMobileDebugLog,
} from '../../lib/mobileDebugLog';
import { resolveSupabaseApiUrl } from '../../lib/resolveSupabaseApiUrl';
import { getProductImageBlobDisplayUrl } from '../../utils/productImageUpload';

/** Keep in sync with android/app/build.gradle versionCode */
export const APK_BUILD_CODE = 32;

function levelColor(level: string): string {
  if (level === 'error') return 'text-red-400';
  if (level === 'warn') return 'text-amber-300';
  return 'text-[#D1D5DB]';
}

export function MobileDebugLogSection() {
  const [tick, setTick] = useState(0);
  const [storageOnly, setStorageOnly] = useState(true);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => subscribeMobileDebugLog(() => setTick((n) => n + 1)), []);

  const entries = useMemo(() => {
    void tick;
    const all = [...getMobileDebugLogEntries()];
    const filtered = storageOnly ? all.filter(isStorageRelatedEntry) : all;
    return filtered.reverse();
  }, [tick, storageOnly]);

  const apiBase = resolveSupabaseApiUrl(
    String(import.meta.env.VITE_SUPABASE_URL ?? ''),
    { isNativeCapacitor: Capacitor.isNativePlatform(), isDev: Boolean(import.meta.env.DEV) },
  );

  const onClear = () => {
    clearMobileDebugLog();
    setTick((n) => n + 1);
  };

  const onCopy = async () => {
    const text = getMobileDebugLogText(storageOnly);
    const header = `ERP Mobile debug log\nbuild=${APK_BUILD_CODE} version=${APP_VERSION} native=${Capacitor.isNativePlatform()} api=${apiBase}\n\n`;
    try {
      await navigator.clipboard.writeText(header + text);
      setCopyHint('Copied');
    } catch {
      setCopyHint('Copy failed — use Share');
    }
    window.setTimeout(() => setCopyHint(null), 3000);
  };

  const onShare = async () => {
    const text = getMobileDebugLogText(storageOnly);
    const header = `ERP Mobile debug (build ${APK_BUILD_CODE})\nAPI: ${apiBase}\n\n`;
    const body = header + (text || '(no log entries yet)');
    try {
      await Share.share({
        title: 'ERP Mobile debug log',
        text: body.length > 12000 ? body.slice(0, 12000) + '\n…(truncated)' : body,
        dialogTitle: 'Share debug log',
      });
    } catch {
      /* user cancelled */
    }
  };

  const onTestLastImage = useCallback(async () => {
    const ref = lastProductImageDebugRef;
    if (!ref) {
      setCopyHint('Open Products first (loads a thumb)');
      window.setTimeout(() => setCopyHint(null), 3000);
      return;
    }
    setTesting(true);
    try {
      const url = await getProductImageBlobDisplayUrl(ref);
      setCopyHint(url ? 'Test: blob OK' : `Test failed${lastProductImageDebugFailReason ? ` — ${lastProductImageDebugFailReason}` : ''}`);
    } finally {
      setTesting(false);
      setTick((n) => n + 1);
      window.setTimeout(() => setCopyHint(null), 4000);
    }
  }, []);

  return (
    <div className="border-t border-[#374151] pt-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-white text-sm flex items-center gap-2">
          <Bug className="w-4 h-4 text-amber-400" />
          Debug log
          <span className="text-[#6B7280] font-mono text-xs">({entries.length})</span>
        </p>
        <button
          type="button"
          onClick={() => setTick((n) => n + 1)}
          className="text-[#3B82F6] text-xs flex items-center gap-1"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      <p className="text-xs text-[#9CA3AF]">
        Reproduce product photo issue, then read lines below or Share. Build {APK_BUILD_CODE} · {APP_VERSION} ·{' '}
        {Capacitor.isNativePlatform() ? 'native' : 'web'} · API {apiBase.replace(/^https?:\/\//, '')}
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStorageOnly((v) => !v)}
          className={`px-2 py-1 rounded text-xs ${storageOnly ? 'bg-amber-600/30 text-amber-200' : 'bg-[#374151] text-[#9CA3AF]'}`}
        >
          {storageOnly ? 'Storage only' : 'All logs'}
        </button>
        <button
          type="button"
          onClick={() => void onTestLastImage()}
          disabled={testing}
          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-[#374151] text-white disabled:opacity-50"
        >
          <Zap className="w-3.5 h-3.5" />
          Test last image
        </button>
        <button type="button" onClick={onClear} className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-[#374151] text-[#9CA3AF]">
          <Trash2 className="w-3.5 h-3.5" />
          Clear
        </button>
        <button type="button" onClick={() => void onCopy()} className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-[#374151] text-[#9CA3AF]">
          <Copy className="w-3.5 h-3.5" />
          Copy
        </button>
        <button type="button" onClick={() => void onShare()} className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-[#3B82F6]/20 text-[#93C5FD]">
          <Share2 className="w-3.5 h-3.5" />
          Share
        </button>
      </div>

      {copyHint ? <p className="text-xs text-emerald-400">{copyHint}</p> : null}
      {lastProductImageDebugRef ? (
        <p className="text-[10px] text-[#6B7280] font-mono break-all">
          Last ref: {lastProductImageDebugRef.slice(0, 100)}
          {lastProductImageDebugFailReason ? ` · ${lastProductImageDebugFailReason}` : ''}
        </p>
      ) : null}

      <ul className="max-h-52 overflow-y-auto space-y-1 text-[10px] font-mono bg-[#111827] rounded-lg p-2 border border-[#374151]">
        {entries.length === 0 ? (
          <li className="text-[#6B7280]">No entries yet. Open Products or upload a photo.</li>
        ) : (
          entries.map((e) => (
            <li key={e.id} className="border-b border-[#1F2937]/80 pb-1 last:border-0">
              <span className="text-[#6B7280]">{new Date(e.ts).toLocaleTimeString()}</span>{' '}
              <span className={levelColor(e.level)}>[{e.level}]</span>{' '}
              <span className="text-amber-200/80">{e.tag}</span>:{' '}
              <span className="text-[#D1D5DB] break-all">{e.message}</span>
              {e.detail ? <div className="text-[#9CA3AF] pl-2 break-all">{e.detail}</div> : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
