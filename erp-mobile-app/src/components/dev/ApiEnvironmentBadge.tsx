import { getResolvedSupabaseUrl } from '../../lib/supabase';
import { CANONICAL_SUPABASE_API_URL } from '../../lib/resolveSupabaseApiUrl';

/** Live runtime API host so operators can confirm Mini PC vs old VPS. */
export function ApiEnvironmentBadge({ className = '' }: { className?: string }) {
  const url = getResolvedSupabaseUrl().replace(/\/$/, '');
  const ok = /api\.ndmcore\.com/i.test(url) || url === CANONICAL_SUPABASE_API_URL;
  return (
    <div
      className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-mono leading-snug ${
        ok
          ? 'border-emerald-800/60 bg-emerald-950/50 text-emerald-300'
          : 'border-red-800/60 bg-red-950/50 text-red-300'
      } ${className}`}
      data-testid="api-environment-badge"
      title="Runtime Supabase API base used by this app build"
    >
      <span className="text-[#9CA3AF] font-sans text-[10px] uppercase tracking-wide mr-1.5">
        Connected to:
      </span>
      <span className="break-all">{url || '(unset)'}</span>
    </div>
  );
}
