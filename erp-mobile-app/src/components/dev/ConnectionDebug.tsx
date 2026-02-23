/**
 * Dev-only: shows connection info (Supabase URL, Company ID, Branch ID, User email).
 * Only visible when import.meta.env.DEV is true.
 */

import { Database, User, Building2, MapPin } from 'lucide-react';

interface ConnectionDebugProps {
  supabaseUrl: string;
  companyId: string | null;
  branchId: string | null;
  userEmail: string | null;
}

export function ConnectionDebug({ supabaseUrl, companyId, branchId, userEmail }: ConnectionDebugProps) {
  if (!import.meta.env.DEV) return null;

  const url = (import.meta.env.VITE_SUPABASE_URL || supabaseUrl || '').trim();
  const isVps = url.includes('supabase.dincouture.pk');

  return (
    <div className="mt-4 p-4 bg-[#1F2937] border border-[#374151] rounded-xl text-left">
      <p className="text-xs font-medium text-[#9CA3AF] mb-2 uppercase tracking-wider">Connection Debug (dev only)</p>
      <div className="space-y-2 text-sm">
        <div className="flex items-start gap-2">
          <Database className="w-4 h-4 text-[#3B82F6] flex-shrink-0 mt-0.5" />
          <div>
            <span className="text-[#9CA3AF]">Supabase URL:</span>{' '}
            <span className={isVps ? 'text-emerald-400' : 'text-amber-400'}>
              {url || 'Not set'}
            </span>
            {isVps && <span className="ml-1 text-emerald-500 text-xs">✓ VPS</span>}
          </div>
        </div>
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
