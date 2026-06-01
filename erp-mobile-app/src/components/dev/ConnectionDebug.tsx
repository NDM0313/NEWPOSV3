/**
 * Connection info: dev tools flag OR native APK with Developer Mode unlocked (7-tap version).
 */

import { Capacitor } from '@capacitor/core';
import { Database, User, Building2, MapPin } from 'lucide-react';
import { isDeveloperModeUnlocked } from '../../lib/developerMode';
import { getResolvedSupabaseUrl } from '../../lib/supabase';
import { showErpDevTools } from '../../utils/erpDevTools';

interface ConnectionDebugProps {
  supabaseUrl: string;
  companyId: string | null;
  branchId: string | null;
  userEmail: string | null;
}

function shouldShowConnectionDebug(): boolean {
  if (showErpDevTools()) return true;
  return Capacitor.isNativePlatform() && isDeveloperModeUnlocked();
}

export function ConnectionDebug({ supabaseUrl, companyId, branchId, userEmail }: ConnectionDebugProps) {
  if (!shouldShowConnectionDebug()) return null;

  const baked = (import.meta.env.VITE_SUPABASE_URL || supabaseUrl || '').trim();
  const runtime = getResolvedSupabaseUrl().trim();
  const url = runtime || baked;
  const isErpProxy = url.includes('erp.dincouture.pk');
  const isVps = url.includes('supabase.dincouture.pk');

  const label = showErpDevTools()
    ? 'Connection Debug (dev only)'
    : 'Connection Debug (Developer Mode)';

  return (
    <div className="mt-4 p-4 bg-[#1F2937] border border-[#374151] rounded-xl text-left">
      <p className="text-xs font-medium text-[#9CA3AF] mb-2 uppercase tracking-wider">{label}</p>
      <div className="space-y-2 text-sm">
        <div className="flex items-start gap-2">
          <Database className="w-4 h-4 text-[#3B82F6] flex-shrink-0 mt-0.5" />
          <div>
            <span className="text-[#9CA3AF]">Supabase API (runtime):</span>{' '}
            <span className={isErpProxy ? 'text-emerald-400' : isVps ? 'text-amber-400' : 'text-white'}>
              {url || 'Not set'}
            </span>
            {isErpProxy && <span className="ml-1 text-emerald-500 text-xs">✓ ERP proxy</span>}
            {Capacitor.isNativePlatform() && !isErpProxy && (
              <span className="ml-1 text-red-400 text-xs">⚠ native should use erp.dincouture.pk</span>
            )}
          </div>
        </div>
        {baked && baked !== url ? (
          <p className="text-[10px] text-[#6B7280] font-mono pl-6">VITE baked: {baked}</p>
        ) : null}
        <div className="flex items-start gap-2">
          <Building2 className="w-4 h-4 text-[#3B82F6] flex-shrink-0 mt-0.5" />
          <div>
            <span className="text-[#9CA3AF]">Company ID:</span>{' '}
            <span className="text-white">{companyId || '—'}</span>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-[#3B82F6] flex-shrink-0 mt-0.5" />
          <div>
            <span className="text-[#9CA3AF]">Branch ID:</span>{' '}
            <span className="text-white">{branchId || '—'}</span>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <User className="w-4 h-4 text-[#3B82F6] flex-shrink-0 mt-0.5" />
          <div>
            <span className="text-[#9CA3AF]">User email:</span>{' '}
            <span className="text-white">{userEmail || '—'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
